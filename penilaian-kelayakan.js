/**
 * @fileoverview Hasil Penilaian dan Kelayakan (HPK) of the employer portal:
 * tabel pengajuan, formulir per jenis, simpan/submit, persetujuan BAP.
 * Validation (contracts/penilaian-kelayakan.js) runs in the page before
 * calling write helpers; the server re-validates.
 */

import { apiGet, apiPost, apiPut } from './http.js';

const enc = encodeURIComponent;
const base = (id) => `/penilaian-kelayakan/${enc(id)}`;

/** @param {string} role */
export function listPenilaianKelayakan(role) {
  return apiGet('/penilaian-kelayakan', { role });
}

/**
 * Skema isian + dokumen untuk satu jenis HPK (sumber OSS sudah terisi).
 * @param {string} role
 * @param {string} jenis
 */
export function getFormulirPenilaian(role, jenis) {
  return apiGet('/penilaian-kelayakan/formulir', { role, jenis });
}

/** @param {string} role @param {string} id */
export function getPenilaianKelayakan(role, id) {
  return apiGet(base(id), { role });
}

/** Simpan Draft; body per PenilaianKelayakanRequest. */
export function createPenilaianKelayakan(role, body) {
  return apiPost('/penilaian-kelayakan', body, { role });
}

/** Ubah isian (Draft / Perlu Perbaikan); body per PenilaianKelayakanRequest. */
export function updatePenilaianKelayakan(role, id, body) {
  return apiPut(base(id), body, { role });
}

/** Submit ke verifikator (Menunggu Verifikasi). */
export function submitPenilaianKelayakan(role, id) {
  return apiPost(`${base(id)}/submit`, {}, { role });
}

/** Setujui BAP; body {namaPenyetuju, jabatanPenyetuju}. */
export function approveBapPenilaian(role, id, body) {
  return apiPost(`${base(id)}/bap-approval`, body, { role });
}

/** [I] Verifikator/sistem (demo): body {status, catatan?}. */
export function transitionPenilaianKelayakan(role, id, body) {
  return apiPost(`${base(id)}/transition`, body, { role });
}
