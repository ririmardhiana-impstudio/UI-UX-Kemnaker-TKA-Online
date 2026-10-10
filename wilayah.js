/** @fileoverview Region reference (registration address). */

import { apiGet } from './http.js';

/**
 * Children of a region path.
 * @param {{provinsi: (string|undefined), kabupaten: (string|undefined),
 *     kecamatan: (string|undefined)}=} parents
 * @return {!Promise<!Array<{nama: string}>>}
 */
export function listWilayah(parents = {}) {
  return apiGet('/wilayah', parents);
}
