/** @fileoverview Ekspos (penilaian kelayakan daring) schedules. */

import { apiGet, apiPost } from './http.js';

/**
 * Employer's upcoming ekspos (+ mode, platform, meetingUrl).
 * @param {string} role
 */
export function listEkspos(role) {
  return apiGet('/ekspos', { role });
}

/** Back office weekly calendar {days, times, events, sessions}. */
export function getEksposSchedule() {
  return apiGet('/ekspos-schedule');
}

/**
 * Create the online meeting link of an ekspos session.
 * @param {string} id Session id (eks-<antrian>).
 * @param {{platform: string, mulai: string}} body
 * @return {!Promise<!Object>} Updated session.
 */
export function createEksposMeeting(id, body) {
  return apiPost(`/ekspos-schedule/${encodeURIComponent(id)}/meetings`, body);
}

/**
 * File the BAP (berita acara) of an ekspos session.
 * @param {string} id Session id.
 * @param {{hasil: string, ringkasan: string, peserta: !Array<string>,
 *     rekamanUrl: (string|undefined), durasiMenit: number}} body
 * @return {!Promise<!Object>} Updated session with `bap.nomor`.
 */
export function createEksposBap(id, body) {
  return apiPost(`/ekspos-schedule/${encodeURIComponent(id)}/bap`, body);
}
