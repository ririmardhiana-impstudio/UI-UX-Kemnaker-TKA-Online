/**
 * @fileoverview Contract + validator untuk tagihan DKPTKA/SKRD sisi pemberi
 * kerja (akun portal): pernyataan pemberi kerja bahwa mereka sudah membayar
 * — DKPTKA di bank persepsi, atau SKRD di Kas Daerah lewat bank daerah
 * (keduanya di luar TKA Online; Simponi di luar lingkup aplikasi).
 * Konfirmasi ini menjadikan tagihan Lunas dan memicu persetujuan otomatis SK
 * Pengesahan RPTKA (menunggu TTE Direktur). `buktiBayar` WAJIB untuk tagihan
 * SKRD (bukti pembayaran dari bank daerah, diteruskan ke Disnaker setempat)
 * — jenis tagihan tidak diketahui kontrak ini, jadi wajib-nya diperiksa di
 * endpoint (`routes/portal.js` `confirmBayarEmployer`), bukan di sini.
 */

import { mergeErrors, validateContract } from './schema.js';

export const BILLING_KONFIRMASI_REQUEST = {
  name: 'BillingKonfirmasiRequest',
  description: 'Pemberi kerja menyatakan sudah membayar tagihan ini. ' +
    '`konfirmasi` harus true; `buktiBayar` wajib untuk tagihan SKRD.',
  fields: {
    konfirmasi: { type: 'boolean', required: true, example: true,
      description: 'Pernyataan pemberi kerja sudah membayar tagihan ini.' },
    buktiBayar: { type: 'object', required: false,
      description: 'Berkas bukti pembayaran (wajib untuk tagihan SKRD, ' +
        'diteruskan ke Disnaker setempat) — {namaBerkas, ukuranKb, ' +
        'berkasId}.',
      example: { namaBerkas: 'bukti-transfer-bank-daerah.pdf',
        ukuranKb: 180, berkasId: 'a1b2c3' } },
  },
};

export function validateBillingKonfirmasi(payload) {
  const base = validateContract(BILLING_KONFIRMASI_REQUEST, payload);
  let result = base.errors.konfirmasi || payload?.konfirmasi === true ? base
    : mergeErrors(base, { konfirmasi: 'Centang pernyataan sudah membayar ' +
      'terlebih dahulu.' });
  if (payload?.buktiBayar != null && !payload.buktiBayar?.namaBerkas) {
    result = mergeErrors(result, { buktiBayar: 'Berkas bukti pembayaran ' +
      'tidak valid.' });
  }
  return result;
}
