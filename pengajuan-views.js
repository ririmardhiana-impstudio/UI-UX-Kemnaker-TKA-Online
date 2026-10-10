/**
 * @fileoverview Verifikator menu "Perubahan RPTKA" dan "Pencabutan RPTKA"
 * (AK-24): tabel pengajuan yang dibuat pemberi kerja (dinamis, real time),
 * Detail (isian + dokumen) dan panel Verifikasi | Tolak. Satu modul untuk
 * dua jenis: `kindOf()` membaca `state.page`. Data = GET
 * /{perubahan|pencabutan}-verifikasi.
 */

import { kilobyte, pratinjauAttrs } from '../../components/doc-preview.js';
import { emptyState } from '../../components/empty-state.js';
import { html, qs } from '../../components/dom.js';
import { formatFileSize } from '../../components/form-ui.js';
import { statusBadge } from '../../components/status-badge.js';
import {
  BTN_OUTLINE, CARD, CALLOUT_INFO, CALLOUT_WARN, LINK_MUTED, THEAD,
  cardHeader, mountPaged, navAttrs, pageTitle, pagerSlot,
} from '../portal/ui.js';
import { WAITING, setFilter, state } from './state.js';

export const KINDS = {
  perubahan: {
    label: 'Perubahan RPTKA', rows: 'perubahanRows',
    detail: 'perubahanDetailRow', jenisHead: 'Jenis Perubahan',
    desc: 'Pengajuan perubahan data TKA, alamat, lokasi kerja, atau nama ' +
      'TKI pendamping yang dibuat pemberi kerja.',
  },
  pencabutan: {
    label: 'Pencabutan RPTKA', rows: 'pencabutanRows',
    detail: 'pencabutanDetailRow', jenisHead: 'Alasan Pencabutan',
    desc: 'Pengajuan pencabutan Pengesahan RPTKA yang dibuat pemberi kerja.',
  },
};

const FILTERS = ['', WAITING, 'Perbaikan', 'Diteruskan ke Validator'];

export const kindOf = () => (state.page.startsWith('perubahan')
  ? 'perubahan' : 'pencabutan');

const rowsOf = () => state[KINDS[kindOf()].rows] ?? [];

function filteredRows() {
  const q = state.q.trim().toLowerCase();
  return rowsOf()
    .filter((r) => !state.status || r.status === state.status)
    .filter((r) => !q || [r.nomor, r.pemohon, r.nama, r.jenis]
      .some((v) => String(v ?? '').toLowerCase().includes(q)))
    .map((r, i) => ({ ...r, urut: i + 1 }));
}

function rowMarkup(row) {
  return html`<tr>
    <td class="text-center text-[13px]">${row.urut}</td>
    <td class="whitespace-nowrap text-[13px]">${row.tanggal}</td>
    <td class="whitespace-nowrap font-mono text-[13px] font-bold">
      ${row.nomor}</td>
    <td class="text-[13px]">${row.jenis}</td>
    <td><p class="font-bold">${row.pemohon}</p>
      <p class="text-xs text-base-content/60">TKA: ${row.nama}</p></td>
    <td>${statusBadge(row.status, row.tone)}</td>
    <td><div class="flex justify-end">
      <button type="button" ${navAttrs(`${kindOf()}Detail`, { id: row.id })}
        class="btn btn-sm btn-primary"
        aria-label="Detail ${row.nomor} ${row.pemohon}">Detail</button>
    </div></td></tr>`;
}

function filterButton(status) {
  const active = state.status === status;
  const count = rowsOf().filter((r) => !status || r.status === status).length;
  return html`<button type="button" data-filter="${status}"
      data-focus-key="pj-filter-${status || 'semua'}" aria-pressed="${active}"
      class="btn btn-sm ${active ? 'btn-primary' : BTN_OUTLINE}">
    ${status || 'Semua'} <span class="${active ? 'opacity-80'
    : 'text-base-content/60'}">${count}</span></button>`;
}

export function renderPengajuan() {
  const cfg = KINDS[kindOf()];
  return html`
    ${pageTitle({ eyebrow: 'Verifikasi', title: `Daftar ${cfg.label}`,
      desc: `${cfg.desc} Verifikasi meneruskan ke Validator; Tolak ` +
        'mengembalikan untuk perbaikan.' })}
    <section class="${CARD}" aria-label="Tabel ${cfg.label}">
      <div class="flex flex-wrap items-center gap-3 border-b border-base-200
          px-5 py-4">
        <div class="flex flex-wrap gap-2" role="group"
          aria-label="Filter status">${FILTERS.map(filterButton)}</div>
        <input type="search" id="pj-search" value="${state.q}"
          aria-label="Cari pengajuan" autocomplete="off"
          placeholder="Cari nomor, pemberi kerja, TKA…"
          class="input input-sm ms-auto w-full sm:w-72"
          data-testid="verifikator-input-cari-pengajuan" />
      </div>
      <div class="overflow-x-auto">
        <table class="table min-w-[960px] text-sm">
          <caption class="sr-only">Tabel ${cfg.label}</caption>
          <thead class="${THEAD}"><tr>
            <th scope="col" class="text-center">No</th>
            <th scope="col">Tanggal Pengajuan</th>
            <th scope="col">Nomor Permohonan</th>
            <th scope="col">${cfg.jenisHead}</th>
            <th scope="col">Pemberi Kerja</th>
            <th scope="col">Status</th>
            <th scope="col"><span class="sr-only">Aksi</span></th>
          </tr></thead>
          <tbody id="pj-rows"></tbody>
        </table>
      </div>
      ${pagerSlot('pj-pager')}
    </section>`;
}

function drawRows(root) {
  mountPaged(root, {
    body: '#pj-rows', footer: '#pj-pager', items: filteredRows(),
    row: rowMarkup,
    empty: html`<tr><td colspan="7">${emptyState({
      title: 'Belum ada pengajuan',
      body: 'Pengajuan yang dibuat pemberi kerja di portal muncul di sini ' +
        'secara otomatis.',
    })}</td></tr>`,
  });
}

export function mountPengajuan(root) {
  drawRows(root);
  for (const button of root.querySelectorAll('[data-filter]')) {
    button.addEventListener('click', () =>
      setFilter({ status: button.dataset.filter }));
  }
  qs('#pj-search', root).addEventListener('input', (event) => {
    setFilter({ q: event.target.value }, { silent: true });
    drawRows(root);
  });
}

function dl(items) {
  return html`<dl class="grid gap-x-6 gap-y-3.5 px-5 py-4 text-sm
      sm:grid-cols-2">${items.map(({ label, value }) => html`<div>
    <dt class="text-xs font-bold text-base-content/60">${label}</dt>
    <dd class="mt-0.5 break-words font-semibold">${value || '—'}</dd>
  </div>`)}</dl>`;
}

function dokumenCard(row) {
  return html`<section class="${CARD}" aria-labelledby="pj-doc-title">
    ${cardHeader(html`<span id="pj-doc-title">Dokumen yang diunggah
      (${row.dokumen.length})</span>`)}
    <ul class="divide-y divide-base-200">
      ${row.dokumen.map((d) => html`<li class="flex flex-wrap items-center
          justify-between gap-3 px-5 py-3.5">
        <div class="min-w-0"><p class="text-sm font-bold">${d.jenis}</p>
          <p class="break-all text-xs text-base-content/60">${d.fileName} ·
            ${formatFileSize(d.fileSize)}</p></div>
        <button type="button" ${pratinjauAttrs({ judul: d.jenis,
    namaBerkas: d.fileName, ukuranKb: kilobyte(d.fileSize),
    berkasId: d.berkasId })} class="btn btn-sm ${BTN_OUTLINE}"
          aria-label="Lihat ${d.jenis}">Lihat dokumen</button></li>`)}
    </ul></section>`;
}

function panel(row) {
  let body;
  if (row.status === WAITING) {
    body = html`<p class="text-sm leading-relaxed text-base-content/80">
        Periksa isian dan dokumen. <b>Verifikasi</b>: diteruskan ke
        Validator. <b>Tolak</b>: isi alasan; pemberi kerja memperbaiki lalu
        mengajukan kembali.</p>
      <button type="button" data-action="pj-verify" data-id="${row.id}"
        class="btn btn-primary w-full"
        data-testid="verifikator-btn-pengajuan-verifikasi">Verifikasi
      </button>
      <button type="button" data-action="pj-reject" data-id="${row.id}"
        class="btn w-full border-error/30 text-error shadow-none
          hover:bg-error/10" data-testid="verifikator-btn-pengajuan-tolak">
        Tolak</button>`;
  } else if (row.status === 'Perbaikan') {
    body = html`<div class="${CALLOUT_WARN}"><b>Perbaikan.</b> Alasan
      penolakan:<br>${row.alasan || '—'}<br><span class="text-xs">Pemberi
      kerja memperbaiki lalu mengajukan kembali; berkas kembali ke daftar
      ini.</span></div>`;
  } else {
    body = html`<div class="${CALLOUT_INFO}"><b>${row.status}.</b>
      Pengajuan sedang diperiksa Validator.</div>`;
  }
  return html`<section class="${CARD} lg:sticky lg:top-24"
      aria-labelledby="pj-v-title">
    ${cardHeader(html`<span id="pj-v-title">Verifikasi</span>`,
      statusBadge(row.status, row.tone))}
    <div class="grid gap-3 px-5 py-4">${body}</div></section>`;
}

export function renderPengajuanDetail() {
  const kind = kindOf();
  const cfg = KINDS[kind];
  const row = state[cfg.detail];
  return html`
    ${pageTitle({
      back: html`<button type="button" ${navAttrs(kind)}
        class="${LINK_MUTED} mb-1 text-[13px]">← Daftar ${cfg.label}
        </button>`,
      eyebrow: `${cfg.label} ${row.nomor}`, title: row.pemohon,
      desc: `${row.jenis} · diajukan ${row.tanggal}` })}
    <div class="grid items-start gap-5 lg:grid-cols-[1fr_340px]">
      <div class="grid gap-5">
        <section class="${CARD}" aria-labelledby="pj-isian-title">
          ${cardHeader(html`<span id="pj-isian-title">Isian
            pengajuan</span>`)}${dl(row.isian)}</section>
        ${dokumenCard(row)}
      </div>
      ${panel(row)}
    </div>`;
}
