/**
 * @fileoverview Validator menu "Pencabutan RPTKA per TKA" (PV-01..PV-05):
 * tabel pengajuan pencabutan yang dibuat pemberi kerja (real time), dengan
 * Detail (isian + dokumen yang diupload); Validasi | Tolak dilakukan dari
 * halaman Detail. Data = GET /pencabutan-validasi (state.pencRows).
 */

import { emptyState } from '../../components/empty-state.js';
import { html, qs } from '../../components/dom.js';
import { statusBadge } from '../../components/status-badge.js';
import {
  BTN_OUTLINE, CARD, THEAD, mountPaged, navAttrs, pageTitle, pagerSlot,
} from '../portal/ui.js';
import { PC, TABS, matchesFilter, setFilter, state } from './state.js';

const COLUMNS = 7;

const count = (key) => state.pencRows
  .filter((r) => matchesFilter(r, 'pencabutan', key)).length;

function filteredRows() {
  const q = state.q.trim().toLowerCase();
  return state.pencRows
    .filter((r) => matchesFilter(r, 'pencabutan', state.status))
    .filter((r) => !q || [r.pemohon, r.nomor, r.nama, r.jenis]
      .some((v) => String(v ?? '').toLowerCase().includes(q)))
    .map((r, i) => ({ ...r, urut: i + 1 }));
}

function row(r) {
  const actionable = r.status === PC.VALIDASI;
  return html`<tr>
    <td class="text-center text-[13px]">${r.urut}</td>
    <td class="whitespace-nowrap font-mono text-[13px] font-bold">
      ${r.nomor}</td>
    <td class="whitespace-nowrap text-[13px]">${r.tanggal}</td>
    <td><p class="font-bold">${r.nama}</p>
      <p class="text-xs text-base-content/60">${r.pemohon}</p></td>
    <td class="text-[13px]">${r.jenis}</td>
    <td>${statusBadge(r.status, r.tone)}</td>
    <td class="pe-5"><div class="flex flex-wrap justify-end gap-1.5">
      <button type="button" ${navAttrs('pencabutanDetail', { id: r.id })}
        class="btn btn-sm ${actionable ? 'btn-primary' : BTN_OUTLINE}"
        aria-label="Detail pencabutan ${r.nomor} ${r.nama}">Detail</button>
    </div></td></tr>`;
}

function tabButton(tab) {
  const active = state.status === tab.key;
  return html`<button type="button" data-filter="${tab.key}"
      data-focus-key="penc-filter-${tab.key}" aria-pressed="${active}"
      class="btn btn-sm ${active ? 'btn-primary' : BTN_OUTLINE}">
    ${tab.label} <span class="${active ? 'opacity-80' : 'text-base-content/60'}">
      ${count(tab.key)}</span></button>`;
}

export function renderPencabutan() {
  return html`
    ${pageTitle({ eyebrow: 'Pencabutan RPTKA',
      title: 'Pencabutan RPTKA per TKA',
      desc: 'Pengajuan pencabutan RPTKA per TKA dari pemberi kerja, ' +
        'tampil real time. Setelah diverifikasi Verifikator, buka Detail ' +
        'untuk memeriksa isian dan dokumen, lalu Validasi atau Tolak ' +
        '(kembali untuk perbaikan) dari halaman Detail.' })}
    <section class="${CARD}" aria-label="Tabel pencabutan RPTKA">
      <div class="flex flex-wrap items-center gap-3 border-b border-base-200
          px-5 py-4">
        <div class="flex flex-wrap gap-2" role="group"
          aria-label="Filter status">${TABS.pencabutan.map(tabButton)}</div>
        <input type="search" id="penc-search" value="${state.q}"
          aria-label="Cari pencabutan" autocomplete="off"
          placeholder="Cari nomor, nama TKA, pemberi kerja…"
          class="input input-sm ms-auto w-full sm:w-72"
          data-testid="validator-input-cari-pencabutan" />
      </div>
      <div class="overflow-x-auto">
        <table class="table min-w-[1000px] text-sm">
          <caption class="sr-only">Tabel pengajuan pencabutan RPTKA per TKA
          </caption>
          <thead class="${THEAD}"><tr>
            <th scope="col" class="text-center">No</th>
            <th scope="col">No. Permohonan</th>
            <th scope="col">Tanggal Pengajuan</th>
            <th scope="col">TKA / Pemberi Kerja</th>
            <th scope="col">Jenis Pencabutan</th>
            <th scope="col">Status</th>
            <th scope="col"><span class="sr-only">Aksi</span></th>
          </tr></thead>
          <tbody id="penc-rows"></tbody>
        </table>
      </div>
      ${pagerSlot('penc-pager')}
    </section>`;
}

function drawRows(root) {
  mountPaged(root, {
    body: '#penc-rows', footer: '#penc-pager', items: filteredRows(), row,
    empty: html`<tr><td colspan="${COLUMNS}">${emptyState({
      title: 'Belum ada pengajuan pencabutan',
      body: 'Pengajuan pencabutan dari pemberi kerja muncul di sini ' +
        'otomatis. Ubah filter status atau kata kunci bila perlu.',
    })}</td></tr>`,
  });
}

export function mountPencabutan(root) {
  drawRows(root);
  for (const button of root.querySelectorAll('[data-filter]')) {
    button.addEventListener('click', () =>
      setFilter({ status: button.dataset.filter }));
  }
  qs('#penc-search', root).addEventListener('input', (event) => {
    setFilter({ q: event.target.value }, { silent: true });
    drawRows(root);
  });
}
