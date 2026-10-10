/**
 * @fileoverview "Riwayat status" side drawer (legacy `drawer` state) for
 * HPK, Pengesahan and Perubahan records. Uses <dialog class="modal
 * modal-end"> so focus is trapped and Esc closes it.
 */

import { html } from '../../components/dom.js';
import { addDays, stepTone } from './format.js';
import { state } from './state.js';
import { dialogClose, openDialog } from './ui.js';

const DRAWER = 'riwayat-drawer';
const CHG_STEPS = ['Draf', 'Diajukan', 'Pemeriksaan Petugas',
  'Penandatanganan Direktur', 'Terbit'];
const CHG_AT = { 6: 4, 3: 2, 2: 1 };
const HPK_EKSPOS_NOTE = 'Rabu, 7 Oktober 2026 · 09.30 WIB · antrian 14';

function hpkHistory(id) {
  const h = state.data.hpk.find((x) => x.id === id);
  if (!h) {
    return null;
  }
  const rejected = h.tone === 'red';
  return {
    title: 'Riwayat Status HPK',
    sub: `No. permohonan ${h.noPermohonan} · ${h.layanan}`,
    steps: state.data.steps.hpk.map((s, i) => ({
      s: i === 1 && rejected ? 'Verifikasi Data dan Upload tidak disetujui'
        : s,
      d: i <= h.stepIdx ? addDays(h.tgl, i * 2) : '',
      note: (i === 1 && rejected ? h.catatan : '') ||
        (i === 2 && h.stepIdx === 2 ? HPK_EKSPOS_NOTE : ''),
      ...stepTone(i, h.stepIdx, h.tone),
    })),
  };
}

function pengHistory(id) {
  const p = state.data.pengesahan.find((x) => x.id === id);
  if (!p) {
    return null;
  }
  const dk = state.data.company.dk;
  const steps = state.data.steps.pengesahan
    .filter((s) => dk || !/Pembayaran/.test(s));
  const at = dk ? p.stepIdx : Math.min(p.stepIdx, steps.length - 1);
  return {
    title: 'Riwayat Status Pengesahan',
    sub: `${p.nama} · ${p.jabatan}`,
    steps: steps.map((s, i) => ({
      s: p.tone === 'red' && i === 5
        ? 'Kode billing kedaluwarsa — klik Proses lagi' : s,
      d: i <= at ? addDays(p.tgl, i * 2) : '',
      note: '',
      ...stepTone(i, at, p.tone),
    })),
  };
}

function chgHistory(id) {
  const c = state.data.perubahan.find((x) => x.id === id);
  if (!c) {
    return null;
  }
  const at = CHG_AT[c.statusId] ?? 0;
  return {
    title: 'Riwayat Status Perubahan',
    sub: `${c.barcode} · ${c.nama}`,
    steps: CHG_STEPS.map((s, i) => ({
      s, d: i <= at ? addDays(c.suratTgl, i) : '', note: '',
      ...stepTone(i, at, 'blue'),
    })),
  };
}

function drawerContent(info) {
  return html`
    <div class="sticky top-0 flex justify-between gap-3 border-b
        border-base-300 bg-base-100 px-6.5 py-5.5">
      <div><h2 id="riwayat-title" class="text-[17px] font-bold">
        ${info.title}</h2>
        <p class="mt-0.5 text-[13px] text-base-content/70">${info.sub}</p>
      </div>${dialogClose()}</div>
    <ol class="px-6.5 py-5.5">${info.steps.map((s) => html`<li
        class="grid grid-cols-[22px_1fr] gap-3.5 pb-4.5">
      <span class="mt-0.5 size-3.5 rounded-full border-2 ${s.dot}"
        aria-hidden="true"></span>
      <div><div class="flex justify-between gap-2.5">
          <b class="text-sm ${s.label}">${s.s}</b>
          <span class="whitespace-nowrap text-[11px] font-bold ${s.tagClass}">
            ${s.tag}</span></div>
        <p class="mt-0.5 text-xs text-base-content/60">${s.d}</p>
        ${s.note ? html`<p class="mt-1.5 rounded-field bg-base-200 px-2.5
          py-2 text-xs leading-normal text-base-content/80">${s.note}</p>`
          : ''}</div></li>`)}</ol>`;
}

export const actions = {
  riwayat(el) {
    const loaders = { hpk: hpkHistory, peng: pengHistory, chg: chgHistory };
    const info = loaders[el.dataset.kind]?.(el.dataset.id);
    if (info) {
      openDialog(DRAWER, drawerContent(info), 'w-[min(460px,100vw)]');
    }
  },
};
