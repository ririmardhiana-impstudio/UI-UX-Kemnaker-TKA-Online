/**
 * @fileoverview Verifikator screens "Beranda" (ringkasan) and "Daftar
 * Pemberi Kerja" (tabel pendaftar online: filter status, cari, pager).
 * Row actions: Detail (navigates) and Verifikasi (action 'verify',
 * handled in verify-dialog.js).
 */

import { emptyState } from '../../components/empty-state.js';
import { html, qs } from '../../components/dom.js';
import { statusBadge } from '../../components/status-badge.js';
import { hpkBerandaCard } from './hpk-list-view.js';
import { formatNpwp } from '../../components/form-ui.js';
import {
  BTN_OUTLINE, CARD, CALLOUT_INFO, LINK, THEAD, mountPaged, navAttrs,
  pageTitle, pagerSlot,
} from '../portal/ui.js';
import {
  ACTIVE, FIX, STATUS_FILTERS, WAITING, matchesStatus, setFilter, state,
} from './state.js';

const STAT_TONE = {
  [WAITING]: 'text-warning', [FIX]: 'text-error', [ACTIVE]: 'text-success',
  Ditolak: 'text-error',
};

/** NPWP shown in tables; "—" when the pendaftar has none (Non-OSS). */
export function npwpText(row) {
  return row.npwp && row.npwp !== '—' ? formatNpwp(row.npwp) : '—';
}

function count(status) {
  return state.rows.filter((r) => matchesStatus(r, status)).length;
}

function statCard({ key, label }) {
  return html`<button type="button" ${navAttrs('daftar', { status: key })}
      class="${CARD} grid gap-1 p-4 text-left transition-colors
        hover:bg-base-200/50">
    <span class="text-xs font-bold text-base-content/60">${label}</span>
    <span class="text-[28px] font-extrabold leading-none
      ${STAT_TONE[key] ?? 'text-base-content'}">${count(key)}</span>
    <span class="text-xs text-base-content/60">Lihat daftar →</span>
  </button>`;
}

/** Beranda: ringkasan jumlah per status + antrean menunggu verifikasi. */
export function renderBeranda() {
  const waiting = state.rows.filter((r) => r.status === WAITING);
  return html`
    ${pageTitle({
      eyebrow: 'Selamat datang, Andika Pratama',
      title: 'Verifikasi Akun Pemberi Kerja',
      desc: 'Periksa data perusahaan, email admin, data operator, dan ' +
        'dokumen pendaftar, lalu verifikasi agar sistem mengirim email ' +
        'aktivasi akses TKA Online.',
    })}
    <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      aria-label="Ringkasan status pendaftar">
      ${STATUS_FILTERS.slice(1).map(statCard)}
    </section>
    <section class="${CARD}" aria-labelledby="antrean-title">
      <div class="flex flex-wrap items-center justify-between gap-2.5
          border-b border-base-200 px-5 py-4">
        <h2 id="antrean-title" class="text-[15px] font-bold">
          Menunggu verifikasi (${waiting.length})</h2>
        <button type="button" ${navAttrs('daftar', { status: WAITING })}
          class="${LINK} text-[13px]">Lihat semua →</button>
      </div>
      ${waiting.length ? html`<ul class="divide-y divide-base-200">
        ${waiting.slice(0, 5).map((row) => html`<li class="flex flex-wrap
            items-center justify-between gap-3 px-5 py-3.5">
          <div class="min-w-0"><p class="text-sm font-bold">${row.nama}</p>
            <p class="text-xs text-base-content/60">${row.kategori} ·
              daftar ${row.tgl}</p></div>
          <button type="button" ${navAttrs('detail', { id: row.id })}
            class="btn btn-sm btn-primary">Periksa</button></li>`)}
      </ul>` : html`<p class="px-5 py-7 text-center text-sm
        text-base-content/60">Tidak ada pendaftar yang menunggu
        verifikasi.</p>`}
    </section>
    ${hpkBerandaCard()}
    <div class="${CALLOUT_INFO}"><b>Alur verifikasi:</b> pemohon menekan
      "Submit Verifikasi" di registrasi → data operator, perusahaan, dan
      dokumen masuk ke daftar ini → Verifikator memeriksa Detail →
      <b>Verifikasi</b> → sistem mengirim email aktivasi ke email admin
      dan operator.</div>`;
}

function rowMarkup(row) {
  return html`<tr>
    <td><p class="font-bold">${row.nama}</p>
      <p class="text-xs text-base-content/60">${row.kategori}</p></td>
    <td class="w-px whitespace-nowrap font-mono text-[13px]">
      ${npwpText(row)}</td>
    <td class="text-[13px]">${row.emailAdmin || '—'}</td>
    <td class="text-center">${row.operators.length}</td>
    <td class="whitespace-nowrap text-[13px]">${row.tgl}</td>
    <td>${statusBadge(row.status, row.tone)}</td>
    <td><div class="flex justify-end gap-1.5">
      <button type="button" ${navAttrs('detail', { id: row.id })}
        class="btn btn-sm btn-primary"
        aria-label="Detail ${row.nama}">Detail</button>
    </div></td></tr>`;
}

function filteredRows() {
  const q = state.q.trim().toLowerCase();
  return state.rows.filter((row) => matchesStatus(row, state.status) &&
    (!q || [row.nama, row.npwp, row.emailAdmin, row.sso]
      .some((v) => String(v ?? '').toLowerCase().includes(q))));
}

function tabButton({ key, label }) {
  const active = state.status === key;
  return html`<button type="button" data-filter="${key}"
      data-focus-key="filter-${key || 'semua'}" aria-pressed="${active}"
      class="btn btn-sm ${active ? 'btn-primary' : BTN_OUTLINE}">
    ${label} <span class="${active ? 'opacity-80' : 'text-base-content/60'}">
      ${count(key)}</span></button>`;
}

/** Daftar Pemberi Kerja. */
export function renderDaftar() {
  return html`
    ${pageTitle({
      eyebrow: 'Verifikasi Akun',
      title: 'Daftar Pemberi Kerja',
      desc: 'Pemberi Kerja yang sudah melakukan registrasi online — data ' +
        'perusahaan terdaftar di WLKP dan operator terdaftar di SIAPKerja.',
    })}
    <section class="${CARD}" aria-label="Tabel daftar pemberi kerja">
      <div class="flex flex-wrap items-center gap-3 border-b border-base-200
          px-5 py-4">
        <div class="flex flex-wrap gap-2" role="group"
          aria-label="Filter status">${STATUS_FILTERS.map(tabButton)}</div>
        <input type="search" id="verif-search" value="${state.q}"
          aria-label="Cari pemberi kerja"
          placeholder="Cari nama, NPWP, atau email…" autocomplete="off"
          class="input input-sm ms-auto w-full sm:w-72"
          data-testid="verifikator-input-cari" />
      </div>
      <div class="overflow-x-auto">
        <table class="table min-w-[960px] text-sm">
          <caption class="sr-only">Daftar pemberi kerja yang mendaftar
            online</caption>
          <thead class="${THEAD}"><tr>
            <th scope="col">Pemberi Kerja</th><th scope="col">NPWP</th>
            <th scope="col">Email Admin</th>
            <th scope="col" class="text-center">Operator</th>
            <th scope="col">Tgl daftar</th><th scope="col">Status</th>
            <th scope="col"><span class="sr-only">Aksi</span></th>
          </tr></thead>
          <tbody id="verif-rows"></tbody>
        </table>
      </div>
      ${pagerSlot('verif-pager')}
    </section>`;
}

function drawRows(root) {
  mountPaged(root, {
    body: '#verif-rows', footer: '#verif-pager', items: filteredRows(),
    row: rowMarkup,
    empty: html`<tr><td colspan="7">${emptyState({
      title: 'Tidak ada pemberi kerja yang cocok',
      body: 'Ubah filter status atau kata kunci pencarian.',
    })}</td></tr>`,
  });
}

export function mountDaftar(root) {
  drawRows(root);
  for (const button of root.querySelectorAll('[data-filter]')) {
    button.addEventListener('click', () =>
      setFilter({ status: button.dataset.filter }));
  }
  qs('#verif-search', root).addEventListener('input', (event) => {
    setFilter({ q: event.target.value }, { silent: true });
    drawRows(root);
  });
}
