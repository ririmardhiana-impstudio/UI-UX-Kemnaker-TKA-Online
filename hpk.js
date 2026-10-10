/** @fileoverview Permohonan HPK (tahap 1). */

import { apiGet } from './http.js';

/** @param {string} role @param {string=} layanan Optional filter. */
export function listHpk(role, layanan) {
  return apiGet('/hpk', { role, layanan });
}

/** @param {string} role @param {string} id e.g. 'h1' */
export function getHpk(role, id) {
  return apiGet(`/hpk/${encodeURIComponent(id)}`, { role });
}
