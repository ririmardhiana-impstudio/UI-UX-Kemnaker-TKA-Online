/** @fileoverview Akun Petugas Ekspos: jadwal ekspose + hasil penilaian HPK. */

import { validateEksposHpkPerbaikan } from '../contracts/ekspos-hpk.js';
import { ApiError, apiGet, apiPost } from './http.js';

const path = (id, action = '') =>
  `/ekspos-hpk/${encodeURIComponent(id)}${action}`;

/** Pengajuan HPK fase ekspose, urut jadwal (tanggal, jam, no. antrian). */
export function listEksposHpk() {
  return apiGet('/ekspos-hpk');
}

/** Detail: jadwal, link ekspose, riwayat jadwal, BAP, aksi tersedia. */
export function getEksposHpk(id) {
  return apiGet(path(id));
}

/** Reschedule: sistem membuat jadwal baru, jadwal lama masuk riwayat. */
export function rescheduleEkspos(id) {
  return apiPost(path(id, '/reschedule'));
}

/**
 * Minta pemberi kerja memperbaiki data/dokumen (catatan 10–500 karakter).
 * @throws {ApiError} 400 bila catatan tidak valid (tanpa hit network).
 */
export function requestPerbaikan(id, catatan) {
  const { valid, errors } = validateEksposHpkPerbaikan({ catatan });
  if (!valid) {
    throw new ApiError(400, { code: 'VALIDATION_ERROR',
      message: errors.catatan, field: 'catatan', fields: errors });
  }
  return apiPost(path(id, '/perbaikan'), { catatan });
}

/** Buat BAP hasil penilaian kelayakan (status BAP: menunggu disetujui). */
export function createHasilBap(id) {
  return apiPost(path(id, '/bap'));
}
