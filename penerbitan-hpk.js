/** @fileoverview Akun Direktur: daftar pemberi kerja, terbitkan HPK, TTE. */

import { validatePenerbitanHpk } from '../contracts/penerbitan-hpk.js';
import { ApiError, apiGet, apiPost } from './http.js';

const path = (id, action = '') =>
  `/penerbitan-hpk/${encodeURIComponent(id)}${action}`;

/** Pemberi kerja Tervalidasi / HPK Terbit (+ status TTE per baris). */
export function listPenerbitanHpk() {
  return apiGet('/penerbitan-hpk');
}

/** Detail: data isian, dokumen HPK, BAP, riwayat, surat, aksi tersedia. */
export function getPenerbitanHpk(id) {
  return apiGet(path(id));
}

/**
 * Terbitkan surat HPK (Tervalidasi -> HPK Terbit).
 * @throws {ApiError} 400 bila pernyataan belum dicentang (tanpa hit network).
 */
export function terbitkanHpk(id, konfirmasi) {
  const { valid, errors } = validatePenerbitanHpk({ konfirmasi });
  if (!valid) {
    throw new ApiError(400, { code: 'VALIDATION_ERROR',
      message: errors.konfirmasi, field: 'konfirmasi', fields: errors });
  }
  return apiPost(path(id, '/terbitkan'), { konfirmasi });
}

/** TTE otomatis semua: jalankan TTE untuk setiap HPK Terbit yang belum ber-TTE. */
export function jalankanTteSemua() {
  return apiPost('/penerbitan-hpk/tte-semua', {});
}

/** Jalankan TTE (barcode) untuk HPK yang sudah terbit. */
export function jalankanTte(id) {
  return apiPost(path(id, '/tte'), {});
}
