/** @fileoverview Pencabutan Pengesahan RPTKA per TKA (pemberi kerja). */

import { apiGet, apiPost, apiPut } from './http.js';

export function listPencabutan() {
  return apiGet('/pencabutan');
}

export function getPencabutan(id, role) {
  return apiGet(`/pencabutan/${encodeURIComponent(id)}`, { role });
}

/** Draf (`draft: true`) atau submit ke Verifikator; lihat PencabutanSubmitRequest. */
export function createPencabutan(body) {
  return apiPost('/pencabutan', body);
}

/** Ubah Draf; `draft: false` = submit. */
export function updatePencabutan(id, body) {
  return apiPut(`/pencabutan/${encodeURIComponent(id)}`, body);
}
