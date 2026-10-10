/**
 * @fileoverview Verifikator "Detail HPK": isian formulir (pemberi kerja,
 * layanan, jabatan TKA, lokasi, negara) dan dokumen yang diunggah, plus
 * panel Verifikasi | Tolak. Data = GET /hpk-verifikasi/{id}
 * (state.hpkDetail).
 */

import { kilobyte, pratinjauAttrs } from '../../components/doc-preview.js';
import { formatFileSize } from '../../components/form-ui.js';
import { html } from '../../components/dom.js';
import { statusBadge } from '../../components/status-badge.js';
import {
  BTN_OUTLINE, CARD, CALLOUT_INFO, CALLOUT_WARN, LINK_MUTED, THEAD,
  cardHeader, navAttrs, pageTitle,
} from '../portal/ui.js';
import { HPK_FIX, HPK_VERIFIED, WAITING, state } from './state.js';

function dl(items) {
  return html`<dl class="grid gap-x-6 gap-y-3.5 px-5 py-4 text-sm
      sm:grid-cols-2">${items.map(([term, value]) => html`<div>
    <dt class="text-xs font-bold text-base-content/60">${term}</dt>
    <dd class="mt-0.5 break-words font-semibold">${value || '—'}</dd>
  </div>`)}</dl>`;
}

function isianCard(row) {
  const { isian } = row;
  return html`<section class="${CARD}" aria-labelledby="hi-title">
    ${cardHeader(html`<span id="hi-title">Isian HPK</span>`)}
    ${dl([
    ['Pemberi Kerja', row.pemohon], ['Jenis Pemberi Kerja', row.kategori],
    ['No. permohonan', row.noPermohonan], ['Layanan', row.layanan],
    ['Tanggal submit', row.masuk],
    ['Lokasi kerja', isian.lokasi],
    ['Negara asal TKA', isian.negara],
    ['Masa kerja', `${isian.bulan} bulan`],
  ])}
    <div class="overflow-x-auto border-t border-base-200">
      <table class="table text-sm">
        <caption class="sr-only">Jabatan TKA yang diajukan</caption>
        <thead class="${THEAD}"><tr><th scope="col">Jabatan TKA</th>
          <th scope="col" class="text-center">Jumlah</th></tr></thead>
        <tbody>${isian.jabatan.map((j) => html`<tr>
          <td class="font-semibold">${j.nama}</td>
          <td class="text-center">${j.jumlah}</td></tr>`)}</tbody>
      </table></div>
  </section>`;
}

function dokumenCard(row) {
  return html`<section class="${CARD}" aria-labelledby="hd-title">
    ${cardHeader(html`<span id="hd-title">Dokumen yang diunggah
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

/** Right-hand panel: actions available for the current status. */
function verifikasiPanel(row) {
  let body;
  if (row.status === WAITING) {
    body = html`<p class="text-sm leading-relaxed text-base-content/80">
        Periksa isian dan dokumen. <b>Verifikasi</b>: sistem membuat jadwal
        ekspos. <b>Tolak</b>: isi alasan; pemberi kerja memperbaiki lalu
        submit ulang.</p>
      <button type="button" data-action="hpk-verify" data-id="${row.id}"
        class="btn btn-primary w-full"
        data-testid="verifikator-btn-hpk-verifikasi">Verifikasi</button>
      <button type="button" data-action="hpk-reject" data-id="${row.id}"
        class="btn w-full border-error/30 text-error shadow-none
          hover:bg-error/10" data-testid="verifikator-btn-hpk-tolak">
        Tolak</button>`;
  } else if (row.status === HPK_FIX) {
    body = html`<div class="${CALLOUT_WARN}"><b>Perbaikan data.</b> Alasan
      penolakan:<br>${row.alasan || '—'}<br><span class="text-xs">Pemberi
      kerja memperbaiki data lalu submit ulang; berkas kembali ke daftar
      ini.</span></div>`;
  } else if (row.status === HPK_VERIFIED) {
    body = html`<div class="${CALLOUT_INFO}"><b>Terverifikasi.</b>
      ${row.ekspos
    ? html`Jadwal ekspos dibuat sistem: <b>${row.ekspos.hari},
        ${row.ekspos.jam} WIB</b> (${row.ekspos.mode}).`
    : html`Tahap saat ini: ${row.jadwalEkspos || 'proses lanjutan'}.`}
      </div>`;
  }
  return html`<section class="${CARD} lg:sticky lg:top-24"
      aria-labelledby="hv-title">
    ${cardHeader(html`<span id="hv-title">Verifikasi</span>`,
      statusBadge(row.status, row.tone))}
    <div class="grid gap-3 px-5 py-4">${body}</div></section>`;
}

/** Detail screen for `state.hpkDetail`. */
export function renderHpkDetail() {
  const row = state.hpkDetail;
  return html`
    ${pageTitle({
      back: html`<button type="button" ${navAttrs('hpk')}
        class="${LINK_MUTED} mb-1 text-[13px]">← Daftar HPK</button>`,
      eyebrow: `HPK ${row.noPermohonan}`, title: row.pemohon,
      desc: `${row.layanan} · submit ${row.masuk}`,
    })}
    <div class="grid items-start gap-5 lg:grid-cols-[1fr_340px]">
      <div class="grid gap-5">${isianCard(row)}${dokumenCard(row)}</div>
      ${verifikasiPanel(row)}
    </div>`;
}
