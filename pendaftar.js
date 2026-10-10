/** @fileoverview Pendaftar pemberi kerja (verifikasi akun Verifikator). */

import { apiGet, apiPost } from './http.js';

export function listPendaftar() {
  return apiGet('/pendaftar');
}

/**
 * Detail pendaftar: data perusahaan, email admin, operator, dokumen.
 * @param {string} id NPWP, atau slug nama bila tanpa NPWP (Non-OSS).
 */
export function getPendaftar(id) {
  return apiGet(`/pendaftar/${key(id)}`);
}

/**
 * Activate a verified registration (409 when not activatable); the
 * response lists `emailTerkirim` to admin and every operator.
 */
export function activatePendaftar(id) {
  return apiPost(`/pendaftar/${key(id)}/activate`);
}

/** Ask the applicant to fix their data (catatan 10–1000 chars). */
export function requestPendaftarFix(id, catatan) {
  return apiPost(`/pendaftar/${key(id)}/request-fix`, { catatan });
}

/** Re-upload documents after a "Perlu perbaikan" decision (AK-15). */
export function resubmitPendaftar(npwp, documents) {
  return apiPost(`/pendaftar/${key(npwp)}/resubmit`, { documents });
}

/** NPWP with spaces -> digits; ids that already are slugs pass through. */
function key(value) {
  const text = String(value);
  return /^[\d\s]+$/.test(text) ? text.replace(/\D/g, '')
    : encodeURIComponent(text);
}
