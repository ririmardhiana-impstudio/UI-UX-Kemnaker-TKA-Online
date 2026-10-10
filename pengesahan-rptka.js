/**
 * @fileoverview Form RPTKA (Pengesahan RPTKA kelompok A/B): Nomor HPK
 * aktif, daftar/detail pengajuan, simpan Draf, Submit. Validasi
 * (contracts/pengesahan-rptka.js) berjalan di halaman sebelum helper tulis
 * dipanggil; server memvalidasi ulang.
 */

import { apiGet, apiPost, apiPut } from './http.js';

const base = (id) => `/pengesahan-rptka/${encodeURIComponent(id)}`;

/**
 * Nomor HPK aktif + sisa kuota per jabatan.
 * @param {string} role
 * @param {string=} layanan
 */
export function listHpkAktif(role, layanan) {
  return apiGet('/pengesahan-rptka/hpk', { role, layanan });
}

/** @param {string} role @param {string=} jenis */
export function listRptka(role, jenis) {
  return apiGet('/pengesahan-rptka', { role, jenis });
}

/** @param {string} role @param {string} id */
export function getRptka(role, id) {
  return apiGet(base(id), { role });
}

/** Simpan Draf baru; body per PengesahanRptkaRequest. */
export function createRptka(role, body) {
  return apiPost('/pengesahan-rptka', body, { role });
}

/** Ubah Draf; body per PengesahanRptkaRequest. */
export function updateRptka(role, id, body) {
  return apiPut(base(id), body, { role });
}

/** Kirim ulang pengajuan yang dikembalikan (revisi dokumen / Data TKA). */
export function resubmitRptka(role, id) {
  return apiPost(`${base(id)}/resubmit`, {}, { role });
}

/** Submit Draf ke Verifikator (Menunggu Verifikasi). */
export function submitRptka(role, id) {
  return apiPost(`${base(id)}/submit`, {}, { role });
}
