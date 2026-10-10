/**
 * @fileoverview Pengesahan RPTKA list per layanan (legacy "hpkList": HPK
 * rows for groups A/B, non-HPK pengesahan rows for group C) and HPK detail
 * (tahap 2: jabatan quota + submitted pengesahan).
 */

import { html, qs, raw } from '../../components/dom.js';
import { statusBadge } from '../../components/status-badge.js';
import { jenisDef } from '../../contracts/pengesahan-rptka.js';
import { reloadCollection } from './data.js';
import { load as loadRptka, renderPage as renderJenisPage } from './rptka-list.js';
import { go, state } from './state.js';
import {
  BTN, BTN_OUTLINE, CARD, LINK_MUTED, THEAD, cardHeader, mountPaged,
  navAttrs, pageTitle, pagerSlot,
} from './ui.js';

const LAYANAN_DESC = {
  'Direktur/Komisaris': 'Data dan dokumen TKA diisi sekaligus dengan permohonan penilaian kelayakan.',
  'Sementara (1–6 bulan)': 'Untuk pekerjaan bersifat sementara 1–6 bulan. Tidak dapat diperpanjang; tanpa form TKI pendamping.',
  'Pekerjaan Lebih dari 6 bulan': 'HPK lalu Pengesahan per TKA. Masa berlaku 7 bulan s.d. 2 tahun.',
  'Perpanjangan': 'Ajukan paling lambat 30 hari sebelum masa berlaku berakhir.',
  'Non DKPTKA': 'Tanpa pembayaran DKPTKA; wajib nomor dan tanggal surat persetujuan pembebasan.',
  'Perpanjangan Non DKPTKA': 'Perpanjangan tanpa pembayaran DKPTKA dan tanpa form TKI pendamping.',
  'Baru (lebih dari 6 bulan)': 'Satu tahap: data calon TKA → dokumen → pengurus → pernyataan. Tanpa HPK dan tanpa DKPTKA.',
  'Jangka Pendek (1–6 bulan)': 'Untuk pekerjaan sementara 1–6 bulan. Tanpa HPK dan tanpa DKPTKA.',
};
const MIN_QUERY = 3;
const SMALL_BTN = 'btn btn-sm h-auto min-h-8 py-1.5 text-xs font-bold';

/** Legacy addNew(): start the right flow for the current layanan. */
export function addNew() {
  const lay = state.p.layanan ?? '';
  const co = state.data.company;
  if (/Perpanjangan/.test(lay)) {
    go('perpanjangan', { layanan: lay });
  } else if (co.hpk) {
    go('hpkWizard', { layanan: lay || 'Pekerjaan Lebih dari 6 bulan' });
  } else {
    go('tkaWizard', { mode: 'nonhpk', jenis: 'Baru', layanan: lay });
  }
}

function matches(query, values) {
  if (query.length < MIN_QUERY) {
    return true;
  }
  const q = query.toLowerCase();
  return values.some((v) => String(v ?? '').toLowerCase().includes(q));
}

function hpkRows(query = '') {
  const lay = state.p.layanan ?? '';
  return state.data.hpk
    .filter((h) => !lay || h.layanan === lay)
    .filter((h) => matches(query, [h.noPermohonan, h.barcode,
      ...h.jabatan.map((j) => j.nama)]));
}

function pengRows(query = '') {
  const prefix = (state.p.layanan ?? '').split(' (')[0];
  return state.data.pengesahan
    .filter((p) => !prefix || (p.layanan ?? '').startsWith(prefix))
    .filter((p) => matches(query, [p.nama, p.paspor, p.jabatan]));
}

function hpkRow(h) {
  const done = h.stepIdx >= 8;
  const back = h.tone === 'red';
  const jab = h.jabatan.map((j) => `${j.nama} (${j.kuota})`).join(', ');
  return html`<tr class="align-top">
    <td><p class="font-mono font-bold">${h.noPermohonan}</p>
      <p class="mt-0.5 text-xs text-base-content/60">HPK ${h.barcode}</p>
      <p class="text-xs text-base-content/60">${h.tgl}</p></td>
    <td><p class="font-semibold leading-normal">${jab}</p>
      <p class="mt-0.5 text-xs text-base-content/60">${h.layanan} · TKA:
        ${h.negara}</p></td>
    <td class="text-base-content/80">${h.lokasi}</td>
    <td>${statusBadge(h.status, h.tone)}
      ${back ? html`<p class="mt-1.5 text-xs leading-normal text-error">
        ${h.catatan}</p>` : ''}</td>
    <td><div class="grid justify-items-end gap-1.5">
      ${done ? html`<button type="button" class="${SMALL_BTN} btn-primary"
          ${navAttrs('hpkDetail', { hpk: h.id })}>Proses Selanjutnya →</button>
        <button type="button" class="link link-hover link-secondary text-xs
          font-bold" data-action="open-doc" data-doc="hpkDoc"
          data-id="${h.id}">Cetak BA &amp; HPK</button>` : ''}
      ${back ? html`<button type="button" class="${SMALL_BTN} btn-error"
        ${navAttrs('hpkWizard', { layanan: h.layanan, edit: h.id })}>
        Perbaiki &amp; Proses Kembali</button>` : ''}
      <button type="button" class="${LINK_MUTED} text-xs" data-action="riwayat"
        data-kind="hpk" data-id="${h.id}">Lihat proses selengkapnya</button>
    </div></td></tr>`;
}

function pengRow(p) {
  return html`<tr>
    <td><b>${p.nama}</b><p class="text-xs text-base-content/60">${p.negara}
      · ${p.paspor}</p></td>
    <td>${p.jabatan}<p class="text-xs text-base-content/60">${p.layanan}</p>
    </td>
    <td>${p.bulan} bulan</td>
    <td>${statusBadge(p.status, p.tone)}</td>
    <td><div class="grid justify-items-end gap-1.5">
      ${p.stepIdx === 0 ? html`<button type="button"
        class="${SMALL_BTN} btn-primary" ${navAttrs('tkaWizard', {
          mode: 'nonhpk', jenis: p.jenis, jabatan: p.jabatan, nama: p.nama,
          layanan: p.layanan })}>Lanjutkan</button>` : ''}
      ${p.stepIdx >= 6 ? html`<button type="button"
        class="${SMALL_BTN} ${BTN_OUTLINE}" data-action="open-doc"
        data-doc="skPeng" data-id="${p.id}">Cetak SK</button>` : ''}
      <button type="button" class="${LINK_MUTED} text-xs" data-action="riwayat"
        data-kind="peng" data-id="${p.id}">Riwayat status</button>
    </div></td></tr>`;
}

const HPK_HEAD = html`<th class="w-[150px]">No. / Barcode</th>
  <th>Jabatan (jumlah)</th><th>Lokasi</th><th>Proses status</th>
  <th class="w-[190px] text-right">Aksi</th>`;
const PENG_HEAD = html`<th>Calon TKA</th><th>Jabatan</th>
  <th class="w-[90px]">Jangka</th><th>Proses status</th>
  <th class="w-[170px] text-right">Aksi</th>`;

/**
 * VIEWS.hpkList.load. Verifikator/Validator/Simponi bisa mengubah status
 * HPK/Pengesahan di belakang (back office) selagi tab portal ini sudah
 * terbuka — `state.data.hpk`/`state.data.pengesahan` di-cache sejak
 * `boot()` dan sebelumnya tidak pernah di-refresh saat sekadar navigasi
 * menu, jadi progres yang baru tidak pernah terlihat tanpa reload penuh
 * halaman. Refresh dulu di sini, baru resolve pengajuan Form RPTKA
 * (kelompok A/B).
 */
export async function loadList() {
  await Promise.all([
    reloadCollection('hpk'), reloadCollection('pengesahan'),
    reloadCollection('billing'), loadRptka(),
  ]);
}

/** Layanan yang termasuk 11 jenis Pengesahan RPTKA: hanya tabel Form RPTKA. */
const isJenis = () => Boolean(jenisDef(state.p.layanan)?.roles
  .includes(state.role));

/** hpkList view. */
export function renderList() {
  if (isJenis()) {
    return renderJenisPage(state.p.layanan);
  }
  const co = state.data.company;
  const lay = state.p.layanan ?? '';
  const isEmpty = co.hpk ? !hpkRows().length : !pengRows().length;
  const addBtn = html`<button type="button" class="${BTN}"
    data-action="add-new" data-testid="hpk-btn-tambah">+ Tambah Baru</button>`;
  return html`
    ${pageTitle({
      eyebrow: 'Daftar Hasil Penilaian Kelayakan dan Pengesahan RPTKA',
      title: lay, desc: LAYANAN_DESC[lay] ?? '',
      actions: addBtn })}
    <div class="${CARD} flex items-center gap-2.5 px-3.5 py-1">
      <label for="hpk-search" class="sr-only">Cari permohonan</label>
      <span class="text-base-content/50" aria-hidden="true">⌕</span>
      <input id="hpk-search" type="search" data-search="hpk"
        class="input input-ghost h-10 flex-1 px-0 text-sm focus:outline-none"
        placeholder="Cari no. permohonan, barcode, atau jabatan (min. 3 karakter)">
    </div>
    <section class="${CARD} overflow-hidden" ${isEmpty ? 'hidden' : ''}>
      <div class="overflow-x-auto"><table class="table min-w-[900px]
          text-[13px]"><thead><tr class="${THEAD}">
          ${co.hpk ? HPK_HEAD : PENG_HEAD}</tr></thead>
        <tbody id="hpk-body"></tbody></table></div>
      ${pagerSlot('hpk-pager')}</section>
    ${isEmpty ? html`<div class="rounded-box border border-dashed
        border-base-content/20 bg-base-100 p-12 text-center">
      <p class="mb-1.5 text-[17px] font-extrabold">Belum ada permohonan
        ${lay}</p>
      <p class="mb-4.5 text-sm text-base-content/70">Mulai permohonan baru
        untuk layanan ini.</p>${addBtn}</div>` : ''}`;
}

/** @param {!Element} root */
export function mountList(root) {
  if (isJenis()) {
    return;
  }
  const co = state.data.company;
  const draw = (query) => mountPaged(root, {
    body: '#hpk-body', footer: '#hpk-pager',
    items: co.hpk ? hpkRows(query) : pengRows(query),
    row: co.hpk ? hpkRow : pengRow,
    empty: html`<tr><td colspan="5" class="py-8 text-center
      text-base-content/60">Tidak ada permohonan yang cocok.</td></tr>`,
  });
  draw('');
  const search = qs('#hpk-search', root);
  search.addEventListener('input', () => {
    const footer = qs('#hpk-pager', root);
    footer.replaceWith(footer.cloneNode(false));
    draw(search.value.trim());
  });
}

function currentHpk() {
  const list = state.data.hpk;
  return list.find((h) => h.id === (state.p.hpk ?? 'h1')) ?? list[0] ??
    { jabatan: [] };
}

function jabatanRow(j, hd) {
  const pct = Math.round((j.terisi / j.kuota) * 100);
  const full = j.terisi >= j.kuota;
  return html`<li class="grid items-center gap-4 border-t border-base-200
      px-5 py-3.5 text-sm md:grid-cols-[minmax(0,1.5fr)_100px_minmax(0,1fr)_150px]">
    <div><p class="font-semibold">${j.nama}</p>
      <p class="text-xs text-base-content/60">${j.bulan} bulan</p></div>
    <span class="text-[13px]">${j.terisi} / ${j.kuota}</span>
    <progress class="progress progress-secondary h-2" value="${pct}" max="100"
      aria-label="Kuota ${j.nama} terisi ${pct}%"></progress>
    <div class="md:justify-self-end">${full
      ? html`<span class="text-xs font-bold text-base-content/60">Kuota
          penuh</span>`
      : html`<button type="button" class="${BTN} btn-sm"
        ${navAttrs('rptka', { hpk: hd.id, jabatan: j.nama,
          jenis: jenisDef(hd.layanan) ? hd.layanan : '' })}
        aria-label="Ajukan RPTKA jabatan ${j.nama}">Ajukan RPTKA</button>`}
    </div></li>`;
}

function hdPengRow(p) {
  const bill = Boolean(p.billing) && p.stepIdx <= 5;
  return html`<tr>
    <td><b>${p.nama}</b><p class="text-xs text-base-content/60">${p.negara}
      · ${p.paspor}</p></td>
    <td>${p.jabatan}</td><td class="text-xs">${p.jenis}</td>
    <td>${p.bulan} bln</td><td>${statusBadge(p.status, p.tone)}</td>
    <td class="text-xs font-bold ${p.imigrasi ? 'text-success'
      : 'text-base-content/50'}">${p.imigrasi ? '✓ Terkirim' : '—'}</td>
    <td><div class="grid justify-items-end gap-1.5">
      ${bill ? html`<button type="button" class="${SMALL_BTN} btn-warning"
        data-action="open-billing" data-id="${p.billing}">Tagihan DKPTKA
        </button>` : ''}
      ${p.stepIdx >= 6 ? html`<button type="button"
        class="${SMALL_BTN} ${BTN_OUTLINE}" data-action="open-doc"
        data-doc="skPeng" data-id="${p.id}">Cetak SK</button>` : ''}
      <button type="button" class="${LINK_MUTED} text-xs" data-action="riwayat"
        data-kind="peng" data-id="${p.id}">Riwayat</button></div></td></tr>`;
}

/** VIEWS.hpkDetail.load: lihat komentar di loadList() — baris Pengesahan
 * di bawah HPK ini juga butuh status terbaru dari back office. */
export async function loadDetail() {
  await Promise.all([
    reloadCollection('hpk'), reloadCollection('pengesahan'),
    reloadCollection('billing'),
  ]);
}

/** hpkDetail view. */
export function renderDetail() {
  const hd = currentHpk();
  const total = hd.jabatan.reduce((a, j) => a + j.kuota, 0);
  const terisi = hd.jabatan.reduce((a, j) => a + j.terisi, 0);
  const printBtns = html`<div class="flex gap-2">
    <button type="button" class="${BTN_OUTLINE}" data-action="open-doc"
      data-doc="hpkDoc" data-id="${hd.id ?? ''}">Cetak Berita Acara</button>
    <button type="button" class="${BTN_OUTLINE}" data-action="open-doc"
      data-doc="hpkDoc" data-id="${hd.id ?? ''}">Cetak HPK</button></div>`;
  const summary = [
    ['No. permohonan', hd.noPermohonan, 'font-mono'],
    ['HPK terbit', hd.terbit, ''], ['Lokasi kerja', hd.lokasi, ''],
    ['Kuota terisi', `${terisi} dari ${total} TKA`, ''],
  ];
  return html`
    ${pageTitle({ eyebrow: 'Tahap 2 · Daftar Pengesahan RPTKA',
      title: `HPK ${hd.barcode ?? ''} · ${hd.layanan ?? ''}`,
      actions: printBtns })}
    <dl class="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-px
        overflow-hidden rounded-box border border-base-300 bg-base-300
        text-[13px]">${summary.map(([label, value, cls]) => html`
      <div class="bg-base-100 px-4.5 py-4"><dt class="text-base-content/60">
        ${label}</dt><dd class="text-sm font-bold ${cls}">${value}</dd>
      </div>`)}</dl>
    <section class="${CARD}">${cardHeader(raw('Rencana jabatan &amp; kuota'))}
      <ul>${hd.jabatan.map((j) => jabatanRow(j, hd))}</ul></section>
    <section class="${CARD} overflow-hidden">
      ${cardHeader('Pengesahan yang sudah diajukan')}
      <div class="overflow-x-auto"><table class="table min-w-[1040px]
          text-[13px]"><thead><tr class="${THEAD}"><th>Calon TKA</th>
          <th>Jabatan</th><th class="w-[130px]">Jenis</th>
          <th class="w-[90px]">Disetujui</th><th>Status</th>
          <th class="w-[110px]">Imigrasi</th>
          <th class="w-[150px] text-right">Aksi</th></tr></thead>
        <tbody id="hd-body"></tbody></table></div>
      ${pagerSlot('hd-pager')}</section>`;
}

/** @param {!Element} root */
export function mountDetail(root) {
  const hd = currentHpk();
  mountPaged(root, {
    body: '#hd-body', footer: '#hd-pager',
    items: state.data.pengesahan.filter((p) => p.hpk === hd.id),
    row: hdPengRow,
  });
}

export const actions = {
  'add-new'() {
    addNew();
  },
};
