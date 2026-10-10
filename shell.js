/**
 * @fileoverview Verifikator chrome: sidebar (brand, user card, menu) and
 * breadcrumb — same layout as the employer portal shell
 * (js/pages/portal/shell.js).
 */

import { brand } from '../../components/brand.js';
import { html, qs, raw, setHtml } from '../../components/dom.js';
import { BADGE_HIGHLIGHT, navAttrs } from '../portal/ui.js';
import { WAITING, scopeOf, state } from './state.js';

const MENU = [
  { h: 'UTAMA' },
  { label: 'Beranda', page: 'beranda' },
  { h: 'VERIFIKASI AKUN' },
  { label: 'Daftar Pemberi Kerja', page: 'daftar' },
  { h: 'VERIFIKASI HPK' },
  { label: 'Verifikasi HPK', page: 'hpk' },
  { h: 'PENGESAHAN RPTKA' },
  { label: 'Pengesahan RPTKA', page: 'pengesahan' },
  { h: 'PERPANJANGAN RPTKA' },
  { label: 'Perpanjangan Lintas Provinsi', page: 'perpanjangan' },
  { label: 'Perpanjangan Lintas Kab/Kota', page: 'kabkota' },
  { h: 'PERUBAHAN & PENCABUTAN' },
  { label: 'Perubahan RPTKA', page: 'perubahan' },
  { label: 'Pencabutan RPTKA', page: 'pencabutan' },
];

/** Menu item that is highlighted for the current page ("detail" too). */
function isActive(item) {
  const page = { detail: 'daftar', hpkDetail: 'hpk',
    pengesahanDetail: 'pengesahan',
    perpanjanganDetail: 'perpanjangan', kabkotaDetail: 'kabkota',
    perubahanDetail: 'perubahan',
    pencabutanDetail: 'pencabutan' }[state.page] ?? state.page;
  return item.page === page;
}

function waitingCount() {
  return state.rows?.filter((r) => r.status === WAITING).length ?? 0;
}

function hpkWaitingCount() {
  return state.hpkRows?.filter((r) => r.status === WAITING).length ?? 0;
}

const scopeWaiting = (scope) => () => state.pengRows?.filter((r) =>
  scopeOf(r) === scope && r.status === WAITING).length ?? 0;

const waitingOf = (rows) => rows?.filter((r) => r.status === WAITING).length ??
  0;

function leafItem(item) {
  const active = isActive(item);
  const badge = { daftar: waitingCount, hpk: hpkWaitingCount,
    pengesahan: scopeWaiting('pengesahan'),
    perpanjangan: scopeWaiting('perpanjangan'),
    kabkota: scopeWaiting('kabkota'),
    perubahan: () => waitingOf(state.perubahanRows),
    pencabutan: () => waitingOf(state.pencabutanRows) }[item.page]?.() ?? 0;
  return html`<li><button type="button" ${navAttrs(item.page)}
      ${active ? raw('aria-current="page"') : ''}
      class="flex justify-between gap-2 rounded-field px-2.5 py-2 text-left
        hover:bg-primary-content/10 ${active
          ? 'bg-primary-content/10 font-bold text-primary-content'
          : 'font-medium text-primary-content/80'}">
    <span>${item.label}</span>
    ${badge ? html`<span class="${BADGE_HIGHLIGHT} badge-xs h-auto py-0.5
      font-extrabold">${badge}</span>` : ''}</button></li>`;
}

/** Sidebar brand + user card + menu. */
export function renderSidebar() {
  setHtml(qs('#brand'), brand({ subtitle: 'Verifikator Akun', size: 'md' }));
  setHtml(qs('#user-card'), html`<div class="mx-3.5 mb-3.5 rounded-box
      border border-primary-content/10 bg-primary-content/10 px-3.5 py-3">
    <p class="text-[11px] text-primary-content/60">Direktorat PPTKA</p>
    <p class="text-[13px] font-bold leading-snug text-primary-content">
      Andika Pratama</p>
    <p class="mt-2 flex gap-1.5 text-[10px] font-bold">
      <span class="rounded-full bg-primary-content/10 px-2 py-0.5
        text-info-bright">Verifikator Akun</span></p></div>`);
  setHtml(qs('#side-menu'), html`<ul class="menu w-full gap-0.5 px-2.5 pb-5
      text-[13px]">${MENU.map((item) => item.h
    ? html`<li class="menu-title px-2.5 pb-1.5 pt-4 text-[10px]
        font-extrabold tracking-widest text-primary-content/60">
        ${item.h}</li>`
    : leafItem(item))}</ul>`);
}

/** Breadcrumb text for the header + document title. */
export function crumbText(rows) {
  const base = 'TKA Online › Verifikasi Akun';
  if (state.page === 'beranda') {
    return `${base} › Beranda`;
  }
  if (state.page === 'daftar') {
    return `${base} › Daftar Pemberi Kerja`;
  }
  if (state.page === 'hpk') {
    return 'TKA Online › Verifikasi HPK › Daftar HPK Pemberi Kerja';
  }
  if (state.page === 'pengesahan') {
    return 'TKA Online › Pengesahan RPTKA › Daftar Permohonan RPTKA';
  }
  const pj = { perubahan: 'Perubahan RPTKA', pencabutan: 'Pencabutan RPTKA' };
  const pjKind = state.page.replace('Detail', '');
  if (pj[pjKind]) {
    const rows = state[`${pjKind}Rows`];
    const nomor = state.page.endsWith('Detail')
      ? rows?.find((r) => r.id === state.id)?.nomor ?? 'Detail' : null;
    return `TKA Online › ${pj[pjKind]}${nomor ? ` › ${nomor}` : ''}`;
  }
  if (state.page === 'kabkota') {
    return 'TKA Online › Perpanjangan RPTKA › Lintas Kab/Kota dalam 1 Provinsi';
  }
  if (state.page === 'kabkotaDetail') {
    const peng = state.pengRows?.find((r) => r.id === state.id);
    return 'TKA Online › Perpanjangan RPTKA › Lintas Kab/Kota › ' +
      (peng?.nomorRptka ?? 'Detail');
  }
  if (state.page === 'perpanjangan') {
    return 'TKA Online › Perpanjangan RPTKA › Lintas Provinsi';
  }
  if (state.page === 'perpanjanganDetail') {
    const peng = state.pengRows?.find((r) => r.id === state.id);
    return 'TKA Online › Perpanjangan RPTKA › ' +
      (peng?.nomorRptka ?? 'Detail');
  }
  if (state.page === 'pengesahanDetail') {
    const peng = state.pengRows?.find((r) => r.id === state.id);
    return 'TKA Online › Pengesahan RPTKA › ' +
      (peng?.nomorRptka ?? 'Detail');
  }
  if (state.page === 'hpkDetail') {
    const hpk = state.hpkRows?.find((r) => r.id === state.id);
    return `TKA Online › Verifikasi HPK › ${hpk?.noPermohonan ?? 'Detail'}`;
  }
  const nama = rows?.find((r) => r.id === state.id)?.nama ?? 'Detail';
  return `${base} › Daftar Pemberi Kerja › ${nama}`;
}

export function renderHeader() {
  const text = crumbText(state.rows);
  qs('#crumb').textContent = text;
  document.title = `${text.split(' › ').pop()} — Verifikasi Akun — ` +
    'TKA Online';
}
