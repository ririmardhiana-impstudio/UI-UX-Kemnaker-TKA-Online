/** @fileoverview Legacy-regime services (Sisa RPTKA/Notifikasi, Peralihan). */

import { apiGet } from './http.js';

/**
 * Rows {a, b, c, d} = fixture rows + genLegacy(grp, layanan, role).
 * @param {{grp: string, layanan: string, role: string}} params
 */
export function listLegacy(params) {
  return apiGet('/legacy', params);
}
