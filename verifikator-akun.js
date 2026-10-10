/**
 * @fileoverview Entry of verifikator-akun.html — akun Verifikator
 * (usulan KAK Modul 1, AK-20): daftar pemberi kerja yang mendaftar online,
 * detail, dan verifikasi (email aktivasi ke admin + operator). Layout =
 * portal pemberi kerja; view modules live in js/pages/verifikator-akun/.
 */

import { getHpkVerifikasi, listHpkVerifikasi } from '../api/hpk-verifikasi.js';
import { getPendaftar, listPendaftar } from '../api/pendaftar.js';
import { getPengajuan, listPengajuan } from '../api/pengajuan-verifikasi.js';
import {
  getPengesahanVerifikasi, listPengesahanVerifikasi,
} from '../api/pengesahan-verifikasi.js';
import { qs, setHtml } from '../components/dom.js';
import { bindDropdowns } from '../components/dropdown.js';
import { startLiveSync } from '../components/live-sync.js';
import { closeDialog, errorView, loadingView } from './portal/ui.js';
import { renderDetail } from './verifikator-akun/detail-view.js';
import {
  actions as pengajuanActions, onPengajuanDialogSubmit,
} from './verifikator-akun/pengajuan-dialog.js';
import {
  mountPengajuan, renderPengajuan, renderPengajuanDetail,
} from './verifikator-akun/pengajuan-views.js';
import { renderHpkDetail } from './verifikator-akun/hpk-detail-view.js';
import {
  actions as hpkActions, onHpkDialogSubmit,
} from './verifikator-akun/hpk-dialog.js';
import { mountHpk, renderHpk } from './verifikator-akun/hpk-list-view.js';
import {
  renderPengesahanDetail,
} from './verifikator-akun/pengesahan-detail-view.js';
import {
  actions as pengesahanActions, onPengesahanDialogSubmit,
} from './verifikator-akun/pengesahan-dialog.js';
import {
  mountPengesahan, renderPengesahan,
} from './verifikator-akun/pengesahan-list-view.js';
import {
  mountDaftar, renderBeranda, renderDaftar,
} from './verifikator-akun/list-view.js';
import { renderHeader, renderSidebar } from './verifikator-akun/shell.js';
import {
  go, readUrl, state, subscribe,
} from './verifikator-akun/state.js';
import {
  actions as verifyActions, onDialogSubmit,
} from './verifikator-akun/verify-dialog.js';

const VIEWS = {
  beranda: { render: renderBeranda },
  daftar: { render: renderDaftar, mount: mountDaftar },
  detail: { render: renderDetail },
  hpk: { render: renderHpk, mount: mountHpk },
  hpkDetail: { render: renderHpkDetail },
  pengesahan: { render: renderPengesahan, mount: mountPengesahan },
  pengesahanDetail: { render: renderPengesahanDetail },
  perpanjangan: { render: renderPengesahan, mount: mountPengesahan },
  perpanjanganDetail: { render: renderPengesahanDetail },
  kabkota: { render: renderPengesahan, mount: mountPengesahan },
  kabkotaDetail: { render: renderPengesahanDetail },
  perubahan: { render: renderPengajuan, mount: mountPengajuan },
  perubahanDetail: { render: renderPengajuanDetail },
  pencabutan: { render: renderPengajuan, mount: mountPengajuan },
  pencabutanDetail: { render: renderPengajuanDetail },
};

const ACTIONS = {
  ...verifyActions,
  ...hpkActions,
  ...pengesahanActions,
  ...pengajuanActions,
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

/** Detail pages: which state slot + loader each one uses. */
const DETAILS = {
  detail: { slot: 'detail', load: getPendaftar },
  hpkDetail: { slot: 'hpkDetail', load: getHpkVerifikasi },
  pengesahanDetail: { slot: 'pengDetail', load: getPengesahanVerifikasi },
  perpanjanganDetail: { slot: 'pengDetail', load: getPengesahanVerifikasi },
  kabkotaDetail: { slot: 'pengDetail', load: getPengesahanVerifikasi },
  perubahanDetail: { slot: 'perubahanDetailRow',
    load: (id) => getPengajuan('perubahan', id) },
  pencabutanDetail: { slot: 'pencabutanDetailRow',
    load: (id) => getPengajuan('pencabutan', id) },
};

/** State slot -> loader of every list the Verifikator watches. */
const LISTS = {
  rows: listPendaftar, hpkRows: listHpkVerifikasi,
  pengRows: listPengesahanVerifikasi,
  perubahanRows: () => listPengajuan('perubahan'),
  pencabutanRows: () => listPengajuan('pencabutan'),
};

async function loadLists() {
  const slots = Object.keys(LISTS);
  const results = await Promise.all(slots.map((slot) => LISTS[slot]()));
  return Object.fromEntries(slots.map((slot, i) => [slot, results[i] ?? []]));
}

/** Load the detail of `state.id` (detail pages); false when it failed. */
async function loadDetail(token) {
  const { slot, load } = DETAILS[state.page];
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
      showError(`Gagal memuat detail pemberi kerja: ${error.message}`);
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
  if (state.page in DETAILS && !(await loadDetail(token))) {
    return;
  }
  const view = VIEWS[state.page];
  const wrapper = document.createElement('div');
  wrapper.className = 'grid gap-5 animate-fade-in';
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

/** Load the pendaftar list, then render (initial load + retry). */
async function boot() {
  viewEl.setAttribute('aria-busy', 'true');
  setHtml(viewEl, loadingView());
  renderShell();
  try {
    Object.assign(state, await loadLists());
  } catch (error) {
    showError(`Gagal memuat daftar pemberi kerja: ${error.message}`);
    return;
  }
  renderView({ focus: true });
}

/**
 * Live sync: reload the three lists (+ the open detail) and re-render only
 * when something changed, so pengajuan baru / perbaikan dari pemberi kerja
 * (portal) and keputusan Validator muncul tanpa reload. Typing in a search
 * box keeps focus.
 */
async function refreshLive() {
  if (Object.keys(LISTS).some((slot) => !state[slot])) {
    return;
  }
  const lists = await loadLists();
  const entry = DETAILS[state.page];
  const detail = entry ? await entry.load(state.id) : null;
  const slots = Object.keys(LISTS);
  const before = [...slots.map((slot) => state[slot]),
    entry ? state[entry.slot] : null];
  if (JSON.stringify([...slots.map((slot) => lists[slot]), detail]) ===
      JSON.stringify(before)) {
    return;
  }
  Object.assign(state, lists);
  if (entry) {
    state[entry.slot] = detail;
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
    const toggle = qs('#verif-drawer');
    toggle.checked = false;
    closeDialog('verif-modal');
    document.activeElement?.blur();
  }
  handler(el, event);
}

function init() {
  readUrl();
  bindDropdowns();
  document.addEventListener('click', onClick);
  qs('#verif-modal').addEventListener('submit', (event) => {
    onDialogSubmit(event);
    onHpkDialogSubmit(event);
    onPengesahanDialogSubmit(event);
    onPengajuanDialogSubmit(event);
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
