/**
 * @fileoverview Direktur "Detail": data pemberi kerja, data isian, dokumen
 * HPK, BAP, riwayat (kartu dipakai ulang dari validator-hpk/detail-view.js)
 * dan panel Penerbitan dengan fitur "Terbitkan HPK". Data =
 * GET /penerbitan-hpk/{id} (state.detail).
 */

import { qrCode } from '../../components/qr-code.js';
import { html } from '../../components/dom.js';
import { statusBadge } from '../../components/status-badge.js';
import { tanggal } from '../petugas-ekspos/format.js';
import {
  CALLOUT_INFO, CARD, LINK_MUTED, cardHeader, navAttrs, pageTitle,
} from '../portal/ui.js';
import {
  bapCard, dokumenCard, isianCard, pemberiKerjaCard, riwayatCard,
} from '../validator-hpk/detail-view.js';
import { ST, state } from './state.js';

/** TTE block of the panel: barcode when run, otherwise a pointer. */
function tteBlock(row) {
  if (row.surat.tte) {
    return html`<div class="grid justify-items-center gap-2 text-center">
      ${qrCode({ value: row.surat.tte.barcode, size: 'size-36',
    label: `Barcode TTE ${row.surat.nomor}` })}
      <p class="font-mono text-xs font-semibold">${row.surat.tte.barcode}</p>
      <p class="text-xs text-base-content/60">TTE ${tanggal(row.surat.tte.tgl)}
        · ${row.surat.tte.oleh}</p></div>`;
  }
  return html`<p class="text-sm leading-relaxed text-base-content/80">
    TTE (barcode) belum dijalankan. Jalankan dari tombol <b>TTE</b> di
    Hasil Penilaian Kelayakan (HPK).</p>`;
}

/** Right-hand panel: Terbitkan HPK, or the issued surat + TTE. */
function penerbitanPanel(row) {
  const body = row.aksi.terbitkan
    ? html`<p class="text-sm leading-relaxed text-base-content/80">
        Isian dan dokumen sudah <b>Tervalidasi</b>. <b>Terbitkan HPK</b>:
        nomor surat dibuat dan status menjadi <b>HPK Terbit</b>.</p>
      <button type="button" data-action="terbitkan-open" data-id="${row.id}"
        class="btn btn-primary w-full" data-testid="direktur-btn-terbitkan">
        Terbitkan HPK</button>`
    : html`<div class="${CALLOUT_INFO}"><b>HPK Terbit.</b> Surat
        <span class="font-mono font-semibold">${row.surat.nomor}</span>
        terbit ${tanggal(row.surat.terbit)}.</div>${tteBlock(row)}`;
  return html`<section class="${CARD} lg:sticky lg:top-24"
      aria-labelledby="vt-title">
    ${cardHeader(html`<span id="vt-title">Penerbitan HPK</span>`,
    statusBadge(row.status, row.tone))}
    <div class="grid gap-3 px-5 py-4">${body}</div></section>`;
}

/** Detail screen for `state.detail`. */
export function renderDetail() {
  const row = state.detail;
  return html`
    ${pageTitle({
      back: html`<button type="button" ${navAttrs('daftar')}
        class="${LINK_MUTED} mb-1 text-[13px]">← Hasil Penilaian Kelayakan (HPK)
        </button>`,
      eyebrow: `No. HPK ${row.noHpk}`, title: row.pemohon,
      desc: `${row.jenis} · ${row.status === ST.TERVALIDASI
        ? 'tervalidasi, menunggu diterbitkan' : 'HPK terbit'}`,
    })}
    <div class="grid items-start gap-5 lg:grid-cols-[1fr_340px]">
      <div class="grid gap-5">${pemberiKerjaCard(row)}
        ${isianCard(row.formulir)}${dokumenCard(row.formulir)}
        ${bapCard(row.bap)}${riwayatCard(row.riwayat)}</div>
      ${penerbitanPanel(row)}
    </div>`;
}
