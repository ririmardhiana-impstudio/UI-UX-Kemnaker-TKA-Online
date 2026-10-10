/**
 * @fileoverview Operator perusahaan (multi-operator, level akses) and NIB
 * verification against OSS. `actorLevel` is sent for the prototype only;
 * the backend takes the acting operator from the session.
 */

import { apiGet, apiPatch, apiPost } from './http.js';

/** @param {string} role */
export function listOperators(role) {
  return apiGet('/operators', { role });
}

/**
 * Invite an operator (403 non-admin, 409 duplicate email).
 * @param {string} role
 * @param {{nama: string, email: string, level: string,
 *     actorLevel: string}} body
 */
export function inviteOperator(role, body) {
  return apiPost('/operators', body, { role });
}

/**
 * Change level and/or aktif (409 when it removes the last active admin).
 * @param {string} role
 * @param {string} id
 * @param {{level: (string|undefined), aktif: (boolean|undefined),
 *     actorLevel: string}} body
 */
export function updateOperator(role, id, body) {
  return apiPatch(`/operators/${encodeURIComponent(id)}`, body, { role });
}

/**
 * Check a NIB against OSS (422 unknown / not applicable, 503 OSS down).
 * @param {string} role
 * @param {string} nib
 */
export function verifyNib(role, nib) {
  return apiPost(`/companies/${encodeURIComponent(role)}/nib-verifications`,
    { nib });
}
