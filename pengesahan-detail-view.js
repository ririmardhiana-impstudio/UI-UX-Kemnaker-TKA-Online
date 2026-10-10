/**
 * @fileoverview Verifikator "Detail RPTKA" (Pengesahan): isian (TKA, jabatan,
 * paspor, masa kerja) dan dokumen yang diunggah, plus panel Verifikasi |
 * Tolak. Data = GET /pengesahan-verifikasi/{id} (state.pengDetail).
 */

import { kilobyte, pratinjauAttrs } from '../../components/doc-preview.js';
import { formatFileSize } from '../../components/form-ui.js';
import { html } from '../../components/dom.js';
import { statusBadge } from '../../components/status-badge.js';
import {
  BTN_OUTLINE, CARD, CALLOUT_INFO, CALLOUT_WARN, LINK_MUTED, THEAD,
  cardHeader, navAttrs, pageTitle,
} from '../portal/ui.js';
import { WAITING, pageScope, state } from './state.js';

function dl(items) {
  return html`<dl class="grid gap-x-6 gap-y-3.5 px-5 py-4 text-sm
      sm:grid-cols-2">${items.map(([term, value]) => html`<div>
    <dt class="text-xs font-bold text-base-content/60">${term}</dt>
    <dd class="mt-0.5 break-words font-semibold">${value || '—'}</dd>
  </div>`)}</dl>`;
}

function isianCard(row) {
  return html`<section class="${CARD}" aria-labelledby="pi-title">
    ${cardHeader(html`<span id="pi-title">Isian RPTKA</span>`)}
    ${dl([
    ['Pemberi Kerja', row.pemohon], ['Jenis Pemberi Kerja', row.kategori],
    ['Nomor RPTKA', row.nomorRptka], ['No HPK', row.noHpk],
    ['Jenis RPTKA', row.jenisRptka],
    ['Tanggal pengajuan', row.tanggalPengajuan],
  ])}
    <div class="overflow-x-auto border-t border-base-200">
      <table class="table text-sm">
        <caption class="sr-only">TKA yang diajukan</caption>
        <thead class="${THEAD}"><tr><th scope="col">Nama TKA</th>
          <th scope="col">Negara</th><th scope="col">Paspor</th>
          <th scope="col">Jabatan</th>
          <th scope="col" class="text-center">Masa kerja</th></tr></thead>
        <tbody>${row.isian.tka.map((t) => html`<tr>
          <td class="font-semibold">${t.nama}</td><td>${t.negara}</td>
          <td class="font-mono text-[13px]">${t.paspor}</td>
          <td>${t.jabatan}</td>
          <td class="text-center">${t.bulan} bulan</td></tr>`)}</tbody>
      </table></div>
  </section>`;
}

function dokumenCard(row) {
  return html`<section class="${CARD}" aria-labelledby="pd-title">
    ${cardHeader(html`<span id="pd-title">Dokumen yang diunggah
      (${row.dokumen.length})</span>`)}
    <ul class="divide-y divide-base-200">
      ${row.dokumen.map((d) => html`<li class="flex flex-wrap items-center
          justify-between gap-3 px-5 py-3.5">
        <div class="min-w-0"><p class="text-sm font-bold">${d.jenis}</p>
          <p class="break-all text-xs text-base-content/60">${d.fileName} ·
            ${formatFileSize(d.fileSize)}</p></div>
        <button type="button" ${pratinjauAttrs({ judul: d.jenis, namaBerkas: d.fileName,
          ukuranKb: kilobyte(d.fileSize), berkasId: d.berkasId })}
          class="btn btn-sm ${BTN_OUTLINE}"
          aria-label="Lihat ${d.jenis}">Lihat dokumen</button></li>`)}
    </ul></section>`;
}

/** Right-hand panel: what the Verifikator can do. */
function verifikasiPanel(row) {
  let body;
  if (row.status === WAITING) {
    body = html`<p class="text-sm leading-relaxed text-base-content/80">
        Periksa isian dan dokumen. <b>Verifikasi</b>: permohonan diteruskan
        ke Validator. <b>Tolak</b>: isi alasan; pemberi kerja memperbaiki
        lalu submit ulang.</p>
      <button type="button" data-action="peng-verify" data-id="${row.id}"
        class="btn btn-primary w-full"
        data-testid="verifikator-btn-rptka-verifikasi">Verifikasi</button>
      <button type="button" data-action="peng-reject" data-id="${row.id}"
        class="btn w-full border-error/30 text-error shadow-none
          hover:bg-error/10"
        data-testid="verifikator-btn-rptka-tolak">Tolak</button>`;
  } else if (row.status === 'Perbaikan') {
    body = html`<div class="${CALLOUT_WARN}"><b>Perbaikan.</b> Alasan
      penolakan:<br>${row.alasan || '—'}<br><span class="text-xs">Pemberi
      kerja memperbaiki lalu submit ulang; berkas kembali ke daftar
      ini.</span></div>`;
  } else {
    body = html`<div class="${CALLOUT_INFO}"><b>${row.status}.</b>
      Permohonan sedang diperiksa Validator.</div>`;
  }
  return html`<section class="${CARD} lg:sticky lg:top-24"
      aria-labelledby="pv-title">
    ${cardHeader(html`<span id="pv-title">Verifikasi</span>`,
      statusBadge(row.status, row.tone))}
    <div class="grid gap-3 px-5 py-4">${body}</div></section>`;
}

/** Detail screen for `state.pengDetail`. */
export function renderPengesahanDetail() {
  const row = state.pengDetail;
  const back = { perpanjangan: ['perpanjangan', 'Perpanjangan Lintas Provinsi'],
    kabkota: ['kabkota', 'Perpanjangan Lintas Kab/Kota dalam 1 Provinsi'],
    pengesahan: ['pengesahan', 'Daftar Permohonan RPTKA'],
  }[pageScope(state.page)];
  return html`
    ${pageTitle({
      back: html`<button type="button" ${navAttrs(back[0])}
        class="${LINK_MUTED} mb-1 text-[13px]">← ${back[1]}
        </button>`,
      eyebrow: `RPTKA ${row.nomorRptka}`, title: row.pemohon,
      desc: `${row.jenisRptka} · diajukan ${row.tanggalPengajuan}`,
    })}
    <div class="grid items-start gap-5 lg:grid-cols-[1fr_340px]">
      <div class="grid gap-5">${isianCard(row)}${dokumenCard(row)}</div>
      ${verifikasiPanel(row)}
    </div>`;
}
