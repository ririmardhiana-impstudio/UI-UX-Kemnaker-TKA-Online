/**
 * @fileoverview Menu "Hasil Penilaian dan Kelayakan (HPK)" (page key
 * "hpkHasil"): tabel pengajuan HPK with search (>= 3 huruf), sort per
 * kolom, status filter and pagination, plus the dispatcher to the form
 * (params {baru} / {edit}) and detail (params {id}) views.
 */

import { html, qs, setHtml } from '../../components/dom.js';
import { emptyState } from '../../components/empty-state.js';
import { createPager } from '../../components/pagination.js';
import { statusBadge } from '../../components/status-badge.js';
import { PK_STATUS_LIST } from '../../contracts/penilaian-kelayakan.js';
import {
  PAGE, cache, load, tanggal,
} from './hpk-hasil-data.js';
import * as detail from './hpk-hasil-detail.js';
import * as form from './hpk-hasil-form.js';
import { state } from './state.js';
import {
  BTN, LINK, THEAD, navAttrs, pageTitle, pagerSlot,
} from './ui.js';

export { load };

const MIN_QUERY = 3;
const COLUMNS = [
  { key: 'tanggal', label: 'Tanggal', cls: 'w-[185px]' },
  { key: 'noHpk', label: 'No. HPK', cls: 'w-[150px]' },
  { key: 'jenis', label: 'Tipe HPK', cls: '' },
  { key: 'status', label: 'Status', cls: 'w-[200px]' },
];
const ARIA_SORT = { asc: 'ascending', desc: 'descending' };
const ARROW = { asc: '▲', desc: '▼' };

function compare({ key, dir }) {
  const factor = dir === 'asc' ? 1 : -1;
  const rank = (row) => key === 'status'
    ? PK_STATUS_LIST.indexOf(row.status) : row[key];
  return (a, b) => {
    const x = rank(a);
    const y = rank(b);
    const order = typeof x === 'number' ? x - y : String(x)
      .localeCompare(String(y), 'id');
    return order ? order * factor
      : b.id.localeCompare(a.id, 'en', { numeric: true });
  };
}

function headRow(sort) {
  return html`<tr class="${THEAD}">
    <th scope="col" class="w-14">No</th>
    ${COLUMNS.map((c) => html`<th scope="col" class="${c.cls}"
      aria-sort="${c.key === sort.key ? ARIA_SORT[sort.dir] : 'none'}">
      <button type="button" data-hpk-sort="${c.key}"
        class="inline-flex items-center gap-1 font-bold hover:text-base-content"
        aria-label="Urutkan ${c.label}">${c.label}
        <span aria-hidden="true" class="text-[10px]">${c.key === sort.key
          ? ARROW[sort.dir] : '↕'}</span></button></th>`)}
    <th scope="col" class="w-[120px] text-right">Aksi</th></tr>`;
}

function listRow(r, no) {
  return html`<tr>
    <td class="text-base-content/70">${no}</td>
    <td>${tanggal(r.tanggal)}</td>
    <td class="font-mono font-bold">${r.noHpk}</td>
    <td>${r.jenis}</td>
    <td>${statusBadge(r.status, r.tone)}</td>
    <td><div class="flex justify-end gap-3">
      <button type="button" class="${LINK} text-xs"
        ${navAttrs(PAGE, { id: r.id })}
        aria-label="Lihat ${r.noHpk}">Lihat</button>
      ${r.bisaDiubah ? html`<button type="button" class="${LINK} text-xs"
        ${navAttrs(PAGE, { edit: r.id })}
        aria-label="Ubah ${r.noHpk}">Ubah</button>` : ''}</div></td></tr>`;
}

function renderList() {
  const c = cache();
  const add = html`<button type="button" class="${BTN}"
    ${navAttrs(PAGE, { baru: 1 })} data-testid="hpk-btn-ajukan">+ Ajukan HPK
    </button>`;
  const intro = pageTitle({ title: 'Hasil Penilaian dan Kelayakan (HPK)',
    desc: 'Ajukan penilaian kelayakan, pantau verifikasi, jadwal ekspose, ' +
      'dan BAP hingga surat HPK terbit.', actions: add });
  if (!c.list.length) {
    return html`${intro}${emptyState({ icon: '▤',
      title: 'Belum ada pengajuan HPK',
      body: 'Pengajuan yang Anda simpan atau kirim akan tampil di sini ' +
        'beserta statusnya.',
      action: { label: 'Ajukan HPK', attrs: navAttrs(PAGE, { baru: 1 }) } })}`;
  }
  return html`${intro}
    <div class="flex flex-wrap items-end gap-3">
      <div class="grid gap-1.5">
        <label for="hpk-q" class="text-sm font-bold">Cari</label>
        <input id="hpk-q" type="search" value="${c.q}" autocomplete="off"
          class="input h-10 w-full md:w-80"
          placeholder="No. HPK, tipe HPK, atau status"
          aria-describedby="hpk-q-hint">
        <p id="hpk-q-hint" class="text-xs text-base-content/60">Ketik minimal
          ${MIN_QUERY} huruf.</p></div>
      <div class="grid gap-1.5 self-start">
        <label for="hpk-status" class="text-sm font-bold">Status</label>
        <select id="hpk-status" class="select h-10 w-auto">
          <option value="">Semua status</option>
          ${PK_STATUS_LIST.map((s) => html`<option value="${s}"
            ${s === c.status ? 'selected' : ''}>${s}</option>`)}
        </select></div></div>
    <p id="hpk-count" role="status" class="sr-only"></p>
    <section class="rounded-box border border-base-300 bg-base-100
        overflow-hidden" aria-label="Tabel pengajuan HPK">
      <div id="hpk-table" class="overflow-x-auto"><table
          class="table min-w-[820px] text-[13px]">
        <caption class="sr-only">Pengajuan Hasil Penilaian dan Kelayakan
          (HPK)</caption>
        <thead id="hpk-head"></thead><tbody id="hpk-body"></tbody></table>
      </div>
      <div id="hpk-empty" hidden></div>
      ${pagerSlot('hpk-pager')}</section>`;
}

function visibleRows(c) {
  const needle = c.q.trim().toLowerCase();
  const search = needle.length >= MIN_QUERY;
  return c.list
    .filter((r) => !c.status || r.status === c.status)
    .filter((r) => !search || [r.noHpk, r.jenis, r.status, tanggal(r.tanggal)]
      .some((v) => v.toLowerCase().includes(needle)))
    .sort(compare(c.sort));
}

function mountList(root) {
  const c = cache();
  const input = qs('#hpk-q', root);
  if (!input) {
    return;
  }
  const head = qs('#hpk-head', root);
  const pager = createPager(qs('#hpk-pager', root), { onChange: draw,
    label: 'Navigasi halaman tabel HPK' });

  function draw() {
    const items = visibleRows(c);
    const rows = pager.update(items);
    setHtml(head, headRow(c.sort));
    setHtml(qs('#hpk-body', root), html`${rows.map((r) =>
      listRow(r, items.indexOf(r) + 1))}`);
    qs('#hpk-table', root).hidden = !items.length;
    const empty = qs('#hpk-empty', root);
    empty.hidden = items.length > 0;
    setHtml(empty, items.length ? html`` : emptyState({
      title: 'Tidak ada hasil',
      body: 'Ubah kata kunci atau filter status.',
      action: { label: 'Reset pencarian', attrs: html`data-hpk-reset` } }));
    qs('#hpk-count', root).textContent = `${items.length} pengajuan ` +
      'ditampilkan.';
  }
  const redraw = () => {
    pager.reset();
    draw();
  };
  input.addEventListener('input', () => {
    c.q = input.value;
    redraw();
  });
  qs('#hpk-status', root).addEventListener('change', (event) => {
    c.status = event.target.value;
    redraw();
  });
  head.addEventListener('click', (event) => {
    const key = event.target.closest('[data-hpk-sort]')?.dataset.hpkSort;
    if (!key) {
      return;
    }
    c.sort = { key, dir: c.sort.key === key && c.sort.dir === 'asc'
      ? 'desc' : 'asc' };
    redraw();
    qs(`[data-hpk-sort="${key}"]`, head)?.focus();
  });
  qs('#hpk-empty', root).addEventListener('click', (event) => {
    if (event.target.closest('[data-hpk-reset]')) {
      Object.assign(c, { q: '', status: '' });
      input.value = '';
      qs('#hpk-status', root).value = '';
      redraw();
      input.focus();
    }
  });
  draw();
}

/** hpkHasil view: tabel / form / detail by params. */
export function render() {
  if (state.p.baru || state.p.edit) {
    return form.render();
  }
  return state.p.id ? detail.render() : renderList();
}

/** @param {!Element} root */
export function mount(root) {
  if (state.p.baru || state.p.edit) {
    form.mount(root);
  } else if (state.p.id) {
    detail.mount(root);
  } else {
    mountList(root);
  }
}

export const actions = { ...form.actions, ...detail.actions };
