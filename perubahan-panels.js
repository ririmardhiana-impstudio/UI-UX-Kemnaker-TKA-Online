/**
 * @fileoverview "Tambah Perubahan" form panels per jenis perubahan
 * (semula tertulis vs menjadi), split from perubahan.js.
 */

import { html, raw } from '../../components/dom.js';
import { state } from './state.js';
import {
  LINK, field, fieldError, noopAttrs, selectField,
} from './ui.js';

const TKA_DETAILS = ['Data Nama', 'Data Kelahiran', 'Data Paspor',
  'Data Alamat'];
export const NEW_LOKASI = 'KAB. KARAWANG, JAWA BARAT';

function semulaMenjadi(semula, menjadi) {
  return html`<div class="grid gap-3.5 rounded-box border border-base-300 p-4
      md:grid-cols-2">
    <div class="grid content-start gap-2"><p class="text-xs font-extrabold
      tracking-wider text-base-content/60">SEMULA TERTULIS</p>${semula}</div>
    <div class="grid content-start gap-2"><p class="text-xs font-extrabold
      tracking-wider text-secondary">MENJADI</p>${menjadi}</div></div>`;
}

/** Current pendamping (system data; legacy demo name when absent). */
export function pendampingSemula(t) {
  return t.pendamping ?? 'Agus Setiawan';
}

/**
 * One panel per jenis perubahan (semula read-only from system data,
 * menjadi editable); hidden unless it is the selected jenis.
 * @param {!Object} t TKA from GET /tka?barcode=.
 * @return {!Array<!Object>} SafeHtml per jenis.
 */
export function jenisPanels(t) {
  const co = state.data.company;
  const muted = 'rounded-field bg-base-200 px-3.5 py-3 text-sm ' +
    'text-base-content/70';
  const tka = html`<div class="grid gap-2.5">
    <fieldset class="flex flex-wrap gap-4 text-[13px] font-semibold">
      <legend class="sr-only">Data yang diubah</legend>
      ${TKA_DETAILS.map((d) => html`<label class="flex cursor-pointer
        items-center gap-2"><input type="checkbox" name="chg-detail"
        value="${d}" class="checkbox checkbox-secondary checkbox-sm"
        ${d === 'Data Paspor' ? 'checked' : ''}>${d}</label>`)}</fieldset>
    ${fieldError('chg-detail')}
    ${semulaMenjadi(html`<p class="${muted}">No. paspor ${t.paspor} ·
      ${t.negara}</p>`, html`<div class="grid gap-2 md:grid-cols-2">
      ${field({ id: 'chg-paspor', label: 'No. paspor baru',
        value: 'C7H2M51RX', inputClass: 'border-secondary',
        attrs: raw('required maxlength="20"') })}
      ${field({ id: 'chg-negara', label: 'Kewarganegaraan',
        value: t.negara, attrs: raw('required') })}</div>`)}</div>`;
  const alamat = semulaMenjadi(html`<p class="${muted} leading-normal">
    ${co.jalan}, ${co.kel}, ${co.kec}, ${co.kab}, ${co.prov}
    ${co.kodepos}</p>`, html`<div class="grid gap-2">
    ${field({ id: 'chg-jalan', label: 'Alamat baru',
      value: 'Jl. Industri Selatan 7 Blok HH No. 2',
      inputClass: 'border-secondary', attrs: raw('required') })}
    <div class="grid grid-cols-2 gap-2">
      ${selectField({ id: 'chg-prov', label: 'Provinsi', options: [co.prov],
        selected: co.prov })}
      ${selectField({ id: 'chg-kab', label: 'Kab./Kota', options: [co.kab],
        selected: co.kab })}
      ${selectField({ id: 'chg-kec', label: 'Kecamatan', options: [co.kec],
        selected: co.kec })}
      ${selectField({ id: 'chg-kel', label: 'Kelurahan', options: [co.kel],
        selected: co.kel })}</div>
    ${field({ id: 'chg-kodepos', label: 'Kode pos', value: co.kodepos,
      span: 'w-32', attrs: raw('required pattern="[0-9]{5}" inputmode="numeric"') })}
  </div>`);
  const lokasi = html`<div class="grid gap-2 rounded-box border
      border-base-300 p-4">
    <p class="text-xs font-extrabold tracking-wider text-base-content/60">
      DAFTAR LOKASI KERJA (MIN. 1)</p>
    <p class="flex justify-between rounded-field bg-base-200 px-3.5 py-3
      text-sm"><span>${co.kab}, ${co.prov}</span><span
      class="text-base-content/60">semula</span></p>
    <p class="flex justify-between rounded-field border border-secondary
      px-3.5 py-3 text-sm"><span>${NEW_LOKASI}</span><button type="button"
      class="font-bold text-error" ${noopAttrs('Hapus lokasi')}>Hapus
      </button></p>
    <button type="button" class="${LINK} justify-self-start text-[13px]"
      ${noopAttrs('Tambah lokasi')}>+ Tambah lokasi</button>
    <p class="text-xs text-base-content/60">Hanya bila tidak mengubah jenis
      pembayaran DKPTKA (PNBP ↔ pendapatan daerah).</p></div>`;
  const pendamping = semulaMenjadi(html`<p class="${muted}">
    ${pendampingSemula(t)}</p>`, html`<div class="grid gap-2
      md:grid-cols-2">${field({ id: 'chg-pdp-nama',
      label: 'Nama Tenaga Kerja Pendamping baru',
      inputClass: 'border-secondary',
      attrs: raw('required minlength="3" maxlength="100"') })}
    ${field({ id: 'chg-pdp-jabatan', label: 'Jabatan Tenaga Kerja Pendamping',
      value: t.jabatan, attrs: raw('required minlength="3" maxlength="100"'),
    })}<p class="text-xs text-base-content/60 md:col-span-2">Unggah surat
      penunjukan Tenaga Kerja Pendamping pada tab Upload Dokumen.</p></div>`);
  return [tka, alamat, lokasi, pendamping].map((panel, i) => html`<div
    data-jenis-panel="${i}" ${state.chgJenis === i ? '' : 'hidden'}>
    ${panel}</div>`);
}
