/** @fileoverview Active foreign workers (TKA) per employer role. */

import { apiGet } from './http.js';

/** @param {string} role @return {!Promise<!Array<!Object>>} */
export function listTka(role) {
  return apiGet('/tka', { role });
}

/** Lookup TKA by SK barcode (Perubahan "Cari"). */
export function findTkaByBarcode(role, barcode) {
  return apiGet('/tka', { role, barcode });
}
