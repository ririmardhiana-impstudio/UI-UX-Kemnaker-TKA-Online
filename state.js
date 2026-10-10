/**
 * @fileoverview State of verifikator-akun.html: active page, selected
 * pendaftar id, list filter + the loaded rows. URL sync
 * (?page=&id=&status=) so reload/back keep the screen, same idea as the
 * portal state (js/pages/portal/state.js) but tiny.
 */

export const WAITING = 'Menunggu verifikasi';
export const FIX = 'Perlu perbaikan';
export const ACTIVE = 'Aktif';

export const HPK_FIX = 'Perbaikan data';
export const HPK_VERIFIED = 'Terverifikasi';

export const HPK_STATUS_FILTERS = [
  { key: '', label: 'Semua' },
  { key: WAITING, label: 'Menunggu verifikasi' },
  { key: HPK_FIX, label: 'Perbaikan data' },
  { key: HPK_VERIFIED, label: 'Terverifikasi' },
];

export const STATUS_FILTERS = [
  { key: '', label: 'Semua' },
  { key: WAITING, label: 'Menunggu verifikasi' },
  { key: FIX, label: 'Perlu perbaikan' },
  { key: ACTIVE, label: 'Aktif' },
  { key: 'Ditolak', label: 'Ditolak' },
];

/** Jenis RPTKA menu "Perpanjangan RPTKA" (AK-23), tidak di Pengesahan. */
export const PERPANJANGAN_LINTAS =
  'Perpanjangan Pengesahan RPTKA Lintas Provinsi';

/**
 * Menu Verifikator pemilik baris permohonan RPTKA, dari nama jenis asli
 * Form RPTKA (seed memakai judul panjang "Perpanjangan Pengesahan RPTKA
 * ..."): "Perpanjangan Lintas Kab/Kota dalam 1 Provinsi" -> kabkota (AK-25),
 * "Perpanjangan Lintas Provinsi" (+ Non HPK) -> perpanjangan (AK-23),
 * selain itu -> pengesahan (AK-22).
 * @param {{jenisRptka: string}} row
 * @return {string} pengesahan | perpanjangan | kabkota
 */
export function scopeOf(row) {
  if (/^Perpanjangan .*Lintas Kab\/Kota/.test(row.jenisRptka)) {
    return 'kabkota';
  }
  return /^Perpanjangan/.test(row.jenisRptka) ? 'perpanjangan' : 'pengesahan';
}

/** Scope menu untuk halaman daftar/detail yang aktif. */
export const pageScope = (page) => ({ perpanjangan: 'perpanjangan',
  perpanjanganDetail: 'perpanjangan', kabkota: 'kabkota',
  kabkotaDetail: 'kabkota' }[page] ?? 'pengesahan');

/** Kompatibilitas AK-23: baris milik menu Perpanjangan Lintas Provinsi? */
export const isLintas = (row) => scopeOf(row) === 'perpanjangan';

const PAGES = ['beranda', 'daftar', 'detail', 'hpk', 'hpkDetail',
  'pengesahan', 'pengesahanDetail', 'perpanjangan', 'perpanjanganDetail',
  'perubahan', 'perubahanDetail', 'pencabutan', 'pencabutanDetail',
  'kabkota', 'kabkotaDetail'];
const LIST_PAGES = ['daftar', 'hpk', 'pengesahan', 'perpanjangan', 'kabkota',
  'perubahan', 'pencabutan'];
const DETAIL_PAGES = ['detail', 'hpkDetail', 'pengesahanDetail',
  'perpanjanganDetail', 'kabkotaDetail', 'perubahanDetail',
  'pencabutanDetail'];
const DEFAULT_PAGE = 'beranda';

export const state = {
  page: DEFAULT_PAGE,
  id: '',
  status: '',
  q: '',
  /** @type {?Array<!Object>} Loaded pendaftar rows; null while loading. */
  rows: null,
  /** @type {?Object} Detail of `id` (GET /pendaftar/{id}). */
  detail: null,
  /** @type {?Array<!Object>} HPK rows (GET /hpk-verifikasi). */
  hpkRows: null,
  /** @type {?Object} Detail of HPK `id`. */
  hpkDetail: null,
  /** @type {?Array<!Object>} Pengesahan RPTKA rows. */
  pengRows: null,
  /** @type {?Object} Detail of Pengesahan `id`. */
  pengDetail: null,
  /** @type {?Array<!Object>} Pengajuan Perubahan / Pencabutan (AK-24). */
  perubahanRows: null,
  perubahanDetailRow: null,
  pencabutanRows: null,
  pencabutanDetailRow: null,
};

const listeners = new Set();

/** @param {function(string)} listener kind: 'navigate' | 'view'. */
export function subscribe(listener) {
  listeners.add(listener);
}

function notify(kind) {
  for (const listener of listeners) {
    listener(kind);
  }
}

/** Does the row belong to a filter tab? ("Ditolak" matches "Ditolak — …") */
export function matchesStatus(row, status) {
  return !status || row.status === status ||
    (status === 'Ditolak' && row.status.startsWith('Ditolak'));
}

/** Navigate to a page; params: {id, status}. */
export function go(page, params = {}) {
  state.page = PAGES.includes(page) ? page : DEFAULT_PAGE;
  state.id = params.id ?? '';
  if (LIST_PAGES.includes(state.page)) {
    state.status = params.status ?? '';
    state.q = '';
  }
  writeUrl('push');
  notify('navigate');
}

/**
 * Merge list filters; re-render unless `silent` (typing in the search box
 * redraws only the table rows, so the input keeps focus).
 */
export function setFilter(patch, { silent = false } = {}) {
  Object.assign(state, patch);
  writeUrl('replace');
  if (!silent) {
    notify('view');
  }
}

export function refreshView() {
  notify('view');
}

export function readUrl() {
  const params = new URLSearchParams(window.location.search);
  const page = params.get('page');
  state.page = PAGES.includes(page) ? page : DEFAULT_PAGE;
  state.id = params.get('id') ?? '';
  state.status = params.get('status') ?? '';
  state.q = params.get('q') ?? '';
}

function writeUrl(mode) {
  const params = new URLSearchParams();
  if (state.page !== DEFAULT_PAGE) {
    params.set('page', state.page);
  }
  if (DETAIL_PAGES.includes(state.page) && state.id) {
    params.set('id', state.id);
  }
  if (LIST_PAGES.includes(state.page)) {
    for (const key of ['status', 'q']) {
      if (state[key]) {
        params.set(key, state[key]);
      }
    }
  }
  const query = params.toString();
  const url = `${window.location.pathname}${query ? `?${query}` : ''}`;
  window.history[mode === 'push' ? 'pushState' : 'replaceState'](null, '', url);
}

window.addEventListener('popstate', () => {
  readUrl();
  notify('navigate');
});
