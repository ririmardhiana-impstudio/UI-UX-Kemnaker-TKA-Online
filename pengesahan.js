/** @fileoverview Pengesahan RPTKA (tahap 2). */

import { apiGet } from './http.js';

/**
 * @param {string} role
 * @param {{hpk: (string|undefined), layanan: (string|undefined)}=} filter
 */
export function listPengesahan(role, filter = {}) {
  return apiGet('/pengesahan', { role, ...filter });
}
