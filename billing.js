/** @fileoverview DKPTKA billing codes. */

import { apiGet, apiPost } from './http.js';

/** @param {string} role */
export function listBilling(role) {
  return apiGet('/billing', { role });
}

/** Reissue an expired billing code ("Proses lagi"); 409 otherwise. */
export function reissueBilling(role, id) {
  return apiPost(`/billing/${encodeURIComponent(id)}/reissue`, undefined,
    { role });
}

/**
 * Employer self-declares a bill as paid (tanda bukti, separate from
 * Simponi's authoritative confirm-payment/SM-07); 409 unless Belum dibayar.
 * `buktiBayar` ({namaBerkas, ukuranKb, berkasId}) is required for SKRD bills
 * (bukti pembayaran dari bank daerah, diteruskan ke Disnaker setempat).
 */
export function confirmBayar(role, id, buktiBayar = null) {
  return apiPost(`/billing/${encodeURIComponent(id)}/confirm-bayar`,
    { konfirmasi: true, ...(buktiBayar ? { buktiBayar } : {}) }, { role });
}
