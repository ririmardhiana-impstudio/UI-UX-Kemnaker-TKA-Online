/**
 * @fileoverview Pengesahan RPTKA oleh akun Validator (usulan, lembar
 * kebutuhan "Tabel Daftar Pemberi Kerja" RPTKA, VP-01..VP-05): data perusahaan yang
 * sudah berhasil diverifikasi Verifikator, Detail (isian + dokumen +
 * DKPTKA), Verifikasi -> sistem otomatis menerbitkan kode billing DKPTKA
 * (nominal tergantung jenis pemberi kerja dan jenis RPTKA; Simponi di luar
 * lingkup aplikasi) | Tolak (alasan)
 * -> status Perbaikan; pemberi kerja submit ulang langsung ke Validator.
 * Baris = antrian Pengesahan yang sama dengan akun Verifikator
 * (routes/pengesahan-verifikasi.js), tanpa data ganda.
 */

import {
  validatePengesahanValidasiReject,
} from '../../contracts/pengesahan-validasi.js';
import { onValidatorVerified } from './billing-dkptka.js';
import { fail, invalid, list, notFound, ok, route } from '../router.js';
import {
  PENG_STATUS, VALIDATOR_STAGE, VERIF_STAGE, billingStatusOf, detailOf, find as findRow,
  pengRows, rejectBilling,
} from './pengesahan-verifikasi.js';

const TAG = 'Validator RPTKA';
const ACTOR = ['Maya Anggraeni', 'Validator (Kasi/Subkoordinator)',
  '10.12.4.31'];
const NOT_FOUND = 'Permohonan RPTKA yang sudah diverifikasi';
/** Pengajuan yang masih di meja Verifikator: tampil, belum bisa diproses. */
export const STATUS_VERIFIKATOR = 'Menunggu Verifikator';
const TONE = {
  [STATUS_VERIFIKATOR]: 'blue',
  [PENG_STATUS.WAITING]: 'amber', [PENG_STATUS.FIX]: 'red',
  [PENG_STATUS.BILLED]: 'green', [PENG_STATUS.FREE]: 'green',
  [PENG_STATUS.SKRD_WAIT]: 'amber', [PENG_STATUS.SKRD]: 'green',
};

export const PENGESAHAN_VALIDASI_ROUTES = [
  route('GET', '/pengesahan-validasi', ({ store }) =>
    list(inScope(store).map(view)), {
    tag: TAG,
    summary: 'Tabel permohonan RPTKA yang sudah berhasil diverifikasi ' +
      'Verifikator: No HPK, tanggal pengajuan, nomor RPTKA, jenis RPTKA, ' +
      '`status` (Menunggu verifikasi, Perbaikan, Billing terbit, Bebas ' +
      'DKPTKA).',
  }),
  route('GET', '/pengesahan-validasi/:id', ({ params, store }) => {
    const row = find(store, params.id);
    return row ? ok(view(row)) : notFound(NOT_FOUND);
  }, {
    tag: TAG, example: { params: { id: 'q20' } },
    summary: 'Detail isian dan dokumen yang diunggah + perhitungan DKPTKA ' +
      '(`dkptka`: bebas, jumlah TKA, bulan, rupiah) dan `billing`.',
    responses: { 404: 'Permohonan RPTKA tidak ditemukan / belum diverifikasi.' },
  }),
  route('POST', '/pengesahan-validasi/:id/verify', verify, {
    tag: TAG, example: { params: { id: 'q20' } },
    summary: 'Verifikasi: kode billing DKPTKA terbit otomatis (status ' +
      'Billing terbit; masa berlaku 5 hari kerja; pemberi kerja menerima ' +
      'tagihan). Bebas DKPTKA (tanpa billing) bila jenis pemberi kerja / ' +
      'jenis RPTKA dibebaskan: langsung disetujui otomatis, menunggu TTE ' +
      'Direktur. Hanya dari Menunggu verifikasi.',
    responses: { 409: 'Status bukan Menunggu verifikasi (INVALID_STATE).' },
  }),
  route('POST', '/pengesahan-validasi/:id/reject', reject, {
    tag: TAG, request: 'PengesahanValidasiRejectRequest',
    example: { params: { id: 'q20' }, body: {
      alasan: 'Data pengurus belum lengkap; lengkapi lalu submit ulang.' } },
    summary: 'Tolak dengan alasan (10–1000 karakter): status Perbaikan; ' +
      'pemberi kerja memperbaiki lalu submit ulang langsung ke Validator ' +
      '(POST /pengesahan-verifikasi/{id}/resubmit, tahap billing).',
    responses: { 409: 'Status bukan Menunggu verifikasi (INVALID_STATE).' },
  }),
];

/**
 * Status di tabel Validator. Pengajuan pemberi kerja langsung tampil
 * (sinkron): masih di Verifikator = "Menunggu Verifikator" (hanya Detail);
 * di tahap Validator atau sudah ditindaklanjuti (billing terbit / bebas /
 * Perbaikan) = status billing; submit ulang pemberi kerja = Menunggu lagi.
 * null untuk baris yang sudah melewati Validator di rantai Back Office.
 */
function statusOf(row) {
  if (row.tahap === VERIF_STAGE) {
    return STATUS_VERIFIKATOR;
  }
  const status = billingStatusOf(row);
  if (!status || !(row.tahap === VALIDATOR_STAGE || row.billingState)) {
    return null;
  }
  return status === PENG_STATUS.FORWARDED ? PENG_STATUS.WAITING : status;
}

const inScope = (store) => pengRows(store).filter((row) => statusOf(row));

function find(store, id) {
  const row = findRow(store, id);
  return row && statusOf(row) ? row : null;
}

/** Detail as seen by the Validator: status/tone/alasan of the billing table. */
function view(row) {
  const detail = detailOf(row);
  const status = statusOf(row);
  return { ...detail, status, tone: TONE[status],
    alasan: status === PENG_STATUS.FIX ? detail.alasanBilling : '',
    aksi: { verifikasi: status === PENG_STATUS.WAITING } };
}

const stateError = (row) => fail(409, 'INVALID_STATE',
  `Status "${statusOf(row)}" tidak dapat diproses; hanya permohonan ` +
  'Menunggu verifikasi yang dapat diverifikasi atau ditolak.');

function verify({ params, store }) {
  const row = find(store, params.id);
  if (!row) {
    return notFound(NOT_FOUND);
  }
  if (statusOf(row) !== PENG_STATUS.WAITING) {
    return stateError(row);
  }
  onValidatorVerified(store, row, ACTOR);
  return ok(view(row));
}

function reject({ params, body, store }) {
  const result = validatePengesahanValidasiReject(body);
  if (!result.valid) {
    return invalid(result);
  }
  const row = find(store, params.id);
  if (!row) {
    return notFound(NOT_FOUND);
  }
  if (statusOf(row) !== PENG_STATUS.WAITING) {
    return stateError(row);
  }
  rejectBilling(store, row, body.alasan.trim(), ACTOR);
  return ok(view(row));
}
