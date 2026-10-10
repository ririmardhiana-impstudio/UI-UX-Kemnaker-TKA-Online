/**
 * @fileoverview Pratinjau dokumen untuk semua akun (pemberi kerja,
 * Verifikator, Validator, Direktur, Back Office). Dialog mandiri (dibuat
 * sekali di <body>): berkas JPG/PNG tampil sebagai gambar, PDF di iframe,
 * dimuat dari berkas-store lewat `berkasId`. Dokumen tanpa isi tersimpan
 * (data demo/OSS) menampilkan lembar contoh + keterangan.
 *
 * Pemakaian di view: tombol `<button type="button" ${pratinjauAttrs({...})}>`
 * dan di handler aksi `preview-doc`: `bukaPratinjau(opsiDariDataset(el.dataset))`.
 */

import { ambilBerkas } from './berkas-store.js';
import { escapeHtml, html, qs, raw, setHtml } from './dom.js';

const DIALOG_ID = 'doc-preview';
const IMAGE = /\.(jpe?g|png)$/i;
const FAKE_LINES = ['w-full', 'w-[92%]', 'w-[96%]', 'w-[70%]', 'w-full',
  'w-[88%]', 'w-[55%]'];

/**
 * @typedef {{judul: string, namaBerkas: string, ukuranKb: (?number),
 *     berkasId: (?string)}} OpsiPratinjau
 */

/**
 * Atribut tombol pratinjau (data-action="preview-doc" + data-*).
 * @param {!OpsiPratinjau} opsi
 * @return {!Object} SafeHtml
 */
export function pratinjauAttrs({ judul, namaBerkas, ukuranKb, berkasId }) {
  return raw(`data-action="preview-doc" data-title="${escapeHtml(judul)}" ` +
    `data-name="${escapeHtml(namaBerkas)}" ` +
    `data-size-kb="${escapeHtml(ukuranKb ?? '')}" ` +
    `data-berkas-id="${escapeHtml(berkasId ?? '')}"`);
}

/** Byte -> KB (dibulatkan ke atas) untuk atribut pratinjau. */
export const kilobyte = (bytes) => bytes ? Math.max(1, Math.ceil(bytes / 1024))
  : null;

/** @param {!DOMStringMap} ds @return {!OpsiPratinjau} */
export function opsiDariDataset(ds) {
  return { judul: ds.title || ds.name, namaBerkas: ds.name,
    ukuranKb: Number(ds.sizeKb) || null, berkasId: ds.berkasId || null };
}

function ensureDialog() {
  let dialog = qs(`#${DIALOG_ID}`);
  if (dialog) {
    return dialog;
  }
  dialog = document.createElement('dialog');
  dialog.id = DIALOG_ID;
  dialog.className = 'modal';
  dialog.setAttribute('aria-labelledby', `${DIALOG_ID}-title`);
  dialog.innerHTML = `<div class="modal-box max-w-3xl p-0">
    <div class="flex items-center justify-between gap-3 border-b
      border-base-300 px-6 py-4"><div class="min-w-0">
      <h2 id="${DIALOG_ID}-title" class="font-bold"></h2>
      <p id="${DIALOG_ID}-meta" class="break-all text-xs
        text-base-content/60"></p></div>
      <form method="dialog"><button class="btn btn-ghost btn-sm btn-square
        text-xl text-base-content/60" aria-label="Tutup">×</button></form>
    </div><div id="${DIALOG_ID}-body" class="grid gap-3 px-6 py-5"
      aria-busy="false"></div></div>
    <form method="dialog" class="modal-backdrop"><button
      aria-label="Tutup">tutup</button></form>`;
  document.body.append(dialog);
  return dialog;
}

/** Lembar contoh bila isi berkas tidak tersimpan. */
function lembarContoh(namaBerkas) {
  return html`<div class="grid justify-items-center gap-3 rounded-box
      bg-base-300 p-6"><div class="grid aspect-[1/1.41] w-full max-w-[380px]
      content-start gap-2.5 bg-base-100 p-7 shadow-xl" role="img"
      aria-label="Contoh tampilan dokumen ${namaBerkas}">
    <div class="h-2.5 w-3/5 rounded-sm bg-base-300"></div>
    <div class="h-2 w-2/5 rounded-sm bg-base-200"></div>
    <div class="my-2 h-px bg-base-300"></div>
    ${FAKE_LINES.map((w) => html`<div class="h-1.75 rounded-sm bg-base-200
      ${w}"></div>`)}</div>
    <p class="max-w-md text-center text-xs text-base-content/70">Contoh
      tampilan dokumen. Isi berkas ini tidak tersimpan di prototipe (data
      demo atau berkas OSS); berkas yang Anda unggah sendiri tampil apa
      adanya.</p></div>`;
}

function isiBerkas(blob, namaBerkas, judul) {
  const url = URL.createObjectURL(blob);
  const image = blob.type.startsWith('image/') || IMAGE.test(namaBerkas);
  return {
    url,
    markup: image
      ? html`<img src="${url}" alt="Pratinjau ${judul}" class="mx-auto
          max-h-[70vh] max-w-full rounded-box border border-base-300
          object-contain">`
      : html`<iframe src="${url}" title="Pratinjau ${judul}" class="h-[70vh]
          w-full rounded-box border border-base-300"></iframe>`,
  };
}

/**
 * Buka dialog pratinjau.
 * @param {!OpsiPratinjau} opsi
 * @return {!Promise<void>}
 */
export async function bukaPratinjau({ judul, namaBerkas, ukuranKb, berkasId }) {
  const dialog = ensureDialog();
  const body = qs(`#${DIALOG_ID}-body`, dialog);
  qs(`#${DIALOG_ID}-title`, dialog).textContent = judul;
  qs(`#${DIALOG_ID}-meta`, dialog).textContent = ukuranKb
    ? `${namaBerkas} · ${ukuranKb} KB` : namaBerkas;
  body.setAttribute('aria-busy', 'true');
  setHtml(body, html`<div class="skeleton h-72 w-full"></div>
    <span class="sr-only" role="status">Memuat dokumen…</span>`);
  if (!dialog.open) {
    dialog.showModal();
  }
  const blob = await ambilBerkas(berkasId);
  const shown = blob ? isiBerkas(blob, namaBerkas, judul) : null;
  setHtml(body, shown ? shown.markup : lembarContoh(namaBerkas));
  body.setAttribute('aria-busy', 'false');
  if (shown) {
    dialog.addEventListener('close', () => URL.revokeObjectURL(shown.url),
      { once: true });
  }
}
