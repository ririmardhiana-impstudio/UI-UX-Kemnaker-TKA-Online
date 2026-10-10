/**
 * @fileoverview "Tiket saya" (pemberi kerja) / "Antrian tiket" (agen):
 * ticket list with status filter + search, conversation thread, agent
 * lock actions (ambil / tutup / buka kembali) and the reply composer.
 * Business rules (lock, state machine) are enforced by the API; the UI
 * mirrors them to decide which action button to show.
 */

import {
  closeTiket, listTiket, listTiketMessages, postTiketMessage, reopenTiket,
  takeTiket,
} from '../../api/tiket.js';
import { createStatusBadge } from '../../components/status-badge.js';
import {
  fillSlots, qs, renderList, setBusy, setVisible,
} from '../../components/dom.js';
import { validateTiketMessage } from '../../contracts/tiket.js';
import {
  CANNED_REPLIES, INTERNAL_QUEUES, PK_SESSION, STATUS_FILTERS,
} from './config.js';
import { clearFieldErrors, showFieldErrors } from './form-errors.js';

const CHIP_BASE = 'cursor-pointer rounded-full border px-2.5 py-1.25 ' +
  'text-xs font-bold';
const CHIP_ACTIVE = 'border-primary bg-primary text-primary-content';
const CHIP_IDLE = 'border-base-300 bg-base-100 text-base-content/80';
const BUBBLE_MINE = ['bg-primary', 'text-primary-content', 'border-primary'];
const BUBBLE_OTHER = ['bg-base-100', 'border-base-300'];
const SHORT_DATE = / September 2026/;

/**
 * @param {{session: function(): {mode: string, agent: string},
 *     toast: function(string, string=)}} deps
 * @return {{reset: function(string), load: function(): !Promise}}
 */
export function createChat({ session, toast }) {
  const el = {
    title: qs('#list-title'),
    openNew: qs('#open-new'),
    search: qs('#ticket-search'),
    filters: qs('#ticket-filters'),
    wrap: qs('#ticket-list-wrap'),
    list: qs('#ticket-list'),
    listLoading: qs('#ticket-list-loading'),
    listError: qs('#ticket-list-error'),
    listEmpty: qs('#ticket-list-empty'),
    thread: qs('#thread'),
    threadLoading: qs('#thread-loading'),
    threadError: qs('#thread-error'),
    messages: qs('#messages'),
    closed: qs('#thread-closed'),
    canned: qs('#canned-bar'),
    composer: qs('#composer'),
    draft: qs('#draft'),
    aside: qs('#agent-aside'),
    section: qs('#view-chat'),
  };
  const tpl = { ticket: qs('#tpl-ticket'), message: qs('#tpl-message') };
  const state = {
    tickets: [], messages: [], filter: 'Semua', search: '', sel: null,
  };
  let threadRequest = 0;

  const isPk = () => session().mode === 'pk';
  const agent = () => session().agent;
  const current = () =>
    state.tickets.find((t) => t.no === state.sel) ?? state.tickets[0];

  function reset(defaultTicket) {
    state.filter = 'Semua';
    state.search = '';
    state.sel = defaultTicket;
    el.search.value = '';
    el.draft.value = '';
  }

  async function load() {
    renderChrome();
    setVisible(el.listError, false);
    setVisible(el.listLoading, true);
    el.list.replaceChildren();
    setBusy(el.wrap, true);
    try {
      state.tickets = await listTiket(
        isPk() ? { perusahaan: PK_SESSION.perusahaan } : {});
      renderTickets();
      await loadThread();
    } catch (error) {
      qs('[data-slot="message"]', el.listError).textContent = error.message;
      setVisible(el.listError, true);
    } finally {
      setVisible(el.listLoading, false);
      setBusy(el.wrap, false);
    }
  }

  function renderChrome() {
    const pk = isPk();
    el.title.textContent = pk ? 'Tiket saya' : 'Tiket masuk';
    setVisible(el.openNew, pk);
    setVisible(el.aside, !pk);
    setVisible(el.canned, !pk);
    el.section.classList.toggle('lg:grid-cols-[380px_minmax(0,1fr)]', pk);
    el.section.classList.toggle(
      'lg:grid-cols-[380px_minmax(0,1fr)_280px]', !pk);
  }

  function renderFilters() {
    el.filters.replaceChildren(...STATUS_FILTERS.map((f) => {
      const count = f === 'Semua' ? state.tickets.length
        : state.tickets.filter((t) => t.status === f).length;
      const button = document.createElement('button');
      const active = state.filter === f;
      button.type = 'button';
      button.dataset.filter = f;
      button.className = `${CHIP_BASE} ${active ? CHIP_ACTIVE : CHIP_IDLE}`;
      button.setAttribute('aria-pressed', String(active));
      button.textContent = `${f} · ${count}`;
      return button;
    }));
  }

  function visibleTickets() {
    const term = state.search.trim().toLowerCase();
    return state.tickets
      .filter((t) => state.filter === 'Semua' || t.status === state.filter)
      .filter((t) => !term || [t.no, t.perusahaan, t.kategori, t.judul]
        .some((v) => v.toLowerCase().includes(term)));
  }

  function renderTickets() {
    renderFilters();
    const rows = visibleTickets();
    const selNo = current()?.no;
    setVisible(el.listEmpty, rows.length === 0);
    renderList(el.list, tpl.ticket, rows, (node, t) => {
      const on = t.no === selNo;
      const button = qs('button', node);
      button.dataset.no = t.no;
      button.classList.toggle('bg-base-200', on);
      button.classList.toggle('bg-base-100', !on);
      if (on) {
        button.setAttribute('aria-current', 'true');
      }
      setVisible(qs('[data-role="bar"]', node), on);
      fillSlots(node, {
        no: t.no, judul: t.judul, lock: t.lock,
        sub: isPk() ? t.kategori : `${t.perusahaan} · ${t.kategori}`,
        tgl: t.tgl.replace(SHORT_DATE, ' Sep'),
      });
      qs('[data-role="badge"]', node)
        .replaceWith(createStatusBadge(t.status, t.tone));
      setVisible(qs('[data-role="locked"]', node), isLockedByOther(t));
    });
  }

  function isLockedByOther(t) {
    return !isPk() && Boolean(t.lock) && t.lock !== agent() &&
      t.status !== 'Selesai';
  }

  async function loadThread() {
    const cur = current();
    renderHeader(cur);
    el.messages.replaceChildren();
    setVisible(el.closed, false);
    setVisible(el.threadError, false);
    if (!cur) {
      return;
    }
    const request = ++threadRequest;
    setVisible(el.threadLoading, true);
    setBusy(el.thread, true);
    try {
      const messages = await listTiketMessages(cur.no);
      if (request === threadRequest) {
        state.messages = messages;
        renderMessages();
      }
    } catch (error) {
      if (request === threadRequest) {
        qs('[data-slot="message"]', el.threadError).textContent =
          error.message;
        setVisible(el.threadError, true);
      }
    } finally {
      if (request === threadRequest) {
        setVisible(el.threadLoading, false);
        setBusy(el.thread, false);
      }
    }
  }

  function renderHeader(cur) {
    const t = cur ?? { no: '—', kategori: '—', judul: '', tgl: '—' };
    fillSlotsById({ 'cur-no': t.no, 'cur-kategori': t.kategori,
      'cur-judul': t.judul, 'cur-tgl': t.tgl, 'cur-lock': t.lock,
      'cur-agen': t.agen ?? agent(), 'aside-perusahaan': t.perusahaan,
      'aside-kategori': t.kategori,
      'aside-akun': t.perusahaan === PK_SESSION.perusahaan
        ? PK_SESSION.akun : '—' });
    const badgeSlot = qs('#cur-status');
    badgeSlot.replaceChildren(cur ? createStatusBadge(t.status, t.tone) : '');
    const agenMode = !isPk() && Boolean(cur);
    const mine = t.lock === agent() && t.status !== 'Selesai';
    setVisible(qs('#cur-locked'), agenMode && isLockedByOther(t));
    setVisible(qs('#act-take'), agenMode && t.status === 'Baru');
    setVisible(qs('#act-close'), agenMode && mine);
    setVisible(qs('#act-reopen'), agenMode && t.status === 'Selesai');
    setVisible(el.closed, false);
  }

  function renderMessages() {
    const mineSender = isPk() ? 'pk' : 'agen';
    renderList(el.messages, tpl.message, state.messages, (node, m) => {
      const mine = m.sender === mineSender;
      node.classList.add(mine ? 'justify-items-end' : 'justify-items-start');
      qs('[data-role="bubble"]', node).classList
        .add(...(mine ? BUBBLE_MINE : BUBBLE_OTHER));
      fillSlots(node, { from: m.from, time: m.time, text: m.text,
        file: m.file, ext: m.ext, size: m.size });
      setVisible(qs('[data-role="file"]', node), Boolean(m.file));
    });
    setVisible(el.closed, current()?.status === 'Selesai');
    el.thread.scrollTop = el.thread.scrollHeight;
  }

  function replaceTicket(updated) {
    state.tickets = state.tickets.map((t) =>
      (t.no === updated.no ? updated : t));
  }

  async function runAction(button, action, successText) {
    const cur = current();
    button.disabled = true;
    try {
      replaceTicket(await action(cur.no, agent()));
      renderTickets();
      await loadThread();
      toast(successText);
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      button.disabled = false;
    }
  }

  async function send(event) {
    event.preventDefault();
    const cur = current();
    const body = { sender: isPk() ? 'pk' : 'agen',
      author: isPk() ? PK_SESSION.name : agent(), text: el.draft.value };
    const result = validateTiketMessage({ ...body, text: body.text.trim() });
    if (!result.valid) {
      showFieldErrors(el.composer, { text: result.errors.text ??
        Object.values(result.errors)[0] });
      return;
    }
    clearFieldErrors(el.composer);
    const button = qs('#send');
    button.disabled = true;
    try {
      state.messages.push(await postTiketMessage(cur.no, body));
      el.draft.value = '';
      renderMessages();
    } catch (error) {
      showFieldErrors(el.composer, { text: error.message });
    } finally {
      button.disabled = false;
    }
  }

  function bindEvents() {
    el.filters.addEventListener('click', (event) => {
      const button = event.target.closest('[data-filter]');
      if (button) {
        state.filter = button.dataset.filter;
        renderTickets();
      }
    });
    el.search.addEventListener('input', () => {
      state.search = el.search.value;
      renderTickets();
    });
    el.list.addEventListener('click', (event) => {
      const button = event.target.closest('[data-no]');
      if (!button || button.dataset.no === state.sel) {
        return;
      }
      state.sel = button.dataset.no;
      el.draft.value = '';
      clearFieldErrors(el.composer);
      renderTickets();
      loadThread();
    });
    qs('[data-retry="list"]').addEventListener('click', load);
    qs('[data-retry="thread"]').addEventListener('click', loadThread);
    qs('#act-take').addEventListener('click', (e) => runAction(
      e.currentTarget, takeTiket, 'Tiket diambil.'));
    qs('#act-close').addEventListener('click', (e) => runAction(
      e.currentTarget, closeTiket, 'Tiket ditutup.'));
    qs('#act-reopen').addEventListener('click', (e) => runAction(
      e.currentTarget, reopenTiket, 'Tiket dibuka kembali.'));
    el.composer.addEventListener('submit', send);
    el.canned.addEventListener('click', (event) => {
      const button = event.target.closest('[data-canned]');
      if (button) {
        el.draft.value = `${button.dataset.canned}.`;
        el.draft.focus();
      }
    });
  }

  function renderStatic() {
    el.canned.append(...CANNED_REPLIES.map((label) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.canned = label;
      button.className = 'cursor-pointer rounded-full bg-base-200 px-2.5 ' +
        'py-1.25 text-xs hover:bg-base-300';
      button.textContent = label;
      return button;
    }));
    qs('#internal-list').append(...INTERNAL_QUEUES.map((label) => {
      const item = document.createElement('li');
      item.className = 'rounded-lg border border-base-300 px-2.5 py-2';
      item.textContent = label;
      return item;
    }));
  }

  renderStatic();
  bindEvents();
  return {
    reset,
    load,
    /** Select a ticket (e.g. right after creating it) then reload. */
    select(no) {
      state.sel = no;
      state.filter = 'Semua';
      state.search = '';
      el.search.value = '';
    },
  };
}

function fillSlotsById(values) {
  for (const [id, value] of Object.entries(values)) {
    qs(`#${id}`).textContent = value ?? '';
  }
}
