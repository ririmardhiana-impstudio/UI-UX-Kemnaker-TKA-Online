/**
 * @fileoverview Daftar pengajuan Form RPTKA: kartu "Pengajuan Form RPTKA"
 * di daftar HPK/Pengesahan (jenis yang sudah punya submenu) dan halaman
 * `rptkaList` untuk submenu jenis baru (KEK, Ibu Kota Nusantara, Kerja Sama
 * Internasional, Alih Status, Dahsuskim, Rangkap Jabatan, Non DKPTKA Non
 * HPK). Data lewat GET /pengesahan-rptka?jenis= (cache di rptka-data).
 */

import { html } from '../../components/dom.js';
import { emptyState } from '../../components/empty-state.js';
import { statusBadge } from '../../components/status-badge.js';
import { RPTKA_STATUS, jenisDef } from '../../contracts/pengesahan-rptka.js';
import { PAGE, cache, isPerpanjangan, loadList, tanggal } from './rptka-data.js';
import { state } from './state.js';
import {
  BTN, CARD, LINK, THEAD, cardHeader, navAttrs, pageTitle,
} from './ui.js';

/** VIEWS.hpkList.load: hanya untuk layanan yang termasuk 11 jenis. */
export async function load() {
  const jenis = state.p.layanan;
  if (jenisDef(jenis)?.roles.includes(state.role)) {
    await loadList(jenis);
  } else {
    cache().list = [];
  }
}

/** VIEWS.rptkaList.load. */
export function loadPage() {
  return loadList(state.p.jenis);
}

/** Kolom daftar Perpanjangan: No | No HPK | Tgl Pengajuan | Nomor RPTKA | Jenis | Status. */
function rowPerpanjangan(r) {
  const draft = r.status === RPTKA_STATUS.DRAF;
  return html`<tr>
    <td class="font-mono font-bold">${r.noAjuan}</td>
    <td>${r.hpkBarcode ?? '—'}</td>
    <td>${r.diajukan ? tanggal(r.diajukan) : '—'}</td>
    <td class="font-mono">${r.nomorRptka ?? '—'}</td>
    <td>${r.jenis ?? '—'}</td><td>${statusBadge(r.status, r.tone)}</td>
    <td class="text-right"><button type="button" class="${LINK} text-xs"
      ${navAttrs(PAGE, { id: r.id })}
      aria-label="${draft ? 'Lanjutkan' : 'Lihat'} ${r.noAjuan}">${draft
    ? 'Lanjutkan' : 'Lihat'}</button></td></tr>`;
}

function row(r) {
  const draft = r.status === RPTKA_STATUS.DRAF;
  return html`<tr>
    <td class="font-mono font-bold">${r.noAjuan}</td>
    <td>${r.hpkBarcode ?? '—'}</td>
    <td>${r.jenis ?? '—'}${r.kegiatan ? html`<p class="text-xs
      text-base-content/60">Kegiatan ${r.kegiatan}</p>` : ''}</td>
    <td>${r.jumlahTka}</td><td>${statusBadge(r.status, r.tone)}</td>
    <td>${tanggal(r.diubah)}</td>
    <td class="text-right"><button type="button" class="${LINK} text-xs"
      ${navAttrs(PAGE, { id: r.id })}
      aria-label="${draft ? 'Lanjutkan' : 'Lihat'} ${r.noAjuan}">${draft
    ? 'Lanjutkan' : 'Lihat'}</button></td></tr>`;
}

function tablePerpanjangan(rows) {
  return html`<div class="overflow-x-auto"><table class="table min-w-[760px]
      text-[13px]"><caption class="sr-only">Draft dan pengajuan Perpanjangan
    RPTKA</caption><thead><tr class="${THEAD}"><th scope="col">No</th>
      <th scope="col">No HPK</th><th scope="col">Tgl Pengajuan</th>
      <th scope="col">Nomor RPTKA</th><th scope="col">Jenis RPTKA</th>
      <th scope="col">Status</th>
      <th scope="col" class="w-28 text-right">Aksi</th></tr></thead>
    <tbody>${rows.map(rowPerpanjangan)}</tbody></table></div>`;
}

function table(rows) {
  return html`<div class="overflow-x-auto"><table class="table min-w-[760px]
      text-[13px]"><caption class="sr-only">Draft dan pengajuan Form RPTKA
    </caption><thead><tr class="${THEAD}"><th scope="col">No. ajuan</th>
      <th scope="col">Nomor HPK</th><th scope="col">Jenis RPTKA</th>
      <th scope="col" class="w-24">Jumlah TKA</th>
      <th scope="col">Status</th><th scope="col">Diubah</th>
      <th scope="col" class="w-28 text-right">Aksi</th></tr></thead>
    <tbody>${rows.map(row)}</tbody></table></div>`;
}

/**
 * Tabel Form RPTKA satu jenis: isi submenu sidebar (rptkaList) dan juga
 * hpkList untuk jenis yang sudah punya submenu lama.
 * @param {string=} jenis
 */
export function renderPage(jenis = state.p.jenis) {
  const def = jenisDef(jenis);
  const rows = cache().list ?? [];
  const add = html`<button type="button" class="${BTN}"
    ${navAttrs(PAGE, { baru: 1, jenis })}
    data-testid="rptka-btn-ajukan">+ Ajukan Pengesahan RPTKA</button>`;
  const perp = isPerpanjangan(jenis);
  return html`${pageTitle({ eyebrow: perp ? 'Perpanjangan'
      : 'Pengajuan Surat › Pengesahan RPTKA',
    title: def?.judul ?? 'Pengesahan RPTKA', desc: def?.ket ?? '',
    actions: perp ? html`<button type="button" class="${BTN}"
      ${navAttrs(PAGE, { baru: 1, jenis })}
      data-testid="rptka-btn-ajukan">+ Ajukan Perpanjangan</button>` : add })}
    ${rows.length ? html`<section class="${CARD} overflow-hidden"
        aria-label="Pengajuan Form RPTKA" data-testid="rptka-list">
      ${cardHeader(perp ? 'Pengajuan Perpanjangan RPTKA'
    : 'Pengajuan Form RPTKA')}${perp ? tablePerpanjangan(rows)
    : table(rows)}</section>`
    : emptyState({ icon: '▤', title: 'Belum ada pengajuan',
      body: `Draft dan pengajuan ${perp ? 'Perpanjangan' : 'Pengesahan'} ` +
        'RPTKA jenis ini akan tampil di sini.', action: { label: perp
        ? 'Ajukan Perpanjangan' : 'Ajukan Pengesahan RPTKA',
        attrs: navAttrs(PAGE, { baru: 1, jenis }) } })}`;
}
