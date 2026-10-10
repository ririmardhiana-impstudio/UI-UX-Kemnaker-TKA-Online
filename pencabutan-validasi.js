/**
 * @fileoverview Pencabutan RPTKA per TKA di akun Validator (usulan, lembar
 * kebutuhan "Tabel Daftar Pemberi Kerja", PV-01..PV-05): tabel pengajuan
 * pencabutan yang dibuat pemberi kerja (real time), Detail (isian + dokumen
 * yang diupload), Validasi | Tolak (alasan -> Perbaikan; pemberi kerja
 * memperbaiki lalu submit ulang langsung ke Validator). Baris = pengajuan
 * yang sama dengan akun Verifikator (routes/pengajuan-verifikasi.js).
 */

import {
  PENCABUTAN_JENIS, pencabutanDokumenContoh, validatePengajuanReject,
} from '../../contracts/pengajuan-verifikasi.js';
import { fail, invalid, list, notFound, ok, route } from '../router.js';
import {
  VERIF, audit, detailOf, entries, find as findEntry, notify, setVerif,
} from './pengajuan-verifikasi.js';

const KIND = 'pencabutan';
const TAG = 'Validator Pencabutan';
const ACTOR = ['Maya Anggraeni', 'Validator (Kasi/Subkoordinator)',
  '10.12.4.31'];
const NOT_FOUND = 'Pengajuan pencabutan RPTKA';

/** Status di tabel Validator. */
export const PC = {
  VERIFIKATOR: 'Menunggu Verifikator', VALIDASI: 'Menunggu validasi',
  PERBAIKAN: 'Perbaikan', VALIDATED: 'Tervalidasi',
};
const TONE = { [PC.VERIFIKATOR]: 'blue', [PC.VALIDASI]: 'amber',
  [PC.PERBAIKAN]: 'red', [PC.VALIDATED]: 'green' };

export const PENCABUTAN_VALIDASI_ROUTES = [
  route('GET', '/pencabutan-validasi', ({ store }) =>
    list(entries(KIND, store).map((e) => view(store, e))), {
    tag: TAG,
    summary: 'Tabel pengajuan pencabutan RPTKA per TKA dari pemberi kerja ' +
      '(real time): Menunggu Verifikator, Menunggu validasi, Perbaikan, ' +
      'Tervalidasi.',
  }),
  route('GET', '/pencabutan-validasi/:id', ({ params, store }) => {
    const entry = findEntry(KIND, store, params.id);
    return entry ? ok(view(store, entry)) : notFound(NOT_FOUND);
  }, {
    tag: TAG, example: { params: { id: 'pc1' }, before: [EXAMPLE_SUBMIT()] },
    summary: 'Detail pencabutan: isian dan dokumen yang diupload + aksi ' +
      'validasi yang tersedia.',
    responses: { 404: 'Pengajuan pencabutan tidak ditemukan.' },
  }),
  route('POST', '/pencabutan-validasi/:id/validate', validate, {
    tag: TAG, example: { params: { id: 'pc1' },
      before: [EXAMPLE_SUBMIT(), EXAMPLE_VERIFY()] },
    summary: 'Validasi pencabutan: status Tervalidasi. Hanya dari Menunggu ' +
      'validasi (sudah diverifikasi Verifikator).',
    responses: { 409: 'Status bukan Menunggu validasi (INVALID_STATE).' },
  }),
  route('POST', '/pencabutan-validasi/:id/reject', reject, {
    tag: TAG, request: 'PengajuanRejectRequest',
    example: { params: { id: 'pc1' }, body: {
      alasan: 'Surat pernyataan pemberi kerja belum ditandatangani.' },
    before: [EXAMPLE_SUBMIT(), EXAMPLE_VERIFY()] },
    summary: 'Tolak dengan alasan (10–1000 karakter): status Perbaikan; ' +
      'pemberi kerja memperbaiki lalu submit ulang langsung ke Validator ' +
      '(POST /pencabutan-verifikasi/{id}/resubmit).',
    responses: { 409: 'Status bukan Menunggu validasi (INVALID_STATE).' },
  }),
];

/** Setup contoh OpenAPI: satu pengajuan pencabutan masuk + diverifikasi. */
function EXAMPLE_SUBMIT() {
  return { method: 'POST', path: '/pencabutan', body: {
    role: 'swasta', barcode: '25103377', jenis: PENCABUTAN_JENIS[0],
    alasan: 'TKA telah meninggalkan Indonesia dengan EPO.',
    dokumen: pencabutanDokumenContoh(PENCABUTAN_JENIS[0]) } };
}

function EXAMPLE_VERIFY() {
  return { method: 'POST', path: '/pencabutan-verifikasi/pc1/verify' };
}

function statusOf(item) {
  if (item.verif === VERIF.VALIDATED) {
    return PC.VALIDATED;
  }
  if (item.verif === VERIF.FORWARDED) {
    return PC.VALIDASI;
  }
  return item.verif === VERIF.FIX && item.verifOleh === 'validator'
    ? PC.PERBAIKAN : PC.VERIFIKATOR;
}

/** Detail seperti dilihat Validator: status/alasan milik tabel Validator. */
function view(store, entry) {
  const status = statusOf(entry.item);
  return { ...detailOf(KIND, store, entry), status, tone: TONE[status],
    alasan: status === PC.PERBAIKAN ? entry.item.verifAlasan ?? '' : '',
    aksi: { validasi: status === PC.VALIDASI } };
}

const stateError = (item) => fail(409, 'INVALID_STATE',
  `Status "${statusOf(item)}" tidak dapat diproses; hanya pengajuan ` +
  'Menunggu validasi yang dapat divalidasi atau ditolak.');

function validate({ params, store }) {
  const entry = findEntry(KIND, store, params.id);
  if (!entry) {
    return notFound(NOT_FOUND);
  }
  if (statusOf(entry.item) !== PC.VALIDASI) {
    return stateError(entry.item);
  }
  setVerif(KIND, store, entry, VERIF.VALIDATED);
  audit(KIND, store, 'Validasi', entry, [{ field: 'status',
    sebelum: VERIF.FORWARDED, sesudah: VERIF.VALIDATED }], ACTOR);
  notify(KIND, store, entry, `Pencabutan ${entry.item.noPermohonan} ` +
    'divalidasi', 'Pengajuan pencabutan RPTKA sudah divalidasi; menunggu ' +
    'SK Pencabutan.');
  return ok(view(store, entry));
}

function reject({ params, body, store }) {
  const result = validatePengajuanReject(body);
  if (!result.valid) {
    return invalid(result);
  }
  const entry = findEntry(KIND, store, params.id);
  if (!entry) {
    return notFound(NOT_FOUND);
  }
  if (statusOf(entry.item) !== PC.VALIDASI) {
    return stateError(entry.item);
  }
  entry.item.verifAlasan = body.alasan.trim();
  entry.item.verifOleh = 'validator';
  setVerif(KIND, store, entry, VERIF.FIX);
  audit(KIND, store, 'Kembalikan', entry, [
    { field: 'status', sebelum: VERIF.FORWARDED, sesudah: VERIF.FIX },
    { field: 'alasan', sebelum: '', sesudah: entry.item.verifAlasan }], ACTOR);
  notify(KIND, store, entry, `Pencabutan ${entry.item.noPermohonan} ` +
    'perlu perbaikan', entry.item.verifAlasan);
  return ok(view(store, entry));
}
