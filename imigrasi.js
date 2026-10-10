/**
 * @fileoverview Akun Superadmin (view-only): data Pengesahan RPTKA ber-Visa-
 * ITAS dari integrasi Imigrasi dan data perpanjangan RPTKA pemberi kerja.
 * Endpoint tulis (POST .../visa-itas, .../perlintasan) dipanggil sistem
 * Imigrasi, bukan UI, jadi tidak ada helper-nya di sini.
 */

import { apiGet } from './http.js';

const enc = encodeURIComponent;

/** TKA pada Pengesahan RPTKA terbit yang sudah memiliki Visa dan ITAS. */
export function listImigrasiTka() {
  return apiGet('/imigrasi/tka');
}

/** Detail view-only satu TKA. */
export function getImigrasiTka(id) {
  return apiGet(`/imigrasi/tka/${enc(id)}`);
}

/** Perpanjangan RPTKA yang diajukan pemberi kerja. */
export function listImigrasiPerpanjangan() {
  return apiGet('/imigrasi/perpanjangan');
}

/** Detail view-only satu perpanjangan. */
export function getImigrasiPerpanjangan(id) {
  return apiGet(`/imigrasi/perpanjangan/${enc(id)}`);
}
