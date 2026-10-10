/**
 * @fileoverview Akun Simponi: permintaan billing DKPTKA, penerbitan kode,
 * dan konfirmasi pembayaran (NTPN, status Lunas).
 */

import {
  validateSimponiConfirm, validateSimponiIssue,
} from '../contracts/simponi.js';
import { ApiError, apiGet, apiPost } from './http.js';

const path = (id, action = '') =>
  `/simponi-billing/${encodeURIComponent(id)}${action}`;

/** Permintaan billing dari TKA Online (+ kode yang sudah diterbitkan). */
export function listSimponiBilling() {
  return apiGet('/simponi-billing');
}

/** Detail: perhitungan nominal DKPTKA, masa berlaku, integrasi, billing. */
export function getSimponiBilling(id) {
  return apiGet(path(id));
}

/**
 * Terbitkan kode billing DKPTKA.
 * @throws {ApiError} 400 bila pernyataan belum dicentang (tanpa hit network).
 */
export function terbitkanBilling(id, konfirmasi) {
  const { valid, errors } = validateSimponiIssue({ konfirmasi });
  if (!valid) {
    throw new ApiError(400, { code: 'VALIDATION_ERROR',
      message: errors.konfirmasi, field: 'konfirmasi', fields: errors });
  }
  return apiPost(path(id, '/issue'), { konfirmasi });
}

/**
 * Konfirmasi pembayaran DKPTKA (diterima Simponi di luar TKA Online):
 * terbitkan NTPN, status menjadi Lunas.
 * @throws {ApiError} 400 bila form belum valid (tanpa hit network).
 */
export function konfirmasiPembayaran(id, { konfirmasi, bank }) {
  const { valid, errors } = validateSimponiConfirm({ konfirmasi, bank });
  if (!valid) {
    const [field] = Object.keys(errors);
    throw new ApiError(400, { code: 'VALIDATION_ERROR',
      message: errors[field], field, fields: errors });
  }
  return apiPost(path(id, '/confirm-payment'), { konfirmasi, bank });
}
