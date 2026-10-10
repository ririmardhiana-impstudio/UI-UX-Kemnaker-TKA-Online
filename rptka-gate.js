/**
 * @fileoverview Gerbang antar-tahap Form RPTKA: tahap berikutnya hanya
 * terbuka bila tahap sebelumnya lengkap. Urutan: header (Jenis RPTKA,
 * Kegiatan, Nomor HPK) -> Jabatan TKA -> Unggah Dokumen -> Data TKA ->
 * Preview. Kelengkapan = tidak ada error pada validateRptkaSubmit untuk
 * tahap itu.
 */

import { validateRptkaSubmit } from '../../contracts/pengesahan-rptka.js';
import { TABS, hpkOf, payload } from './rptka-data.js';

export const HEADER = 'header';
const ORDER = [HEADER, ...TABS.map((t) => t.key)];
export const STEP_LABEL = { [HEADER]: 'Jenis RPTKA dan Nomor HPK',
  ...Object.fromEntries(TABS.map((t) => [t.key, t.label])) };

/** Tahap pemilik sebuah path error validator. */
export function tabOfError(path) {
  if (['jenis', 'kegiatan', 'hpkId'].includes(path)) {
    return HEADER;
  }
  if (path.startsWith('jabatan') || path === 'tka') {
    return 'jabatan';
  }
  return path.startsWith('tka.') && path.includes('.data.') ? 'data' : 'dokumen';
}

/** @return {!Object<string, !Object<string, string>>} tahap -> {path: pesan} */
export function groupErrors(S) {
  // Revisi: kuota HPK sudah terpakai saat submit awal, jangan dihitung lagi.
  const hpk = S.w.perluRevisi ? null : hpkOf(S);
  const { errors } = validateRptkaSubmit(payload(S.w), hpk);
  const out = {};
  for (const [path, message] of Object.entries(errors)) {
    (out[tabOfError(path)] ??= {})[path] = message;
  }
  return out;
}

/**
 * Tahap pertama yang belum lengkap sebelum `target` (null = boleh buka).
 * @param {!Object} S
 * @param {string} target
 * @param {!Object=} groups hasil groupErrors (hemat hitung ulang).
 * @return {?string}
 */
export function blocker(S, target, groups = groupErrors(S)) {
  return ORDER.slice(0, ORDER.indexOf(target)).find((k) => groups[k]) ?? null;
}
