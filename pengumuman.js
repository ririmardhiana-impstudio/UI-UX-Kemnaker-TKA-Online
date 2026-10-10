/** @fileoverview Mandatory-read announcements. */

import { apiGet } from './http.js';

/** @return {!Promise<!Array<{tgl, tag, judul, isi}>>} */
export function listPengumuman() {
  return apiGet('/pengumuman');
}
