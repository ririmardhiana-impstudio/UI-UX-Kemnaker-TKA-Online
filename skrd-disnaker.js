/** @fileoverview Akun Disnaker setempat: tabel Perpanjangan Lintas Kab/Kota + SKRD. */

import { validateSkrdTerbitkan } from '../contracts/skrd.js';
import { ApiError, apiGet, apiPost } from './http.js';

const path = (id, action = '') =>
  `/skrd-disnaker/${encodeURIComponent(id)}${action}`;

/** Perpanjangan Lintas Kab/Kota dalam 1 Provinsi yang sudah divalidasi. */
export function listSkrdDisnaker() {
  return apiGet('/skrd-disnaker');
}

/** Detail: isian TKA, dokumen, perhitungan retribusi, SKRD (bila terbit). */
export function getSkrdDisnaker(id) {
  return apiGet(path(id));
}

/**
 * Terbitkan SKRD -> terkirim dan diterima pemberi kerja.
 * @throws {ApiError} 400 bila konfirmasi belum true (tanpa hit network).
 */
export function terbitkanSkrd(id, konfirmasi) {
  const { valid, errors } = validateSkrdTerbitkan({ konfirmasi });
  if (!valid) {
    throw new ApiError(400, { code: 'VALIDATION_ERROR',
      message: errors.konfirmasi, field: 'konfirmasi', fields: errors });
  }
  return apiPost(path(id, '/terbitkan'), { konfirmasi });
}
