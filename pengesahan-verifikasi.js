/** @fileoverview Pengesahan RPTKA oleh akun Verifikator (AK-22). */

import { apiGet, apiPost } from './http.js';

const path = (id, action = '') =>
  `/pengesahan-verifikasi/${encodeURIComponent(id)}${action}`;

export function listPengesahanVerifikasi() {
  return apiGet('/pengesahan-verifikasi');
}

/** Detail: isian TKA, dokumen, perhitungan DKPTKA, billing. */
export function getPengesahanVerifikasi(id) {
  return apiGet(path(id));
}

/**
 * Verifikasi. tahap `verifikasi` -> diteruskan ke Validator; `billing` ->
 * kode billing DKPTKA terbit ke Simponi (409 bila status tidak sesuai).
 * @param {string} id
 * @param {string} tahap verifikasi | billing
 */
export function verifyPengesahan(id, tahap) {
  return apiPost(path(id, '/verify'), { tahap });
}

/** Tolak dengan alasan (10–1000 karakter) -> status Perbaikan. */
export function rejectPengesahan(id, tahap, alasan) {
  return apiPost(path(id, '/reject'), { tahap, alasan });
}

/** Pemberi kerja submit ulang setelah Perbaikan. */
export function resubmitPengesahan(id, tahap) {
  return apiPost(path(id, '/resubmit'), { tahap });
}
