/**
 * @fileoverview RPTKA life cycle: perpanjangan (cakupan wilayah),
 * keputusan pencabutan oleh Direktur (persetujuan Dirjen), surat
 * keterangan.
 */

import { apiGet, apiPost } from './http.js';

const enc = encodeURIComponent;

/**
 * Submit a perpanjangan; body per PerpanjanganRequest.
 * @param {string} role
 * @param {!Object} body
 * @return {!Promise<{noPermohonan: string, diprosesOleh: string}>}
 */
export function createPerpanjangan(role, body) {
  return apiPost('/perpanjangan', body, { role });
}

/** @param {{status: (string|undefined)}=} filter */
export function listKeputusanPencabutan(filter = {}) {
  return apiGet('/keputusan-pencabutan', filter);
}

/** Direktur proposes a pencabutan; body per PencabutanDirekturRequest. */
export function createKeputusanPencabutan(body) {
  return apiPost('/keputusan-pencabutan', body);
}

/** Dirjen decision; body {decision: setujui|kembalikan, catatan}. */
export function decideKeputusanPencabutan(id, body) {
  return apiPost(`/keputusan-pencabutan/${enc(id)}/decision`, body);
}

/** @param {string} role */
export function listSuratKeterangan(role) {
  return apiGet('/surat-keterangan', { role });
}

/** @param {string} role @param {string} id */
export function getSuratKeterangan(role, id) {
  return apiGet(`/surat-keterangan/${enc(id)}`, { role });
}

/** Request a surat keterangan; body per SuratKeteranganRequest. */
export function createSuratKeterangan(role, body) {
  return apiPost('/surat-keterangan', body, { role });
}

/**
 * Identity + blocker of a pencabutan target, shown before the Direktur
 * confirms a proposal.
 * @param {string} barcode 8-digit Pengesahan RPTKA barcode.
 * @return {!Promise<{nama: string, jabatan: string, pemberiKerja: string,
 *     akhir: ?string, blocker: ?string}>}
 */
export function lookupPencabutanTarget(barcode) {
  return apiGet('/keputusan-pencabutan/target', { barcode });
}
