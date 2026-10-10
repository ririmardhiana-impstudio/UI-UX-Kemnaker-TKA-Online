/** @fileoverview Akun Direktur: daftar, detail & TTE Pengesahan RPTKA. */

import { apiGet, apiPost } from './http.js';

const path = (id, action = '') =>
  `/pengesahan-direktur/${encodeURIComponent(id)}${action}`;

/** RPTKA lolos DKPTKA: Menunggu TTE (di atas) dan Sudah di TTE. */
export function listPengesahanDirektur() {
  return apiGet('/pengesahan-direktur');
}

/** Detail: isian, dokumen, DKPTKA, persetujuan, dokumen Pengesahan. */
export function getPengesahanDirektur(id) {
  return apiGet(path(id));
}

/**
 * TTE otomatis semua: tandatangani semua RPTKA berstatus Menunggu TTE di
 * satu menu ('pengesahan' | 'perpanjangan').
 */
export function tteSemuaRptka(menu) {
  return apiPost('/pengesahan-direktur/tte-semua', { menu });
}

/** Tombol TTE: tandatangani Pengesahan RPTKA dan terbitkan ke pemberi kerja. */
export function tteRptka(id) {
  return apiPost(path(id, '/tte'), {});
}
