/**
 * @fileoverview Contract + validator untuk akun Disnaker setempat (usulan,
 * lembar kebutuhan "Tabel Daftar Pemberi Kerja" — SKRD, DN-01..DN-03):
 * Perpanjangan RPTKA Lintas Kab/Kota dalam 1 Provinsi yang sudah divalidasi
 * Validator -> Detail -> Terbitkan Surat Ketetapan Retribusi Daerah (SKRD);
 * SKRD terkirim dan diterima pemberi kerja (tagihan di Pembayaran DKPTKA).
 */

import { mergeErrors, validateContract } from './schema.js';

/** Jenis RPTKA yang dipungut sebagai retribusi daerah (bukan PNBP). */
export const LINTAS_KABKOTA_RE = /^Perpanjangan .*Lintas Kab\/Kota/;

/** @param {string} jenis Nama jenis RPTKA. @return {boolean} */
export const isLintasKabKota = (jenis) => LINTAS_KABKOTA_RE.test(jenis ?? '');

/** Status tabel Disnaker. */
export const SKRD_STATUS = Object.freeze({
  MENUNGGU: 'Menunggu SKRD',
  TERBIT: 'SKRD terbit',
  LUNAS: 'Lunas',
});

export const SKRD_TERBITKAN_REQUEST = {
  name: 'SkrdTerbitkanRequest',
  description: 'Petugas Disnaker menerbitkan SKRD untuk Perpanjangan RPTKA ' +
    'Lintas Kab/Kota dalam 1 Provinsi yang sudah divalidasi. `konfirmasi` ' +
    'harus true (pernyataan data sudah diperiksa); nomor SKRD, nominal ' +
    'retribusi, dan masa berlaku (5 hari kerja) dibuat otomatis oleh sistem.',
  fields: {
    konfirmasi: { type: 'boolean', required: true, example: true,
      description: 'Pernyataan data sudah diperiksa dan SKRD siap terbit.' },
  },
};

/** @param {!Object} payload @return {{valid: boolean, errors: !Object}} */
export function validateSkrdTerbitkan(payload) {
  const base = validateContract(SKRD_TERBITKAN_REQUEST, payload);
  return base.errors.konfirmasi || payload?.konfirmasi === true ? base
    : mergeErrors(base, { konfirmasi: 'Centang pernyataan data sudah ' +
      'diperiksa terlebih dahulu.' });
}
