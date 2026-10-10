/**
 * @fileoverview Tab "Unggah Dokumen" (per TKA + per jabatan, daftar mengikuti
 * jenis RPTKA / kegiatan / jangka waktu; format & ukuran, pratinjau, ganti,
 * hasil OCR paspor) dan tab "Data TKA" (identitas TKA + lokasi kerja,
 * terisi otomatis dari OCR, bisa diedit). Render murni.
 */

import { html, raw } from '../../components/dom.js';
import { emptyState } from '../../components/empty-state.js';
import { confidenceBadge, ocrPanel } from '../../components/ocr-panel.js';
import { statusBadge } from '../../components/status-badge.js';
import { OCR_AMBANG_KEYAKINAN } from '../../contracts/analitik.js';
import {
  INTEGRASI_PERPANJANGAN, RPTKA_KB, dokumenTka, dokumenUntuk, jenisDef,
  kolomTka,
} from '../../contracts/pengesahan-rptka.js';
import { berkasKey, cache } from './rptka-data.js';
import { CARD, LINK, fieldError } from './ui.js';

const DOC_ROW = 'grid gap-2 rounded-box border border-base-300 px-4 py-3';

/** Aturan format & ukuran satu dokumen, untuk teks bantu. */
export function aturan(def) {
  if (def.gambarKb) {
    return `PDF maks. ${def.maxKb / 1024} MB, JPEG/PNG/JPG maks. ` +
      `${def.gambarKb} KB`;
  }
  const ukuran = def.maxKb >= 1024 ? `${def.maxKb / 1024} MB`
    : `${def.maxKb} KB`;
  return `${def.jpg ? 'JPG berwarna' : 'PDF atau JPG'}, maks. ${ukuran}`;
}

/** DOM id of a document input: scope "t0" (TKA index) or "j0" (jabatan). */
export const docId = (scope, kunci) => `rp-doc-${scope}-${kunci}`;

function ocrBlock(id, saved, ocr) {
  if (!ocr) {
    return '';
  }
  const n = ocr.terisi?.length ?? 0;
  return html`<p class="flex flex-wrap items-center gap-x-2 text-xs
      font-semibold text-success" data-testid="rptka-ocr-ringkas">✓ Dokumen
    dibaca otomatis${n ? `: ${n} kolom Data TKA terisi (${ocr.terisi
    .join(', ')}).` : '.'}<button type="button" class="${LINK}
      text-xs" data-action="rptka-tab" data-tab="data">Lihat Data TKA
    </button></p><details data-testid="rptka-ocr-detail"
      ${ocr.perluPeriksa ? 'open' : ''}><summary class="${LINK} cursor-pointer
      text-xs">Lihat hasil baca dokumen</summary>${ocrPanel({
    id: `${id}-panel`, title: 'Hasil baca dokumen',
    fileName: saved?.namaBerkas, fields: ocr.fields,
    perluPeriksa: ocr.perluPeriksa, ambang: ocr.ambangKeyakinan })}</details>`;
}

function acceptOf(def) {
  if (def.gambarKb) {
    return '.pdf,.jpg,.jpeg,.png';
  }
  return def.jpg ? '.jpg,.jpeg' : '.pdf,.jpg,.jpeg';
}

function docItem(def, scope, saved, ocr, preview = '') {
  const id = docId(scope, def.kunci);
  return html`<li class="${DOC_ROW}">
    <div class="flex flex-wrap items-start justify-between gap-2">
      <div><label for="${id}" class="text-sm font-semibold">${def.label}
        </label>
        <p id="${id}-status" class="text-xs text-base-content/70">${saved
          ? `Tersimpan: ${saved.namaBerkas} · ${saved.ukuranKb} KB`
          : aturan(def)}${def.ocr ? ' · dibaca otomatis (OCR)' : ''}</p></div>
      <span id="${id}-badge">${saved ? statusBadge('Sudah diunggah', 'green')
        : statusBadge('Perlu diunggah', 'gray')}</span></div>
    <div class="flex flex-wrap items-center gap-2">
      <input id="${id}" type="file" ${saved ? 'hidden' : ''}
        accept="${acceptOf(def)}"
        class="file-input file-input-sm w-full" data-rp-doc="${scope}"
        data-kunci="${def.kunci}"
        aria-describedby="${id}-status ${id}-error">
      ${saved ? html`<button type="button" class="${LINK} text-xs"
        data-action="rptka-preview" data-scope="${scope}"
        data-kunci="${def.kunci}" aria-label="Pratinjau ${def.label}">
        Pratinjau</button><button type="button" id="${id}-ganti"
        class="${LINK} text-xs" data-action="rptka-ganti"
        data-input="${id}" aria-label="Ganti ${def.label}">Ganti</button>`
    : ''}</div>
    ${preview ? html`<img src="${preview}" alt="Pratinjau ${def.label}"
      class="max-h-52 w-auto max-w-full justify-self-start rounded-box border
        border-base-300 object-contain">` : ''}
    ${fieldError(id)}
    <p id="${id}-live" role="status" class="sr-only"></p>
    <div id="${id}-ocr" aria-busy="false" class="grid gap-2">
      ${ocrBlock(id, saved, ocr)}</div></li>`;
}

function tkaDocs(S, t, i) {
  const defs = dokumenTka(S.w, t);
  const done = defs.filter((d) => t.dokumen[d.kunci]).length;
  const key = `t${i}`;
  return html`<details class="collapse collapse-arrow border border-base-300
      bg-base-100" data-open-key="${key}" ${S.open.has(key) ? 'open' : ''}>
    <summary class="collapse-title text-sm font-bold">TKA ${i + 1} ·
      ${t.jabatan} (${t.urut}) <span class="ms-2 text-xs font-semibold
      ${done === defs.length ? 'text-success' : 'text-base-content/60'}">
      ${done}/${defs.length} dokumen</span></summary>
    <div class="collapse-content"><ul class="grid gap-2.5 pt-2">
      ${defs.map((d) => docItem(d, key, t.dokumen[d.kunci],
    S.ocr[berkasKey(t, d.kunci)], S.urls.get(berkasKey(t, d.kunci))))}</ul>
    </div></details>`;
}

function jabatanDocs(S, j, idx) {
  const defs = dokumenUntuk(S.w, 'jabatan', j);
  if (!defs.length) {
    return '';
  }
  return html`<ul class="grid gap-2.5">${defs.map((d) => docItem(d,
    `j${idx}`, S.w.dokumenJabatan[j.nama]?.[d.kunci], null,
    S.urls.get(`${j.nama}:${d.kunci}`)))}</ul>`;
}

/** Dokumen tingkat pengajuan (jenis Perpanjangan, scope "p"). */
function permohonanDocs(S) {
  const defs = dokumenUntuk(S.w, 'permohonan', null);
  if (!defs.length) {
    return '';
  }
  const done = defs.filter((d) => S.w.dokumenPermohonan?.[d.kunci]).length;
  return html`<section class="${CARD} grid gap-3 p-4"
      aria-label="Dokumen permohonan">
    <h3 class="text-sm font-bold text-secondary">Dokumen permohonan
      <span class="ms-2 text-xs font-semibold ${done === defs.length
    ? 'text-success' : 'text-base-content/60'}">${done}/${defs.length}
      dokumen</span></h3>
    <ul class="grid gap-2.5">${defs.map((d) => docItem(d, 'p',
    S.w.dokumenPermohonan?.[d.kunci], null,
    S.urls.get(`permohonan:${d.kunci}`)))}</ul></section>`;
}

/** BPJS: diintegrasikan otomatis, tidak diunggah. */
function integrasiNote(S) {
  if (!jenisDef(S.w.jenis)?.tkaExtra) {
    return '';
  }
  return html`<p class="alert alert-info alert-soft text-[13px]"
      data-testid="rptka-integrasi">${INTEGRASI_PERPANJANGAN.join(' dan ')}
    terhubung otomatis (integrasi) — tidak perlu diunggah. Isi nomor
    kepesertaan pada tab Data TKA.</p>`;
}

function kosong(S) {
  const perlu = !S.w.jenis ? 'header' : 'jabatan';
  return emptyState({ icon: '▤',
    title: perlu === 'header' ? 'Pilih Jenis RPTKA dahulu'
      : 'Belum ada jabatan',
    body: 'Dokumen persyaratan muncul per jabatan dan per TKA setelah ' +
      'Jenis RPTKA dipilih dan jabatan ditambahkan.',
    action: { label: perlu === 'header' ? 'Pilih Jenis RPTKA'
      : 'Ke tab Jabatan TKA',
    attrs: raw(`data-action="rptka-tab" data-tab="${perlu}"`) } });
}

/** Tab "Unggah Dokumen". */
export function renderDokumen(S) {
  if (!S.w.jenis || !S.w.tka.length) {
    return kosong(S);
  }
  const perp = jenisDef(S.w.jenis)?.tkaExtra;
  return html`<p class="text-[13px] text-base-content/70">Unggah dokumen
      persyaratan per ${perp ? 'permohonan, ' : ''}jabatan atau per TKA. Format dan ukuran dicek saat
      memilih berkas (${perp ? 'PDF maks. 2 MB, JPEG/PNG/JPG maks. 150 KB'
    : `foto & paspor JPG maks. ${RPTKA_KB.foto} KB, lainnya PDF/JPG maks. ${RPTKA_KB.umum / 1024} MB`}). Paspor dibaca otomatis (OCR)
      dan mengisi tab Data TKA.</p>
    ${permohonanDocs(S)}${integrasiNote(S)}${S.w.jabatan.map((j, idx) => {
    const tkas = S.w.tka.map((t, i) => [t, i]).filter(([t]) =>
      t.jabatan === j.nama);
    return html`<section class="${CARD} grid gap-3 p-4"
        aria-label="Dokumen jabatan ${j.nama}">
      <h3 class="text-sm font-bold text-secondary">${j.nama}</h3>
      ${jabatanDocs(S, j, idx)}${tkas.map(([t, i]) => tkaDocs(S, t, i))}
    </section>`;
  })}`;
}

function ocrLabel(col, t) {
  const keyakinan = t.ocr?.[col.kunci];
  if (keyakinan === undefined) {
    return col.label;
  }
  return html`${col.label} <span class="ms-1 inline-flex">
    ${confidenceBadge(keyakinan, OCR_AMBANG_KEYAKINAN)}</span>`;
}

function options(list, value) {
  const all = value && !list.includes(value) ? [...list, value] : list;
  return html`<option value="">Pilih…</option>${all.map((o) => html`<option
    value="${o}" ${o === value ? 'selected' : ''}>${o}</option>`)}`;
}

function tkaField(col, t, i) {
  const id = `rp-f-${i}-${col.kunci}`;
  const low = t.ocr?.[col.kunci] < OCR_AMBANG_KEYAKINAN;
  const attrs = raw(`data-tka="${i}" data-fkey="${col.kunci}" ` +
    `aria-describedby="${id}-error" required`);
  const wide = col.span ? 'md:col-span-2' : '';
  const value = t.data[col.kunci] ?? '';
  const label = html`<label for="${id}" class="text-sm font-bold">
    ${ocrLabel(col, t)}</label>`;
  if (col.opsi || col.lokasi) {
    return html`<div class="grid content-start gap-1.5 ${wide}">${label}
      <select id="${id}" class="select h-11 w-full ${low ? 'select-warning'
    : ''}" ${attrs}>${options(col.opsi ?? cache().lokasi ?? [], value)}
      </select>${fieldError(id)}</div>`;
  }
  const type = { tanggal: 'date', email: 'email', tel: 'tel' }[col.tipe]
    ?? 'text';
  const limit = type === 'date' ? '' : `maxlength="${col.maxLength}"`;
  return html`<div class="grid content-start gap-1.5 ${wide}">${label}
    <input id="${id}" type="${type}" ${raw(limit)} value="${value}"
      class="input h-11 w-full ${low ? 'input-warning' : ''}" ${attrs}>
    ${low ? html`<p class="text-xs font-semibold text-warning">Periksa:
      keyakinan OCR rendah, cocokkan dengan paspor.</p>` : ''}
    ${fieldError(id)}</div>`;
}

function tkaCard(t, i, jabatan, jenis) {
  return html`<article class="${CARD} grid gap-4 p-5"
      aria-label="Data TKA ${i + 1}">
    <h3 class="text-sm font-bold text-secondary">TKA ${i + 1} · ${t.jabatan}
      (${t.urut}) · ${jabatan.jangkaWaktuBulan} bulan</h3>
    <div class="grid gap-3.5 md:grid-cols-2">
      ${kolomTka(jenis).map((c) => tkaField(c, t, i))}</div></article>`;
}

/** Tab "Data TKA". */
export function renderData(S) {
  if (!S.w.jenis || !S.w.tka.length) {
    return kosong(S);
  }
  return html`<p class="text-[13px] text-base-content/70">Kolom terisi
      otomatis dari hasil OCR paspor (ditandai tingkat keyakinan) dan tetap
      dapat diedit. Kolom lain, termasuk lokasi kerja, diisi manual.</p>
    ${S.w.tka.map((t, i) => tkaCard(t, i,
    S.w.jabatan.find((j) => j.nama === t.jabatan), S.w.jenis))}`;
}
