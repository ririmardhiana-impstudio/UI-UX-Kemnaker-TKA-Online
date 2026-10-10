/** @fileoverview Public status lookup (Landing "Cek status"). */

import { apiGet } from './http.js';

/**
 * @param {string} jenis rptka | hpk | billing | pendaftaran
 * @param {string} nomor Barcode / no. permohonan / kode billing / NPWP.
 * @return {!Promise<!Object>} {jenis, nomor, layanan, tanggal, tahap,
 *     status, tone, batas?, rupiah?, catatan?}; 404 NOT_FOUND when unknown.
 */
export function getStatusPermohonan(jenis, nomor) {
  return apiGet('/status-permohonan', { jenis, nomor });
}
