/**
 * @fileoverview Direktur "Hasil Penilaian Kelayakan (HPK)": tabel pemberi kerja yang
 * sudah Tervalidasi (dan yang HPK-nya sudah terbit) dengan fitur Detail dan,
 * di halaman utama ini, TTE berupa barcode bagi HPK yang sudah diterbitkan.
 * Data = GET /penerbitan-hpk (state.rows).
 */

import { emptyState } from '../../components/empty-state.js';
import { html, qs } from '../../components/dom.js';
import { statusBadge } from '../../components/status-badge.js';
import {
  BTN_OUTLINE, CARD, THEAD, mountPaged, navAttrs, pageTitle, pagerSlot,
} from '../portal/ui.js';
import { tanggal } from '../petugas-ekspos/format.js';
import { TABS, matchesFilter, setFilter, state } from './state.js';

const COLUMNS = 7;

/** HPK Terbit rows that still wait for TTE (target of "TTE otomatis semua"). */
export const pendingTte = () => state.rows.filter((r) => r.aksi.tte);

const count = (key) => state.rows
  .filter((r) => matchesFilter(r, 'daftar', key)).length;

function filteredRows() {
  const q = state.q.trim().toLowerCase();
  return state.rows.filter((r) => matchesFilter(r, 'daftar', state.status) &&
    (!q || [r.pemohon, r.noHpk, r.jenis, r.bap.nomor, r.surat?.nomor]
      .some((v) => String(v ?? '').toLowerCase().includes(q))));
}

/** TTE column: "Belum di TTE" until TTE runs, then "Sudah di TTE". */
function tteCell(r) {
  return r.surat?.tte
    ? html`${statusBadge('Sudah di TTE', 'green')}<p class="mt-1 text-xs
      text-base-content/60">${tanggal(r.surat.tte.tgl)}</p>`
    : statusBadge('Belum di TTE', 'amber');
}

function tteAction(r) {
  if (r.aksi.tte) {
    return html`<button type="button" data-action="tte-open"
      data-id="${r.id}" class="btn btn-sm btn-primary"
      aria-label="TTE ${r.noHpk} ${r.pemohon}">TTE</button>`;
  }
  return r.surat?.tte ? html`<button type="button" data-action="barcode-open"
      data-id="${r.id}" class="btn btn-sm ${BTN_OUTLINE}"
      aria-label="Lihat barcode TTE ${r.noHpk} ${r.pemohon}">Barcode</button>`
    : '';
}

function row(r) {
  return html`<tr>
    <td><p class="font-bold">${r.pemohon}</p>
      <p class="text-xs text-base-content/60">${r.noHpk} · ${r.jenis}</p></td>
    <td class="text-[13px]">${r.jabatan}</td>
    <td class="whitespace-nowrap text-[13px]">
      <p class="font-mono font-semibold">${r.bap.nomor}</p>
      <p class="text-xs text-base-content/60">Disetujui
        ${tanggal(r.bap.tglSetuju)} · ${r.bap.penyetuju.nama}</p></td>
    <td>${statusBadge(r.status, r.tone)}${r.surat ? html`<p class="mt-1
      font-mono text-xs text-base-content/60">${r.surat.nomor}</p>` : ''}</td>
    <td class="whitespace-nowrap">${tteCell(r)}</td>
    <td class="whitespace-nowrap text-[13px]">${tanggal(r.tanggalAjuan)}</td>
    <td class="pe-5"><div class="flex flex-wrap justify-end gap-1.5">
      <button type="button" ${navAttrs('detail', { id: r.id })}
        class="btn btn-sm ${BTN_OUTLINE}"
        aria-label="Detail ${r.noHpk} ${r.pemohon}">Detail</button>
      ${tteAction(r)}</div></td></tr>`;
}

function tabButton(tab) {
  const active = state.status === tab.key;
  return html`<button type="button" data-filter="${tab.key}"
      data-focus-key="direktur-filter-${tab.key}" aria-pressed="${active}"
      class="btn btn-sm ${active ? 'btn-primary' : BTN_OUTLINE}">
    ${tab.label} <span class="${active ? 'opacity-80' : 'text-base-content/60'}">
      ${count(tab.key)}</span></button>`;
}

/** Header action: one click runs TTE on every HPK Terbit without TTE. */
function tteSemuaButton() {
  const total = pendingTte().length;
  return html`<button type="button" data-action="tte-semua-open"
    class="btn btn-primary" ${total ? '' : 'disabled'}
    data-testid="direktur-btn-tte-semua">TTE otomatis semua
    <span class="badge badge-sm border-0 bg-primary-content/20
      text-primary-content">${total}</span></button>`;
}

export function renderDaftar() {
  return html`
    ${pageTitle({ eyebrow: 'Penerbitan HPK',
      title: 'Hasil Penilaian Kelayakan (HPK)',
      desc: 'Pemberi Kerja yang isian dan dokumen HPK-nya sudah ' +
        'tervalidasi. Buka Detail untuk memeriksa, atau jalankan TTE ' +
        '(barcode) per baris atau sekaligus lewat TTE otomatis semua: HPK ' +
        'langsung terbit, kolom TTE menjadi Sudah di TTE, dan HPK tampil ' +
        'di akun pemberi kerja.', actions: tteSemuaButton() })}
    <section class="${CARD}" aria-label="Tabel hasil penilaian kelayakan (HPK)">
      <div class="flex flex-wrap items-center gap-3 border-b border-base-200
          px-5 py-4">
        <div class="flex flex-wrap gap-2" role="group"
          aria-label="Filter status">${TABS.daftar.map(tabButton)}</div>
        <input type="search" id="direktur-search" value="${state.q}"
          aria-label="Cari pemberi kerja" autocomplete="off"
          placeholder="Cari nama, no. HPK, no. BAP, no. surat…"
          class="input input-sm ms-auto w-full sm:w-72"
          data-testid="direktur-input-cari" />
      </div>
      <div class="overflow-x-auto">
        <table class="table min-w-[1000px] text-sm">
          <caption class="sr-only">Tabel hasil penilaian kelayakan (HPK)</caption>
          <thead class="${THEAD}"><tr><th scope="col">Pemberi Kerja</th>
            <th scope="col">Jabatan TKA</th><th scope="col">BAP</th>
            <th scope="col">Status</th><th scope="col">TTE</th>
            <th scope="col">Tanggal pengajuan</th>
            <th scope="col"><span class="sr-only">Aksi</span></th></tr></thead>
          <tbody id="direktur-rows"></tbody>
        </table>
      </div>
      ${pagerSlot('direktur-pager')}
    </section>`;
}

function drawRows(root) {
  mountPaged(root, {
    body: '#direktur-rows', footer: '#direktur-pager', items: filteredRows(),
    row,
    empty: html`<tr><td colspan="${COLUMNS}">${emptyState({
      title: 'Tidak ada data yang cocok',
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
  qs('#direktur-search', root).addEventListener('input', (event) => {
    setFilter({ q: event.target.value }, { silent: true });
    drawRows(root);
  });
}
