/**
 * @fileoverview Entry of imigrasi-akun.html — akun Superadmin (view-only):
 * menerima data Pengesahan RPTKA ber-Visa-ITAS dari integrasi Imigrasi dan
 * data perpanjangan RPTKA dari pemberi kerja. Layout = portal pemberi kerja;
 * view modules live in js/pages/imigrasi-akun/.
 */

import {
  getImigrasiPerpanjangan, getImigrasiTka, listImigrasiPerpanjangan,
  listImigrasiTka,
} from '../api/imigrasi.js';
import { bukaPratinjau, opsiDariDataset } from '../components/doc-preview.js';
import { qs, setHtml } from '../components/dom.js';
import { bindDropdowns } from '../components/dropdown.js';
import { errorView, loadingView } from './portal/ui.js';
import { renderDetail } from './imigrasi-akun/detail-view.js';
import { mountDaftar, renderDaftar } from './imigrasi-akun/list-view.js';
import { renderHeader, renderSidebar } from './imigrasi-akun/shell.js';
import { go, readUrl, state, subscribe } from './imigrasi-akun/state.js';

const LIST = { render: renderDaftar, mount: mountDaftar };
const VIEWS = { pengesahan: LIST, perpanjangan: LIST,
  detail: { render: renderDetail }, perpanjanganDetail: { render: renderDetail } };
const LOADERS = { detail: getImigrasiTka,
  perpanjanganDetail: getImigrasiPerpanjangan };

const ACTIONS = {
  go(el) {
    go(el.dataset.page, JSON.parse(el.dataset.params || '{}'));
  },
  'preview-doc'(el) {
    bukaPratinjau(opsiDariDataset(el.dataset));
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
    const detail = await LOADERS[state.page](state.id);
    if (token !== renderToken) {
      return false;
    }
    state.detail = detail;
    return true;
  } catch (error) {
    if (token === renderToken) {
      showError(`Gagal memuat data: ${error.message}`);
    }
    return false;
  }
}

async function renderView({ focus = false } = {}) {
  const token = ++renderToken;
  renderShell();
  if (!state.rows) {
    return;
  }
  if (LOADERS[state.page] && !(await loadDetail(token))) {
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
  if (focus) {
    const heading = qs('h1', wrapper);
    heading?.setAttribute('tabindex', '-1');
    heading?.focus({ preventScroll: true });
  }
}

/** Load both lists, then render (initial load + retry). */
async function boot() {
  viewEl.setAttribute('aria-busy', 'true');
  setHtml(viewEl, loadingView());
  renderShell();
  try {
    [state.rows, state.prpRows] = await Promise.all([listImigrasiTka(),
      listImigrasiPerpanjangan()]);
  } catch (error) {
    showError(`Gagal memuat data: ${error.message}`);
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
    qs('#imigrasi-drawer').checked = false;
    document.activeElement?.blur();
  }
  handler(el, event);
}

function init() {
  readUrl();
  bindDropdowns();
  document.addEventListener('click', onClick);
  subscribe((kind) => {
    renderView({ focus: kind === 'navigate' });
    if (kind === 'navigate') {
      window.scrollTo(0, 0);
    }
  });
  boot();
}

init();
