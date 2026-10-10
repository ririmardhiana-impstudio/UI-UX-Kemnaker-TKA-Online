/** @fileoverview Notifications inbox + admin settings (KAK Modul 7). */

import { apiGet, apiPost, apiPut, apiRequest } from './http.js';

/**
 * Inbox of an employer role (newest first).
 * @param {string} role
 * @param {('unread'|undefined)} status
 * @return {!Promise<{items: !Array<!Object>, unread: number}>}
 */
export async function listNotifikasi(role, status) {
  const { data, meta } = await apiRequest('GET', '/notifikasi',
    { query: { role, status } });
  return { items: data, unread: meta?.unread ?? 0 };
}

/** Mark one notification read. */
export function markNotifikasiRead(role, id) {
  return apiPost(`/notifikasi/${encodeURIComponent(id)}/read`, undefined,
    { role });
}

/** Mark every notification of the role read; returns {updated}. */
export function markAllNotifikasiRead(role) {
  return apiPost('/notifikasi/read-all', undefined, { role });
}

/** Admin: notification event settings. */
export function listNotificationSettings() {
  return apiGet('/notification-settings');
}

/**
 * Admin: update one event.
 * @param {string} event
 * @param {{aktif: boolean, kanal: {email: boolean, sms: boolean,
 *     push: boolean}, template: string, pengingatHari: (?number|undefined)}}
 *     body
 */
export function updateNotificationSetting(event, body) {
  return apiPut(`/notification-settings/${encodeURIComponent(event)}`, body);
}
