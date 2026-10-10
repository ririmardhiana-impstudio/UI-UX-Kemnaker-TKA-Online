/** @fileoverview Perubahan Pengesahan RPTKA. */

import { apiGet, apiPost } from './http.js';

const path = (id, action = '') =>
  `/perubahan/${encodeURIComponent(id)}${action}`;

/** @param {string} role */
export function listPerubahan(role) {
  return apiGet('/perubahan', { role });
}

/** @param {string} role @param {string} id */
export function getPerubahan(role, id) {
  return apiGet(path(id), { role });
}

/** Create a draft; body per CreatePerubahanRequest. */
export function createPerubahan(body) {
  return apiPost('/perubahan', body);
}

/** Mark a document uploaded; body {role, nama, fileName}. */
export function uploadPerubahanDocument(id, body) {
  return apiPost(path(id, '/documents'), body);
}

/** Submit draft (Proses); body {role, agree: true}. */
export function submitPerubahan(id, body) {
  return apiPost(path(id, '/submit'), body);
}

/** Cancel draft; body {role, alasan}. */
export function cancelPerubahan(id, body) {
  return apiPost(path(id, '/cancel'), body);
}
