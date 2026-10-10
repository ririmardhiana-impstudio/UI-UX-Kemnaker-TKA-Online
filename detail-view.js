/**
 * @fileoverview Verifikator "Detail pemberi kerja": Nama Pemberi Kerja,
 * Email Admin Pemberi Kerja, Data Operator, Dokumen, plus panel Verifikasi
 * (Sesuai / Tidak sesuai) and riwayat email aktivasi. Data = GET
 * /pendaftar/{id} (state.detail).
 */

import { kilobyte, pratinjauAttrs } from '../../components/doc-preview.js';
import { formatFileSize } from '../../components/form-ui.js';
import { html } from '../../components/dom.js';
import { statusBadge } from '../../components/status-badge.js';
import {
  BTN_OUTLINE, CARD, CALLOUT_INFO, CALLOUT_WARN, LINK_MUTED, THEAD,
  cardHeader, navAttrs, pageTitle,
} from '../portal/ui.js';
import { npwpText } from './list-view.js';
import { ACTIVE, FIX, WAITING, state } from './state.js';

const OSS = 'OSS';

function dl(items) {
  return html`<dl class="grid gap-x-6 gap-y-3.5 px-5 py-4 text-sm
      sm:grid-cols-2">${items.map(([term, value]) => html`<div>
    <dt class="text-xs font-bold text-base-content/60">${term}</dt>
    <dd class="mt-0.5 break-words font-semibold">${value || '—'}</dd>
  </div>`)}</dl>`;
}

function perusahaanCard(row) {
  const nonOss = row.metodePendaftaran !== OSS;
  const items = [
    ['Nama Pemberi Kerja', row.nama],
    ['Jenis Pemberi Kerja', row.kategori],
    ['Status Penanam Modal', row.statusPenanamModal],
    ['Metode Pendaftaran', row.metodePendaftaran],
    ['NPWP', npwpText(row)],
    ['NIB', nonOss ? '' : row.nib],
    ['Kode WLKP', nonOss ? '' : row.kodeWlkp],
    ['Tanggal daftar', row.tgl],
    ['Didaftarkan oleh (SSO SIAPkerja)', row.sso],
  ];
  return html`<section class="${CARD}" aria-labelledby="dp-title">
    ${cardHeader(html`<span id="dp-title">Data Pemberi Kerja</span>`)}
    ${dl(items)}
    ${nonOss ? html`<p class="border-t border-base-200 px-5 py-3 text-xs
      text-base-content/60">Metode Non-OSS: NPWP, NIB, dan kode WLKP tidak
      dikumpulkan saat registrasi.</p>` : ''}
  </section>`;
}

function adminCard(row) {
  return html`<section class="${CARD}" aria-labelledby="da-title">
    ${cardHeader(html`<span id="da-title">Email Admin Pemberi Kerja</span>`)}
    ${dl([['Email admin (akun SIAPkerja pendaftar)', row.emailAdmin],
      ['Nama admin', row.sso]])}</section>`;
}

function operatorCard(row) {
  const nonOss = row.metodePendaftaran !== OSS;
  const label = nonOss ? 'Data Ditemukan' : 'Terdaftar di SIAPKerja';
  return html`<section class="${CARD}" aria-labelledby="do-title">
    ${cardHeader(html`<span id="do-title">Data Operator
      (${row.operators.length})</span>`)}
    ${row.operators.length ? html`<div class="overflow-x-auto">
      <table class="table text-sm">
        <thead class="${THEAD}"><tr><th scope="col">Nama</th>
          <th scope="col">Email operator</th><th scope="col">SIAPKerja</th>
        </tr></thead>
        <tbody>${row.operators.map((op) => html`<tr>
          <td class="font-semibold">${op.nama || '—'}</td>
          <td>${op.email}</td>
          <td>${op.terdaftar ? statusBadge(label, 'green')
            : statusBadge('Tidak ditemukan', 'red')}</td></tr>`)}
        </tbody></table></div>`
      : html`<p class="px-5 py-6 text-center text-sm text-base-content/60">
        Data operator belum tersedia.</p>`}
  </section>`;
}

function dokumenCard(row) {
  const d = row.dokumen;
  return html`<section class="${CARD}" aria-labelledby="dd-title">
    ${cardHeader(html`<span id="dd-title">Dokumen</span>`)}
    ${d ? html`<div class="flex flex-wrap items-center justify-between
        gap-3 px-5 py-4">
      <div class="min-w-0"><p class="text-sm font-bold">${d.jenis}</p>
        <p class="break-all text-xs text-base-content/60">${d.fileName} ·
          ${formatFileSize(d.fileSize)}</p></div>
      <button type="button" ${pratinjauAttrs({ judul: d.jenis, namaBerkas: d.fileName,
          ukuranKb: kilobyte(d.fileSize), berkasId: d.berkasId })}
        class="btn btn-sm ${BTN_OUTLINE}">
        Lihat dokumen</button></div>`
      : html`<p class="px-5 py-6 text-center text-sm text-base-content/60">
        Belum ada dokumen yang diunggah.</p>`}
  </section>`;
}

function emailCard(row) {
  return html`<section class="${CARD}" aria-labelledby="de-title">
    ${cardHeader(html`<span id="de-title">Email aktivasi terkirim</span>`)}
    <ul class="divide-y divide-base-200">
      ${row.emailTerkirim.map((mail) => html`<li class="px-5 py-3.5">
        <p class="text-sm font-bold">${mail.ke}</p>
        <p class="text-xs text-base-content/60">${mail.peran} ·
          ${mail.waktu}</p>
        <p class="mt-0.5 text-xs text-base-content/70">${mail.subjek}</p>
      </li>`)}</ul></section>`;
}

/** Right-hand panel: what the Verifikator can do for the current status. */
function verifikasiPanel(row) {
  let body;
  if (row.status === WAITING) {
    body = html`<p class="text-sm leading-relaxed text-base-content/80">
        Periksa data perusahaan, email admin, operator, dan dokumen. Jika
        sesuai, sistem mengirim email aktivasi ke email admin dan operator.
      </p>
      <button type="button" data-action="verify" data-id="${row.id}"
        class="btn btn-primary w-full" data-testid="verifikator-btn-verifikasi">
        Verifikasi</button>
      <button type="button" data-action="reject" data-id="${row.id}"
        class="btn w-full border-error/30 text-error shadow-none
          hover:bg-error/10" data-testid="verifikator-btn-tidak-sesuai">
        Tidak sesuai — minta perbaikan</button>`;
  } else if (row.status === FIX) {
    body = html`<div class="${CALLOUT_WARN}"><b>Menunggu perbaikan
      pemohon.</b><br>${row.catatan ?? 'Pemohon diminta mengunggah ulang dokumen.'}
      <br><span class="text-xs">Berkas kembali ke daftar ini setelah pemohon
      mengunggah ulang.</span></div>`;
  } else if (row.status === ACTIVE) {
    body = html`<div class="${CALLOUT_INFO}"><b>Akun aktif.</b> Email
      aktivasi telah dikirim ke ${row.emailTerkirim.length} alamat (email
      admin dan operator).</div>`;
  } else {
    body = html`<div class="${CALLOUT_WARN}">${row.status}. Tidak ada aksi
      verifikasi yang tersedia.</div>`;
  }
  return html`<section class="${CARD} lg:sticky lg:top-24"
      aria-labelledby="dv-title">
    ${cardHeader(html`<span id="dv-title">Verifikasi</span>`,
      statusBadge(row.status, row.tone))}
    <div class="grid gap-3 px-5 py-4">${body}</div></section>`;
}

/** Detail screen for `state.detail`. */
export function renderDetail() {
  const row = state.detail;
  return html`
    ${pageTitle({
      back: html`<button type="button" ${navAttrs('daftar')}
        class="${LINK_MUTED} mb-1 text-[13px]">← Daftar Pemberi Kerja
        </button>`,
      eyebrow: 'Detail pemberi kerja', title: row.nama,
      desc: `${row.kategori} · mendaftar ${row.tgl}`,
    })}
    <div class="grid items-start gap-5 lg:grid-cols-[1fr_340px]">
      <div class="grid gap-5">
        ${perusahaanCard(row)}${adminCard(row)}${operatorCard(row)}
        ${dokumenCard(row)}
        ${row.emailTerkirim.length ? emailCard(row) : ''}
      </div>
      ${verifikasiPanel(row)}
    </div>`;
}
