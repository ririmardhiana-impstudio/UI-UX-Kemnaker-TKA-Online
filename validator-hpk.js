/**
 * @fileoverview Entry of validator-hpk.html — akun Validator (usulan, lembar
 * kebutuhan "Tabel Daftar Pemberi Kerja"): daftar pemberi kerja yang BAP-nya
 * sudah disetujui (menunggu divalidasi), Detail (data isian + dokumen HPK)
 * dan Verifikasi. Layout = portal pemberi kerja; view modules live in
 * js/pages/validator-hpk/.
 */

import {
  getPencabutanValidasi, listPencabutanValidasi,
} from '../api/pencabutan-validasi.js';
import {
  getPengesahanValidasi, listPengesahanValidasi,
} from '../api/pengesahan-validasi.js';
import { getValidasiHpk, listValidasiHpk } from '../api/validasi-hpk.js';
import { qs, setHtml } from '../components/dom.js';
import { bindDropdowns } from '../components/dropdown.js';
import { closeDialog, errorView, loadingView } from './portal/ui.js';
import { actions, onDialogSubmit } from './validator-hpk/actions.js';
import { renderDetail } from './validator-hpk/detail-view.js';
import {
  onPencabutanSubmit, pencabutanActions,
} from './validator-hpk/pencabutan-actions.js';
import {
  renderPencabutanDetail,
} from './validator-hpk/pencabutan-detail-view.js';
import {
  mountPencabutan, renderPencabutan,
} from './validator-hpk/pencabutan-list-view.js';
import {
  pengesahanActions, onPengesahanSubmit,
} from './validator-hpk/pengesahan-actions.js';
import {
  renderPengesahanDetail,
} from './validator-hpk/pengesahan-detail-view.js';
import {
  mountPengesahan, renderPengesahan,
} from './validator-hpk/pengesahan-list-view.js';
import { mountDaftar, renderDaftar } from './validator-hpk/list-view.js';
import { renderHeader, renderSidebar } from './validator-hpk/shell.js';
import {
  go, readUrl, state, subscribe,
} from './validator-hpk/state.js';

const VIEWS = {
  daftar: { render: renderDaftar, mount: mountDaftar },
  detail: { render: renderDetail },
  pengesahan: { render: renderPengesahan, mount: mountPengesahan },
  pengesahanDetail: { render: renderPengesahanDetail },
  perpanjangan: { render: renderPengesahan, mount: mountPengesahan },
  perpanjanganDetail: { render: renderPengesahanDetail },
  kabkota: { render: renderPengesahan, mount: mountPengesahan },
  kabkotaDetail: { render: renderPengesahanDetail },
  pencabutan: { render: renderPencabutan, mount: mountPencabutan },
  pencabutanDetail: { render: renderPencabutanDetail },
};

/** Detail pages: state slot, loader and error label. */
const DETAILS = {
  detail: { slot: 'detail', load: getValidasiHpk, label: 'HPK' },
  pengesahanDetail: { slot: 'pengDetail', load: getPengesahanValidasi,
    label: 'RPTKA' },
  perpanjanganDetail: { slot: 'pengDetail', load: getPengesahanValidasi,
    label: 'perpanjangan RPTKA' },
  kabkotaDetail: { slot: 'pengDetail', load: getPengesahanValidasi,
    label: 'perpanjangan lintas kab/kota' },
  pencabutanDetail: { slot: 'pencDetail', load: getPencabutanValidasi,
    label: 'pencabutan RPTKA' },
};

const ACTIONS = {
  ...actions,
  ...pengesahanActions,
  ...pencabutanActions,
  go(el) {
    go(el.dataset.page, JSON.parse(el.dataset.params || '{}'));
  },
  retry() {
    boot();
  },
};

const viewEl = qs('#view');
let renderToken = 0;

function renderShell() {
  renderSidebar();
  renderHeader();
}

function showError(message) {
  viewEl.setAttribute('aria-busy', 'false');
  setHtml(viewEl, errorView(message));
}

/** Load the detail of `state.id`; false when it failed or went stale. */
async function loadDetail(token) {
  const { slot, load, label } = DETAILS[state.page];
  if (state[slot]?.id === state.id) {
    return true;
  }
  state[slot] = null;
  setHtml(viewEl, loadingView());
  try {
    const detail = await load(state.id);
    if (token !== renderToken) {
      return false;
    }
    state[slot] = detail;
    return true;
  } catch (error) {
    if (token === renderToken) {
      showError(`Gagal memuat detail ${label}: ${error.message}`);
    }
    return false;
  }
}

/** Remember the focused control (data-focus-key) across a re-render. */
function focusedKey() {
  const active = document.activeElement;
  return viewEl.contains(active) ? active.dataset?.focusKey ?? null : null;
}

async function renderView({ focus = false } = {}) {
  const key = focus ? null : focusedKey();
  const token = ++renderToken;
  renderShell();
  if (!state.rows || !state.pengRows || !state.pencRows) {
    return;
  }
  if (state.page in DETAILS && !(await loadDetail(token))) {
    return;
  }
  const view = VIEWS[state.page];
  const wrapper = document.createElement('div');
  wrapper.className = 'grid grid-cols-1 gap-5 animate-fade-in';
  setHtml(wrapper, view.render());
  viewEl.replaceChildren(wrapper);
  viewEl.setAttribute('aria-busy', 'false');
  view.mount?.(wrapper);
  renderShell();
  const target = key && wrapper.querySelector(`[data-focus-key="${key}"]`);
  if (target) {
    target.focus({ preventScroll: true });
  } else if (focus) {
    const heading = qs('h1', wrapper);
    heading?.setAttribute('tabindex', '-1');
    heading?.focus({ preventScroll: true });
  }
}

/** Load the HPK rows, then render (initial load + retry). */
async function boot() {
  viewEl.setAttribute('aria-busy', 'true');
  setHtml(viewEl, loadingView());
  renderShell();
  try {
    [state.rows, state.pengRows, state.pencRows] = (await Promise.all([
      listValidasiHpk(), listPengesahanValidasi(), listPencabutanValidasi(),
    ])).map((rows) => rows ?? []);
  } catch (error) {
    showError(`Gagal memuat daftar pemberi kerja: ${error.message}`);
    return;
  }
  renderView({ focus: true });
}

const POLL_MS = 5000;
const STORE_KEY = 'tka:mock-store';
let refreshing = false;

/** True while the user is typing or has a dialog open (do not redraw). */
function userBusy() {
  const active = document.activeElement;
  return qs('#validator-modal').open ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(active?.tagName);
}

/**
 * Real-time sync: re-fetch both lists (and the open detail) so pengajuan
 * baru dari pemberi kerja / perubahan status dari Verifikator muncul tanpa
 * reload. Silent — no loading skeleton; skipped while the user is busy.
 */
async function refreshData() {
  if (refreshing || !state.rows || userBusy() || document.hidden) {
    return;
  }
  refreshing = true;
  try {
    const [hpk, peng, penc] = (await Promise.all([
      listValidasiHpk(), listPengesahanValidasi(), listPencabutanValidasi(),
    ])).map((rows) => rows ?? []);
    const detail = state.page in DETAILS
      ? await DETAILS[state.page].load(state.id).catch(() => null) : null;
    if (JSON.stringify([hpk, peng, penc, detail]) !== JSON.stringify([
      state.rows, state.pengRows, state.pencRows,
      state[DETAILS[state.page]?.slot]])) {
      [state.rows, state.pengRows, state.pencRows] = [hpk, peng, penc];
      if (detail) {
        state[DETAILS[state.page].slot] = detail;
      }
      renderView();
    }
  } catch {
    // Transient failure: keep the current screen, retry on next tick.
  } finally {
    refreshing = false;
  }
}

function watchRealtime() {
  window.addEventListener('storage', (event) => {
    if (event.key === STORE_KEY) {
      refreshData();
    }
  });
  document.addEventListener('visibilitychange', refreshData);
  window.addEventListener('focus', refreshData);
  setInterval(refreshData, POLL_MS);
}

function onClick(event) {
  const el = event.target.closest('[data-action]');
  const handler = el && !el.disabled && ACTIONS[el.dataset.action];
  if (!handler) {
    return;
  }
  event.preventDefault();
  if (el.dataset.action === 'go') {
    qs('#validator-drawer').checked = false;
    closeDialog('validator-modal');
    document.activeElement?.blur();
  }
  handler(el, event);
}

function init() {
  readUrl();
  bindDropdowns();
  document.addEventListener('click', onClick);
  qs('#validator-modal').addEventListener('submit', (event) => {
    if (!onPengesahanSubmit(event) && !onPencabutanSubmit(event)) {
      onDialogSubmit(event);
    }
  });
  subscribe((kind) => {
    renderView({ focus: kind === 'navigate' });
    if (kind === 'navigate') {
      window.scrollTo(0, 0);
    }
  });
  boot();
  watchRealtime();
}

init();
