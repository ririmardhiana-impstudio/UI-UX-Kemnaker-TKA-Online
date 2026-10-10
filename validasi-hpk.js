/**
 * @fileoverview Akun Validator HPK (usulan, dari lembar kebutuhan "Tabel
 * Daftar Pemberi Kerja"): daftar pemberi kerja yang BAP-nya sudah disetujui
 * (status "Menunggu Divalidasi"), detail (data isian + dokumen HPK) dan
 * `validate` (Verifikasi -> "Tervalidasi"). Baris = pengajuan HPK yang sama
 * dengan portal pemberi kerja (routes/penilaian-kelayakan.js), lintas
 * pemberi kerja.
 */

import { PK_STATUS as S } from '../../contracts/penilaian-kelayakan.js';
import { ROLE_KEYS } from '../../contracts/schema.js';
import {
  VALIDASI_HPK_STATUS, validateValidasiHpk,
} from '../../contracts/validasi-hpk.js';
import { fail, invalid, list, notFound, ok, route } from '../router.js';
import {
  applyTransition, buildFormulir, nextOf, seed,
} from './penilaian-kelayakan.js';
import { appendAudit } from './security.js';

const TAG = 'Validator HPK';
const ACTOR = ['Maya Anggraeni', 'Validator (Kasi/Subkoordinator)',
  '10.12.4.31'];
const EXAMPLE_ID = { params: { id: 'pk5' } };
const NOT_FOUND = 'Pengajuan HPK dengan BAP disetujui';

export const VALIDASI_HPK_ROUTES = [
  route('GET', '/validasi-hpk', ({ store }) =>
    list(entriesOf(store).map((entry) => summary(entry, store))), {
    tag: TAG,
    summary: 'Tabel pemberi kerja yang sudah menyetujui BAP (Menunggu ' +
      'Divalidasi, Tervalidasi), urut tanggal persetujuan BAP.',
  }),
  route('GET', '/validasi-hpk/:id', ({ params, store }) => {
    const entry = find(store, params.id);
    return entry ? ok(detail(entry, store)) : notFound(NOT_FOUND);
  }, {
    tag: TAG, example: EXAMPLE_ID,
    summary: 'Detail HPK: data isian, dokumen HPK, BAP, riwayat, dan aksi ' +
      'validasi yang tersedia.',
    responses: { 404: 'Pengajuan HPK tidak ditemukan / BAP belum disetujui.' },
  }),
  route('POST', '/validasi-hpk/:id/validate', validate, {
    tag: TAG, request: 'ValidasiHpkRequest',
    example: { params: { id: 'pk5' }, body: { konfirmasi: true } },
    summary: 'Verifikasi: isian + dokumen dinyatakan sesuai ketentuan, ' +
      'status Tervalidasi. Hanya dari Menunggu Divalidasi.',
    responses: { 400: 'Pernyataan konfirmasi belum true.',
      409: 'Status bukan Menunggu Divalidasi (INVALID_STATE).' },
  }),
];

/** [{role, item}] of every HPK with an approved BAP in scope, oldest first. */
function entriesOf(store) {
  seed(store);
  return ROLE_KEYS.flatMap((role) => (store.penilaianKelayakan[role] ?? [])
    .map((item) => ({ role, item })))
    .filter(({ item }) => VALIDASI_HPK_STATUS.includes(item.status) &&
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
  };
}

function detail(entry, store) {
  const { item, role } = entry;
  return {
    ...summary(entry, store), bap: item.bap, riwayat: item.riwayat,
    formulir: buildFormulir(item.jenis, store.companies[role], item),
    aksi: { validasi: item.status === S.MENUNGGU_VALIDASI },
  };
}

function validate({ params, body, store }) {
  const entry = find(store, params.id);
  if (!entry) {
    return notFound(NOT_FOUND);
  }
  const result = validateValidasiHpk(body);
  if (!result.valid) {
    return invalid(result);
  }
  const { item, role } = entry;
  const sebelum = item.status;
  if (sebelum !== S.MENUNGGU_VALIDASI || !nextOf(item).includes(S.TERVALIDASI)) {
    return fail(409, 'INVALID_STATE', `Pengajuan berstatus ${sebelum}; ` +
      'hanya HPK berstatus Menunggu Divalidasi yang dapat divalidasi.');
  }
  applyTransition(store, role, item, { status: S.TERVALIDASI,
    catatan: 'Isian dan dokumen permohonan sesuai ketentuan.' }, ACTOR[1]);
  const [pengguna, peran, ip] = ACTOR;
  appendAudit(store, { pengguna, peran, aksi: 'Validasi', modul: 'Permohonan',
    objek: `HPK ${item.noHpk}`,
    perubahan: [{ field: 'status', sebelum, sesudah: item.status }], ip });
  return ok(detail(entry, store));
}
