/** @fileoverview Analitik penggunaan TKA (KAK Modul 6). */

import { apiGet, apiPost } from './http.js';

/** Filter options: provinsi, kabupaten per provinsi, sektor, jabatan. */
export function getAnalitikDimensi() {
  return apiGet('/analitik/dimensi');
}

/**
 * Aggregates for a filter.
 * @param {{provinsi: (string|undefined), kabupaten: (string|undefined),
 *     sektor: (string|undefined), jabatan: (string|undefined),
 *     dari: (string|undefined), sampai: (string|undefined)}} filter
 */
export function getPenggunaanTka(filter) {
  return apiGet('/analitik/penggunaan-tka', filter);
}

/** Request an export job; returns {exportId, status, format}. */
export function requestAnalitikExport(format, filter) {
  return apiPost('/analitik/exports', { format, filter });
}

/** Export job status + rows. @param {string} exportId */
export function getAnalitikExport(exportId) {
  return apiGet(`/analitik/exports/${encodeURIComponent(exportId)}`);
}
