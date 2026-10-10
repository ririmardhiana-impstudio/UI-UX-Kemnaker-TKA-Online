/**
 * @fileoverview Form RPTKA (Pengesahan RPTKA, 11 jenis): Nomor HPK aktif,
 * daftar/detail pengajuan, simpan Draf, Submit -> Menunggu Verifikasi
 * (masuk antrian Verifikator, baris pengesahan per TKA, kuota HPK terpakai
 * bila jenis memakai HPK). Rules RP-01..RP-12
 * (docs/shared/business-rules.md). Seeded lazily.
 */

import {
  RPTKA_STATUS as S, RPTKA_TONE, butuhHpk, dokumenTka, dokumenUntuk, jenisDef,
  kegiatanOpsi,  slotTka, validateRptkaDraft, validateRptkaSubmit,
} from '../../contracts/pengesahan-rptka.js';
import {
  PENGESAHAN_RPTKA_FIXTURE, PENGESAHAN_RPTKA_SEQ_SEED,
} from '../fixtures/pengesahan-rptka.js';
import {
  checkRole, created, fail, invalid, list, notFound, ok, route,
} from '../router.js';
import { antrianOf } from './back-office.js';
import {
  ensureRptkaRiwayat, pushRptkaRiwayat, resubmitAntrian,
} from './pengesahan-verifikasi.js';
import { pushNotifikasi } from './notifikasi.js';

const TAG = 'Pengesahan RPTKA (Form RPTKA)';
const ROLE_QUERY = { role: 'swasta | lembaga | pemerintah (wajib)' };
const EXAMPLE = { query: { role: 'swasta' } };
const DEFAULT_TODAY = '2026-09-30';
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli',
  'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const HPK_AKTIF_STEP = 8;
const pad = (n, size = 4) => String(n).padStart(size, '0');

export const PENGESAHAN_RPTKA_ROUTES = [
  route('GET', '/pengesahan-rptka/hpk', scoped(listHpkAktif), {
    tag: TAG, query: ROLE_QUERY,
    summary: 'Nomor HPK milik perusahaan yang masih aktif/berlaku (HPK ' +
      'terbit, belum lewat masa berlaku) + sisa kuota per jabatan. ' +
      'Kelompok C 403 (tanpa HPK).',
    example: EXAMPLE,
    responses: { 403: 'Kelompok C tidak memakai HPK.' },
  }),
  route('GET', '/pengesahan-rptka', scoped(listRptka), {
    tag: TAG, query: { ...ROLE_QUERY, jenis: 'Nama jenis (opsional).' },
    summary: 'Pengajuan Form RPTKA (Draf & Menunggu Verifikasi), terbaru ' +
      'dulu; filter ?jenis=.',
    example: EXAMPLE,
  }),
  route('GET', '/pengesahan-rptka/:id', scoped(getRptka), {
    tag: TAG, query: ROLE_QUERY, summary: 'Detail pengajuan Form RPTKA.',
    example: { params: { id: 'rp1' }, query: EXAMPLE.query },
    responses: { 404: 'Pengajuan tidak ditemukan.' },
  }),
  route('POST', '/pengesahan-rptka', scoped(createRptka), {
    tag: TAG, query: ROLE_QUERY, request: 'PengesahanRptkaRequest',
    summary: 'Simpan Form RPTKA sebagai Draf (hpkId wajib bila jenis ' +
      'memakai HPK).',
    example: EXAMPLE,
    responses: { 404: 'Nomor HPK tidak ditemukan.',
      422: 'Jenis tidak tersedia untuk role ini / HPK tidak aktif.' },
  }),
  route('PUT', '/pengesahan-rptka/:id', scoped(updateRptka), {
    tag: TAG, query: ROLE_QUERY, request: 'PengesahanRptkaRequest',
    summary: 'Ubah Draf (atau revisi dokumen & Data TKA pengajuan yang ' +
      'dikembalikan). Jenis dan Nomor HPK terkunci setelah Draf pertama ' +
      'disimpan.',
    example: { params: { id: 'rp1' }, query: EXAMPLE.query },
    responses: { 404: 'Pengajuan tidak ditemukan.',
      409: 'Hanya Draf yang dapat diubah.',
      422: 'Jenis / Nomor HPK tidak dapat diganti.' },
  }),
  route('POST', '/pengesahan-rptka/:id/resubmit', scoped(resubmitRptka), {
    tag: TAG, query: ROLE_QUERY,
    summary: 'Kirim ulang pengajuan yang dikembalikan Verifikator/Validator ' +
      '(`perluRevisi`) setelah revisi disimpan lewat PUT; kembali ke tahap ' +
      'pemeriksa yang mengembalikan (RP-17).',
    example: { params: { id: 'rp3' }, query: EXAMPLE.query,
      before: [{ method: 'POST', path: '/pengesahan-rptka/rp3/submit',
        query: EXAMPLE.query },
      { method: 'POST', path: '/pengesahan-verifikasi/q-rp3-swasta/reject',
        body: { tahap: 'verifikasi', alasan: 'Dokumen tidak terbaca jelas.' } }] },
    responses: { 400: 'Isian / dokumen belum lengkap (fields).',
      409: 'Pengajuan tidak sedang dikembalikan.' },
  }),
  route('POST', '/pengesahan-rptka/:id/submit', scoped(submitRptka), {
    tag: TAG, query: ROLE_QUERY,
    summary: 'Submit ke Verifikator (Draf -> Menunggu Verifikasi). Semua ' +
      'tab wajib lengkap; kuota HPK terpakai.',
    example: { params: { id: 'rp3' }, query: EXAMPLE.query },
    responses: { 400: 'Isian / dokumen belum lengkap (fields).',
      409: 'Bukan Draf.', 422: 'HPK tidak aktif lagi.' },
  }),
];

/** Wrap a handler: role valid, store seeded. */
function scoped(handler) {
  return (req) => {
    const error = checkRole(req.query.role);
    if (error) {
      return error;
    }
    seed(req.store);
    return handler(req);
  };
}

export function seed(store) {
  store.pengesahanRptka ??= structuredClone(PENGESAHAN_RPTKA_FIXTURE);
  store.pengesahanRptkaSeq ??= PENGESAHAN_RPTKA_SEQ_SEED;
  return store;
}

const rowsOf = (store, role) => store.pengesahanRptka[role] ?? [];
const find = (store, role, id) => rowsOf(store, role)
  .find((r) => r.id === id) ?? null;
const todayIso = (store) => store.todayIso ?? DEFAULT_TODAY;

/** "12 Agustus 2026" -> Date (UTC) | null. */
function parseTanggal(text) {
  const [d, month, y] = String(text).split(' ');
  const m = BULAN.indexOf(month);
  return m < 0 ? null : new Date(Date.UTC(Number(y), m, Number(d)));
}

function formatTanggal(date) {
  return `${date.getUTCDate()} ${BULAN[date.getUTCMonth()]} ` +
    date.getUTCFullYear();
}

/** HPK aktif = terbit <= hari ini <= terbit + jangka waktu terpanjang. */
function hpkInfo(store, hpk) {
  const terbit = parseTanggal(hpk.terbit);
  const today = new Date(`${todayIso(store)}T00:00:00Z`);
  if (hpk.stepIdx < HPK_AKTIF_STEP || !terbit) {
    return null;
  }
  const berlaku = new Date(terbit);
  berlaku.setUTCMonth(berlaku.getUTCMonth() +
    Math.max(...hpk.jabatan.map((j) => j.bulan)));
  if (terbit > today || berlaku < today) {
    return null;
  }
  const jabatan = hpk.jabatan.map((j) => ({ ...j, sisa: j.kuota - j.terisi }));
  const sisaKuota = jabatan.reduce((sum, j) => sum + j.sisa, 0);
  return {
    id: hpk.id, noPermohonan: hpk.noPermohonan, barcode: hpk.barcode,
    layanan: hpk.layanan, terbit: hpk.terbit,
    berlakuSampai: formatTanggal(berlaku), lokasi: hpk.lokasi, jabatan,
    sisaKuota, bisaDipilih: sisaKuota > 0,
  };
}

function findHpkAktif(store, role, id) {
  const hpk = id ? store.hpk[role].find((h) => h.id === id) : null;
  return hpk ? hpkInfo(store, hpk) : null;
}

function listHpkAktif({ query, store }) {
  if (!store.companies[query.role].hpk) {
    return fail(403, 'FORBIDDEN', 'Pemberi kerja kelompok C mengajukan ' +
      'Pengesahan RPTKA tanpa HPK.');
  }
  return list(store.hpk[query.role].map((h) => hpkInfo(store, h))
    .filter(Boolean));
}

function listRptka({ query, store }) {
  const rows = rowsOf(store, query.role)
    .filter((r) => !query.jenis || r.jenis === query.jenis)
    .map((r) => summary(r, nomorRptka(store, query.role, r)));
  return list(rows.sort((a, b) => b.diubah.localeCompare(a.diubah) ||
    b.id.localeCompare(a.id, 'en', { numeric: true })));
}

/** Nomor RPTKA: nomor pengesahan terbit (TTE Direktur), selain itu no. permohonan. */
function nomorRptka(store, role, item) {
  const row = (store.pengesahan[role] ?? []).find((p) =>
    p.rptkaId === item.id && p.pengesahan?.nomor);
  return row?.pengesahan.nomor ?? item.noAjuan ?? null;
}

function summary(r, nomor = null) {
  return { id: r.id, noAjuan: r.noAjuan, hpkId: r.hpkId,
    hpkBarcode: r.hpkBarcode, jenis: r.jenis, kegiatan: r.kegiatan,
    status: r.status, tone: r.tone, diubah: r.diubah,
    diajukan: r.diajukan ?? null, nomorRptka: nomor,
    perluRevisi: r.perluRevisi ?? null,
    jumlahTka: r.jabatan.reduce((n, j) => n + j.jumlahTka, 0),
    // Pengesahan RPTKA asal (pemilih "Nomor RPTKA" pada Perpanjangan,
    // revisi akun pemberi kerja poin 5) — dipakai panel "Riwayat Terkait"
    // (poin 7) di halaman Detail Pengajuan baris asal.
    rptkaAsalId: r.rptkaAsalId ?? null };
}

function getRptka({ params, query, store }) {
  const found = find(store, query.role, params.id);
  if (found) {
    // Pengajuan lama ("existing") yang progres sebelum `pushRptkaRiwayat`
    // ada (RV-11) belum punya riwayat — lengkapi lazy dari tanggal yang
    // memang sudah tersimpan di baris ini (RV-13).
    ensureRptkaRiwayat(store, query.role, found);
  }
  return found ? ok(found) : notFound('Pengajuan Form RPTKA');
}

/** Field yang disimpan dari body (hpkId hanya untuk jenis ber-HPK). */
function normalize(body, hpk) {
  return { jenis: body.jenis ?? null, kegiatan: body.kegiatan ?? null,
    hpkId: hpk?.id ?? null, hpkBarcode: hpk?.barcode ?? null,
    hpkLayanan: hpk?.layanan ?? null, jabatan: body.jabatan ?? [],
    tka: body.tka ?? [], dokumenJabatan: body.dokumenJabatan ?? {},
    dokumenPermohonan: body.dokumenPermohonan ?? {},
    rptkaAsalId: body.rptkaAsalId ?? null };
}

/** Jenis harus tersedia untuk role (RP-11). */
function jenisError(role, body) {
  const jenis = body?.jenis;
  const def = jenisDef(jenis);
  if (def && !def.roles.includes(role)) {
    return fail(422, 'PRECONDITION_FAILED', `Jenis ${jenis} tidak tersedia ` +
      'untuk pemberi kerja ini.', { field: 'jenis' });
  }
  const opsi = kegiatanOpsi(jenis, role);
  return body?.kegiatan && opsi.length && !opsi.includes(body.kegiatan)
    ? fail(422, 'PRECONDITION_FAILED', `Kegiatan ${body.kegiatan} tidak ` +
      'tersedia untuk pemberi kerja ini.', { field: 'kegiatan' }) : null;
}

function createRptka({ query, body, store }) {
  const roleError = jenisError(query.role, body);
  if (roleError) {
    return roleError;
  }
  const hpk = butuhHpk(body?.jenis)
    ? findHpkAktif(store, query.role, body?.hpkId) : null;
  const result = validateRptkaDraft(body, hpk);
  if (!result.valid) {
    return invalid(result);
  }
  if (butuhHpk(body.jenis) && !hpk) {
    return store.hpk[query.role].some((h) => h.id === body.hpkId)
      ? fail(422, 'PRECONDITION_FAILED', 'Nomor HPK tidak aktif atau sudah ' +
        'lewat masa berlaku.', { field: 'hpkId' })
      : notFound('Nomor HPK');
  }
  const seq = store.pengesahanRptkaSeq += 1;
  const iso = todayIso(store);
  const draft = {
    id: `rp${seq}`,
    noAjuan: `RP-${iso.slice(2, 4)}${iso.slice(5, 7)}-${pad(seq)}`,
    ...normalize(body, hpk), status: S.DRAF, tone: RPTKA_TONE[S.DRAF],
    dibuat: iso, diubah: iso, riwayat: [],
  };
  pushRptkaRiwayat(store, draft, S.DRAF, store.companies[query.role].nama);
  rowsOf(store, query.role).unshift(draft);
  return created(draft);
}

function updateRptka({ params, query, body, store }) {
  const item = find(store, query.role, params.id);
  if (!item) {
    return notFound('Pengajuan Form RPTKA');
  }
  if (item.status !== S.DRAF && !item.perluRevisi) {
    return fail(409, 'INVALID_STATE', `Pengajuan berstatus ${item.status}; ` +
      'hanya Draf atau pengajuan yang dikembalikan yang dapat diubah.');
  }
  if (item.perluRevisi) {
    return reviseRptka(store, query.role, item, body);
  }
  const locked = (item.jenis && body?.jenis !== item.jenis)
    ? 'jenis' : ((item.hpkId ?? null) !== (body?.hpkId ?? null) &&
      butuhHpk(item.jenis) ? 'hpkId' : null);
  if (locked) {
    return fail(422, 'PRECONDITION_FAILED', 'Jenis dan Nomor HPK tidak ' +
      'dapat diganti setelah Draf disimpan.', { field: locked });
  }
  const roleError = jenisError(query.role, body);
  if (roleError) {
    return roleError;
  }
  const hpk = findHpkAktif(store, query.role, item.hpkId);
  const result = validateRptkaDraft(body, hpk);
  if (!result.valid) {
    return invalid(result);
  }
  Object.assign(item, normalize(body, hpk ?? (item.hpkId ? {
    id: item.hpkId, barcode: item.hpkBarcode, layanan: item.hpkLayanan }
    : null)), { diubah: todayIso(store) });
  return ok(item);
}

function submitRptka({ params, query, store }) {
  const item = find(store, query.role, params.id);
  if (!item) {
    return notFound('Pengajuan Form RPTKA');
  }
  if (item.status !== S.DRAF) {
    return fail(409, 'INVALID_STATE', `Pengajuan berstatus ${item.status}; ` +
      'hanya Draf yang dapat disubmit.');
  }
  const hpk = findHpkAktif(store, query.role, item.hpkId);
  if (butuhHpk(item.jenis) && !hpk) {
    return fail(422, 'PRECONDITION_FAILED', 'Nomor HPK tidak aktif lagi.',
      { field: 'hpkId' });
  }
  const result = validateRptkaSubmit({ ...item,
    hpkId: item.hpkId ?? undefined }, hpk);
  if (!result.valid) {
    return invalid(result);
  }
  Object.assign(item, { status: S.MENUNGGU, tone: RPTKA_TONE[S.MENUNGGU],
    diubah: todayIso(store), diajukan: todayIso(store) });
  pushRptkaRiwayat(store, item, S.MENUNGGU, store.companies[query.role].nama,
    'Dikirim ke Verifikator.');
  applySubmitEffects(store, query.role, item);
  return ok(item);
}

/**
 * Revisi pengajuan yang dikembalikan: hanya dokumen & Data TKA yang berubah
 * (jenis, kegiatan, HPK, jabatan terkunci; kuota HPK sudah terpakai saat
 * submit awal sehingga tidak dicek ulang).
 */
function reviseRptka(store, role, item, body) {
  const next = { ...body, jenis: item.jenis, kegiatan: item.kegiatan,
    hpkId: item.hpkId ?? undefined, jabatan: item.jabatan };
  const result = validateRptkaDraft(next, null);
  if (!result.valid) {
    return invalid(result);
  }
  Object.assign(item, { tka: next.tka ?? [],
    dokumenJabatan: next.dokumenJabatan ?? {},
    dokumenPermohonan: next.dokumenPermohonan ?? {},
    diubah: todayIso(store) });
  return ok(item);
}

/** Kirim ulang berkas yang dikembalikan Verifikator/Validator (RP-17). */
function resubmitRptka({ params, query, store }) {
  const item = find(store, query.role, params.id);
  if (!item) {
    return notFound('Pengajuan Form RPTKA');
  }
  if (!item.perluRevisi) {
    return fail(409, 'INVALID_STATE', `Pengajuan berstatus ${item.status}; ` +
      'hanya pengajuan yang dikembalikan yang dapat dikirim ulang.');
  }
  // Jabatan terkunci saat revisi & kuota HPK sudah terpakai saat submit awal,
  // jadi cek kuota tidak diulang (hpk = null).
  const result = validateRptkaSubmit({ ...item,
    hpkId: item.hpkId ?? undefined }, null);
  if (!result.valid) {
    return invalid(result);
  }
  const tahap = item.perluRevisi;
  const rowId = `q-${item.id}-${query.role}`;
  const sent = resubmitAntrian({ params: { id: rowId }, body: { tahap },
    store });
  if (sent.status >= 400) {
    return sent;
  }
  item.diubah = todayIso(store);
  const antrian = antrianOf(store).find((q) => q.id === rowId);
  if (antrian) {
    antrian.rptka = detailUntukPemeriksa(item);
  }
  return ok(item);
}

const MIME = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg' };

/**
 * Isian + dokumen asli pengajuan untuk akun Verifikator/Validator/Direktur
 * (dibaca pengesahan-verifikasi detailOf): berkas dirujuk lewat berkasId.
 */
function detailUntukPemeriksa(item) {
  const berkas = (jenis, saved) => ({ jenis, fileName: saved.namaBerkas,
    fileSize: saved.ukuranKb * 1024, berkasId: saved.berkasId ?? null,
    mimeType: MIME[saved.namaBerkas.split('.').pop().toLowerCase()] ??
      'application/pdf' });
  const dokumen = [];
  for (const d of dokumenUntuk(item, 'permohonan', null)) {
    dokumen.push(berkas(d.label, item.dokumenPermohonan[d.kunci]));
  }
  for (const t of item.tka) {
    for (const d of dokumenTka(item, t)) {
      dokumen.push(berkas(`${d.label} — ${t.data.nama}`, t.dokumen[d.kunci]));
    }
  }
  for (const j of item.jabatan) {
    for (const d of dokumenUntuk(item, 'jabatan', j)) {
      dokumen.push(berkas(`${d.label} — ${j.nama}`,
        item.dokumenJabatan[j.nama][d.kunci]));
    }
  }
  return {
    tka: item.tka.map((t) => ({ nama: t.data.nama, negara: t.data.kebangsaan,
      paspor: t.data.nomorPaspor, jabatan: t.jabatan,
      bulan: item.jabatan.find((j) => j.nama === t.jabatan).jangkaWaktuBulan })),
    dokumen,
  };
}

/**
 * Kuota HPK terpakai, baris pengesahan per TKA, antrian, notifikasi.
 * Perpanjangan (`rptkaAsalId` terisi, pemilih Nomor RPTKA poin 5) TIDAK
 * menambah pemakaian kuota — jabatan itu melanjutkan TKA yang sama pada
 * RPTKA asal, kuotanya sudah terpakai sejak pengajuan asal (lihat
 * `validateRptkaJabatan`).
 */
function applySubmitEffects(store, role, item) {
  const hpk = item.hpkId ? store.hpk[role].find((h) => h.id === item.hpkId)
    : null;
  if (!item.rptkaAsalId) {
    for (const j of item.jabatan) {
      const master = hpk?.jabatan.find((h) => h.nama === j.nama);
      if (master) {
        master.terisi += j.jumlahTka;
      }
    }
  }
  const iso = todayIso(store);
  const tgl = formatTanggal(new Date(`${iso}T00:00:00Z`));
  const rows = slotTka(item.jabatan).map((slot, i) => {
    const t = item.tka.find((x) => x.jabatan === slot.jabatan &&
      x.urut === slot.urut);
    const j = item.jabatan.find((x) => x.nama === slot.jabatan);
    return { id: `${item.id}-t${i + 1}`, hpk: item.hpkId, rptkaId: item.id,
      layanan: item.jenis, nama: t.data.nama, negara: t.data.kebangsaan,
      paspor: t.data.nomorPaspor, jabatan: slot.jabatan, jenis: item.jenis,
      bulan: j.jangkaWaktuBulan, tgl, stepIdx: 1, status: S.MENUNGGU,
      tone: 'amber', imigrasi: false,
      // Identitas TKA lengkap (KOLOM_TKA, lihat uploads/Pengesahan
      // RPTKA.txt) — dipakai js/pages/portal/sk-pengesahan-doc.js supaya
      // SK Pengesahan menampilkan tempat/tanggal lahir, alamat, dsb.
      // sungguhan, bukan "—" placeholder (hanya ada untuk pengajuan lewat
      // Form RPTKA; baris seed/demo lama tidak punya field ini).
      identitas: t.data };
  });
  store.pengesahan[role].unshift(...rows);
  const company = store.companies[role];
  antrianOf(store).unshift({
    id: `q-${item.id}-${role}`, no: item.noAjuan, jenis: 'Pengesahan',
    layanan: item.jenis, kegiatan: item.kegiatan ?? null,
    pemohon: company.nama, kategori: company.kategori,
    masuk: `${iso.slice(8)} ${BULAN[Number(iso.slice(5, 7)) - 1].slice(0, 3)} ` +
      iso.slice(0, 4),
    tahap: 'Verifikasi Data dan Upload', sla: '2 hari', tone: 'amber',
    tka: rows.map((r) => r.nama).join(', '),
    rptka: detailUntukPemeriksa(item),
  });
  pushNotifikasi(store, role, {
    judul: `Form RPTKA ${item.noAjuan} terkirim`,
    isi: `${rows.length} TKA diajukan dan menunggu verifikasi Verifikator.`,
    kategori: 'Pengesahan', tautan: { page: 'rptka', params: { id: item.id } },
  });
}
