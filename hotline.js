/**
 * @fileoverview TKA Hotline page (migrated from TKA Hotline.dc.html).
 * Two modes in the header: Pemberi kerja (profil, tiket saya, buat tiket,
 * state belum login) and Agen / petugas (login agen, antrian tiket,
 * dasbor). Each mode remembers its own active view, like the legacy.
 */

import { brand } from '../components/brand.js';
import { qs, qsa, setHtml, setVisible } from '../components/dom.js';
import { createChat } from './hotline/chat.js';
import {
  DEFAULT_AGENT, MODES, NAV, PK_SESSION, VIEW_SECTION,
} from './hotline/config.js';
import { createDashboard } from './hotline/dashboard.js';
import {
  bindBaruForm, bindLoginForm, bindProfilForm,
} from './hotline/forms.js';

const TOAST_MS = 3000;
const MODE_ACTIVE = ['bg-base-100', 'text-primary'];
const MODE_IDLE = ['text-primary-content/80'];
const NAV_ACTIVE = ['bg-primary-content/20', 'text-primary-content'];
const NAV_IDLE = ['text-primary-content/70'];

const state = {
  mode: 'pk',
  view: { pk: 'tiket', agen: 'antrian' },
  agent: DEFAULT_AGENT,
};

const chat = createChat({
  session: () => ({ mode: state.mode, agent: state.agent }),
  toast,
});
const dashboard = createDashboard();

function currentView() {
  return state.view[state.mode];
}

function setMode(mode) {
  if (mode === state.mode) {
    return;
  }
  state.mode = mode;
  chat.reset(MODES.find((m) => m.key === mode).defaultTicket);
  render();
}

function goView(view) {
  state.view[state.mode] = view;
  render();
}

function render() {
  renderHeader();
  const section = VIEW_SECTION[currentView()];
  for (const el of qsa('[data-view]')) {
    setVisible(el, el.dataset.view === section);
  }
  if (section === 'chat') {
    chat.load();
  } else if (section === 'dashboard') {
    dashboard.load();
  }
}

function renderHeader() {
  for (const button of qsa('[data-mode]')) {
    const active = button.dataset.mode === state.mode;
    button.classList.remove(...MODE_ACTIVE, ...MODE_IDLE);
    button.classList.add(...(active ? MODE_ACTIVE : MODE_IDLE));
    button.setAttribute('aria-pressed', String(active));
  }
  const nav = qs('#view-nav');
  nav.replaceChildren(...NAV[state.mode].map(([key, label]) => {
    const active = key === currentView();
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.goView = key;
    button.className = 'cursor-pointer whitespace-nowrap rounded-lg px-3 py-2';
    button.classList.add(...(active ? NAV_ACTIVE : NAV_IDLE));
    if (active) {
      button.setAttribute('aria-current', 'page');
    }
    button.textContent = label;
    return button;
  }));
  const isPk = state.mode === 'pk';
  qs('#who').textContent = isPk ? PK_SESSION.name : state.agent;
  qs('#who-sub').textContent = isPk
    ? `${PK_SESSION.perusahaan} · ${PK_SESSION.akun}`
    : 'Agen hotline PPTKA';
}

/**
 * Short-lived DaisyUI toast (aria-live region #toast).
 * @param {string} message
 * @param {string=} tone 'success' | 'error'
 */
function toast(message, tone = 'success') {
  const item = document.createElement('div');
  item.className = `alert ${tone === 'error' ? 'alert-error' : 'alert-success'}
    animate-fade-in text-sm`;
  item.setAttribute('role', tone === 'error' ? 'alert' : 'status');
  item.textContent = message;
  qs('#toast').append(item);
  window.setTimeout(() => item.remove(), TOAST_MS);
}

function bindEvents() {
  document.addEventListener('click', (event) => {
    const modeButton = event.target.closest('[data-mode]');
    if (modeButton) {
      setMode(modeButton.dataset.mode);
      return;
    }
    const viewButton = event.target.closest('[data-go-view]');
    if (viewButton) {
      goView(viewButton.dataset.goView);
    }
  });
  qs('#open-new').addEventListener('click', () => goView('baru'));
  bindProfilForm({ onSaved: () => goView('tiket') });
  bindBaruForm({
    onCreated: (tiket) => {
      chat.select(tiket.no);
      goView('tiket');
      toast(`Tiket ${tiket.no} berhasil dikirim.`);
    },
  });
  bindLoginForm({
    onLoggedIn: (name) => {
      state.agent = name;
      goView('antrian');
    },
  });
}

setHtml(qs('#brand'), brand({ title: 'TKA Hotline', href: 'index.html',
  size: 'sm' }));
chat.reset(MODES[0].defaultTicket);
bindEvents();
render();
