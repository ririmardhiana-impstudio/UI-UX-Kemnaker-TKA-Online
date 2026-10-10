/**
 * @fileoverview KAK Modul 8 — audit log (hash chain), RBAC (peran & akses,
 * pengguna internal) and security alerts.
 */

import { apiGet, apiPatch, apiPost, apiRequest } from './http.js';

/**
 * Audit log page (newest first).
 * @param {{pengguna: (string|undefined), modul: (string|undefined),
 *     aksi: (string|undefined), dari: (string|undefined),
 *     sampai: (string|undefined), page: (number|undefined)}=} filters
 * @return {!Promise<{items: !Array<!Object>, meta: !Object}>}
 */
export async function listAuditLogs(filters = {}) {
  const query = { ...filters, page: filters.page ? String(filters.page) : '' };
  const { data, meta } = await apiRequest('GET', '/audit-logs', { query });
  return { items: data, meta: meta ?? {} };
}

/** Hash-chain verification {valid, checkedEntries, lastHash, brokenAt}. */
export function getAuditIntegrity() {
  return apiGet('/audit-logs/integrity');
}

/** {permissions: [{key, label}], roles: [{peran, izin, jumlahPengguna}]} */
export function getAccessRoles() {
  return apiGet('/access-roles');
}

export function listInternalUsers() {
  return apiGet('/internal-users');
}

/**
 * @param {string} id
 * @param {{peran: (string|undefined), aktif: (boolean|undefined)}} body
 */
export function updateInternalUser(id, body) {
  return apiPatch(`/internal-users/${encodeURIComponent(id)}`, body);
}

/**
 * Alerts + open count.
 * @return {!Promise<{items: !Array<!Object>, baru: number}>}
 */
export async function listSecurityAlerts() {
  const { data, meta } = await apiRequest('GET', '/security-alerts');
  return { items: data, baru: meta?.baru ?? 0 };
}

/** Acknowledge an alert (catatan 10–500; 409 when already done). */
export function acknowledgeAlert(id, catatan) {
  return apiPost(`/security-alerts/${encodeURIComponent(id)}/acknowledge`,
    { catatan });
}
