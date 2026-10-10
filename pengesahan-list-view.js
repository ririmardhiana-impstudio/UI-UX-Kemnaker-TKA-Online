/**
 * @fileoverview Verifikator menu "Pengesahan RPTKA" (AK-22): tabel data
 * perusahaan yang sudah mengajukan/submit RPTKA. Kolom: No | No HPK |
 * Tanggal Pengajuan | Nomor RPTKA | Jenis RPTKA | Status. Aksi: Detail,
 * Verifikasi (diteruskan ke Validator), Tolak. Penerbitan billing DKPTKA
 * ada di akun Validator. Data = GET /pengesahan-verifikasi.
 *
 * View yang sama dipakai menu "Perpanjangan Lintas Provinsi" (AK-23,
 * `state.page === 'perpanjangan'`): hanya baris jenis Perpanjangan
 * Pengesahan RPTKA Lintas Provinsi; menu Pengesahan RPTKA tidak
 * menampilkannya.
 */

import { emptyState } from '../../components/empty-state.js';
import { html, qs } from '../../components/dom.js';
import { statusBadge } from '../../components/status-badge.js';
import {
  BTN_OUTLINE, CARD, THEAD, mountPaged, navAttrs, pageTitle, pagerSlot,
} from '../portal/ui.js';
import {
  WAITING, pageScope, scopeOf, setFilter, state,
} from './state.js';

const FILTERS = ['', WAITING, 'Perbaikan', 'Diteruskan ke Validator'];

const SCOPES = {
  pengesahan: { eyebrow: 'Pengesahan RPTKA', title: 'Daftar Permohonan RPTKA',
    detail: 'pengesahanDetail',
    desc: 'Data perusahaan yang sudah mengajukan/submit RPTKA. ' },
  perpanjangan: { eyebrow: 'Perpanjangan RPTKA',
    title: 'Perpanjangan RPTKA Lintas Provinsi', detail: 'perpanjanganDetail',
    desc: 'Data perusahaan yang sudah mengajukan/submit Perpanjangan RPTKA ' +
      'dengan lokasi kerja lintas provinsi. ' },
  kabkota: { eyebrow: 'Perpanjangan RPTKA',
    title: 'Perpanjangan RPTKA Lintas Kab/Kota dalam 1 Provinsi',
    detail: 'kabkotaDetail',
    desc: 'Data perusahaan yang sudah mengajukan/submit Perpanjangan RPTKA ' +
      'dengan lokasi kerja lintas kabupaten/kota dalam 1 provinsi. ' },
};
const scope = () => SCOPES[pageScope(state.page)];
const detailPage = () => scope().detail;

/** Rows of the active menu (Perpanjangan Lintas Provinsi vs the rest). */
function scopeRows() {
  const wanted = pageScope(state.page);
  return state.pengRows.filter((r) => scopeOf(r) === wanted);
}

function filteredRows() {
  const q = state.q.trim().toLowerCase();
  return scopeRows()
    .filter((r) => !state.status || r.status === state.status)
    .filter((r) => !q || [r.pemohon, r.nomorRptka, r.noHpk, r.jenisRptka]
      .some((v) => String(v ?? '').toLowerCase().includes(q)))
    .map((r, i) => ({ ...r, urut: i + 1 }));
}

function rowMarkup(row) {
  return html`<tr>
    <td class="text-center text-[13px]">${row.urut}</td>
    <td class="whitespace-nowrap font-mono text-[13px]">${row.noHpk}</td>
    <td class="whitespace-nowrap text-[13px]">${row.tanggalPengajuan}</td>
    <td><p class="whitespace-nowrap font-mono text-[13px] font-bold">
      ${row.nomorRptka}</p>
      <p class="text-xs text-base-content/60">${row.pemohon}</p></td>
    <td class="text-[13px]">${row.jenisRptka}</td>
    <td>${statusBadge(row.status, row.tone)}</td>
    <td><div class="flex justify-end gap-1.5">
      <button type="button" ${navAttrs(detailPage(), { id: row.id })}
        class="btn btn-sm btn-primary"
        aria-label="Detail RPTKA ${row.nomorRptka} ${row.pemohon}">Detail
      </button>
    </div></td></tr>`;
}

function filterButton(status) {
  const active = state.status === status;
  const count = scopeRows()
    .filter((r) => !status || r.status === status).length;
  return html`<button type="button" data-filter="${status}"
      data-focus-key="peng-filter-${status || 'semua'}"
      aria-pressed="${active}"
      class="btn btn-sm ${active ? 'btn-primary' : BTN_OUTLINE}">
    ${status || 'Semua'} <span class="${active ? 'opacity-80'
    : 'text-base-content/60'}">${count}</span></button>`;
}

/** Pengesahan RPTKA: tabel pengajuan. */
export function renderPengesahan() {
  const { eyebrow, title, desc } = scope();
  return html`
    ${pageTitle({ eyebrow, title, desc: desc + 'Verifikasi meneruskan ' +
      'permohonan ke Validator; Tolak mengembalikan untuk perbaikan.' })}
    <section class="${CARD}" aria-label="Tabel permohonan RPTKA">
      <div class="flex flex-wrap items-center gap-3 border-b
          border-base-200 px-5 py-4">
        <div class="flex flex-wrap gap-2" role="group"
          aria-label="Filter status">${FILTERS.map(filterButton)}</div>
        <input type="search" id="peng-search" value="${state.q}"
          aria-label="Cari permohonan RPTKA"
          placeholder="Cari nomor, no. HPK, pemberi kerja…"
          autocomplete="off" class="input input-sm ms-auto w-full sm:w-72"
          data-testid="verifikator-input-cari-rptka" />
      </div>
      <div class="overflow-x-auto">
        <table class="table min-w-[1000px] text-sm">
          <caption class="sr-only">Tabel pengajuan RPTKA</caption>
          <thead class="${THEAD}"><tr>
            <th scope="col" class="text-center">No</th>
            <th scope="col">No HPK</th>
            <th scope="col">Tanggal Pengajuan</th>
            <th scope="col">Nomor RPTKA</th>
            <th scope="col">Jenis RPTKA</th>
            <th scope="col">Status</th>
            <th scope="col"><span class="sr-only">Aksi</span></th>
          </tr></thead>
          <tbody id="peng-rows"></tbody>
        </table>
      </div>
      ${pagerSlot('peng-pager')}
    </section>`;
}

function drawRows(root) {
  mountPaged(root, {
    body: '#peng-rows', footer: '#peng-pager',
    items: filteredRows(), row: rowMarkup,
    empty: html`<tr><td colspan="7">${emptyState({
      title: 'Tidak ada permohonan RPTKA yang cocok',
      body: 'Ubah filter status atau kata kunci pencarian.',
    })}</td></tr>`,
  });
}

export function mountPengesahan(root) {
  drawRows(root);
  for (const button of root.querySelectorAll('[data-filter]')) {
    button.addEventListener('click', () =>
      setFilter({ status: button.dataset.filter }));
  }
  qs('#peng-search', root).addEventListener('input', (event) => {
    setFilter({ q: event.target.value }, { silent: true });
    drawRows(root);
  });
}
