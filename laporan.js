/** @fileoverview Annual TKA reports. */

import { apiGet, apiPost } from './http.js';

/** Definitions L1–L4. */
export function listLaporanDef() {
  return apiGet('/laporan-def');
}

/** Report status for the active period. @param {string} role */
export function getLaporan(role) {
  return apiGet('/laporan', { role });
}

/** Rows of "Laporan Pelaksanaan Penggunaan TKA". */
export function listLaporanPenggunaan() {
  return apiGet('/laporan-penggunaan');
}

/** Submit period (Draft -> Terkirim); body {role, periode, agree}. */
export function submitLaporan(body) {
  return apiPost('/laporan', body);
}

/** Upload .xlsx preview; body {role, kode, fileName, fileSize, ...}. */
export function uploadLaporan(body) {
  return apiPost('/laporan/uploads', body);
}
