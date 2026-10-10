/** @fileoverview TKA Hotline tickets + dashboard. */

import { apiGet, apiPost } from './http.js';

const path = (no, action = '') => `/tiket/${encodeURIComponent(no)}${action}`;

/** @param {{perusahaan: (string|undefined), status: (string|undefined)}=} f */
export function listTiket(filter = {}) {
  return apiGet('/tiket', filter);
}

/** @param {string} no e.g. 'HT-2609-0418' */
export function getTiket(no) {
  return apiGet(path(no));
}

/** Conversation messages {sender, from, time, text, file?}. */
export function listTiketMessages(no) {
  return apiGet(path(no, '/messages'));
}

/** Create ticket; body per CreateTiketRequest. */
export function createTiket(body) {
  return apiPost('/tiket', body);
}

/** Reply; body {sender: 'pk'|'agen', author, text}. */
export function postTiketMessage(no, body) {
  return apiPost(path(no, '/messages'), body);
}

/** Agent takes a Baru ticket (locks it). */
export function takeTiket(no, agen) {
  return apiPost(path(no, '/take'), { agen });
}

/** Locking agent closes the ticket. */
export function closeTiket(no, agen) {
  return apiPost(path(no, '/close'), { agen });
}

/** Reopen a Selesai ticket (re-locked to agen). */
export function reopenTiket(no, agen) {
  return apiPost(path(no, '/reopen'), { agen });
}

/** Hotline dashboard {kpi, months, perCategory, agents}. */
export function getHotlineStats() {
  return apiGet('/hotline-stats');
}
