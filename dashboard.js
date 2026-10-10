/**
 * @fileoverview Beranda (legacy page "dashboard"): prasyarat callout,
 * stats, jadwal ekspos (+ tautan "Gabung ekspos daring" bila petugas
 * sudah membuatnya, KAK Modul 5 [I]), pengesahan akan berakhir
 * (30/60/90 hari), billing belum dibayar. Tombol "+ Ajukan permohonan"
 * dan tabel "Permohonan terbaru" disembunyikan atas permintaan.
 */

import { html, qs, raw, setHtml } from '../../components/dom.js';
import { statusBadge } from '../../components/status-badge.js';
import {
  calendarChip, rupiah, sisaTone, withWeekday,
} from './format.js';
import { jenisPerpanjangan } from '../../contracts/pengesahan-rptka.js';
import { state } from './state.js';
import {
  BADGE_HIGHLIGHT, BTN, CALLOUT_WARN, CARD, H1, LINK, cardHeader,
  emptyText, navAttrs,
} from './ui.js';

const EXP_TABS = [30, 60, 90];
const SAFE_URL = /^https:\/\//;

/** Tombol Perpanjang: daftar Form RPTKA Perpanjangan Lintas Provinsi. */
function perpanjangTarget() {
  const [jenis] = jenisPerpanjangan(state.role);
  return navAttrs('rptkaList', { jenis: jenis.nama });
}

/** "Gabung ekspos daring" link (new tab) when the meeting link exists. */
function joinLink(e) {
  if (!e.meetingUrl || !SAFE_URL.test(e.meetingUrl)) {
    return '';
  }
  return html`<a href="${e.meetingUrl}" target="_blank"
      rel="noopener noreferrer"
      class="${BTN} btn-sm justify-self-start text-[13px]">
    Gabung ekspos daring<span class="sr-only"> ${e.platform ?? ''} antrian
      ${e.antrian} (membuka tab baru)</span> ↗</a>`;
}

function stats() {
  const { company: co, tka, hpk, pengesahan, billing, laporan } = state.data;
  const unpaid = billing.filter((b) => b.status !== 'Lunas');
  const inProcess = hpk.filter((h) => h.stepIdx < 8).length +
    pengesahan.filter((p) => p.stepIdx < 6).length;
  const bill = co.dk
    ? { l: 'Billing belum dibayar', v: unpaid.length,
      s: unpaid.length ? 'batas terdekat 7 Okt 2026' : 'tidak ada' }
    : { l: 'Status DKPTKA', v: 'Bebas',
      s: co.grup === 'B' ? 'Lembaga sosial/keagamaan'
        : 'Instansi/badan internasional' };
  return [
    { l: 'TKA dengan pengesahan aktif', v: tka.length, s: `di ${co.kab}` },
    { l: 'Permohonan dalam proses', v: inProcess, s: 'HPK & pengesahan' },
    bill,
    { l: `Laporan TKA ${laporan.periode}`, v: laporan.status,
      s: 'wajib tiap 1 tahun' },
  ];
}

function eksposCard() {
  const rows = state.data.ekspos;
  return html`<section class="${CARD} overflow-auto"
      aria-labelledby="ekspos-title">
    <div class="flex justify-between border-b border-base-200 px-5 py-4">
      <h2 id="ekspos-title" class="text-[15px] font-bold">Jadwal Ekspos</h2>
      <span class="text-xs text-base-content/60">Telewicara</span></div>
    ${rows.map((e) => {
      const chip = calendarChip(e.tgl);
      return html`<div class="grid gap-2.5 px-5 py-4.5">
        <div class="flex items-center gap-3.5">
          <div class="w-14 flex-none rounded-field bg-primary py-2 text-center
            text-primary-content">
            <p class="text-[10px] font-bold text-info-bright">${chip.month}</p>
            <p class="text-[22px] font-extrabold leading-none">${chip.day}</p>
          </div>
          <div><p class="text-sm font-bold">${e.tgl}</p>
            <p class="text-[13px] text-base-content/70">${e.jam}</p></div>
        </div>
        <dl class="grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1.5 text-[13px]">
          <dt class="text-base-content/60">Layanan</dt>
          <dd>HPK ${e.layanan}</dd>
          <dt class="text-base-content/60">No. antrian</dt>
          <dd class="font-bold">${e.antrian}</dd>
          <dt class="text-base-content/60">Media</dt><dd>${e.media}</dd>
          ${e.platform ? html`<dt class="text-base-content/60">Platform</dt>
            <dd>${e.mode ?? 'Daring'} · ${e.platform}</dd>` : ''}</dl>
        ${joinLink(e)}
        <button type="button" class="${LINK} justify-self-start text-[13px]"
          ${navAttrs('hpkList', { layanan: e.layanan })}>
          Lihat permohonan →</button></div>`;
    })}
    ${rows.length ? '' : emptyText('Tidak ada jadwal ekspos.')}</section>`;
}

function expiringList() {
  const list = state.data.tka.filter((t) => t.sisa <= state.expTab);
  if (!list.length) {
    return emptyText('Tidak ada pengesahan yang berakhir dalam rentang ini.');
  }
  return html`<ul>${list.map((t) => html`<li class="grid grid-cols-[minmax(0,1fr)_auto]
      items-start gap-x-3 gap-y-1.5 border-b border-base-200 px-5 py-3.5">
    <div><p class="text-sm font-bold">${t.nama}</p>
      <p class="text-xs text-base-content/70">${t.jabatan} · SK ${t.barcode}
        · s.d. ${t.akhir}</p></div>
    ${statusBadge(`${t.sisa} hari`, sisaTone(t.sisa))}
    <p class="flex flex-wrap gap-x-2.5 gap-y-1 text-[11px] font-bold">
      ${[['BPJS', t.bpjs], ['NPWP Coretax', t.npwp], ['Laporan', t.lapor]]
        .map(([label, ok]) => html`<span class="${ok ? 'text-success'
          : 'text-error'}">${ok ? '✓' : '✗'} ${label}</span>`)}</p>
    <button type="button" class="${LINK} text-xs"
      ${perpanjangTarget()}>Perpanjang →</button></li>`)}</ul>`;
}

function expiringCard() {
  const tka = state.data.tka;
  return html`<section class="${CARD} overflow-auto"
      aria-labelledby="exp-title">
    <div class="flex flex-wrap items-center justify-between gap-2.5
        border-b border-base-200 px-5 py-3">
      <h2 id="exp-title" class="text-[15px] font-bold">Pengesahan RPTKA akan
        berakhir</h2>
      <div class="flex flex-wrap gap-1" role="group"
          aria-label="Rentang hari">${EXP_TABS.map((d) => {
        const active = state.expTab === d;
        const n = tka.filter((t) => t.sisa <= d).length;
        return html`<button type="button" data-action="exp-tab"
          data-days="${d}" aria-pressed="${active}"
          class="btn btn-xs h-auto border-base-300 py-1.5 font-bold ${active
            ? 'btn-primary' : 'bg-base-100 text-base-content/80'}">
          ${d} hari · ${n}</button>`;
      })}</div></div>
    <div id="expiring-list">${expiringList()}</div></section>`;
}

function unpaidCard() {
  const co = state.data.company;
  const unpaid = state.data.billing.filter((b) => b.status !== 'Lunas');
  const all = co.dk ? html`<button type="button" class="${LINK} text-xs"
    ${navAttrs('pembayaran')}>Semua →</button>` : '';
  return html`<section class="${CARD} overflow-auto">
    ${cardHeader('Billing belum dibayar', all)}
    <ul>${unpaid.map((b) => html`<li><button type="button"
        data-action="open-billing" data-id="${b.id}"
        class="grid w-full gap-1.5 border-b border-base-200 px-5 py-3.5
          text-left hover:bg-base-200/50">
      <span class="flex justify-between gap-2"><b class="text-sm">${b.tka}</b>
        ${statusBadge(b.status, b.tone)}</span>
      <span class="font-mono text-xs text-base-content/70">${b.kode}</span>
      <span class="flex justify-between text-[13px]"><b>${rupiah(b.rupiah)}</b>
        <span class="text-base-content/60">batas ${b.batas}</span></span>
    </button></li>`)}</ul>
    ${unpaid.length ? '' : html`<p class="px-5 py-7 text-center text-[13px]
      leading-normal text-base-content/60">Tidak ada tagihan.${co.dk ? ''
        : raw('<br>Pemberi kerja Anda dibebaskan dari DKPTKA.')}</p>`}
  </section>`;
}

/** @return {!Object} SafeHtml */
export function render() {
  const { company: co, today } = state.data;
  return html`
    <div>
      <p class="text-sm text-base-content/60">${withWeekday(today)}</p>
      <h1 class="${H1} mt-1 text-[28px]">Selamat datang, ${co.nama}</h1>
    </div>
    ${co.hpk ? html`<div class="${CALLOUT_WARN} flex flex-col items-start
        gap-3.5 sm:flex-row">
      <b class="${BADGE_HIGHLIGHT} badge-sm h-auto flex-none rounded-sm
        py-1 text-[11px] tracking-wider">PRASYARAT PERPANJANGAN</b>
      <span class="flex-1">Sebelum memperpanjang, pastikan TKA aktif BPJS
        Ketenagakerjaan &amp; Kesehatan, NPWP TKA aktif di Coretax, dan laporan
        pendampingan serta alih keahlian sudah dikirim. Ajukan paling lambat
        30 hari sebelum masa berlaku berakhir.</span></div>` : ''}
    <div class="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-4">
      ${stats().map((s) => html`<div class="${CARD} px-5 py-4.5">
        <p class="text-[13px] text-base-content/70">${s.l}</p>
        <p class="mb-0.5 mt-1.5 text-3xl font-extrabold tracking-tight">
          ${s.v}</p>
        <p class="text-xs text-base-content/60">${s.s}</p></div>`)}</div>
    <div class="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))]
        items-start gap-4">
      ${eksposCard()}${expiringCard()}${unpaidCard()}</div>`;
}

export const actions = {
  'exp-tab'(el) {
    state.expTab = Number(el.dataset.days);
    const card = el.closest('section');
    for (const button of card.querySelectorAll('[data-action="exp-tab"]')) {
      const active = button === el;
      button.setAttribute('aria-pressed', String(active));
      button.classList.toggle('btn-primary', active);
      button.classList.toggle('bg-base-100', !active);
      button.classList.toggle('text-base-content/80', !active);
    }
    setHtml(qs('#expiring-list'), expiringList());
  },
};

