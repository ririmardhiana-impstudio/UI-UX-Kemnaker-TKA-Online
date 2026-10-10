/**
 * @fileoverview Akun Direktur (usulan, lembar kebutuhan "Tabel Daftar
 * Pemberi Kerja" Direktur): daftar pemberi kerja Tervalidasi / HPK Terbit,
 * detail (data isian + dokumen HPK), `terbitkan` (Tervalidasi -> HPK Terbit,
 * dari halaman detail), `tte` (TTE berupa barcode dari halaman utama) dan
 * `tte-semua` (TTE otomatis semua, satu klik). TTE sekaligus menerbitkan HPK
 * yang masih Tervalidasi (status HPK Terbit + nomor surat, langsung tampil di
 * akun pemberi kerja), sehingga kolom TTE menjadi "Sudah di TTE". Baris = pengajuan HPK yang sama
 * dengan portal pemberi kerja (routes/penilaian-kelayakan.js).
 */

import { PK_STATUS as S } from '../../contracts/penilaian-kelayakan.js';
import {
  PENERBITAN_HPK_STATUS, validatePenerbitanHpk,
} from '../../contracts/penerbitan-hpk.js';
import { ROLE_KEYS } from '../../contracts/schema.js';
import { fail, invalid, list, notFound, ok, route } from '../router.js';
import {
  applyTransition, buildFormulir, nextOf, pushRiwayat, seed,
} from './penilaian-kelayakan.js';
import { pushNotifikasi } from './notifikasi.js';
import { appendAudit } from './security.js';

const TAG = 'Direktur HPK';
const ACTOR = ['Direktur PPTKA', 'Direktur PPTKA', '10.12.4.40'];
const NOT_FOUND = 'Pengajuan HPK Tervalidasi / HPK Terbit';
const EXAMPLE_ID = { params: { id: 'pk4' } };
const DEFAULT_TODAY = '2026-09-30';

export const PENERBITAN_HPK_ROUTES = [
  route('GET', '/penerbitan-hpk', ({ store }) =>
    list(entriesOf(store).map((entry) => summary(entry, store))), {
    tag: TAG,
    summary: 'Tabel pemberi kerja Tervalidasi dan HPK Terbit (+ status TTE), ' +
      'urut tanggal persetujuan BAP.',
  }),
  route('GET', '/penerbitan-hpk/:id', ({ params, store }) => {
    const entry = find(store, params.id);
    return entry ? ok(detail(entry, store)) : notFound(NOT_FOUND);
  }, {
    tag: TAG, example: EXAMPLE_ID,
    summary: 'Detail HPK: data isian, dokumen HPK, BAP, riwayat, surat, dan ' +
      'aksi yang tersedia (terbitkan, tte).',
    responses: { 404: 'Pengajuan HPK tidak ditemukan / belum Tervalidasi.' },
  }),
  route('POST', '/penerbitan-hpk/:id/terbitkan', terbitkan, {
    tag: TAG, request: 'PenerbitanHpkRequest',
    example: { params: EXAMPLE_ID.params, body: { konfirmasi: true } },
    summary: 'Terbitkan HPK (halaman detail): status HPK Terbit + nomor ' +
      'surat. Hanya dari Tervalidasi.',
    responses: { 400: 'Pernyataan konfirmasi belum true.',
      409: 'Status bukan Tervalidasi (INVALID_STATE).' },
  }),
  route('POST', '/penerbitan-hpk/tte-semua', tteSemua, {
    tag: TAG, example: { body: {} },
    summary: 'TTE otomatis semua (halaman utama): sistem menjalankan TTE ' +
      'barcode untuk setiap HPK yang belum ber-TTE (Tervalidasi atau HPK ' +
      'Terbit); yang masih Tervalidasi otomatis diterbitkan lebih dulu. ' +
      'Respons: `{jumlah, ids, rows}`.',
    responses: { 409: 'Tidak ada HPK yang menunggu TTE (INVALID_STATE).' },
  }),
  route('POST', '/penerbitan-hpk/:id/tte', tte, {
    tag: TAG, example: { params: { id: 'pk3' }, body: {} },
    summary: 'Sistem menjalankan TTE berupa barcode (halaman utama). HPK ' +
      'yang masih Tervalidasi otomatis diterbitkan lebih dulu (status HPK ' +
      'Terbit, tampil di akun pemberi kerja).',
    responses: { 409: 'TTE sudah dijalankan (INVALID_STATE).' },
  }),
];

/** [{role, item}] of every Tervalidasi / HPK Terbit row, oldest first. */
function entriesOf(store) {
  seed(store);
  return ROLE_KEYS.flatMap((role) => (store.penilaianKelayakan[role] ?? [])
    .map((item) => ({ role, item })))
    .filter(({ item }) => PENERBITAN_HPK_STATUS.includes(item.status) &&
      item.bap?.disetujui)
    .sort((a, b) => `${a.item.bap.tglSetuju} ${a.item.noHpk}`
      .localeCompare(`${b.item.bap.tglSetuju} ${b.item.noHpk}`));
}

const find = (store, id) => entriesOf(store)
  .find(({ item }) => item.id === id) ?? null;

function summary({ role, item }, store) {
  return {
    id: item.id, noHpk: item.noHpk, role, jenis: item.jenis,
    pemohon: store.companies[role].nama,
    jabatan: item.isian.jabatan ?? '—', tanggalAjuan: item.tanggal,
    status: item.status, tone: item.tone,
    bap: { nomor: item.bap.nomor, tglBap: item.bap.tglBap,
      tglSetuju: item.bap.tglSetuju, penyetuju: item.bap.penyetuju },
    surat: item.surat ?? null,
    aksi: aksi(item),
  };
}

const aksi = (item) => ({
  terbitkan: item.status === S.TERVALIDASI,
  tte: !item.surat?.tte,
});

function detail(entry, store) {
  const { item, role } = entry;
  return {
    ...summary(entry, store), bap: item.bap, riwayat: item.riwayat,
    formulir: buildFormulir(item.jenis, store.companies[role], item),
  };
}

const todayIso = (store) => store.todayIso ?? DEFAULT_TODAY;

function audit(store, aksiName, item, perubahan) {
  const [pengguna, peran, ip] = ACTOR;
  appendAudit(store, { pengguna, peran, aksi: aksiName, modul: 'Permohonan',
    objek: `HPK ${item.noHpk}`, perubahan, ip });
}

/** Can this Tervalidasi row be issued as HPK Terbit? */
const canIssue = (item) => item.status === S.TERVALIDASI &&
  nextOf(item).includes(S.TERBIT);

/** Tervalidasi -> HPK Terbit (surat number, riwayat, notifikasi, audit). */
function issue(store, { item, role }) {
  const sebelum = item.status;
  applyTransition(store, role, item, { status: S.TERBIT,
    catatan: 'Surat HPK diterbitkan oleh Direktur.' }, ACTOR[1]);
  item.surat.tte = null;
  audit(store, 'Setujui', item,
    [{ field: 'status', sebelum, sesudah: item.status }]);
}

function terbitkan({ params, body, store }) {
  const entry = find(store, params.id);
  if (!entry) {
    return notFound(NOT_FOUND);
  }
  const result = validatePenerbitanHpk(body);
  if (!result.valid) {
    return invalid(result);
  }
  if (!canIssue(entry.item)) {
    return fail(409, 'INVALID_STATE', `Pengajuan berstatus ` +
      `${entry.item.status}; hanya HPK berstatus Tervalidasi yang dapat ` +
      'diterbitkan.');
  }
  issue(store, entry);
  return ok(detail(entry, store));
}

/** HPK still waiting for TTE (Tervalidasi or HPK Terbit without TTE). */
const pendingTte = ({ item }) => !item.surat?.tte;

/**
 * Run TTE on one HPK (shared by `tte` and `tte-semua`). A Tervalidasi HPK is
 * issued first, so TTE alone makes it HPK Terbit and visible to the employer.
 */
function runTte(store, entry) {
  const { item, role } = entry;
  if (canIssue(item)) {
    issue(store, entry);
  }
  item.surat.tte = { barcode: `TTE-${item.surat.nomor}`,
    tgl: todayIso(store), oleh: ACTOR[0] };
  pushRiwayat(store, item, S.TERBIT, ACTOR[1],
    'TTE barcode dijalankan sistem pada surat HPK.');
  pushNotifikasi(store, role, {
    judul: `Surat HPK bertanda tangan elektronik (${item.noHpk})`,
    isi: 'Surat HPK kini memuat barcode TTE Direktur.',
    kategori: 'Status permohonan',
    tautan: { page: 'hpkHasil', params: { id: item.id } } });
  audit(store, 'Tanda tangan', item,
    [{ field: 'tte', sebelum: null, sesudah: item.surat.tte.barcode }]);
}

function tte({ params, store }) {
  const entry = find(store, params.id);
  if (!entry) {
    return notFound(NOT_FOUND);
  }
  const { item } = entry;
  if (item.surat?.tte) {
    return fail(409, 'INVALID_STATE', 'TTE sudah dijalankan untuk HPK ini.');
  }
  runTte(store, entry);
  return ok(detail(entry, store));
}

function tteSemua({ store }) {
  const pending = entriesOf(store).filter(pendingTte);
  if (!pending.length) {
    return fail(409, 'INVALID_STATE', 'Tidak ada HPK yang menunggu TTE.');
  }
  pending.forEach((entry) => runTte(store, entry));
  return ok({ jumlah: pending.length, ids: pending.map(({ item }) => item.id),
    rows: pending.map((entry) => summary(entry, store)) });
}
