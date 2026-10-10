/**
 * @fileoverview Validator "Detail Pencabutan" (PV-02): isian pengajuan
 * pencabutan per TKA, dokumen yang diupload, dan panel Validasi | Tolak.
 * Data = GET /pencabutan-validasi/{id} (state.pencDetail).
 */

import { kilobyte, pratinjauAttrs } from '../../components/doc-preview.js';
import { html } from '../../components/dom.js';
import { formatFileSize } from '../../components/form-ui.js';
import { statusBadge } from '../../components/status-badge.js';
import {
  BTN_OUTLINE, CALLOUT_INFO, CALLOUT_WARN, CARD, LINK_MUTED, cardHeader,
  navAttrs, pageTitle,
} from '../portal/ui.js';
import { PC, state } from './state.js';

function dl(items) {
  return html`<dl class="grid gap-x-6 gap-y-3.5 px-5 py-4 text-sm
      sm:grid-cols-2">${items.map(({ label, value }) => html`<div>
    <dt class="text-xs font-bold text-base-content/60">${label}</dt>
    <dd class="mt-0.5 break-words font-semibold">${value || '—'}</dd>
  </div>`)}</dl>`;
}

function isianCard(row) {
  return html`<section class="${CARD}" aria-labelledby="pci-title">
    ${cardHeader(html`<span id="pci-title">Isian pencabutan RPTKA</span>`)}
    ${dl(row.isian)}</section>`;
}

function dokumenCard(row) {
  return html`<section class="${CARD}" aria-labelledby="pcd-title">
    ${cardHeader(html`<span id="pcd-title">Dokumen yang diupload
      (${row.dokumen.length})</span>`)}
    <ul class="divide-y divide-base-200">
      ${row.dokumen.map((d) => html`<li class="flex flex-wrap items-center
          justify-between gap-3 px-5 py-3.5">
        <div class="min-w-0"><p class="text-sm font-bold">${d.jenis}</p>
          <p class="break-all text-xs text-base-content/60">${d.fileName} ·
            ${formatFileSize(d.fileSize)}</p></div>
        <button type="button" ${pratinjauAttrs({ judul: d.jenis,
    namaBerkas: d.fileName, ukuranKb: kilobyte(d.fileSize),
    berkasId: d.berkasId })}
          class="btn btn-sm ${BTN_OUTLINE}"
          aria-label="Lihat ${d.jenis}">Lihat dokumen</button></li>`)}
    </ul></section>`;
}

/** Right-hand panel: Validasi | Tolak for the current status. */
function validasiPanel(row) {
  let body;
  if (row.aksi.validasi) {
    body = html`<p class="text-sm leading-relaxed text-base-content/80">
        Periksa isian dan dokumen pencabutan. <b>Validasi</b>: pengajuan
        dinyatakan sesuai (status Tervalidasi). <b>Tolak</b>: isi alasan;
        status menjadi Perbaikan.</p>
      <button type="button" data-action="penc-validate" data-id="${row.id}"
        class="btn btn-primary w-full"
        data-testid="validator-btn-pencabutan-validasi">Validasi</button>
      <button type="button" data-action="penc-reject" data-id="${row.id}"
        class="btn w-full border-error/30 text-error shadow-none
          hover:bg-error/10" data-testid="validator-btn-pencabutan-tolak">
        Tolak</button>`;
  } else if (row.status === PC.VERIFIKATOR) {
    body = html`<div class="${CALLOUT_INFO}"><b>Menunggu Verifikator.</b>
      Pengajuan pemberi kerja ini sudah masuk dan sedang diperiksa
      Verifikator. Validasi dan Tolak aktif setelah Verifikator
      meneruskannya ke Validator.</div>`;
  } else if (row.status === PC.PERBAIKAN) {
    body = html`<div class="${CALLOUT_WARN}"><b>Perbaikan.</b> Alasan
      penolakan:<br>${row.alasan || '—'}<br><span class="text-xs">Pemberi
      kerja memperbaiki lalu submit ulang langsung ke Validator; berkas
      kembali ke daftar ini.</span></div>`;
  } else {
    body = html`<div class="${CALLOUT_INFO}"><b>Tervalidasi.</b> Pengajuan
      pencabutan sudah divalidasi; pemberi kerja menunggu SK Pencabutan.
      </div>`;
  }
  return html`<section class="${CARD} lg:sticky lg:top-24"
      aria-labelledby="pcv-title">
    ${cardHeader(html`<span id="pcv-title">Validasi</span>`,
    statusBadge(row.status, row.tone))}
    <div class="grid gap-3 px-5 py-4">${body}</div></section>`;
}

/** Detail screen for `state.pencDetail`. */
export function renderPencabutanDetail() {
  const row = state.pencDetail;
  return html`
    ${pageTitle({
      back: html`<button type="button" ${navAttrs('pencabutan')}
        class="${LINK_MUTED} mb-1 text-[13px]">← Pencabutan RPTKA per TKA
        </button>`,
      eyebrow: `Pencabutan ${row.nomor}`, title: row.nama,
      desc: `${row.pemohon} · ${row.jenis} · diajukan ${row.tanggal}`,
    })}
    <div class="grid grid-cols-1 items-start gap-5 lg:grid-cols-[1fr_340px]">
      <div class="grid min-w-0 grid-cols-1 gap-5">${isianCard(row)}
        ${dokumenCard(row)}</div>
      ${validasiPanel(row)}
    </div>`;
}
