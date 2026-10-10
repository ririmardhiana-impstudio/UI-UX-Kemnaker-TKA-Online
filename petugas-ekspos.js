/**
 * @fileoverview Entry of petugas-ekspos.html — akun Petugas Ekspos (usulan,
 * lembar kebutuhan "Fitur Ekspose" + "Fitur Hasil Penilaian"): Jadwal
 * Ekspose (tabel berurutan no. antrian + jadwal, detail, link ekspose) dan
 * Hasil Penilaian (Perbaiki Data dan Dokumen, Reschedule, Buat BAP).
 * Layout = portal pemberi kerja; view modules live in js/pages/petugas-ekspos/.
 */

import { getEksposHpk, listEksposHpk } from '../api/ekspos-hpk.js';
import { qs, setHtml } from '../components/dom.js';
import { bindDropdowns } from '../components/dropdown.js';
import { closeDialog, errorView, loadingView } from './portal/ui.js';
import { actions, onDialogSubmit } from './petugas-ekspos/actions.js';
import { renderDetail } from './petugas-ekspos/detail-view.js';
import {
  mountHasil, mountJadwal, renderHasil, renderJadwal,
} from './petugas-ekspos/list-view.js';
import { renderHeader, renderSidebar } from './petugas-ekspos/shell.js';
import { go, readUrl, state, subscribe } from './petugas-ekspos/state.js';

const VIEWS = {
  jadwal: { render: renderJadwal, mount: mountJadwal },
  hasil: { render: renderHasil, mount: mountHasil },
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
    const detail = await getEksposHpk(state.id);
    if (token !== renderToken) {
      return false;
    }
    state.detail = detail;
    return true;
  } catch (error) {
    if (token === renderToken) {
      showError(`Gagal memuat detail ekspose: ${error.message}`);
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

/** Load the ekspose rows, then render (initial load + retry). */
async function boot() {
  viewEl.setAttribute('aria-busy', 'true');
  setHtml(viewEl, loadingView());
  renderShell();
  try {
    state.rows = (await listEksposHpk()) ?? [];
  } catch (error) {
    showError(`Gagal memuat jadwal ekspose: ${error.message}`);
    return;
  }
  renderView({ focus: true });
}

function onClick(event) {
  const el = event.target.closest('[data-action]');
  const handler = el && !el.disabled && ACTIONS[el.dataset.action];
  if (!handler) {
    return;
  }
  event.preventDefault();
  if (el.dataset.action === 'go') {
    qs('#ekspos-drawer').checked = false;
    closeDialog('ekspos-modal');
    document.activeElement?.blur();
  }
  handler(el, event);
}

function init() {
  readUrl();
  bindDropdowns();
  document.addEventListener('click', onClick);
  qs('#ekspos-modal').addEventListener('submit', onDialogSubmit);
  subscribe((kind) => {
    renderView({ focus: kind === 'navigate' });
    if (kind === 'navigate') {
      window.scrollTo(0, 0);
    }
  });
  boot();
}

init();
