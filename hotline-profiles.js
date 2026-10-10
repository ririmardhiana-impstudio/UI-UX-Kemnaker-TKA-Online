/** @fileoverview TKA Hotline employer profile. */

import { apiGet, apiPut } from './http.js';

/** @param {string} akun Employer username, e.g. 'nbp.hrd'. */
export function getHotlineProfile(akun) {
  return apiGet(`/hotline-profiles/${encodeURIComponent(akun)}`);
}

/**
 * @param {string} akun
 * @param {{penanggungJawab: string, telepon: string, email: string}} body
 */
export function saveHotlineProfile(akun, body) {
  return apiPut(`/hotline-profiles/${encodeURIComponent(akun)}`, body);
}
