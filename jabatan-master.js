/** @fileoverview Master jabatan (back office admin). */

import { apiGet } from './http.js';

export function listJabatanMaster() {
  return apiGet('/jabatan-master');
}
