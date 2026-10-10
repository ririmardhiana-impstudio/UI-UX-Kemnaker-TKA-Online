/**
 * @fileoverview Entry of disnaker-akun.html — akun Disnaker setempat (usulan,
 * lembar kebutuhan "Tabel Daftar Pemberi Kerja" — SKRD): tabel Perpanjangan
 * RPTKA Lintas Kab/Kota dalam 1 Provinsi yang sudah divalidasi Validator,
 * Detail, dan Terbitkan Surat Ketetapan Retribusi Daerah (SKRD) yang diterima
 * pemberi kerja. Layout = portal pemberi kerja; view modules live in
 * js/pages/disnaker-akun/.
 */

import { getSkrdDisnaker, listSkrdDisnaker } from '../api/skrd-disnaker.js';
import { qs, setHtml } from '../components/dom.js';
import { bindDropdowns } from '../components/dropdown.js';
import { closeDialog, errorView, loadingView } from './portal/ui.js';
import { actions, onDialogSubmit } from './disnaker-akun/actions.js';
import { renderDetail } from './disnaker-akun/detail-view.js';
import { mountDaftar, renderDaftar } from './disnaker-akun/list-view.js';
import { renderHeader, renderSidebar } from './disnaker-akun/shell.js';
import {
  go, readUrl, state, subscribe,
} from './disnaker-akun/state.js';

const VIEWS = {
  daftar: { render: renderDaftar, mount: mountDaftar },
  detail: { render: renderDetail },
};

const ACTIONS = {
  ...actions,
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
  if (state.detail?.id === state.id) {
    return true;
  }
  state.detail = null;
  setHtml(viewEl, loadingView());
  try {
    const detail = await getSkrdDisnaker(state.id);
    if (token !== renderToken) {
      return false;
    }
    state.detail = detail;
    return true;
  } catch (error) {
    if (token === renderToken) {
      showError(`Gagal memuat detail perpanjangan RPTKA: ${error.message}`);
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
  if (!state.rows) {
    return;
  }
  if (state.page === 'detail' && !(await loadDetail(token))) {
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

/** Load the rows, then render (initial load + retry). */
async function boot() {
  viewEl.setAttribute('aria-busy', 'true');
  setHtml(viewEl, loadingView());
  renderShell();
  try {
    state.rows = (await listSkrdDisnaker()) ?? [];
  } catch (error) {
    showError(`Gagal memuat daftar perpanjangan RPTKA: ${error.message}`);
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
  return qs('#disnaker-modal').open ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(active?.tagName);
}

/**
 * Real-time sync: re-fetch the list (and the open detail) so berkas yang baru
 * divalidasi Validator muncul tanpa reload. Silent — no loading skeleton;
 * skipped while the user is busy.
 */
async function refreshData() {
  if (refreshing || !state.rows || userBusy() || document.hidden) {
    return;
  }
  refreshing = true;
  try {
    const rows = (await listSkrdDisnaker()) ?? [];
    const detail = state.page === 'detail'
      ? await getSkrdDisnaker(state.id).catch(() => null) : null;
    if (JSON.stringify([rows, detail]) !== JSON.stringify(
      [state.rows, state.detail])) {
      state.rows = rows;
      if (detail) {
        state.detail = detail;
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
    qs('#disnaker-drawer').checked = false;
    closeDialog('disnaker-modal');
    document.activeElement?.blur();
  }
  handler(el, event);
}

function init() {
  readUrl();
  bindDropdowns();
  document.addEventListener('click', onClick);
  qs('#disnaker-modal').addEventListener('submit', onDialogSubmit);
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
