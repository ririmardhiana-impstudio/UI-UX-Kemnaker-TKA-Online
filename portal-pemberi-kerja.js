/**
 * @fileoverview Entry of portal-pemberi-kerja.html (migrated from
 * "Portal Pemberi Kerja.dc.html"). Wires state -> render, delegated
 * actions (data-action), dialogs and the demo role switcher. View modules
 * live in js/pages/portal/.
 */

import { bukaPratinjau, opsiDariDataset } from '../components/doc-preview.js';
import { qs, qsa, setHtml } from '../components/dom.js';
import * as akun from './portal/akun.js';
import * as billing from './portal/billing.js';
import * as cetak from './portal/cetak.js';
import * as dashboard from './portal/dashboard.js';
import { loadRoleData } from './portal/data.js';
import * as documents from './portal/documents.js';
import * as hpk from './portal/hpk.js';
import * as hpkHasil from './portal/hpk-hasil.js';
import * as hpkWizard from './portal/hpk-wizard.js';
import * as laporan from './portal/laporan.js';
import * as laporanModals from './portal/laporan-modals.js';
import * as legacy from './portal/legacy.js';
import * as notifikasi from './portal/notifikasi.js';
import * as operator from './portal/operator.js';
import * as pencabutan from './portal/pencabutan.js';
import * as perpanjangan from './portal/perpanjangan.js';
import * as perubahan from './portal/perubahan.js';
import * as perubahanDetail from './portal/perubahan-detail.js';
import * as riwayat from './portal/riwayat.js';
import * as rptka from './portal/rptka.js';
import * as rptkaList from './portal/rptka-list.js';
import * as suratKeterangan from './portal/surat-keterangan.js';
import {
  bindDropdowns, bindMenuGroups, crumbText, mountRoleSwitcher, renderHeader,
  renderSidebar,
} from './portal/shell.js';
import {
  go, readUrl, state, subscribe, takePendingFocus,
} from './portal/state.js';
import * as tkaWizard from './portal/tka-wizard.js';
import { closeDialog, errorView, loadingView, toast } from './portal/ui.js';

/** page key -> {render, mount?, load?} (legacy `pg` flags). */
const VIEWS = {
  dashboard: { render: dashboard.render },
  dokumen: { render: akun.renderDokumen },
  hpkHasil: { render: hpkHasil.render, mount: hpkHasil.mount,
    load: hpkHasil.load },
  hpkList: { render: hpk.renderList, mount: hpk.mountList,
    load: hpk.loadList },
  rptka: { render: rptka.render, mount: rptka.mount, load: rptka.load },
  rptkaList: { render: rptkaList.renderPage, load: rptkaList.loadPage },
  hpkWizard: { render: hpkWizard.render },
  hpkDetail: { render: hpk.renderDetail, mount: hpk.mountDetail,
    load: hpk.loadDetail },
  tkaWizard: { render: tkaWizard.render },
  perpanjangan: { render: perpanjangan.render, mount: perpanjangan.mount },
  pembayaran: { render: billing.render, mount: billing.mount },
  perubahanList: { render: perubahan.renderList, mount: perubahan.mountList },
  perubahanNew: { render: perubahan.renderNew, mount: perubahan.mountNew },
  perubahanDetail: { render: perubahanDetail.render },
  pencabutan: { render: pencabutan.render, mount: pencabutan.mount,
    load: pencabutan.load },
  suratKeterangan: { render: suratKeterangan.render,
    mount: suratKeterangan.mount, load: suratKeterangan.load },
  notifikasi: { render: notifikasi.render, mount: notifikasi.mount },
  operator: { render: operator.render, mount: operator.mount,
    load: operator.load },
  laporan: { render: laporan.render },
  laporanDetail: { render: laporan.renderDetail, mount: laporan.mountDetail,
    load: laporan.loadDetail },
  legacy: { render: legacy.render, mount: legacy.mount, load: legacy.load },
  profil: { render: akun.renderProfil, mount: akun.mount },
  password: { render: akun.renderPassword, mount: akun.mount },
  email: { render: akun.renderEmail, mount: akun.mount },
};

const ACTIONS = {
  ...dashboard.actions, ...hpk.actions, ...hpkWizard.actions,
  ...hpkHasil.actions, ...cetak.actions, ...rptka.actions,
  ...tkaWizard.actions, ...perpanjangan.actions, ...billing.actions,
  ...perubahanDetail.actions, ...laporan.actions, ...laporanModals.actions,
  ...riwayat.actions, ...documents.actions, ...suratKeterangan.actions,
  ...notifikasi.actions, ...operator.actions, ...pencabutan.actions,
  go(el) {
    go(el.dataset.page, JSON.parse(el.dataset.params || '{}'));
  },
  'preview-doc'(el) {
    bukaPratinjau(opsiDariDataset(el.dataset));
  },
  noop(el) {
    toast(`${el.dataset.label}: belum tersedia di prototipe.`, 'info');
  },
  retry() {
    boot();
  },
  'retry-view'() {
    renderView();
  },
  'close-modal'() {
    closeDialog('portal-modal');
  },
};

const viewEl = qs('#view');
let renderToken = 0;

function currentView() {
  return VIEWS[state.page] ?? VIEWS.dashboard;
}

function renderShell() {
  renderSidebar();
  renderHeader();
  document.title = `${crumbText().split(' › ').pop() || 'Portal'} — ` +
    'Portal Pemberi Kerja — TKA Online';
}

/**
 * Remember which control inside the view had focus (data-focus-key or id)
 * so a 'view' re-render can put focus back instead of dropping it to body.
 * @return {?{key: ?string, id: ?string, pending: ?string, caret: ?number}}
 */
function captureFocus() {
  const pending = takePendingFocus();
  const active = document.activeElement;
  const inside = viewEl.contains(active) && active !== viewEl;
  if (!inside && !pending) {
    return null;
  }
  return {
    pending,
    key: inside ? active.dataset?.focusKey ?? null : null,
    id: inside ? active.id || null : null,
    caret: inside && typeof active.selectionStart === 'number'
      ? active.selectionStart : null,
  };
}

/**
 * Focus the re-rendered twin of the previously focused control; fall back
 * to the page h1 when it is gone or disabled.
 * @param {!Element} wrapper
 * @param {{key: ?string, id: ?string, pending: ?string, caret: ?number}} kept
 */
function restoreFocus(wrapper, kept) {
  const find = (key) => key && (wrapper.querySelector(
    `[data-focus-key="${CSS.escape(key)}"]`)
    ?? wrapper.querySelector(`#${CSS.escape(key)}`));
  const target = [kept.pending, kept.key, kept.id].map(find)
    .find((el) => el && !el.disabled);
  if (target) {
    target.focus({ preventScroll: true });
    if (kept.caret !== null && typeof target.setSelectionRange === 'function'
        && !kept.pending) {
      try {
        target.setSelectionRange(kept.caret, kept.caret);
      } catch {
        // Input types without selection (email, number) keep the default.
      }
    }
    return;
  }
  const heading = qs('h1', wrapper);
  heading?.setAttribute('tabindex', '-1');
  heading?.focus({ preventScroll: true });
}

/** Render the active view into a fresh wrapper (listeners die with it). */
async function renderView({ focus = false } = {}) {
  const kept = focus ? null : captureFocus();
  renderShell();
  if (!state.data) {
    return;
  }
  const view = currentView();
  const token = ++renderToken;
  if (view.load) {
    viewEl.setAttribute('aria-busy', 'true');
    setHtml(viewEl, loadingView());
    try {
      await view.load();
    } catch (error) {
      if (token === renderToken) {
        viewEl.setAttribute('aria-busy', 'false');
        setHtml(viewEl, errorView(`Gagal memuat data: ${error.message}`,
          'retry-view'));
      }
      return;
    }
    if (token !== renderToken) {
      return;
    }
  }
  const wrapper = document.createElement('div');
  wrapper.className = 'grid gap-5 animate-fade-in';
  setHtml(wrapper, view.render());
  viewEl.replaceChildren(wrapper);
  viewEl.setAttribute('aria-busy', 'false');
  view.mount?.(wrapper);
  if (kept) {
    restoreFocus(wrapper, kept);
  } else if (focus) {
    qs('h1', wrapper)?.setAttribute('tabindex', '-1');
    qs('h1', wrapper)?.focus({ preventScroll: true });
  }
}

/** Load the role bundle, then render (initial load, role switch, retry). */
async function boot() {
  const role = state.role;
  viewEl.setAttribute('aria-busy', 'true');
  setHtml(viewEl, loadingView());
  renderShell();
  try {
    await loadRoleData(role);
  } catch (error) {
    if (role === state.role) {
      viewEl.setAttribute('aria-busy', 'false');
      setHtml(viewEl, errorView(
        `Gagal memuat data portal: ${error.message}`));
    }
    return;
  }
  if (role === state.role) {
    renderView();
  }
}

function closeMobileDrawer() {
  const toggle = qs('#portal-drawer');
  if (toggle) {
    toggle.checked = false;
  }
}

function onClick(event) {
  const el = event.target.closest('[data-action]');
  if (!el || el.disabled) {
    return;
  }
  const handler = ACTIONS[el.dataset.action];
  if (!handler) {
    return;
  }
  event.preventDefault();
  if (el.dataset.action === 'go') {
    closeMobileDrawer();
    closeDialog('riwayat-drawer');
    document.activeElement?.blur();
  }
  handler(el, event);
}

/** Agree checkbox + textarea counters + modal file input. */
function onInput(event) {
  const target = event.target;
  if (target.matches('[data-agree]')) {
    state.ui.agree = target.checked;
    for (const button of qsa('[data-requires-agree]')) {
      button.disabled = !target.checked;
    }
  }
  if (target.matches('textarea[data-counter="on"]')) {
    const counter = qs(`[data-counter-for="${target.id}"]`);
    const max = target.getAttribute('maxlength');
    if (counter) {
      counter.textContent = `${target.value.length} / ${max}`;
    }
  }
  if (target.id === 'lap-file') {
    laporanModals.pickFile(target);
  }
}

function onModalSubmit(event) {
  const form = event.target;
  if (form.id === 'batal-form') {
    event.preventDefault();
    perubahanDetail.submitBatal(form);
  } else if (form.id === 'lap-upload-form') {
    event.preventDefault();
    laporanModals.submitUpload(form);
  }
}

function init() {
  readUrl();
  const switcher = mountRoleSwitcher();
  bindMenuGroups();
  bindDropdowns();
  document.addEventListener('click', onClick);
  document.addEventListener('change', onInput);
  document.addEventListener('input', onInput);
  qs('#portal-modal').addEventListener('submit', onModalSubmit);
  subscribe((kind) => {
    if (kind === 'role') {
      switcher.setActive(state.role);
      boot();
    } else {
      renderView({ focus: kind === 'navigate' });
      if (kind === 'navigate') {
        window.scrollTo(0, 0);
      }
    }
  });
  boot();
}

init();
