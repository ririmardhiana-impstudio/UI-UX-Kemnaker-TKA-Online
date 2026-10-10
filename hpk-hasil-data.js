/**
 * @fileoverview Shared state + helpers of the "Hasil Penilaian dan
 * Kelayakan (HPK)" portal menu (page key "hpkHasil"): cached list /
 * detail, Indonesian date formatting and the load() used by the page's
 * three views (tabel, form, detail).
 */

import {
  getPenilaianKelayakan, listPenilaianKelayakan,
} from '../../api/penilaian-kelayakan.js';
import { withRetry } from './data.js';
import { state } from './state.js';

export const PAGE = 'hpkHasil';
export const MODAL = 'portal-modal';

const DATE = new Intl.DateTimeFormat('id-ID', { day: 'numeric',
  month: 'long', year: 'numeric', timeZone: 'UTC' });
const WEEKDAY = new Intl.DateTimeFormat('id-ID', { weekday: 'long',
  timeZone: 'UTC' });

/** Cache lives in state.extra (reset on role switch). */
export function cache() {
  state.extra.hpkHasil ??= { list: null, detail: null, q: '', status: '',
    sort: { key: 'tanggal', dir: 'desc' } };
  return state.extra.hpkHasil;
}

/** Drop cached list + detail after a write. */
export function invalidate() {
  Object.assign(cache(), { list: null, detail: null });
}

/** @param {string} iso YYYY-MM-DD @return {string} "7 Oktober 2026" */
export function tanggal(iso) {
  return iso ? DATE.format(new Date(`${iso}T00:00:00Z`)) : '—';
}

/** @param {string} iso YYYY-MM-DD @return {string} "Rabu" */
export function hari(iso) {
  return iso ? WEEKDAY.format(new Date(`${iso}T00:00:00Z`)) : '—';
}

/** VIEWS[PAGE].load — list, or the detail / pengajuan being edited. */
export async function load() {
  const c = cache();
  const { role } = state;
  const id = state.p.id ?? state.p.edit;
  if (id) {
    if (c.detail?.id !== id) {
      c.detail = await withRetry(() => getPenilaianKelayakan(role, id));
    }
  } else if (!state.p.baru && !c.list) {
    c.list = await withRetry(() => listPenilaianKelayakan(role));
  }
}
