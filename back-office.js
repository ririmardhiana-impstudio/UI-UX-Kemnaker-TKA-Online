/**
 * @fileoverview Back Office Petugas (usulan desain) — port of legacy
 * "Back Office Petugas.dc.html". One page, 9 demo roles; each role has
 * its own menu and home screen. State object + render() updating static
 * sections; data via js/api/* (mocked by js/api/client.js when USE_MOCK).
 */

import { listAntrian } from '../api/antrian.js';
import { getEksposSchedule } from '../api/ekspos.js';
import { listJabatanMaster } from '../api/jabatan-master.js';
import { listPemdaValidations } from '../api/pemda.js';
import { listPendaftar } from '../api/pendaftar.js';
import { listPengumuman } from '../api/pengumuman.js';
import { listKeputusanPencabutan } from '../api/siklus.js';
import { brand } from '../components/brand.js';
import { html, qs, setBusy, setHtml } from '../components/dom.js';
import { createAdminViews } from './back-office/admin-view.js';
import { createAnalitikViews } from './back-office/analitik-view.js';
import { DEFAULT_ROLE, MENU, PAGES, ROLES } from './back-office/config.js';
import { createEksposTtdViews } from './back-office/ekspos-ttd-view.js';
import { createNotifConfigViews } from './back-office/notif-config-view.js';
import { createPencabutanViews } from './back-office/pencabutan-view.js';
import { createQueueViews } from './back-office/queue-view.js';
import {
  SECURITY_PAGE_NEEDS, SECURITY_RESOURCES, createSecurityViews,
} from './back-office/security-view.js';
import { preserveFocus } from './back-office/ui.js';

/** Fetchers per resource key (cached for the page lifetime). */
const RESOURCES = {
  antrian: () => listAntrian(),
  schedule: getEksposSchedule,
  pemda: listPemdaValidations,
  pendaftar: listPendaftar,
  jabatan: listJabatanMaster,
  pengumuman: listPengumuman,
  keputusanPencabutan: () => listKeputusanPencabutan(),
  ...SECURITY_RESOURCES,
};

/** Resources each screen needs before it can render. */
const PAGE_NEEDS = {
  antrian: ['antrian'],
  review: ['antrian'],
  ekspos: ['antrian', 'schedule'],
  ttd: ['antrian'],
  pemda: ['pemda'],
  akun: ['pendaftar'],
  admin: ['jabatan', 'pengumuman'],
  pencabutan: ['keputusanPencabutan'],
  // Analitik & Notifikasi load their own data (own loading/error states).
  analitik: [],
  notifikasi: [],
  ...SECURITY_PAGE_NEEDS,
};

const ACTIVE_NAV = 'bg-primary-content/10 font-bold text-primary-content';
const IDLE_NAV = 'font-medium hover:bg-primary-content/10';

const homeRole = ROLES.find((r) => r.k === DEFAULT_ROLE);

const state = {
  role: homeRole.k,
  page: homeRole.home,
  sel: null,
  marks: {},
  notes: {},
  docIdx: 0,
  docOverride: null,
  decisionNote: null,
  jenis: '',
  ttdSel: { q7: true, q10: true },
  signed: null,
  akunSel: 0,
  adminTab: 0,
  eksposResult: 'layak',
  eksposNote: null,
  pemdaBusy: null,
  data: {},
  status: {},
};

const ctx = {
  state,
  setState,
  role: currentRole,
  queueOf,
};

const queueViews = createQueueViews(ctx);
const eksposTtdViews = createEksposTtdViews(ctx);
const adminViews = createAdminViews(ctx);
const pencabutanViews = createPencabutanViews(ctx);
const analitikViews = createAnalitikViews(ctx);
const notifConfigViews = createNotifConfigViews(ctx);
const securityViews = createSecurityViews(ctx);

const PAGE_RENDER = {
  antrian: queueViews.renderAntrian,
  review: queueViews.renderReview,
  ekspos: eksposTtdViews.renderEkspos,
  ttd: eksposTtdViews.renderTtd,
  pemda: adminViews.renderPemda,
  akun: adminViews.renderAkun,
  admin: adminViews.renderAdmin,
  pencabutan: pencabutanViews.renderPencabutan,
  analitik: analitikViews.renderAnalitik,
  notifikasi: notifConfigViews.renderNotifConfig,
  audit: securityViews.renderAudit,
  akses: securityViews.renderAkses,
  keamanan: securityViews.renderKeamanan,
};

function currentRole() {
  return ROLES.find((r) => r.k === state.role);
}

/** Applications in the stages handled by a role (legacy inStage). */
function queueOf(role) {
  const antrian = state.data.antrian ?? [];
  return role.stages ? antrian.filter((q) => role.stages.includes(q.tahap))
    : [];
}

/**
 * Merge a patch into state and re-render.
 * @param {!Object} patch
 * @param {{focus: (boolean|undefined)}=} options focus = move focus to the
 *     new screen heading (page navigation).
 */
function setState(patch, options = {}) {
  Object.assign(state, patch);
  ensureData();
  render();
  if (options.focus) {
    qs(`#page-${state.page} h1`)?.focus();
  }
}

async function load(key) {
  state.status[key] = 'loading';
  render();
  try {
    state.data[key] = await RESOURCES[key]();
    state.status[key] = 'ok';
  } catch (error) {
    state.status[key] = 'error';
    state.errors = { ...state.errors, [key]: error.message };
  }
  render();
}

/** Start loading every resource the current page needs (once). */
function ensureData() {
  for (const key of PAGE_NEEDS[state.page]) {
    if (!state.status[key]) {
      load(key);
    }
  }
}

function render() {
  renderSidebar();
  const needs = PAGE_NEEDS[state.page];
  const failed = needs.filter((k) => state.status[k] === 'error');
  const isReady = needs.every((k) => state.status[k] === 'ok');
  const loadingEl = qs('#page-loading');
  loadingEl.hidden = isReady || failed.length > 0;
  setBusy(qs('#main'), !isReady && failed.length === 0);
  qs('#page-error').hidden = failed.length === 0;
  if (failed.length) {
    qs('#page-error-text').textContent =
      `Data gagal dimuat: ${state.errors?.[failed[0]] ?? 'kesalahan server.'}`;
  }
  for (const page of PAGES) {
    qs(`#page-${page}`).hidden = !isReady || page !== state.page;
  }
  if (isReady) {
    PAGE_RENDER[state.page]();
  }
}

function renderSidebar() {
  const role = currentRole();
  const hasQueue = state.status.antrian === 'ok';
  const roleList = qs('#role-list');
  preserveFocus(roleList, () => setHtml(roleList, html`${ROLES.map((r) => {
    const isActive = r.k === state.role;
    const count = hasQueue ? queueOf(r).length : 0;
    return html`<li><button type="button" data-role="${r.k}"
      data-focus-key="role-${r.k}" aria-pressed="${String(isActive)}"
      class="flex w-full cursor-pointer justify-between gap-2 rounded-lg
             px-2.5 py-2.25 text-left ${isActive ? ACTIVE_NAV : IDLE_NAV}">
      <span>${r.label}</span>
      ${count ? html`<span class="rounded-full bg-primary-content/10 px-1.75
        py-px text-[11px] font-extrabold"
        aria-label="${count} dalam antrian">${count}</span>` : ''}
    </button></li>`;
  })}`));

  const menuList = qs('#menu-list');
  preserveFocus(menuList, () => setHtml(menuList, html`${MENU[role.k].map(
    ([key, label]) => {
      const isActive = key === state.page;
      return html`<li><button type="button" data-page="${key}"
        data-focus-key="menu-${key}"
        ${isActive ? html`aria-current="page"` : ''}
        class="w-full cursor-pointer rounded-lg px-2.5 py-2.25 text-left
               ${isActive ? ACTIVE_NAV : IDLE_NAV}">${label}</button></li>`;
    })}`));
  qs('#me-nama').textContent = role.nama;
  qs('#me-jab').textContent = role.jab;
}

function selectRole(key) {
  const role = ROLES.find((r) => r.k === key);
  queueViews.resetPager();
  state.jenis = '';
  setState({ role: key, page: role.home, sel: null, marks: {}, notes: {},
    decisionNote: null });
}

function bindShell() {
  setHtml(qs('#brand'), brand({ subtitle: 'Back office PPTKA', size: 'sm',
    href: 'index.html' }));
  qs('#role-list').addEventListener('click', (event) => {
    const button = event.target.closest('[data-role]');
    if (button) {
      selectRole(button.dataset.role);
    }
  });
  qs('#menu-list').addEventListener('click', (event) => {
    const button = event.target.closest('[data-page]');
    if (button) {
      setState({ page: button.dataset.page });
    }
  });
  qs('#page-retry').addEventListener('click', () => {
    for (const key of PAGE_NEEDS[state.page]) {
      if (state.status[key] === 'error') {
        load(key);
      }
    }
  });
}

bindShell();
ensureData();
render();
