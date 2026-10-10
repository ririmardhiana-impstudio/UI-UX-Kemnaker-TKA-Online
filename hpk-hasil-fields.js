/**
 * @fileoverview Markup of the HPK form body (skema dari GET
 * /penilaian-kelayakan/formulir): isian per kelompok (merah = OSS
 * read-only, hitam = input) dan dokumen permohonan (merah = data OSS,
 * biru = berkas OSS, hitam = upload + OCR). Pure render, no state.
 */

import { pratinjauAttrs } from '../../components/doc-preview.js';
import { html, raw } from '../../components/dom.js';
import { statusBadge } from '../../components/status-badge.js';
import {
  PK_SUMBER_DOKUMEN as SD, PK_SUMBER_ISIAN,
} from '../../contracts/penilaian-kelayakan.js';
import { LEGEND } from './hpk-hasil-views.js';
import {
  BTN_OUTLINE, CARD, LINK, field, fieldError, textareaField,
} from './ui.js';

const WIDE = 'md:col-span-2';
const DOC_ROW = 'rounded-box border border-base-300 px-4 py-3';

function ossField(f) {
  const id = `pk-isian-${f.kunci}`;
  return html`<div class="grid content-start gap-1.5
      ${f.kunci === 'alamat' ? WIDE : ''}">
    <label for="${id}" class="flex flex-wrap items-center gap-2 text-sm
      font-bold">${f.label}${statusBadge('Dari OSS', 'red')}</label>
    <input id="${id}" type="text" readonly value="${f.nilai ?? ''}"
      class="input h-11 w-full border-base-300 bg-base-200/50 font-semibold
        text-error"></div>`;
}

/** Baris kosong untuk jabatan baru. */
export const JABATAN_KOSONG = { nama: '', jumlahTka: '' };

/** Satu baris jabatan: nama + jumlah TKA (+ hapus bila lebih dari satu). */
function jabatanRow(f, row, i, banyak) {
  const id = `pk-isian-${f.kunci}-${i}`;
  return html`<li class="grid items-start gap-3 md:grid-cols-[minmax(0,1fr)_160px_auto]" data-jab-row>
    <div class="grid content-start gap-1.5">
      <label for="${id}-nama" class="text-sm font-bold">${i === 0 ? f.label
    : `Jabatan ke-${i + 1}`}</label>
      <input id="${id}-nama" type="text" maxlength="${f.maxNama}"
        value="${row.nama ?? ''}" data-jab="nama" class="input h-11 w-full"
        aria-describedby="${id}-nama-error">${fieldError(`${id}-nama`)}</div>
    <div class="grid content-start gap-1.5">
      <label for="${id}-jumlahTka" class="text-sm font-bold">Jumlah TKA
        </label>
      <input id="${id}-jumlahTka" type="number" min="${f.min}"
        max="${f.max}" inputmode="numeric" value="${row.jumlahTka ?? ''}"
        data-jab="jumlahTka" class="input h-11 w-full"
        aria-describedby="${id}-jumlahTka-error">
      ${fieldError(`${id}-jumlahTka`)}</div>
    ${banyak ? html`<button type="button" class="${LINK} text-xs md:mt-8"
      data-action="hpk-jab-del" data-idx="${i}"
      aria-label="Hapus jabatan ke-${i + 1}">Hapus</button>` : ''}</li>`;
}

/** Isi daftar jabatan (dipakai render awal dan tambah/hapus baris). */
export function jabatanRows(f, rows) {
  const list = rows.length ? rows : [JABATAN_KOSONG];
  return html`${list.map((row, i) => jabatanRow(f, row, i,
    list.length > 1))}`;
}

/** Isian daftar jabatan TKA: boleh lebih dari satu, jumlah TKA per jabatan. */
function jabatanField(f) {
  const id = `pk-isian-${f.kunci}`;
  return html`<fieldset id="${id}" class="grid gap-3 md:col-span-2"
      aria-describedby="${id}-hint ${id}-error">
    <legend class="sr-only">${f.label}</legend>
    <ul id="pk-jabatan-list" class="grid gap-3">${jabatanRows(f,
    Array.isArray(f.nilai) ? f.nilai : [])}</ul>
    ${fieldError(id)}
    <div class="flex flex-wrap items-center gap-3">
      <button type="button" class="${BTN_OUTLINE} btn-sm"
        data-action="hpk-jab-add" data-testid="hpk-btn-tambah-jabatan">
        + Tambah jabatan</button>
      <p id="${id}-hint" class="text-xs text-base-content/70">${f.hint}</p>
    </div></fieldset>`;
}

function inputField(f) {
  const id = `pk-isian-${f.kunci}`;
  if (f.sumber === PK_SUMBER_ISIAN.OSS) {
    return ossField(f);
  }
  if (f.tipe === 'daftar-jabatan') {
    return jabatanField(f);
  }
  if (f.tipe === 'area') {
    return textareaField({ id, label: f.label, value: f.nilai ?? '',
      rows: 4, max: f.maxLength, min: f.minLength, span: WIDE,
      placeholder: f.hint ?? '' });
  }
  const limits = f.tipe === 'angka'
    ? `min="${f.min}" max="${f.max}" inputmode="numeric"`
    : f.maxLength ? `maxlength="${f.maxLength}"` : '';
  return field({ id, label: f.label, value: f.nilai ?? '',
    type: { angka: 'number', tanggal: 'date' }[f.tipe] ?? 'text',
    hint: f.hint ?? '', attrs: raw(`required ${limits}`),
    span: f.kunci === 'lokasiKerja' ? WIDE : '' });
}

/** Isian grouped under a heading per `grup`. */
function groupedFields(fields) {
  let last = '';
  return fields.map((f) => {
    const heading = f.grup !== last ? html`<h3 class="border-b
      border-base-200 pb-1.5 pt-2 text-sm font-bold text-secondary
      md:col-span-2">${f.grup}</h3>` : '';
    last = f.grup;
    return html`${heading}${inputField(f)}`;
  });
}

const sizeText = (u) => `${u.namaBerkas} · ${u.ukuranKb} KB`;

/** Badge of an upload row (saved = {namaBerkas, ukuranKb} or undefined). */
export function uploadBadge(saved, wajib = true) {
  if (saved) {
    return statusBadge('Sudah diunggah', 'green');
  }
  return statusBadge(wajib ? 'Perlu diunggah' : 'Opsional', 'gray');
}

/** Tautan pratinjau berkas unggahan sendiri (semua akun memakai komponen sama). */
export function previewLink(label, saved) {
  return html`<button type="button" class="${LINK} text-xs"
    ${pratinjauAttrs({ judul: label, namaBerkas: saved.namaBerkas,
    ukuranKb: saved.ukuranKb, berkasId: saved.berkasId })}
    aria-label="Pratinjau ${label}">Pratinjau</button>`;
}

/** Status line under an upload label. */
export const uploadStatus = (saved) => saved
  ? `Tersimpan: ${sizeText(saved)}` : 'PDF, JPG, atau PNG, maks. 2 MB.';

function docItem(d, saved) {
  if (d.sumber === SD.OSS_DATA) {
    return html`<li class="${DOC_ROW} flex flex-wrap items-center
        justify-between gap-2"><div><p class="text-sm font-semibold">
        ${d.label}</p><p class="text-sm font-semibold text-error">
        ${d.nilai}</p></div>${statusBadge('Data dari OSS', 'red')}</li>`;
  }
  if (d.sumber === SD.OSS_BERKAS) {
    return html`<li class="${DOC_ROW} flex flex-wrap items-center
        justify-between gap-2"><div><p class="text-sm font-semibold">
        ${d.label}</p><p class="text-xs text-base-content/70">
        ${d.namaBerkas}</p></div><div class="flex items-center gap-3">
        ${statusBadge('Berkas di OSS', 'blue')}
        <button type="button" class="${LINK} text-xs"
          ${pratinjauAttrs({ judul: d.label, namaBerkas: d.namaBerkas })}
          aria-label="Lihat file ${d.label}">Lihat file</button></div></li>`;
  }
  const id = `pk-dokumen-${d.kunci}`;
  return html`<li class="${DOC_ROW} grid gap-2">
    <div class="flex flex-wrap items-start justify-between gap-2">
      <div><label for="${id}" class="text-sm font-semibold">${d.label}
        </label>${d.keterangan ? html`<p class="max-w-2xl text-xs
        text-base-content/70">${d.keterangan}</p>` : ''}
        <p id="${id}-status" class="text-xs text-base-content/70">
        ${uploadStatus(saved)}</p></div>
      <span id="${id}-badge">${uploadBadge(saved, d.wajib)}</span></div>
    <p id="${id}-preview" class="text-xs">${saved ? previewLink(d.label, saved)
    : ''}</p>
    <input id="${id}" type="file" accept=".pdf,.jpg,.jpeg,.png"
      class="file-input file-input-sm w-full" data-hpk-doc="${d.kunci}"
      aria-describedby="${id}-status ${id}-error">
    ${fieldError(id)}
    <p id="${id}-live" role="status" class="sr-only"></p>
    <div id="${id}-ocr" aria-busy="false"></div></li>`;
}

/**
 * @param {!Object} f Formulir skema (fields, dokumen, adaEkspose).
 * @param {!Object<string, {namaBerkas: string, ukuranKb: number}>} uploads
 */
export function bodyHtml(f, uploads) {
  return html`<p class="rounded-box border border-info/20 bg-info/10 px-4
      py-3 text-sm">Ekspose via video conference: <b>${f.adaEkspose
      ? 'Ya' : 'Tidak'}</b>${f.adaEkspose ? ''
      : ' (HPK Direksi/Komisaris langsung ke BAP)'}.</p>
    <section class="${CARD} grid gap-4 px-5 py-6 md:px-7"
        aria-labelledby="pk-isian-title">
      <h2 id="pk-isian-title" class="text-base font-bold">Data isian</h2>
      ${LEGEND}
      <div class="grid gap-4 md:grid-cols-2">${groupedFields(f.fields)}
      </div></section>
    <section class="${CARD} grid gap-4 px-5 py-6 md:px-7"
        aria-labelledby="pk-dokumen-title">
      <div><h2 id="pk-dokumen-title" class="text-base font-bold">Dokumen
        permohonan</h2><p class="text-xs text-base-content/70">Berkas yang
        Anda unggah dicek otomatis dengan OCR.</p></div>
      <ul class="grid gap-3">${f.dokumen.map((d) =>
    docItem(d, uploads[d.kunci]))}</ul></section>`;
}
