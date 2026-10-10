/**
 * @fileoverview Pengesahan RPTKA oleh akun Verifikator (usulan KAK Modul 5,
 * AK-22) di atas antrian Pengesahan Back Office:
 *   1. `verifikasi` — pengajuan RPTKA yang masuk. Verifikasi -> diteruskan
 *      ke Validator (tahap Pemeriksaan Subkoordinator); Tolak (alasan) ->
 *      status Perbaikan, pemberi kerja memperbaiki lalu submit ulang.
 *   2. `billing` — data yang sudah diverifikasi Verifikator; Verifikasi /
 *      Tolak-nya diproses akun Validator (routes/pengesahan-validasi.js,
 *      VP-04): Verifikasi menerbitkan billing otomatis
 *      (routes/billing-dkptka.js), Tolak lewat rejectBilling di bawah.
 *      Submit ulang pemberi kerja (`resubmit`) tetap di sini.
 */

import {
  validatePengesahanReject, validatePengesahanVerify,
} from '../../contracts/back-office.js';
import { jenisDef } from '../../contracts/pengesahan-rptka.js';
import {
  DKPTKA_BEBAS_KATEGORI, DKPTKA_TARIF, PENGESAHAN_DOKUMEN, PENGESAHAN_ISIAN,
  PENGESAHAN_NO_HPK,
} from '../fixtures/pengesahan-verifikasi.js';
import { fail, invalid, list, notFound, ok, route } from '../router.js';
import { antrianOf } from './back-office.js';
import { appendAudit } from './security.js';

export const VERIF_STAGE = 'Verifikasi Data dan Upload';
export const VALIDATOR_STAGE = 'Pemeriksaan Subkoordinator';
const RETURNED = 'Dikembalikan';
const ACTOR = ['Andika Pratama', 'Verifikator Akun', '10.12.4.12'];
const RPTKA_ID_RE = /^q-(.+)-(swasta|lembaga|pemerintah)$/;
/** Sama dengan routes/pengesahan-rptka.js DEFAULT_TODAY — dipakai `pushRptkaRiwayat`. */
const DEFAULT_TODAY = '2026-09-30';
const todayIso = (store) => store.todayIso ?? DEFAULT_TODAY;

/** Nama perusahaan demo (per role) yang punya akun login portal, supaya
 * billing & notifikasi otomatis bisa dicek end-to-end — baris antrian
 * lain (kebanyakan) mewakili pemberi kerja fiktif tanpa akun, dan jatuh ke
 * fallback `swasta` di `roleOfPemohon()`. */
const ROLE_BY_PEMOHON = {
  'PT Nusantara Baja Presisi': 'swasta',
  'Yayasan Pelayanan Kasih Nusantara': 'lembaga',
  'Kantor Perwakilan Organisasi Kerja Sama Teknik Asia (OKTA)': 'pemerintah',
};

/**
 * Portal role pemilik `store.pengesahan[role]`/`store.billing[role]` untuk
 * baris antrian ini. Sebagian besar pemohon di antrian adalah pemberi kerja
 * fiktif tanpa akun login portal — fallback ke `swasta` (akun demo utama)
 * supaya billing & notifikasi selalu bisa dicek end-to-end.
 */
export function roleOfPemohon(pemohon) {
  if (ROLE_BY_PEMOHON[pemohon]) {
    return ROLE_BY_PEMOHON[pemohon];
  }
  return pemohon?.includes('OKTA') ? 'pemerintah' : 'swasta';
}

/**
 * Baris `store.pengesahan[role]` yang mewakili TKA yang sama dengan baris
 * antrian `row` ini. Permohonan yang diajukan lewat Form RPTKA (baru) selalu
 * bisa ditautkan andal lewat `rptkaId` (`row.id` berbentuk
 * `q-${rptkaId}-${role}`, lihat routes/pengesahan-rptka.js
 * `applySubmitEffects`); baris seed/demo lama (tanpa `rptkaId`) jatuh ke
 * pencocokan nama TKA — hanya berhasil untuk baris yang memang dirancang
 * berpasangan di data.js, bukan hasil generator acak.
 */
export function linkedPengesahanRows(store, row) {
  const direct = RPTKA_ID_RE.exec(row.id);
  if (direct) {
    const [, rptkaId, role] = direct;
    return store.pengesahan[role]?.filter((p) => p.rptkaId === rptkaId) ?? [];
  }
  const role = roleOfPemohon(row.pemohon);
  const names = String(row.tka).split(',').map((n) => n.trim());
  return store.pengesahan[role]?.filter((p) => names.includes(p.nama)) ?? [];
}

/**
 * Pengajuan Form RPTKA (`store.pengesahanRptka[role]`) yang melahirkan baris
 * antrian `row` ini — hanya ada untuk permohonan yang masuk lewat Form RPTKA
 * (lihat `linkedPengesahanRows`), `null` untuk baris seed/demo lama.
 */
function linkedRptkaItem(store, row) {
  const direct = RPTKA_ID_RE.exec(row.id);
  if (!direct) {
    return null;
  }
  const [, rptkaId, role] = direct;
  return store.pengesahanRptka?.[role]?.find((item) => item.id === rptkaId) ??
    null;
}

/** Tahap back office -> status di "Daftar Pengesahan RPTKA" pemberi kerja
 * (store.pengesahan[role], 7 tahap PENG_STEPS). SK disetujui otomatis
 * (`row.persetujuan`) tetap di stepIdx 5 sampai Direktur menjalankan TTE;
 * stepIdx 6 (Terbit, tombol Cetak SK) hanya setelah TTE
 * (`row.pengesahan`, billing-dkptka.js); pengiriman ke Imigrasi
 * (`imigrasi`) belum disimulasikan. `oleh` = aktor yang melakukan transisi
 * ini — dipakai kartu "Riwayat status" (`pushRptkaRiwayat`), BUKAN cuma
 * dekorasi; `row.pemohon` = nama pemberi kerja (sudah ada di baris antrian
 * sejak dibuat, lihat routes/pengesahan-rptka.js `applySubmitEffects`). */
function employerStatusFor(row) {
  if (row.tahap === VERIF_STAGE) {
    return row.sla === RETURNED
      ? { stepIdx: 1, status: 'Verifikasi Data dan Upload tidak disetujui ' +
        '— perbaiki dan ajukan kembali', tone: 'red', oleh: 'Verifikator' }
      : { stepIdx: 1, status: VERIF_STAGE, tone: 'amber', oleh: row.pemohon };
  }
  if (row.pengesahan) {
    const perpanjangan = jenisDef(row.layanan)?.menu === 'perpanjangan';
    return { stepIdx: 6, status: perpanjangan
      ? 'Perpanjangan RPTKA terbit — sudah di-TTE Direktur'
      : 'Pengesahan terbit — sudah di-TTE Direktur',
      tone: 'green', oleh: 'Direktur PPTKA' };
  }
  if (row.persetujuan) {
    return { stepIdx: 5, status: 'Disetujui Direktur — menunggu TTE',
      tone: 'blue', oleh: 'Direktur PPTKA (persetujuan otomatis)' };
  }
  const skrd = isSkrd(row);
  switch (row.billingState) {
    case 'skrd':
      return { stepIdx: 5, status: 'Menunggu SKRD dari Dinas ' +
        'Ketenagakerjaan', tone: 'amber', oleh: 'Validator' };
    case 'perbaikan':
      return { stepIdx: 2, status: 'Pemeriksaan Subkoordinator tidak ' +
        'disetujui — perbaiki dan ajukan kembali', tone: 'red',
        oleh: 'Validator' };
    case 'bebas':
      return { stepIdx: 5, status: 'Persetujuan Direktur', tone: 'blue',
        oleh: 'Validator' };
    case 'terbit':
      return { stepIdx: 5, status: skrd ? 'Menunggu pembayaran SKRD'
        : 'Menunggu pembayaran DKPTKA', tone: 'amber',
      oleh: skrd ? 'Dinas Ketenagakerjaan' : 'Validator' };
    case 'lunas':
      return { stepIdx: 5, status: skrd ? 'SKRD lunas — menunggu persetujuan'
        : 'DKPTKA lunas — menunggu persetujuan', tone: 'green',
      oleh: row.pemohon };
    default:
      return { stepIdx: 2, status: VALIDATOR_STAGE, tone: 'blue',
        oleh: 'Verifikator' };
  }
}

/**
 * Tahap revisi pemberi kerja (Verifikator / Validator mengembalikan berkas)
 * untuk pengajuan Form RPTKA: `perluRevisi` = tahap resubmit ('verifikasi' |
 * 'billing') atau null bila tidak sedang dikembalikan.
 */
function revisiOf(row) {
  if (row.tahap === VERIF_STAGE && row.sla === RETURNED) {
    return { perluRevisi: 'verifikasi', catatanRevisi: row.catatan ?? '' };
  }
  if (row.billingState === 'perbaikan') {
    return { perluRevisi: 'billing', catatanRevisi: row.billingAlasan ?? '' };
  }
  return { perluRevisi: null, catatanRevisi: '' };
}

/**
 * Perbarui `stepIdx`/`status`/`tone` baris `store.pengesahan[role]` yang
 * ditautkan ke `row` supaya "Daftar Pengesahan RPTKA" dan drawer "Riwayat
 * Status Pengesahan" pemberi kerja (keduanya baca field ini langsung, lihat
 * js/pages/portal/hpk.js dan riwayat.js) ikut menampilkan progres
 * Verifikator -> Validator -> billing -> TTE secara nyata, bukan beku di
 * "Menunggu Verifikasi". `billingByName` opsional (dipakai billing-dkptka.js)
 * menautkan `p.billing` sekaligus. Ikut memperbarui `status`/`tone` dan
 * `billing` (daftar id) pada pengajuan Form RPTKA (`store.pengesahanRptka`)
 * yang melahirkan baris ini, kalau ada — supaya halaman "Detail Pengajuan"
 * (js/pages/portal/rptka.js) juga tidak beku di "Menunggu Verifikasi" dan
 * bisa menampilkan tombol Tagihan DKPTKA begitu billing terbit. Kalau
 * `row.pengesahan` ada (sudah di-TTE Direktur, `jalankanTte`),
 * disalin ke `p.pengesahan` juga — `js/pages/portal/sk-pengesahan-doc.js`
 * (tombol "Cetak SK" pemberi kerja) butuh nomor/TTE/QR yang SAMA dengan
 * yang dilihat akun Direktur, bukan dokumen statis lama.
 * @return {!Array} Baris yang ikut disinkronkan (bisa kosong).
 */
/**
 * Catat satu entri "Riwayat status" pada pengajuan Form RPTKA (kartu
 * sisi pemberi kerja, `js/pages/portal/rptka-panels.js` `riwayatCard`) —
 * dipanggil dari `syncEmployerPengesahan` (setiap transisi back office)
 * dan langsung dari routes/pengesahan-rptka.js (Draf, Submit). Tanggal
 * selalu `todayIso(store)` (tanggal simulasi, SAMA dengan `dibuat`/
 * `diajukan`), BUKAN `new Date()` sungguhan — supaya seluruh riwayat satu
 * pengajuan konsisten urut, tidak melompat ke tanggal kalender asli.
 * Tidak mencatat entri duplikat kalau status tidak berubah dari entri
 * terakhir (`syncEmployerPengesahan` bisa dipanggil berkali-kali tanpa
 * transisi nyata, mis. pemanggilan defensif).
 */
export function pushRptkaRiwayat(store, item, status, oleh, catatan = null) {
  item.riwayat ??= [];
  if (item.riwayat.at(-1)?.status === status) {
    return;
  }
  item.riwayat.push({ status, tgl: todayIso(store), oleh, catatan });
}

/**
 * Migrasi lunak untuk pengajuan lama yang sudah progres lewat back office
 * SEBELUM `pushRptkaRiwayat` ada (tersimpan di `localStorage`, "existing"
 * — lihat revisi akun pemberi kerja RV-13): `item.riwayat` kosong karena
 * transisi-transisinya terjadi sebelum kode ini ditambahkan, dan tidak ada
 * transisi BARU yang memicu `syncEmployerPengesahan` lagi untuk pengajuan
 * yang sudah di tahap akhir (mis. sudah Lunas + SK terbit). Dipanggil lazy
 * dari `routes/pengesahan-rptka.js` `getRptka` setiap kali pengajuan tanpa
 * riwayat dibuka — HANYA memakai tanggal yang memang sudah ada di baris
 * (`dibuat`, `diajukan`, `diubah`), tidak menebak tanggal transisi
 * antara (Verifikator/Validator) yang memang tidak tercatat di mana pun
 * untuk data lama ini — gap itu dilewati, bukan diisi tebakan, konsisten
 * dengan prinsip RV-11 (tidak memfabrikasi tanggal). Tidak persisten (GET
 * tidak memicu `persistStore`) — dihitung ulang tiap kali dibuka, murah dan
 * deterministik, jadi tidak masalah.
 */
export function ensureRptkaRiwayat(store, role, item) {
  if (item.riwayat?.length) {
    return;
  }
  const nama = store.companies[role]?.nama ?? 'Pemberi kerja';
  item.riwayat = [{ status: 'Draf', tgl: item.dibuat, oleh: nama,
    catatan: null }];
  if (item.diajukan) {
    item.riwayat.push({ status: 'Menunggu Verifikasi', tgl: item.diajukan,
      oleh: nama, catatan: 'Dikirim ke Verifikator.' });
  }
  const row = antrianOf(store).find((q) => q.id === `q-${item.id}-${role}`);
  if (!row) {
    return;
  }
  const { status, oleh } = employerStatusFor(row);
  if (item.riwayat.at(-1)?.status !== status) {
    item.riwayat.push({ status, tgl: item.diubah, oleh,
      catatan: item.catatanRevisi || null });
  }
}

export function syncEmployerPengesahan(store, row, billingByName = null) {
  const rows = linkedPengesahanRows(store, row);
  const { stepIdx, status, tone, oleh } = employerStatusFor(row);
  for (const p of rows) {
    Object.assign(p, { stepIdx, status, tone });
    if (billingByName?.has(p.nama)) {
      p.billing = billingByName.get(p.nama);
    }
    if (row.pengesahan) {
      p.pengesahan = row.pengesahan;
    }
  }
  const item = linkedRptkaItem(store, row);
  if (item) {
    Object.assign(item, { status, tone }, revisiOf(row));
    const billing = rows.map((p) => p.billing).filter(Boolean);
    if (billing.length) {
      item.billing = billing;
    }
    pushRptkaRiwayat(store, item, status, oleh, item.catatanRevisi || null);
  }
  return rows;
}

export const PENG_STATUS = {
  WAITING: 'Menunggu verifikasi',
  FIX: 'Perbaikan',
  FORWARDED: 'Diteruskan ke Validator',
  BILLED: 'Billing terbit',
  FREE: 'Bebas DKPTKA',
  /** Lintas Kab/Kota: sudah divalidasi, menunggu SKRD Disnaker setempat. */
  SKRD_WAIT: 'Menunggu SKRD',
  SKRD: 'SKRD terbit',
};
const TONE = {
  [PENG_STATUS.SKRD_WAIT]: 'amber',
  [PENG_STATUS.SKRD]: 'green',
  [PENG_STATUS.WAITING]: 'amber', [PENG_STATUS.FIX]: 'red',
  [PENG_STATUS.FORWARDED]: 'blue',
  [PENG_STATUS.BILLED]: 'green',
  [PENG_STATUS.FREE]: 'green',
};

export const PENGESAHAN_VERIFIKASI_ROUTES = [
  route('GET', '/pengesahan-verifikasi', ({ store }) =>
    list(pengRows(store).map(summary)), {
    tag: 'Back Office',
    summary: 'Daftar permohonan RPTKA (akun Verifikator): kolom No HPK, ' +
      'tanggal pengajuan, nomor RPTKA, jenis RPTKA, `status` (tabel 1) ' +
      'dan `statusBilling` (tabel 2, hanya yang sudah diverifikasi).',
  }),
  route('GET', '/pengesahan-verifikasi/:id', getDetail, {
    tag: 'Back Office',
    summary: 'Detail isian dan dokumen yang diunggah + perhitungan ' +
      'DKPTKA (`dkptka`: bebas, jumlah TKA, bulan, rupiah).',
    example: { params: { id: 'q3' } },
    responses: { 404: 'Permohonan RPTKA tidak ditemukan.' },
  }),
  route('POST', '/pengesahan-verifikasi/:id/verify', verify, {
    tag: 'Back Office',
    summary: 'Verifikasi tabel `verifikasi` -> diteruskan ke Validator ' +
      '(tahap `billing` diproses akun Validator: 400).',
    request: 'PengesahanVerifyRequest',
    example: { params: { id: 'q3' }, body: { tahap: 'verifikasi' } },
    responses: { 409: 'Status tidak sesuai tahap (INVALID_STATE).' },
  }),
  route('POST', '/pengesahan-verifikasi/:id/reject', reject, {
    tag: 'Back Office',
    summary: 'Tolak dengan alasan (10–1000 karakter): status Perbaikan; ' +
      'pemberi kerja memperbaiki dan submit ulang.',
    request: 'PengesahanRejectRequest',
    example: { params: { id: 'q15' }, body: { tahap: 'verifikasi',
      alasan: 'Paspor tidak terbaca; unggah ulang pindaian berwarna.' } },
    responses: { 409: 'Status tidak sesuai tahap (INVALID_STATE).' },
  }),
  route('POST', '/pengesahan-verifikasi/:id/resubmit', resubmit, {
    tag: 'Back Office',
    summary: 'Pemberi kerja submit ulang setelah Perbaikan: tabel ' +
      '`verifikasi` kembali Menunggu verifikasi; tabel `billing` langsung ' +
      'ke Validator (tanpa Verifikator). Tanpa audit log.',
    request: 'PengesahanVerifyRequest',
    example: {
      params: { id: 'q3' }, body: { tahap: 'verifikasi' },
      before: [{ method: 'POST', path: '/pengesahan-verifikasi/q3/reject',
        body: { tahap: 'verifikasi',
          alasan: 'Paspor tidak terbaca; unggah ulang.' } }],
    },
    responses: { 409: 'Status bukan Perbaikan.' },
  }),
];

export function pengRows(store) {
  return antrianOf(store).filter((q) => q.jenis === 'Pengesahan');
}

/** Status tabel 1 (verifikasi). */
function statusOf(row) {
  if (row.tahap !== VERIF_STAGE) {
    return PENG_STATUS.FORWARDED;
  }
  return row.sla === RETURNED ? PENG_STATUS.FIX : PENG_STATUS.WAITING;
}

/** Tagihan baris ini berupa SKRD (retribusi daerah) dari Disnaker? */
export const isSkrd = (row) => row.billing?.jenis === 'SKRD';

/** Status tabel 2 (billing); null untuk yang belum diverifikasi. */
export function billingStatusOf(row) {
  if (row.tahap === VERIF_STAGE) {
    return null;
  }
  if (row.billingState === 'skrd') {
    return PENG_STATUS.SKRD_WAIT;
  }
  if (isSkrd(row) && ['terbit', 'lunas'].includes(row.billingState)) {
    return PENG_STATUS.SKRD;
  }
  return {
    terbit: PENG_STATUS.BILLED, lunas: PENG_STATUS.BILLED,
    bebas: PENG_STATUS.FREE,
    perbaikan: PENG_STATUS.FIX, validator: PENG_STATUS.FORWARDED,
  }[row.billingState] ?? PENG_STATUS.WAITING;
}

function noHpkOf(row) {
  if (row.id in PENGESAHAN_NO_HPK) {
    return PENGESAHAN_NO_HPK[row.id];
  }
  return /tanpa HPK|Non DKPTKA/.test(row.layanan) ? '—'
    : `2606${row.no.replace(/\D/g, '').slice(-8).padStart(8, '0')}`;
}

function summary(row) {
  const status = statusOf(row);
  const statusBilling = billingStatusOf(row);
  return {
    id: row.id, noHpk: noHpkOf(row), tanggalPengajuan: row.masuk,
    nomorRptka: row.no, jenisRptka: row.layanan, pemohon: row.pemohon,
    kategori: row.kategori, tka: row.tka,
    status, tone: TONE[status],
    statusBilling, toneBilling: statusBilling ? TONE[statusBilling] : null,
    alasan: status === PENG_STATUS.FIX ? row.catatan ?? '' : '',
    alasanBilling: statusBilling === PENG_STATUS.FIX
      ? row.billingAlasan ?? '' : '',
  };
}

/** Jumlah bulan dari jenis RPTKA (default 12). */
function bulanOf(layanan, fixed) {
  if (fixed) {
    return fixed;
  }
  if (/Jangka Pendek/.test(layanan)) {
    return 3;
  }
  return /Sementara/.test(layanan) ? 4 : 12;
}

/** DKPTKA bergantung pada jenis pemberi kerja dan jenis RPTKA (DK-05). */
export function dkptkaOf(row, jumlahTka, bulan) {
  const bebasKategori = DKPTKA_BEBAS_KATEGORI.includes(row.kategori);
  const bebasJenis = /Non DKPTKA/.test(row.layanan) ||
    row.kegiatan === 'Non-DKPTKA';
  const bebas = bebasKategori || bebasJenis;
  return {
    bebas, alasanBebas: bebasKategori
      ? `Jenis pemberi kerja ${row.kategori} dibebaskan DKPTKA.`
      : bebasJenis ? 'Jenis/kegiatan RPTKA Non DKPTKA dibebaskan DKPTKA.' : '',
    tarif: DKPTKA_TARIF, jumlahTka, bulan,
    rupiah: bebas ? 0 : jumlahTka * bulan * DKPTKA_TARIF,
  };
}

export function detailOf(row) {
  const fixed = PENGESAHAN_ISIAN[row.id] ?? {};
  const names = String(row.tka).split(',').map((n) => n.trim());
  const digits = row.no.replace(/\D/g, '').padStart(8, '0');
  const bulan = bulanOf(row.layanan, fixed.bulan);
  return {
    ...summary(row),
    isian: {
      tka: row.rptka?.tka ?? names.map((nama, i) => ({
        nama, negara: fixed.negara ?? 'Jepang',
        paspor: fixed.paspor ?? `TK${digits.slice(-6)}${i}`,
        jabatan: fixed.jabatan ?? 'Tenaga Ahli', bulan,
      })),
    },
    dokumen: row.rptka?.dokumen ?? PENGESAHAN_DOKUMEN.map((d) => ({
      mimeType: 'application/pdf', ...d })),
    dkptka: dkptkaOf(row, names.length, bulan),
    billing: row.billing ?? null,
  };
}

export function find(store, id) {
  return pengRows(store).find((q) => q.id === id) ?? null;
}

export function audit(store, aksi, row, perubahan, actor = ACTOR) {
  const [pengguna, peran, ip] = actor;
  appendAudit(store, {
    pengguna, peran, aksi, modul: 'Permohonan',
    objek: `Pengesahan ${row.no}`, perubahan, ip,
  });
}

function getDetail({ params, store }) {
  const row = find(store, params.id);
  return row ? ok(detailOf(row)) : notFound('Permohonan RPTKA');
}

function stateError(row, tahap) {
  const current = tahap === 'billing' ? billingStatusOf(row) : statusOf(row);
  return fail(409, 'INVALID_STATE',
    `Status "${current}" tidak dapat diproses pada tahap ${tahap}.`);
}

/** Is the row actionable (Menunggu verifikasi) on this table? */
function isWaiting(row, tahap) {
  return (tahap === 'billing' ? billingStatusOf(row) : statusOf(row)) ===
    PENG_STATUS.WAITING;
}

/** Tahap billing diproses akun Validator (/pengesahan-validasi). */
const billingMoved = () => fail(400, 'VALIDATION_ERROR', 'Tahap billing ' +
  'diproses akun Validator (/pengesahan-validasi).', { field: 'tahap' });

function verify({ params, body, store }) {
  const result = validatePengesahanVerify(body);
  if (!result.valid) {
    return invalid(result);
  }
  if (body.tahap === 'billing') {
    return billingMoved();
  }
  const row = find(store, params.id);
  if (!row) {
    return notFound('Permohonan RPTKA');
  }
  if (!isWaiting(row, body.tahap)) {
    return stateError(row, body.tahap);
  }
  Object.assign(row, { tahap: VALIDATOR_STAGE, sla: '1 hari', tone: 'amber' });
  delete row.catatan;
  audit(store, 'Setujui', row, [{ field: 'tahap', sebelum: VERIF_STAGE,
    sesudah: VALIDATOR_STAGE }]);
  syncEmployerPengesahan(store, row);
  return ok(detailOf(row));
}

/** Tolak di tahap billing: alasan + status Perbaikan (akun Validator). */
export function rejectBilling(store, row, alasan, actor) {
  Object.assign(row, { billingState: 'perbaikan', billingAlasan: alasan });
  audit(store, 'Kembalikan', row, [
    { field: 'status', sebelum: PENG_STATUS.WAITING,
      sesudah: PENG_STATUS.FIX },
    { field: 'alasan', sebelum: '', sesudah: alasan }], actor);
  syncEmployerPengesahan(store, row);
  return detailOf(row);
}

function reject({ params, body, store }) {
  const result = validatePengesahanReject(body);
  if (!result.valid) {
    return invalid(result);
  }
  if (body.tahap === 'billing') {
    return billingMoved();
  }
  const row = find(store, params.id);
  if (!row) {
    return notFound('Permohonan RPTKA');
  }
  if (!isWaiting(row, body.tahap)) {
    return stateError(row, body.tahap);
  }
  const alasan = body.alasan.trim();
  Object.assign(row, { sla: RETURNED, tone: 'red', catatan: alasan });
  audit(store, 'Kembalikan', row, [
    { field: 'status', sebelum: PENG_STATUS.WAITING,
      sesudah: PENG_STATUS.FIX },
    { field: 'alasan', sebelum: '', sesudah: alasan }]);
  syncEmployerPengesahan(store, row);
  return ok(detailOf(row));
}

/** Pemberi kerja mengirim ulang berkas yang dikembalikan (dipakai Form RPTKA). */
export function resubmitAntrian(args) {
  return resubmit(args);
}

function resubmit({ params, body, store }) {
  const result = validatePengesahanVerify(body);
  if (!result.valid) {
    return invalid(result);
  }
  const row = find(store, params.id);
  if (!row) {
    return notFound('Permohonan RPTKA');
  }
  const current = body.tahap === 'billing'
    ? billingStatusOf(row) : statusOf(row);
  if (current !== PENG_STATUS.FIX) {
    return stateError(row, body.tahap);
  }
  if (body.tahap === 'verifikasi') {
    Object.assign(row, { sla: '1 hari', tone: 'blue' });
    delete row.catatan;
  } else {
    // Submit ulang tabel 2 langsung ke Validator, tanpa Verifikator.
    Object.assign(row, { tahap: VALIDATOR_STAGE, billingState: 'validator',
      sla: '1 hari', tone: 'amber' });
    delete row.billingAlasan;
  }
  syncEmployerPengesahan(store, row);
  return ok(detailOf(row));
}
