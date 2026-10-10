/**
 * @fileoverview Back office application queue, stage decisions, director
 * TTE, and document annotations (pins).
 */

import { apiDelete, apiGet, apiPost } from './http.js';

/**
 * @param {{tahap: (!Array<string>|undefined), jenis: (string|undefined)}=}
 *     filter tahap = stages of the active back-office role.
 */
export function listAntrian(filter = {}) {
  return apiGet('/antrian', filter);
}

/**
 * Approve (next stage) or return (previous stage / applicant).
 * @param {string} id Antrian id.
 * @param {{decision: string, tahap: string, catatan: (string|undefined),
 *     checklist: (!Array<!Object>|undefined)}} body
 * @return {!Promise<!Object>} Updated row (+ returnedToApplicant, billing:
 *     Simponi code when the Dirjen approves a Pengesahan, else null).
 */
export function decideAntrian(id, body) {
  return apiPost(`/antrian/${encodeURIComponent(id)}/decision`, body);
}

/**
 * Director bulk e-signature (HPK & Pengesahan move to the Dirjen stage).
 * @param {!Array<string>} ids
 * @param {string} passphrase
 * @return {!Promise<{signed: number, ids: !Array<string>,
 *     forwardedToDirjen: number, rows: !Array<!Object>}>}
 */
export function signAntrian(ids, passphrase) {
  return apiPost('/antrian/signatures', { ids, passphrase });
}

/** @param {string} id Antrian id. @return {!Promise<!Array<!Object>>} */
export function listAnnotations(id) {
  return apiGet(`/antrian/${encodeURIComponent(id)}/annotations`);
}

/**
 * @param {string} id Antrian id.
 * @param {{dokumen: string, halaman: number, catatan: string, x: number,
 *     y: number, tahap: string, penulis: (string|undefined)}} body
 * @return {!Promise<!Object>} Created annotation (with nomor).
 */
export function addAnnotation(id, body) {
  return apiPost(`/antrian/${encodeURIComponent(id)}/annotations`, body);
}

/**
 * @param {string} id Antrian id.
 * @param {string} annotationId
 * @param {string} tahap Current stage (optimistic lock).
 * @return {!Promise<{id: string}>}
 */
export function deleteAnnotation(id, annotationId, tahap) {
  return apiDelete(`/antrian/${encodeURIComponent(id)}/annotations/` +
    encodeURIComponent(annotationId), { tahap });
}
