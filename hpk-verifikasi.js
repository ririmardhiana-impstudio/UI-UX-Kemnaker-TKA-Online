/** @fileoverview Verifikasi HPK pemberi kerja (akun Verifikator, AK-21). */

import { apiGet, apiPost } from './http.js';

export function listHpkVerifikasi() {
  return apiGet('/hpk-verifikasi');
}

/** Detail HPK: isian formulir + dokumen yang diunggah. */
export function getHpkVerifikasi(id) {
  return apiGet(`/hpk-verifikasi/${encodeURIComponent(id)}`);
}

/**
 * Verifikasi HPK; sistem menempatkan sesi ekspos di kalender (`ekspos`).
 * 409 bila tidak sedang menunggu verifikasi atau kalender penuh.
 */
export function verifyHpk(id) {
  return apiPost(`/hpk-verifikasi/${encodeURIComponent(id)}/verify`);
}

/** Tolak HPK (alasan 10–1000 karakter) -> status "Perbaikan data". */
export function rejectHpk(id, alasan) {
  return apiPost(`/hpk-verifikasi/${encodeURIComponent(id)}/reject`,
    { alasan });
}

/** Pemberi kerja submit ulang setelah perbaikan data. */
export function resubmitHpk(id) {
  return apiPost(`/hpk-verifikasi/${encodeURIComponent(id)}/resubmit`);
}
