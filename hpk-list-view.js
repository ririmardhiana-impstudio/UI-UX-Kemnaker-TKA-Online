/**
 * @fileoverview Verifikator menu "Verifikasi HPK": tabel daftar pemberi
 * kerja yang mengajukan/submit HPK (filter status, cari, pager) dengan
 * aksi Detail, Verifikasi, dan Tolak. Data = GET /hpk-verifikasi.
 */

import { emptyState } from '../../components/empty-state.js';
import { html, qs } from '../../components/dom.js';
import { statusBadge } from '../../components/status-badge.js';
import {
  BTN_OUTLINE, CARD, LINK, THEAD, mountPaged, navAttrs, pageTitle, pagerSlot,
} from '../portal/ui.js';
import {
  HPK_STATUS_FILTERS, WAITING, matchesStatus, setFilter, state,
} from './state.js';

function count(status) {
  return state.hpkRows.filter((r) => matchesStatus(r, status)).length;
}

/** Beranda card: HPK menunggu verifikasi (max 5). */
export function hpkBerandaCard() {
  const waiting = state.hpkRows.filter((r) => r.status === WAITING);
  return html`<section class="${CARD}" aria-labelledby="hpk-antrean-title">
    <div class="flex flex-wrap items-center justify-between gap-2.5
        border-b border-base-200 px-5 py-4">
      <h2 id="hpk-antrean-title" class="text-[15px] font-bold">
        HPK menunggu verifikasi (${waiting.length})</h2>
      <button type="button" ${navAttrs('hpk', { status: WAITING })}
        class="${LINK} text-[13px]">Lihat semua →</button>
    </div>
    ${waiting.length ? html`<ul class="divide-y divide-base-200">
      ${waiting.slice(0, 5).map((row) => html`<li class="flex flex-wrap
          items-center justify-between gap-3 px-5 py-3.5">
        <div class="min-w-0"><p class="text-sm font-bold">${row.pemohon}</p>
          <p class="text-xs text-base-content/60">${row.noPermohonan} ·
            ${row.layanan} · masuk ${row.masuk}</p></div>
        <button type="button" ${navAttrs('hpkDetail', { id: row.id })}
          class="btn btn-sm btn-primary">Periksa</button></li>`)}
    </ul>` : html`<p class="px-5 py-7 text-center text-sm
      text-base-content/60">Tidak ada HPK yang menunggu verifikasi.</p>`}
  </section>`;
}

function rowMarkup(row) {
  return html`<tr>
    <td class="w-px whitespace-nowrap font-mono text-[13px]">
      ${row.noPermohonan}</td>
    <td><p class="font-bold">${row.pemohon}</p>
      <p class="text-xs text-base-content/60">${row.kategori}</p></td>
    <td class="text-[13px]">${row.layanan}</td>
    <td class="text-[13px]">${row.tka}</td>
    <td class="whitespace-nowrap text-[13px]">${row.masuk}</td>
    <td>${statusBadge(row.status, row.tone)}
      ${row.jadwalEkspos ? html`<p class="mt-1 text-xs
        text-base-content/60">${row.jadwalEkspos}</p>` : ''}</td>
    <td><div class="flex justify-end gap-1.5">
      <button type="button" ${navAttrs('hpkDetail', { id: row.id })}
        class="btn btn-sm btn-primary"
        aria-label="Detail HPK ${row.noPermohonan} ${row.pemohon}">Detail
      </button>
    </div></td></tr>`;
}

function filteredRows() {
  const q = state.q.trim().toLowerCase();
  return state.hpkRows.filter((row) => matchesStatus(row, state.status) &&
    (!q || [row.pemohon, row.noPermohonan, row.layanan, row.tka]
      .some((v) => String(v ?? '').toLowerCase().includes(q))));
}

function tabButton({ key, label }) {
  const active = state.status === key;
  return html`<button type="button" data-filter="${key}"
      data-focus-key="hpk-filter-${key || 'semua'}" aria-pressed="${active}"
      class="btn btn-sm ${active ? 'btn-primary' : BTN_OUTLINE}">
    ${label} <span class="${active ? 'opacity-80' : 'text-base-content/60'}">
      ${count(key)}</span></button>`;
}

/** Verifikasi HPK: daftar. */
export function renderHpk() {
  return html`
    ${pageTitle({
      eyebrow: 'Verifikasi HPK',
      title: 'Daftar HPK Pemberi Kerja',
      desc: 'Pemberi Kerja yang sudah mengajukan/submit HPK. Periksa ' +
        'isian dan dokumen, lalu Verifikasi (sistem membuat jadwal ' +
        'ekspos) atau Tolak dengan alasan.',
    })}
    <section class="${CARD}" aria-label="Tabel daftar HPK pemberi kerja">
      <div class="flex flex-wrap items-center gap-3 border-b border-base-200
          px-5 py-4">
        <div class="flex flex-wrap gap-2" role="group"
          aria-label="Filter status HPK">
          ${HPK_STATUS_FILTERS.map(tabButton)}</div>
        <input type="search" id="hpk-search" value="${state.q}"
          aria-label="Cari HPK"
          placeholder="Cari nama, no. permohonan, layanan…"
          autocomplete="off" class="input input-sm ms-auto w-full sm:w-72"
          data-testid="verifikator-input-cari-hpk" />
      </div>
      <div class="overflow-x-auto">
        <table class="table min-w-[1100px] text-sm">
          <caption class="sr-only">Daftar HPK yang diajukan pemberi kerja
            </caption>
          <thead class="${THEAD}"><tr>
            <th scope="col">No. permohonan</th>
            <th scope="col">Pemberi Kerja</th><th scope="col">Layanan</th>
            <th scope="col">Jabatan TKA</th><th scope="col">Tgl submit</th>
            <th scope="col">Status</th>
            <th scope="col"><span class="sr-only">Aksi</span></th>
          </tr></thead>
          <tbody id="hpk-rows"></tbody>
        </table>
      </div>
      ${pagerSlot('hpk-pager')}
    </section>`;
}

function drawRows(root) {
  mountPaged(root, {
    body: '#hpk-rows', footer: '#hpk-pager', items: filteredRows(),
    row: rowMarkup,
    empty: html`<tr><td colspan="7">${emptyState({
      title: 'Tidak ada HPK yang cocok',
      body: 'Ubah filter status atau kata kunci pencarian.',
    })}</td></tr>`,
  });
}

export function mountHpk(root) {
  drawRows(root);
  for (const button of root.querySelectorAll('[data-filter]')) {
    button.addEventListener('click', () =>
      setFilter({ status: button.dataset.filter }));
  }
  qs('#hpk-search', root).addEventListener('input', (event) => {
    setFilter({ q: event.target.value }, { silent: true });
    drawRows(root);
  });
}
