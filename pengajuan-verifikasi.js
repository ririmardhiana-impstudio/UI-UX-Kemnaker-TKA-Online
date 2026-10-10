/** @fileoverview Pengajuan Perubahan & Pencabutan RPTKA (AK-24). */

import { apiGet, apiPost } from './http.js';

const path = (kind, id, action = '') =>
  `/${kind}-verifikasi${id ? `/${encodeURIComponent(id)}` : ''}${action}`;

/** @param {string} kind perubahan | pencabutan */
export function listPengajuan(kind) {
  return apiGet(path(kind));
}

export function getPengajuan(kind, id) {
  return apiGet(path(kind, id));
}

/** Verifikasi -> diteruskan ke Validator (409 bila bukan menunggu). */
export function verifyPengajuan(kind, id) {
  return apiPost(path(kind, id, '/verify'));
}

/** Tolak dengan alasan (10–1000 karakter) -> status Perbaikan. */
export function rejectPengajuan(kind, id, alasan) {
  return apiPost(path(kind, id, '/reject'), { alasan });
}

/** Pemberi kerja mengajukan ulang setelah Perbaikan. */
export function resubmitPengajuan(kind, id) {
  return apiPost(path(kind, id, '/resubmit'));
}
