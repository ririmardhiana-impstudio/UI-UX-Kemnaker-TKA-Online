/** @fileoverview OCR document extraction (KAK Modul 6). */

import { apiPost } from './http.js';

/**
 * Extract fields from a document scan.
 * @param {{jenisDokumen: string, fileName: string, ukuranKb: number}} body
 * @return {!Promise<{fields: !Array<{kunci: string, label: string,
 *     nilai: string, keyakinan: number}>, perluPeriksa: boolean,
 *     ambangKeyakinan: number}>}
 */
export function extractDocument(body) {
  return apiPost('/ocr/extractions', body);
}

/**
 * Build an OcrRequest from a picked File.
 * @param {string} jenisDokumen
 * @param {!File} file
 * @return {{jenisDokumen: string, fileName: string, ukuranKb: number}}
 */
export function ocrRequestFromFile(jenisDokumen, file) {
  return { jenisDokumen, fileName: file.name,
    ukuranKb: Math.max(1, Math.ceil(file.size / 1024)) };
}
