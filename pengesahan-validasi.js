/** @fileoverview Pengesahan RPTKA oleh akun Validator (billing DKPTKA). */

import {
  validatePengesahanValidasiReject,
} from '../contracts/pengesahan-validasi.js';
import { ApiError, apiGet, apiPost } from './http.js';

const path = (id, action = '') =>
  `/pengesahan-validasi/${encodeURIComponent(id)}${action}`;

/** Permohonan RPTKA yang sudah diverifikasi Verifikator. */
export function listPengesahanValidasi() {
  return apiGet('/pengesahan-validasi');
}

/** Detail: isian TKA, dokumen, perhitungan DKPTKA, billing. */
export function getPengesahanValidasi(id) {
  return apiGet(path(id));
}

/** Verifikasi: sistem menerbitkan kode billing DKPTKA ke Simponi. */
export function verifyPengesahanValidasi(id) {
  return apiPost(path(id, '/verify'));
}

/**
 * Tolak dengan alasan (10–1000 karakter) -> status Perbaikan.
 * @throws {ApiError} 400 bila alasan tidak valid (tanpa hit network).
 */
export function rejectPengesahanValidasi(id, alasan) {
  const { valid, errors } = validatePengesahanValidasiReject({ alasan });
  if (!valid) {
    throw new ApiError(400, { code: 'VALIDATION_ERROR',
      message: errors.alasan, field: 'alasan', fields: errors });
  }
  return apiPost(path(id, '/reject'), { alasan });
}
