/**
 * @fileoverview "Hasil Penilaian dan Kelayakan (HPK)" routes of the
 * employer portal: daftar/detail pengajuan, skema formulir per jenis HPK,
 * simpan Draft, submit, persetujuan BAP and [I] transisi status oleh
 * verifikator/sistem (ekspose terjadwal otomatis). Rules PK-01..PK-10
 * (docs/shared/business-rules.md). Seeded lazily.
 */

import {
  PK_EDITABLE, PK_HASIL_EKSPOSE, PK_JENIS, PK_NEXT, PK_STATUS as S,
  PK_SUMBER_DOKUMEN, PK_SUMBER_ISIAN, PK_TONE, dokumenDefs, fieldDefs,
  hasEkspose, turunanJabatan, validatePenilaianKelayakan, validatePenilaianKelayakanBap,
  validatePenilaianKelayakanSubmit, validatePenilaianKelayakanTransition,
} from '../../contracts/penilaian-kelayakan.js';
import {
  PENILAIAN_KELAYAKAN_FIXTURE, PK_SEQ_SEED,
} from '../fixtures/penilaian-kelayakan.js';
import {
  checkRole, created, fail, invalid, list, notFound, ok, route,
} from '../router.js';
import { pushNotifikasi } from './notifikasi.js';

const TAG = 'Penilaian Kelayakan (HPK)';
const ROLE_QUERY = { role: 'swasta | lembaga | pemerintah (wajib)' };
const DEFAULT_TODAY = '2026-09-30';
const [SLOTS_PER_DAY, SLOT_MINUTES, FIRST_SLOT_HOUR] = [16, 15, 9];
const VERIFIKATOR = 'Verifikator HPK';
const SISTEM = 'Sistem';
const pad = (n, size = 4) => String(n).padStart(size, '0');
const todayIso = (store) => store.todayIso ?? DEFAULT_TODAY;
const EXAMPLE = { role: 'swasta' };

export const PENILAIAN_KELAYAKAN_ROUTES = [
  route('GET', '/penilaian-kelayakan', scoped(listPk), {
    tag: TAG, query: ROLE_QUERY,
    summary: 'Tabel pengajuan HPK (terbaru dulu). Search/sort/pagination ' +
      'dilakukan di klien. Hanya kelompok A/B (403 untuk kelompok C).',
    example: { query: EXAMPLE },
    responses: { 403: 'Kelompok C tidak memakai penilaian kelayakan.' },
  }),
  route('GET', '/penilaian-kelayakan/formulir', scoped(getFormulir), {
    tag: TAG, query: { ...ROLE_QUERY, jenis: 'salah satu dari 7 jenis HPK ' +
      '(wajib)' },
    summary: 'Skema isian + dokumen untuk satu jenis HPK; sumber OSS ' +
      '(read-only) sudah terisi dari data perusahaan.',
    example: { query: { ...EXAMPLE, jenis: PK_JENIS[1] } },
    responses: { 400: 'Jenis HPK tidak dikenal.' },
  }),
  route('GET', '/penilaian-kelayakan/:id', scoped(getPk), {
    tag: TAG, query: ROLE_QUERY,
    summary: 'Detail pengajuan: formulir terisi, riwayat, ekspose, BAP, ' +
      'surat HPK.',
    example: { params: { id: 'pk7' }, query: EXAMPLE },
    responses: { 404: 'Pengajuan HPK tidak ditemukan.' },
  }),
  route('POST', '/penilaian-kelayakan', scoped(createPk), {
    tag: TAG, query: ROLE_QUERY, request: 'PenilaianKelayakanRequest',
    summary: 'Simpan pengajuan HPK sebagai Draft.',
    example: { query: EXAMPLE },
  }),
  route('PUT', '/penilaian-kelayakan/:id', scoped(updatePk), {
    tag: TAG, query: ROLE_QUERY, request: 'PenilaianKelayakanRequest',
    summary: 'Ubah isian (Draft / Ditolak-Perlu Perbaikan). Jenis HPK ' +
      'terkunci setelah pernah disubmit.',
    example: { params: { id: 'pk13' }, query: EXAMPLE },
    responses: { 404: 'Pengajuan HPK tidak ditemukan.',
      409: 'Status tidak mengizinkan perubahan.',
      422: 'Jenis HPK tidak dapat diubah setelah disubmit.' },
  }),
  route('POST', '/penilaian-kelayakan/:id/submit', scoped(submitPk), {
    tag: TAG, query: ROLE_QUERY,
    summary: 'Submit ke verifikator (status Menunggu Verifikasi); semua ' +
      'isian & dokumen wajib lengkap.',
    example: { params: { id: 'pk10' }, query: EXAMPLE },
    responses: { 400: 'Isian / dokumen belum lengkap (fields).',
      409: 'Status tidak mengizinkan submit.' },
  }),
  route('POST', '/penilaian-kelayakan/:id/bap-approval', scoped(approveBap), {
    tag: TAG, query: ROLE_QUERY, request: 'PenilaianKelayakanBapRequest',
    summary: 'Setujui BAP HPK dengan nama + jabatan penyetuju ' +
      '(status Menunggu Divalidasi).',
    example: { params: { id: 'pk6' }, query: EXAMPLE },
    responses: { 409: 'BAP belum tersedia atau sudah disetujui.' },
  }),
  route('POST', '/penilaian-kelayakan/:id/transition', scoped(transitionPk), {
    tag: TAG, query: ROLE_QUERY,
    request: 'PenilaianKelayakanTransitionRequest',
    summary: '[I] Verifikator/sistem memajukan status (ekspose dijadwalkan ' +
      'otomatis; Terjadwal -> Terjadwal = reschedule).',
    example: { params: { id: 'pk12' }, query: EXAMPLE,
      body: { status: S.DALAM } },
    responses: { 409: 'Transisi status tidak diizinkan.' },
  }),
];

/** Wrap a role-scoped handler: 400 unless ?role= is an employer key. */
function scoped(handler) {
  return (req) => {
    const error = checkRole(req.query.role);
    if (error) {
      return error;
    }
    if (!req.store.companies[req.query.role].hpk) {
      return fail(403, 'FORBIDDEN', 'Pemberi kerja kelompok C mengajukan ' +
        'Pengesahan RPTKA tanpa penilaian kelayakan (HPK).');
    }
    seed(req.store);
    return handler(req);
  };
}

export function seed(store) {
  store.penilaianKelayakan ??= structuredClone(PENILAIAN_KELAYAKAN_FIXTURE);
  store.pkSeq ??= { ...PK_SEQ_SEED };
  return store;
}

const rowsOf = (store, role) => store.penilaianKelayakan[role] ?? [];
const find = (store, role, id) => rowsOf(store, role)
  .find((item) => item.id === id) ?? null;

function ossValue(company, kunci) {
  const alamat = [company.jalan, company.kel, company.kec, company.kab,
    company.prov].filter(Boolean).join(', ');
  return { namaPemberiKerja: company.nama, nib: company.nib,
    npwp: company.npwp, alamat: `${alamat} ${company.kodepos ?? ''}`.trim() }[
    kunci];
}

function docState(def, company, upload) {
  if (def.sumber === PK_SUMBER_DOKUMEN.OSS_DATA) {
    return { ...def, status: 'Tersedia di OSS',
      nilai: ossValue(company, def.kunci) };
  }
  if (def.sumber === PK_SUMBER_DOKUMEN.OSS_BERKAS) {
    const prefix = def.kunci === 'npwp' ? 'npwp' : 'akta-pendirian';
    return { ...def, status: 'Tersedia di OSS',
      namaBerkas: `${prefix}-${company.singkat.toLowerCase()}.pdf` };
  }
  return { ...def, status: upload ? 'Terunggah' : 'Belum diunggah',
    namaBerkas: upload?.namaBerkas ?? null,
    ukuranKb: upload?.ukuranKb ?? null,
    berkasId: upload?.berkasId ?? null };
}

/**
 * Nilai isian tersimpan. Pengajuan lama (sebelum daftar jabatan) hanya
 * punya `jabatan` + `jumlahTka`; dipetakan ke satu baris daftar.
 */
function isianValue(item, def) {
  const nilai = item?.isian[def.kunci] ?? null;
  if (def.kunci === 'jabatanTka' && !nilai && item?.isian.jabatan) {
    return [{ nama: item.isian.jabatan,
      jumlahTka: item.isian.jumlahTka ?? 1 }];
  }
  return nilai;
}

export function buildFormulir(jenis, company, item = null) {
  return {
    jenis,
    adaEkspose: hasEkspose(jenis),
    fields: fieldDefs(jenis).map((def) => ({ ...def,
      nilai: def.sumber === PK_SUMBER_ISIAN.OSS
        ? ossValue(company, def.kunci) : isianValue(item, def) })),
    dokumen: dokumenDefs(jenis).map((def) =>
      docState(def, company, item?.dokumen[def.kunci])),
  };
}

const summary = ({ id, noHpk, tanggal, jenis, status, tone }) => ({
  id, noHpk, tanggal, jenis, status, tone,
  bisaDiubah: PK_EDITABLE.includes(status) });

function detail(store, role, item) {
  const bapOpen = Boolean(item.bap && !item.bap.disetujui);
  return {
    ...summary(item),
    jenisTerkunci: item.status !== S.DRAFT,
    adaEkspose: hasEkspose(item.jenis),
    catatan: item.catatan, riwayat: item.riwayat, ekspose: item.ekspose,
    bap: item.bap, bisaSetujuiBap: bapOpen, surat: item.surat,
    transisiTersedia: nextOf(item),
    formulir: buildFormulir(item.jenis, store.companies[role], item),
  };
}

/** Keep only known input keys / upload keys of the jenis. */
function pickBody(body) {
  const isianKeys = fieldDefs(body.jenis)
    .filter((f) => f.sumber === PK_SUMBER_ISIAN.INPUT).map((f) => f.kunci);
  const uploadKeys = dokumenDefs(body.jenis)
    .filter((d) => d.sumber === PK_SUMBER_DOKUMEN.UPLOAD).map((d) => d.kunci);
  const isian = Object.fromEntries(Object.entries(body.isian ?? {})
    .filter(([key]) => isianKeys.includes(key)));
  if (Array.isArray(isian.jabatanTka)) {
    isian.jabatanTka = isian.jabatanTka.map((j) => ({
      nama: String(j.nama).trim(), jumlahTka: j.jumlahTka }));
    Object.assign(isian, turunanJabatan(isian.jabatanTka));
  }
  const dokumen = Object.fromEntries(Object.entries(body.dokumen ?? {})
    .filter(([key]) => uploadKeys.includes(key))
    .map(([key, v]) => [key, { namaBerkas: v.namaBerkas,
      ukuranKb: v.ukuranKb, berkasId: v.berkasId ?? null }]));
  return { isian, dokumen };
}

export function pushRiwayat(store, item, status, oleh, catatan = null) {
  item.riwayat.push({ status, tgl: todayIso(store), oleh, catatan });
}

function listPk({ query, store }) {
  return list(rowsOf(store, query.role).map(summary));
}
function getFormulir({ query, store }) {
  if (!PK_JENIS.includes(query.jenis)) {
    return fail(400, 'VALIDATION_ERROR', 'Jenis HPK tidak dikenal.',
      { field: 'jenis' });
  }
  return ok(buildFormulir(query.jenis, store.companies[query.role]));
}

function getPk({ params, query, store }) {
  const item = find(store, query.role, params.id);
  return item ? ok(detail(store, query.role, item))
    : notFound('Pengajuan HPK');
}

function createPk({ query, body, store }) {
  const result = validatePenilaianKelayakan(body);
  if (!result.valid) {
    return invalid(result);
  }
  store.pkSeq.id += 1;
  const n = store.pkSeq.id;
  const iso = todayIso(store);
  const item = {
    id: `pk${n}`, noHpk: `HPK-${iso.slice(2, 4)}${iso.slice(5, 7)}-${pad(n)}`,
    jenis: body.jenis, status: S.DRAFT, tone: PK_TONE[S.DRAFT],
    tanggal: iso, ...pickBody(body), catatan: null, riwayat: [],
    ekspose: null, bap: null, surat: null,
  };
  pushRiwayat(store, item, S.DRAFT, store.companies[query.role].nama);
  rowsOf(store, query.role).unshift(item);
  return created(detail(store, query.role, item));
}

function updatePk({ params, query, body, store }) {
  const item = find(store, query.role, params.id);
  if (!item) {
    return notFound('Pengajuan HPK');
  }
  if (!PK_EDITABLE.includes(item.status)) {
    return fail(409, 'INVALID_STATE', `Pengajuan berstatus ${item.status} ` +
      'tidak dapat diubah.');
  }
  const result = validatePenilaianKelayakan(body);
  if (!result.valid) {
    return invalid(result);
  }
  if (item.status !== S.DRAFT && body.jenis !== item.jenis) {
    return fail(422, 'PRECONDITION_FAILED', 'Jenis HPK tidak dapat diubah ' +
      'setelah pengajuan disubmit.', { field: 'jenis' });
  }
  Object.assign(item, { jenis: body.jenis, ...pickBody(body) });
  return ok(detail(store, query.role, item));
}

function submitPk({ params, query, store }) {
  const item = find(store, query.role, params.id);
  if (!item) {
    return notFound('Pengajuan HPK');
  }
  if (!PK_EDITABLE.includes(item.status)) {
    return fail(409, 'INVALID_STATE', `Pengajuan berstatus ${item.status} ` +
      'tidak dapat disubmit.');
  }
  const result = validatePenilaianKelayakanSubmit(item);
  if (!result.valid) {
    return invalid(result);
  }
  Object.assign(item, { status: S.MENUNGGU, tone: PK_TONE[S.MENUNGGU],
    catatan: null, ekspose: null, bap: null });
  pushRiwayat(store, item, S.MENUNGGU, store.companies[query.role].nama,
    'Dikirim ke verifikator.');
  return ok(detail(store, query.role, item));
}

function approveBap({ params, query, body, store }) {
  const item = find(store, query.role, params.id);
  if (!item) {
    return notFound('Pengajuan HPK');
  }
  if (!item.bap || item.bap.disetujui) {
    return fail(409, 'INVALID_STATE', item.bap
      ? 'BAP sudah disetujui.' : 'BAP belum tersedia untuk pengajuan ini.');
  }
  const result = validatePenilaianKelayakanBap(body);
  if (!result.valid) {
    return invalid(result);
  }
  Object.assign(item.bap, { disetujui: true, tglSetuju: todayIso(store),
    penyetuju: { nama: body.namaPenyetuju.trim(),
      jabatan: body.jabatanPenyetuju.trim() } });
  Object.assign(item, { status: S.MENUNGGU_VALIDASI,
    tone: PK_TONE[S.MENUNGGU_VALIDASI] });
  pushRiwayat(store, item, S.MENUNGGU_VALIDASI,
    store.companies[query.role].nama,
    `BAP disetujui oleh ${item.bap.penyetuju.nama}.`);
  return ok(detail(store, query.role, item));
}

/** Verifikator transitions that remain allowed for this jenis. */
export function nextOf(item) {
  const stop = !hasEkspose(item.jenis) && item.status === S.TERVERIFIKASI;
  return stop ? [] : PK_NEXT[item.status];
}

/** Next free 15-minute ekspose slot (working days, 09:00-13:00). */
function newSlot(store) {
  store.pkSeq.slot += 1;
  const seq = store.pkSeq.slot;
  const d = new Date(`${todayIso(store)}T00:00:00Z`);
  let left = Math.floor((seq - 1) / SLOTS_PER_DAY);
  for (;;) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (![0, 6].includes(d.getUTCDay())) {
      if (left === 0) {
        break;
      }
      left -= 1;
    }
  }
  const minutes = FIRST_SLOT_HOUR * 60 + ((seq - 1) % SLOTS_PER_DAY) *
    SLOT_MINUTES;
  const clock = (m) => `${pad(Math.floor(m / 60), 2)}:${pad(m % 60, 2)}`;
  return { noAntrian: `A-${pad(seq, 3)}`, tanggal: d.toISOString().slice(0, 10),
    jam: clock(minutes), jamSelesai: clock(minutes + SLOT_MINUTES),
    link: `https://meet.kemnaker.go.id/ekspose-hpk-${pad(seq, 3)}`,
    hasil: null, riwayatJadwal: [] };
}

function makeBap(store, item) {
  return { nomor: `BAP/HPK/${pad(Number(item.id.slice(2)))}/IX/2026`,
    tglBap: todayIso(store), hasil: 'Layak', disetujui: false,
    penyetuju: null, tglSetuju: null };
}

const NOTIF = {
  [S.PERBAIKAN]: ['Pengajuan HPK perlu diperbaiki',
    'Periksa catatan verifikator lalu unggah ulang data atau dokumen.'],
  [S.TERJADWAL]: ['Jadwal ekspose HPK tersedia',
    'Buka detail HPK untuk nomor antrian, tautan, dan QR ekspose.'],
  [S.SELESAI]: ['Ekspose selesai: BAP HPK siap disetujui',
    'Setujui BAP HPK dengan nama dan jabatan penyetuju.'],
  [S.TERVERIFIKASI]: ['HPK terverifikasi: BAP siap disetujui',
    'Setujui BAP HPK dengan nama dan jabatan penyetuju.'],
  [S.TERVALIDASI]: ['HPK tervalidasi',
    'Isian dan dokumen HPK sesuai ketentuan; surat HPK segera diterbitkan.'],
  [S.TERBIT]: ['Surat HPK terbit',
    'Surat Hasil Penilaian Kelayakan dapat dicetak dari detail HPK.'],
};

export function applyTransition(store, role, item, { status, catatan },
  actor = null) {
  const reschedule = item.status === S.TERJADWAL && status === S.TERJADWAL;
  const oleh = actor ?? ([S.TERJADWAL, S.MENUNGGU_JADWAL].includes(status)
    ? SISTEM : VERIFIKATOR);
  if (reschedule) {
    const before = item.ekspose;
    item.ekspose = { ...newSlot(store), hasil: PK_HASIL_EKSPOSE.RESCHEDULE,
      riwayatJadwal: [...before.riwayatJadwal, { noAntrian: before.noAntrian,
        tanggal: before.tanggal, jam: before.jam,
        keterangan: 'Dijadwalkan ulang oleh sistem.' }] };
  } else if (status === S.TERJADWAL) {
    item.ekspose = newSlot(store);
  }
  if (status === S.PERBAIKAN) {
    item.catatan = catatan.trim();
    if (item.ekspose) {
      item.ekspose.hasil = PK_HASIL_EKSPOSE.PERBAIKAN;
    }
  }
  if (status === S.SELESAI) {
    item.ekspose.hasil = PK_HASIL_EKSPOSE.LAYAK;
  }
  if (status === S.SELESAI || (status === S.TERVERIFIKASI &&
      !hasEkspose(item.jenis))) {
    item.bap = makeBap(store, item);
  }
  if (status === S.TERBIT) {
    item.surat = { nomor: `HPK/${pad(Number(item.id.slice(2)))}/IX/2026`,
      terbit: todayIso(store) };
  }
  Object.assign(item, { status, tone: PK_TONE[status] });
  pushRiwayat(store, item, status, oleh, reschedule
    ? 'Jadwal ekspose dibuat ulang otomatis.' : catatan?.trim() || null);
  const [judul, isi] = NOTIF[status] ?? [];
  if (judul) {
    pushNotifikasi(store, role, { judul: `${judul} (${item.noHpk})`, isi,
      kategori: 'Status permohonan',
      tautan: { page: 'hpkHasil', params: { id: item.id } } });
  }
}

function transitionPk({ params, query, body, store }) {
  const result = validatePenilaianKelayakanTransition(body);
  if (!result.valid) {
    return invalid(result);
  }
  const item = find(store, query.role, params.id);
  if (!item) {
    return notFound('Pengajuan HPK');
  }
  if (!nextOf(item).includes(body.status)) {
    return fail(409, 'INVALID_STATE', `Status ${item.status} tidak dapat ` +
      `diubah menjadi ${body.status}.`);
  }
  applyTransition(store, query.role, item, body);
  return ok(detail(store, query.role, item));
}
