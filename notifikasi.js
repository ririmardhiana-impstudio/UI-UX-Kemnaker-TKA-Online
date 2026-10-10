/**
 * @fileoverview Notifikasi pemberi kerja (KAK Modul 7): page "notifikasi"
 * (tabs Semua / Belum dibaca, mark read, mark all, item opens its tautan)
 * and the header bell (unread badge + dropdown of the 5 latest).
 * Data: GET /notifikasi?role= cached in state.extra.notifikasi (loaded by
 * mount(), not VIEWS.load, so tab switches do not flash a skeleton).
 */

import {
  listNotifikasi, markAllNotifikasiRead, markNotifikasiRead,
} from '../../api/notifikasi.js';
import { html, raw, setHtml } from '../../components/dom.js';
import { emptyState } from '../../components/empty-state.js';
import {
  TONE_SOFT_BG_CLASS, TONE_TEXT_CLASS,
} from '../../components/status-badge.js';
import { withRetry } from './data.js';
import { go, refreshView, state } from './state.js';
import {
  BTN_OUTLINE, CARD, errorView, loadingView, pageTitle, toast,
} from './ui.js';

const BELL_LATEST = 5;
const TABS = ['Semua', 'Belum dibaca'];
const KATEGORI_STYLE = {
  'Status permohonan': { icon: '↻', tone: 'blue' },
  'Tenggat dokumen': { icon: '!', tone: 'amber' },
  'Pembayaran': { icon: 'Rp', tone: 'blue' },
  'Pengesahan': { icon: '✓', tone: 'green' },
  'Sistem': { icon: 'i', tone: 'gray' },
};
const BELL_ICON = raw('<svg aria-hidden="true" viewBox="0 0 24 24" ' +
  'class="size-5" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 1 1 ' +
  '12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>' +
  '</svg>');

const timeFormat = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit',
  minute: '2-digit', timeZone: 'Asia/Jakarta',
});

let pending = null;
const bell = { el: null, onUpdate: null, error: '', role: null };

/** Load (once per role) the inbox into state.extra.notifikasi. */
function ensureLoaded() {
  const role = state.role;
  if (state.extra.notifikasi) {
    return Promise.resolve(state.extra.notifikasi);
  }
  if (pending?.role !== role) {
    const promise = withRetry(() => listNotifikasi(role)).then((inbox) => {
      if (role === state.role) {
        state.extra.notifikasi = inbox;
      }
      return inbox;
    }).finally(() => {
      if (pending?.promise === promise) {
        pending = null;
      }
    });
    pending = { role, promise };
  }
  return pending.promise;
}

/** Page-level load error (cleared by "Coba lagi"). */
let pageError = '';
let pageErrorRole = null;

function currentPageError() {
  return pageErrorRole === state.role ? pageError : '';
}

/** VIEWS mount hook: load the inbox once, then re-render the view. */
export function mount() {
  if (state.extra.notifikasi || currentPageError()) {
    return;
  }
  ensureLoaded().then(() => refreshView(), (error) => {
    pageError = error.message || 'kesalahan server.';
    pageErrorRole = state.role;
    refreshView();
  });
}

/** Unread count for the sidebar badge (0 while loading). */
export function unreadCount() {
  return state.extra.notifikasi?.unread ?? 0;
}

function formatTime(iso) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : timeFormat.format(date);
}

function kategoriIcon(kategori, size = 'size-9') {
  const style = KATEGORI_STYLE[kategori] ?? KATEGORI_STYLE.Sistem;
  return html`<span aria-hidden="true" class="grid ${size} flex-none
    place-items-center rounded-full text-xs font-extrabold
    ${TONE_SOFT_BG_CLASS[style.tone]} ${TONE_TEXT_CLASS[style.tone]}">
    ${style.icon}</span>`;
}

function itemRow(n) {
  return html`<li class="flex items-start gap-2 border-t border-base-200
      first:border-t-0 ${n.dibaca ? '' : 'bg-info/10'}">
    <button type="button" data-action="nt-open" data-id="${n.id}"
      data-focus-key="nt-open-${n.id}" data-testid="notifikasi-btn-open"
      class="flex min-w-0 flex-1 items-start gap-3.5 px-5 py-4 text-left
        hover:bg-base-200/50">
      ${kategoriIcon(n.kategori)}
      <span class="grid min-w-0 flex-1 gap-0.5">
        <span class="flex flex-wrap items-center gap-x-2 text-xs
          text-base-content/70"><span>${n.kategori}</span>
          <span aria-hidden="true">·</span>
          <time datetime="${n.waktu}">${formatTime(n.waktu)}</time></span>
        <span class="text-sm ${n.dibaca ? 'font-semibold'
          : 'font-extrabold'}">${n.judul}
          ${n.dibaca ? '' : html`<span class="sr-only">(belum dibaca)</span>`}
        </span>
        <span class="text-[13px] leading-relaxed text-base-content/70">
          ${n.isi}</span>
      </span>
      <span aria-hidden="true" class="self-center text-base-content/50">→
      </span>
    </button>
    ${n.dibaca ? '' : html`<button type="button" data-action="nt-mark"
      data-id="${n.id}" class="btn btn-ghost btn-xs mt-4 me-3 text-secondary"
      aria-label="Tandai dibaca: ${n.judul}">Tandai dibaca</button>`}
  </li>`;
}

/** notifikasi view. */
export function render() {
  if (currentPageError()) {
    return errorView(`Gagal memuat notifikasi: ${pageError}`, 'nt-retry');
  }
  if (!state.extra.notifikasi) {
    return loadingView();
  }
  const { items, unread } = state.extra.notifikasi;
  const tab = state.ui.ntTab ?? 0;
  const rows = tab === 1 ? items.filter((n) => !n.dibaca) : items;
  return html`${pageTitle({ title: 'Notifikasi',
    desc: 'Perubahan status permohonan, pengingat tenggat dokumen, ' +
      'konfirmasi pembayaran, dan pemberitahuan pengesahan.',
    actions: html`<button type="button" class="${BTN_OUTLINE} btn-sm"
      data-action="nt-read-all" data-testid="notifikasi-btn-read-all"
      ${unread ? '' : 'disabled'}>Tandai semua dibaca</button>` })}
    <div role="tablist" aria-label="Filter notifikasi"
        class="tabs tabs-border gap-6 border-b border-base-300">
      ${TABS.map((label, i) => html`<button type="button" role="tab"
        id="nt-tab-${i}" aria-selected="${i === tab}"
        aria-controls="nt-panel" tabindex="${i === tab ? '0' : '-1'}"
        data-action="nt-tab" data-tab="${i}"
        class="tab -mb-px h-auto px-0 py-2.5 text-sm font-bold
          ${i === tab ? 'tab-active' : 'text-base-content/70'}">${label}
        ${i === 1 && unread ? html`<span class="badge badge-error badge-xs
          ms-1.5 h-auto py-0.5 font-extrabold">${unread}</span>` : ''}
        </button>`)}
    </div>
    <div id="nt-panel" role="tabpanel" aria-labelledby="nt-tab-${tab}">
      ${rows.length ? html`<ul class="${CARD} overflow-hidden"
          aria-label="Daftar notifikasi">${rows.map(itemRow)}</ul>`
        : emptyState({ icon: '✓',
          title: tab === 1 ? 'Semua notifikasi sudah dibaca'
            : 'Belum ada notifikasi',
          body: 'Notifikasi baru muncul di sini dan di ikon lonceng.' })}
    </div>`;
}

const TAB_KEYS = {
  ArrowLeft: (i) => (i - 1 + TABS.length) % TABS.length,
  ArrowRight: (i) => (i + 1) % TABS.length,
  Home: () => 0,
  End: () => TABS.length - 1,
};

/** Arrow keys / Home / End move between the tabs (roving tabindex). */
document.addEventListener('keydown', (event) => {
  const tabEl = event.target.closest?.('[data-action="nt-tab"]');
  const next = TAB_KEYS[event.key];
  if (!tabEl || !next) {
    return;
  }
  event.preventDefault();
  selectTab(next(Number(tabEl.dataset.tab)));
});

/** Switch tab and keep keyboard focus on it across the re-render. */
function selectTab(index) {
  state.ui.ntTab = index;
  refreshView(`nt-tab-${index}`);
}

async function markRead(id) {
  const inbox = state.extra.notifikasi;
  const item = inbox?.items.find((n) => n.id === id);
  if (!item || item.dibaca) {
    return item;
  }
  await markNotifikasiRead(state.role, id);
  item.dibaca = true;
  inbox.unread = Math.max(0, inbox.unread - 1);
  return item;
}

export const actions = {
  'nt-tab'(el) {
    selectTab(Number(el.dataset.tab));
  },
  async 'nt-mark'(el) {
    el.disabled = true;
    try {
      await markRead(el.dataset.id);
      refreshView(`nt-open-${el.dataset.id}`);
    } catch (error) {
      el.disabled = false;
      toast(error.message || 'Gagal menandai notifikasi.', 'error');
    }
  },
  async 'nt-open'(el) {
    const item = state.extra.notifikasi?.items
      .find((n) => n.id === el.dataset.id);
    if (!item) {
      return;
    }
    document.activeElement?.blur();
    try {
      await markRead(item.id);
    } catch (error) {
      toast('Notifikasi dibuka, tetapi status baca gagal disimpan.', 'info');
    }
    go(item.tautan?.page ?? 'dashboard', item.tautan?.params ?? {});
  },
  async 'nt-read-all'(el) {
    el.disabled = true;
    el.setAttribute('aria-busy', 'true');
    try {
      const { updated } = await markAllNotifikasiRead(state.role);
      const inbox = state.extra.notifikasi;
      inbox.items.forEach((n) => {
        n.dibaca = true;
      });
      inbox.unread = 0;
      toast(`${updated} notifikasi ditandai dibaca.`);
      refreshView(`nt-tab-${state.ui.ntTab ?? 0}`);
    } catch (error) {
      el.disabled = false;
      el.removeAttribute('aria-busy');
      toast(error.message || 'Gagal menandai semua notifikasi.', 'error');
    }
  },
  'nt-retry'() {
    pageError = '';
    refreshView();
  },
  'nt-bell-retry'() {
    bell.error = '';
    mountBell(bell.el, { onUpdate: bell.onUpdate });
  },
};

function bellMenu() {
  const inbox = state.extra.notifikasi;
  if (bell.error) {
    return html`<div role="alert" class="grid gap-2 p-4 text-[13px]">
      <span class="text-error">Notifikasi gagal dimuat.</span>
      <button type="button" class="btn btn-xs justify-self-start"
        data-action="nt-bell-retry">Coba lagi</button></div>`;
  }
  if (!inbox) {
    return html`<div class="grid gap-2 p-4" aria-busy="true">
      <span class="sr-only">Memuat notifikasi…</span>
      <div class="skeleton h-10"></div><div class="skeleton h-10"></div>
    </div>`;
  }
  const latest = inbox.items.slice(0, BELL_LATEST);
  return html`<p class="flex justify-between border-b border-base-200 px-4
      py-3 text-sm font-bold">Notifikasi <span class="text-xs font-semibold
      text-base-content/70">${inbox.unread} belum dibaca</span></p>
    ${latest.length ? html`<ul class="max-h-96 overflow-auto">${latest.map(
      (n) => html`<li><button type="button" data-action="nt-open"
        data-id="${n.id}" class="flex w-full items-start gap-3 px-4 py-3
          text-left hover:bg-base-200/50 ${n.dibaca ? '' : 'bg-info/10'}">
        ${kategoriIcon(n.kategori, 'size-7')}
        <span class="grid min-w-0 gap-0.5">
          <span class="text-[13px] leading-snug ${n.dibaca ? 'font-semibold'
            : 'font-extrabold'}">${n.judul}${n.dibaca ? ''
            : html`<span class="sr-only"> (belum dibaca)</span>`}</span>
          <time datetime="${n.waktu}" class="text-[11px]
            text-base-content/70">${formatTime(n.waktu)}</time></span>
      </button></li>`)}</ul>`
      : html`<p class="px-4 py-6 text-center text-[13px]
        text-base-content/70">Belum ada notifikasi.</p>`}
    <div class="border-t border-base-200 p-1.5">
      <button type="button" data-action="go" data-page="notifikasi"
        data-params="{}" class="btn btn-ghost btn-sm w-full text-secondary"
        data-testid="portal-btn-notifikasi-semua">Lihat semua notifikasi
      </button></div>`;
}

/** Header bell markup (DaisyUI focus dropdown, synced by bindDropdowns). */
export function renderBell() {
  const unread = unreadCount();
  const label = unread ? `Notifikasi: ${unread} belum dibaca` : 'Notifikasi';
  return html`<div class="dropdown dropdown-end max-sm:static">
    <button type="button" tabindex="0" aria-expanded="false"
      aria-controls="nt-bell-menu" aria-label="${label}"
      class="btn btn-ghost btn-sm btn-circle relative"
      data-testid="portal-btn-bell">${BELL_ICON}
      ${unread ? html`<span aria-hidden="true" class="badge badge-error
        badge-xs absolute -end-1 -top-1 h-auto min-w-4 px-1 py-0.5
        text-[10px] font-extrabold">${unread > 99 ? '99+' : unread}</span>`
        : ''}</button>
    <div id="nt-bell-menu" tabindex="-1" class="dropdown-content z-sticky
        mt-2 w-80 max-w-[calc(100vw-2rem)] max-sm:fixed max-sm:inset-x-4
        max-sm:top-16 max-sm:w-auto max-sm:max-w-none rounded-box border border-base-300
        bg-base-100 shadow-lg">${bellMenu()}</div>
  </div>`;
}

/**
 * Render the bell into `el` and load the inbox once per role.
 * @param {?Element} el Header slot.
 * @param {{onUpdate: (function()|undefined)}=} options onUpdate runs after
 *     the inbox arrives (e.g. re-render the sidebar badge).
 */
export function mountBell(el, { onUpdate } = {}) {
  if (!el) {
    return;
  }
  if (bell.role !== state.role) {
    bell.role = state.role;
    bell.error = '';
  }
  bell.el = el;
  bell.onUpdate = onUpdate ?? null;
  setHtml(el, renderBell());
  if (state.extra.notifikasi || bell.error) {
    return;
  }
  ensureLoaded().then(() => {
    bell.error = '';
  }, (error) => {
    bell.error = error.message || 'error';
  }).finally(() => {
    if (bell.el?.isConnected) {
      const hadFocus = bell.el.contains(document.activeElement);
      setHtml(bell.el, renderBell());
      if (hadFocus) {
        bell.el.querySelector('[aria-controls="nt-bell-menu"]')?.focus();
      }
    }
    bell.onUpdate?.();
  });
}
