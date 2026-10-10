/** @fileoverview Akun Direktur: pencabutan RPTKA (lihat detail + TTE semua). */

import { apiGet, apiPost } from './http.js';

const path = (id) => `/pencabutan-direktur${id
  ? `/${encodeURIComponent(id)}` : ''}`;

/** Pengajuan pencabutan yang sudah lolos Verifikator + Validator. */
export function listPencabutanDirektur() {
  return apiGet(path());
}

/** Detail: isian, dokumen, dokumen Pencabutan (`sk`, null sebelum TTE). */
export function getPencabutanDirektur(id) {
  return apiGet(path(id));
}

/** TTE otomatis semua pencabutan berstatus Menunggu TTE. */
export function tteSemuaPencabutan() {
  return apiPost('/pencabutan-direktur/tte-semua', {});
}
