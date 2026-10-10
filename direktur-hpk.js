/**
 * @fileoverview Entry of direktur-hpk.html — akun Direktur (usulan, lembar
 * kebutuhan "Tabel Daftar Pemberi Kerja" Direktur): daftar pemberi kerja
 * Tervalidasi, Detail (data isian + dokumen HPK), Terbitkan HPK di halaman
 * detail dan TTE barcode di halaman utama; menu Pengesahan RPTKA
 * (lembar kebutuhan "Tabel Daftar Pemberi Kerja" RPTKA) view-only: Detail +
 * dokumen Pengesahan hasil TTE otomatis. Layout = portal pemberi kerja;
 * view modules live in js/pages/direktur-hpk/.
 */

import { getPenerbitanHpk, listPenerbitanHpk } from '../api/penerbitan-hpk.js';
import {
  getPencabutanDirektur, listPencabutanDirektur,
} from '../api/pencabutan-direktur.js';
import {
  getPengesahanDirektur, listPengesahanDirektur,
} from '../api/pengesahan-direktur.js';
import { qs, setHtml } from '../components/dom.js';
import { bindDropdowns } from '../components/dropdown.js';
import { startLiveSync } from '../components/live-sync.js';
import { closeDialog, errorView, loadingView } from './portal/ui.js';
import { actions, onDialogSubmit } from './direktur-hpk/actions.js';
import {
  onPencabutanSubmit, pencabutanActions,
} from './direktur-hpk/pencabutan-actions.js';
import {
  renderPencabutanDetail,
} from './direktur-hpk/pencabutan-detail-view.js';
import {
  mountPencabutan, renderPencabutan,
} from './direktur-hpk/pencabutan-list-view.js';
import {
  onPengesahanSubmit, pengesahanActions,
} from './direktur-hpk/pengesahan-actions.js';
import { renderDetail } from './direktur-hpk/detail-view.js';
import { mountDaftar, renderDaftar } from './direktur-hpk/list-view.js';
import {
  renderPengesahanDetail,
} from './direktur-hpk/pengesahan-detail-view.js';
import {
  mountPengesahan, renderPengesahan,
} from './direktur-hpk/pengesahan-list-view.js';
import { renderHeader, renderSidebar } from './direktur-hpk/shell.js';
import {
  go, readUrl, state, subscribe,
} from './direktur-hpk/state.js';

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
  detail: { slot: 'detail', load: getPenerbitanHpk, label: 'HPK' },
  pengesahanDetail: { slot: 'pengDetail', load: getPengesahanDirektur,
    label: 'RPTKA' },
  perpanjanganDetail: { slot: 'pengDetail', load: getPengesahanDirektur,
    label: 'perpanjangan RPTKA' },
  kabkotaDetail: { slot: 'pengDetail', load: getPengesahanDirektur,
    label: 'perpanjangan lintas kab/kota' },
  pencabutanDetail: { slot: 'pencDetail', load: getPencabutanDirektur,
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
      listPenerbitanHpk(), listPengesahanDirektur(), listPencabutanDirektur(),
    ])).map((rows) => rows ?? []);
  } catch (error) {
    showError(`Gagal memuat daftar pemberi kerja: ${error.message}`);
    return;
  }
  renderView({ focus: true });
}

/**
 * Live sync: reload both lists (and the open detail) and re-render only when
 * something changed, so a page left open follows Validator / Simponi /
 * pemberi kerja in real time. Typing in the search box keeps focus.
 */
async function refreshLive() {
  if (!state.rows || !state.pengRows || !state.pencRows) {
    return;
  }
  const [rows, pengRows, pencRows] = (await Promise.all([
    listPenerbitanHpk(), listPengesahanDirektur(), listPencabutanDirektur(),
  ])).map((list) => list ?? []);
  let detail = null;
  const slot = DETAILS[state.page]?.slot;
  if (slot) {
    detail = await DETAILS[state.page].load(state.id);
  }
  const same = JSON.stringify([rows, pengRows, pencRows, detail]) ===
    JSON.stringify([state.rows, state.pengRows, state.pencRows,
      slot ? state[slot] : null]);
  if (same) {
    return;
  }
  Object.assign(state, { rows, pengRows, pencRows });
  if (slot) {
    state[slot] = detail;
  }
  const active = document.activeElement;
  const typing = viewEl.contains(active) && active.tagName === 'INPUT'
    ? { id: active.id, at: active.selectionStart } : null;
  await renderView();
  const input = typing && viewEl.querySelector(`#${typing.id}`);
  if (input) {
    input.focus({ preventScroll: true });
    input.setSelectionRange(typing.at, typing.at);
  }
}

function onClick(event) {
  const el = event.target.closest('[data-action]');
  const handler = el && !el.disabled && ACTIONS[el.dataset.action];
  if (!handler) {
    return;
  }
  event.preventDefault();
  if (el.dataset.action === 'go') {
    qs('#direktur-drawer').checked = false;
    closeDialog('direktur-modal');
    document.activeElement?.blur();
  }
  handler(el, event);
}

function init() {
  readUrl();
  bindDropdowns();
  document.addEventListener('click', onClick);
  qs('#direktur-modal').addEventListener('submit', (event) => {
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
  boot().then(() => startLiveSync(refreshLive));
}

init();
