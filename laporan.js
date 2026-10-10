/**
 * @fileoverview Laporan TKA (legacy "laporan" + "laporanDetail"): four
 * reports L1–L4 per period (Draft -> Terkirim, LP-02), detail tables built
 * from GET /laporan-penggunaan and the manual "Tambah data" side form.
 */

import { html, qs } from '../../components/dom.js';
import { statusBadge } from '../../components/status-badge.js';
import { loadLaporanPenggunaan } from './data.js';
import { state } from './state.js';
import {
  BTN, BTN_OUTLINE, CARD, H1, LINK, THEAD, field, mountPaged, navAttrs,
  noopAttrs, pageTitle, pagerSlot, textareaField,
} from './ui.js';

const COLUMNS = [
  ['Nama TKA', 'No. Paspor', 'Jabatan', 'Barcode SK', 'TKI Pendamping',
    'Periode'],
  ['TKI Pendamping', 'Jabatan TKA didampingi', 'Nama pelatihan', 'Tanggal',
    'Penyelenggara', 'Sertifikat'],
  ['TKI Pendamping', 'Bidang keahlian', 'Metode alih keahlian', 'Durasi',
    'Hasil evaluasi', 'Status'],
  ['Nama TKA', 'No. Paspor', 'Jabatan', 'Barcode SK', 'Tanggal berakhir',
    'Alasan'],
];
const L2 = {
  pelatihan: ['Sertifikasi Operator Mesin CNC', 'ISO 9001 Internal Auditor',
    'Manajemen Pabrik Lanjutan', 'Kepemimpinan Teknik'],
  tanggal: ['14–18 Apr 2025', '2–4 Jun 2025', '8–19 Sep 2025',
    '3–5 Nov 2025'],
  penyelenggara: ['BLK Bekasi', 'LSP Mutu Nasional', 'Internal NBP',
    'PPM Manajemen'],
};
const L3 = {
  bidang: ['Kalibrasi alat ukur', 'Perencanaan perawatan', 'Manajemen pabrik',
    'Sistem mutu ISO 9001', 'Desain cetakan', 'Kontrol proses'],
  metode: ['On-the-job training', 'Mentoring mingguan', 'Job shadowing',
    'Pelatihan kelas', 'Proyek bersama', 'On-the-job training'],
  durasi: ['6 bulan', '9 bulan', '12 bulan', '3 bulan', '6 bulan',
    '8 bulan'],
  hasil: ['Kompeten', 'Kompeten', 'Sebagian', 'Kompeten', 'Dalam proses',
    'Kompeten'],
};
const L2_ROWS = 4;
const L3_ROWS = 6;
const L3_RUNNING = 4;
const L4_SOURCE = 4;

/** True once the active period has been sent. */
export function isSent() {
  return state.data.laporan.status === 'Terkirim';
}

function reportIndex() {
  return Number(state.p.idx ?? 0);
}

/** Legacy lapData: rows per report built from laporan penggunaan. */
function detailRows(li, lp) {
  if (li === 0) {
    return lp.map((x) => [x.nama, x.paspor, x.jabatan, x.sk, x.pendamping,
      `${x.mulai} – ${x.akhir}`]);
  }
  if (li === 1) {
    return lp.slice(0, L2_ROWS).map((x, k) => [x.pendamping, x.jabatan,
      L2.pelatihan[k], L2.tanggal[k], L2.penyelenggara[k], 'Ada']);
  }
  if (li === 2) {
    return lp.slice(0, L3_ROWS).map((x, k) => [x.pendamping, L3.bidang[k],
      L3.metode[k], L3.durasi[k], L3.hasil[k],
      k === L3_RUNNING ? 'Berjalan' : 'Selesai']);
  }
  const x = lp[L4_SOURCE];
  return x ? [[x.nama, x.paspor, x.jabatan, x.sk, x.akhir,
    'Masa berlaku berakhir — EPO']] : [];
}

function reportRow(def, i) {
  const lp = state.data.laporan;
  const sent = isSent();
  return html`<tr>
    <td class="text-base-content/60">${i + 1}</td>
    <td class="font-semibold leading-snug">${def.nama}</td>
    <td>${lp.rows[i].n}</td><td class="text-base-content/70">${lp.rows[i].upd}
    </td><td>${statusBadge(lp.status, sent ? 'green' : 'gray')}</td>
    <td><div class="flex justify-end gap-1.5">
      <button type="button" class="${BTN} btn-sm"
        ${navAttrs('laporanDetail', { idx: i })}>Buka</button>
      <button type="button" class="${BTN_OUTLINE} btn-sm"
        data-action="lap-upload" data-idx="${i}">Upload</button>
      <button type="button" class="${BTN_OUTLINE} btn-sm"
        ${sent ? noopAttrs(`Print ${def.kode}`) : 'disabled'}
        title="${sent ? `Print ${def.kode}` : 'Tersedia setelah Terkirim'}">
        Print</button></div></td></tr>`;
}

/** laporan view. */
export function render() {
  const { company: co, laporan: lp, laporanDef } = state.data;
  const sent = isSent();
  const periode = html`<div class="flex items-center gap-2.5">
    <label for="lap-periode" class="text-[13px] text-base-content/70">Periode
    </label><select id="lap-periode" class="select h-11 w-auto font-bold">
      <option>${lp.periode}</option></select></div>`;
  return html`
    ${pageTitle({ title: 'Laporan TKA', actions: periode,
      desc: 'Pemberi kerja wajib melapor penggunaan TKA setiap 1 tahun.' })}
    ${sent ? html`<p role="status" class="rounded-box border border-success/30
      bg-success/10 px-4.5 py-4 text-sm font-semibold text-success">Terima
      kasih sudah mengirimkan Laporan TKA Periode ${lp.periode}. Laporan kini
      dapat dicetak.</p>` : ''}
    <div class="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-5">
      <section class="${CARD} px-5.5 py-5 text-[13px]">
        <h2 class="mb-1.5 text-[15px] font-bold">Profil pemberi kerja</h2>
        <dl class="grid grid-cols-[140px_1fr] gap-x-4 gap-y-2">
          <dt class="text-base-content/60">Nama</dt>
          <dd class="font-bold">${co.nama}</dd>
          <dt class="text-base-content/60">Alamat</dt>
          <dd>${co.jalan}, ${co.kab}, ${co.prov}</dd>
          <dt class="text-base-content/60">Telepon / Faks</dt>
          <dd>${co.telp} / ${co.fax}</dd>
          <dt class="text-base-content/60">Email</dt><dd>${co.email}</dd></dl>
      </section>
      <section class="${CARD} px-5.5 py-5 text-[13px] leading-relaxed
          text-base-content/80">
        <h2 class="mb-2 text-[15px] font-bold text-base-content">Status
          laporan</h2>
        <p class="mb-1.5 flex gap-2.5">${statusBadge('Draft', 'gray')}masih
          bisa diubah, belum dikirim.</p>
        <p class="flex gap-2.5">${statusBadge('Terkirim', 'green')}sudah
          diterima; dapat dicetak.</p></section></div>
    <section class="${CARD} overflow-x-auto">
      <table class="table min-w-[900px] text-[13px]"><thead>
        <tr class="${THEAD}"><th class="w-10">No</th><th>Laporan</th>
          <th class="w-[100px]">Jumlah data</th>
          <th class="w-[190px]">Terakhir diperbarui</th>
          <th class="w-[110px]">Status</th>
          <th class="w-[230px]"><span class="sr-only">Aksi</span></th></tr>
      </thead><tbody>${laporanDef.map(reportRow)}</tbody></table></section>
    ${sent ? '' : html`<div class="flex justify-end"><button type="button"
      class="${BTN}" data-action="lap-open-kirim"
      data-testid="laporan-btn-kirim">Kirim Laporan Periode ${lp.periode}
      </button></div>`}`;
}

/** Fetch laporan penggunaan before rendering the detail. */
export function loadDetail() {
  return loadLaporanPenggunaan();
}

/** laporanDetail view. */
export function renderDetail() {
  const li = reportIndex();
  const def = state.data.laporanDef[li];
  const back = html`<button type="button" class="${LINK} text-[13px]"
    ${navAttrs('laporan')}>← Laporan TKA ${state.data.laporan.periode}
    </button>`;
  const actions = html`<div class="flex gap-2">
    <button type="button" class="${BTN_OUTLINE}" data-action="lap-upload"
      data-idx="${li}">Upload Excel</button>
    <button type="button" class="${BTN}" data-action="lap-focus-add">+ Tambah
      data</button></div>`;
  return html`
    <div class="flex flex-wrap items-end justify-between gap-4"><div>${back}
      <h1 class="${H1} mt-2 max-w-[820px] text-2xl">${def.nama}</h1></div>
      ${actions}</div>
    <div class="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))]
        items-start gap-5">
      <section class="${CARD} overflow-hidden" aria-label="${def.nama}">
        <div class="overflow-x-auto"><table class="table min-w-[1040px]
            text-[13px]"><thead><tr class="${THEAD}">
            ${COLUMNS[li].map((c) => html`<th>${c}</th>`)}
            <th class="w-[70px]"><span class="sr-only">Aksi</span></th></tr>
          </thead><tbody id="lap-body"></tbody></table></div>
        ${pagerSlot('lap-pager')}</section>
      <form id="lap-add-form" class="${CARD} grid gap-3 p-5" novalidate
          aria-labelledby="lap-add-title">
        <h2 id="lap-add-title" class="text-[15px] font-bold">Tambah data</h2>
        ${field({ id: 'lap-add-barcode', label: 'Barcode Pengesahan',
          value: '26045102' })}
        <p class="rounded-field bg-base-200/50 px-3 py-2.5 text-xs
          leading-normal">Rajesh Kumar · Z6120934 · Process Engineer</p>
        ${field({ id: 'lap-add-tki', label: 'TKI pendamping',
          value: 'Rizky Ramadhan' })}
        ${textareaField({ id: 'lap-add-ket', label: 'Keterangan', rows: 2,
          value: 'Mulai bekerja 8 September 2026.' })}
        <button type="button" class="${BTN}" ${noopAttrs('Simpan data')}>
          Simpan</button></form></div>`;
}

function detailRow(cells) {
  return html`<tr><td class="font-semibold">${cells[0]}</td>
    ${cells.slice(1, 5).map((c) => html`<td>${c}</td>`)}
    <td class="text-xs text-base-content/70">${cells[5]}</td>
    <td class="text-right"><button type="button" class="${LINK} text-xs"
      ${noopAttrs('Edit baris laporan')}>Edit</button></td></tr>`;
}

/** @param {!Element} root */
export function mountDetail(root) {
  mountPaged(root, {
    body: '#lap-body', footer: '#lap-pager',
    items: detailRows(reportIndex(), state.extra.laporanPenggunaan ?? []),
    row: detailRow,
    empty: html`<tr><td colspan="7" class="p-10 text-center text-sm
      text-base-content/60">Belum ada data. Tambah manual atau unggah templat
      Excel.</td></tr>`,
  });
}

export const actions = {
  'lap-focus-add'() {
    qs('#lap-add-barcode')?.focus();
  },
};
