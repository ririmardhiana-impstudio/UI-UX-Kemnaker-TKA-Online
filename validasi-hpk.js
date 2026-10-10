/** @fileoverview Akun Validator HPK: daftar pemberi kerja + validasi dokumen. */

import { validateValidasiHpk } from '../contracts/validasi-hpk.js';
import { ApiError, apiGet, apiPost } from './http.js';

const path = (id, action = '') =>
  `/validasi-hpk/${encodeURIComponent(id)}${action}`;

/** Pemberi kerja dengan BAP disetujui (Menunggu Divalidasi / Tervalidasi). */
export function listValidasiHpk() {
  return apiGet('/validasi-hpk');
}

/** Detail: data isian, dokumen HPK, BAP, riwayat, aksi tersedia. */
export function getValidasiHpk(id) {
  return apiGet(path(id));
}

/**
 * Validasi kesesuaian isian + dokumen -> Tervalidasi.
 * @throws {ApiError} 400 bila pernyataan belum dicentang (tanpa hit network).
 */
export function validateHpk(id, konfirmasi) {
  const { valid, errors } = validateValidasiHpk({ konfirmasi });
  if (!valid) {
    throw new ApiError(400, { code: 'VALIDATION_ERROR',
      message: errors.konfirmasi, field: 'konfirmasi', fields: errors });
  }
  return apiPost(path(id, '/validate'), { konfirmasi });
}
