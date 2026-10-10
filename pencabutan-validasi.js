/** @fileoverview Pencabutan RPTKA per TKA oleh akun Validator. */

import { validatePengajuanReject } from '../contracts/pengajuan-verifikasi.js';
import { ApiError, apiGet, apiPost } from './http.js';

const path = (id, action = '') =>
  `/pencabutan-validasi${id ? `/${encodeURIComponent(id)}` : ''}${action}`;

/** Pengajuan pencabutan dari pemberi kerja (real time). */
export function listPencabutanValidasi() {
  return apiGet(path());
}

/** Detail: isian, dokumen yang diupload, aksi tersedia. */
export function getPencabutanValidasi(id) {
  return apiGet(path(id));
}

/** Validasi -> Tervalidasi (409 bila bukan Menunggu validasi). */
export function validatePencabutan(id) {
  return apiPost(path(id, '/validate'));
}

/**
 * Tolak dengan alasan (10–1000 karakter) -> status Perbaikan.
 * @throws {ApiError} 400 bila alasan tidak valid (tanpa hit network).
 */
export function rejectPencabutanValidasi(id, alasan) {
  const { valid, errors } = validatePengajuanReject({ alasan });
  if (!valid) {
    throw new ApiError(400, { code: 'VALIDATION_ERROR',
      message: errors.alasan, field: 'alasan', fields: errors });
  }
  return apiPost(path(id, '/reject'), { alasan });
}
