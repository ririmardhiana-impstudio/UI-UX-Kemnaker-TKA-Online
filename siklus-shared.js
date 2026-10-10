/**
 * @fileoverview Helpers shared by the RPTKA life-cycle mock routes
 * (siklus.js, keputusan-pencabutan.js): lazy seeding of the collections,
 * the demo "today" and zero-padded sequence numbers.
 */

import {
  KEPUTUSAN_PENCABUTAN_FIXTURE, PERPANJANGAN_FIXTURE,
  SURAT_KETERANGAN_FIXTURE,
} from '../fixtures/siklus.js';

const DEFAULT_TODAY = '30 September 2026';

/** Demo date (store.today overrides it in tests). */
export const today = (store) => store.today ?? DEFAULT_TODAY;

/** Zero-padded sequence number. */
export const pad = (n, size = 4) => String(n).padStart(size, '0');

/** Seed the life-cycle collections once per store. */
export function seed(store) {
  store.perpanjangan ??= structuredClone(PERPANJANGAN_FIXTURE);
  store.keputusanPencabutan ??= structuredClone(KEPUTUSAN_PENCABUTAN_FIXTURE);
  store.suratKeterangan ??= structuredClone(SURAT_KETERANGAN_FIXTURE);
  store.siklusSeq ??= { prp: 0, kp: 3, sk: 4, sket: 1, kep: 7 };
  return store;
}
