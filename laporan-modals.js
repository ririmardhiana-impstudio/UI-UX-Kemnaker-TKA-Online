/**
 * @fileoverview Laporan dialogs: "Upload Excel" (POST /laporan/uploads,
 * VR-05 .xlsx <= 1 MB, 409 after Terkirim) with a two-step preview, and
 * "Kirim Laporan Periode" (POST /laporan, LP-02/LP-03).
 */

import { submitLaporan, uploadLaporan } from '../../api/laporan.js';
import { html, qs, setHtml } from '../../components/dom.js';
import {
  LAPORAN_MIME_XLSX, validateLaporanUpload,
} from '../../contracts/laporan.js';
import { reloadCollection } from './data.js';
import { refreshView, state } from './state.js';
import {
  BTN, BTN_OUTLINE, closeDialog, dialogClose, field, openDialog, showErrors,
  toast,
} from './ui.js';

const MODAL = 'portal-modal';
const DEMO_FILE = {
  name: 'laporan-penggunaan-tka-2025.xlsx', size: 48 * 1024,
  type: LAPORAN_MIME_XLSX,
};
const KB = 1024;

/** Selected file (demo file until the user picks one). */
let upload = { idx: 0, file: DEMO_FILE };

function fileLabel(file) {
  return `${Math.max(1, Math.round(file.size / KB))} KB · maks. 1 MB, hanya ` +
    '.xlsx';
}

function uploadStepOne() {
  const def = state.data.laporanDef[upload.idx];
  return html`<div class="flex items-center justify-between border-b
      border-base-300 px-6 py-4.5"><h2 class="font-bold">Upload Excel ·
      ${def.nama}</h2>${dialogClose()}</div>
    <form id="lap-upload-form" novalidate class="grid gap-3.5 p-6">
      <div class="flex flex-wrap items-center justify-between gap-2 rounded-box
          border border-info/20 bg-info/10 px-4 py-3.5 text-[13px]">
        <span>1 · Unduh templat, isi sesuai kolom.</span>
        <button type="button" class="link link-hover link-secondary font-bold"
          data-action="noop" data-label="Unduh templat">Unduh templat .xlsx
        </button></div>
      <label for="lap-file" class="grid cursor-pointer gap-1 rounded-box
          border-2 border-dashed border-base-content/20 bg-base-200/50 p-7
          text-center hover:border-secondary">
        <b class="text-sm" id="lap-file-name">${upload.file.name}</b>
        <span class="text-xs text-base-content/60" id="lap-file-size">
          ${fileLabel(upload.file)}</span>
        <span class="text-xs font-bold text-secondary">Ganti berkas</span>
        <input id="lap-file" type="file" class="sr-only"
          accept=".xlsx,${LAPORAN_MIME_XLSX}"
          aria-describedby="lap-file-error"></label>
      <p id="lap-file-error" class="text-xs font-semibold text-error"
        aria-live="polite" hidden></p>
      ${field({ id: 'lap-deskripsi', label: 'Deskripsi',
        value: 'Pembaruan data per 30 September 2026' })}
      <div class="flex justify-end"><button type="submit" class="${BTN}"
        data-testid="laporan-btn-review">Review dan Proses</button></div>
    </form>`;
}

function uploadStepTwo(result) {
  const def = state.data.laporanDef[upload.idx];
  return html`<div class="flex items-center justify-between border-b
      border-base-300 px-6 py-4.5"><h2 class="font-bold">Upload Excel ·
      ${def.nama}</h2>${dialogClose()}</div>
    <div class="grid gap-3.5 p-6">
      <p class="text-sm"><b>${result.validRows} baris valid</b>, <b
        class="text-error">${result.invalidRows} baris tidak valid</b> —
        baris tidak valid tidak akan diproses.</p>
      <ul class="max-h-80 overflow-auto rounded-box border border-base-300">
        ${result.rows.map((u) => html`<li class="grid grid-cols-[40px_1fr_120px_1.4fr]
          gap-2.5 border-t border-base-200 px-3.5 py-2.5 text-[13px]
          first:border-t-0"><span class="text-base-content/60">${u.no}</span>
          <b class="font-semibold">${u.nama}</b><span class="font-mono
          text-xs">${u.paspor}</span><span class="font-semibold ${u.valid
            ? 'text-success' : 'text-error'}">${u.message}</span></li>`)}
      </ul>
      <div class="flex justify-end gap-2.5">
        <button type="button" class="${BTN_OUTLINE}"
          data-action="close-modal">Batal</button>
        <button type="button" class="${BTN}" data-action="lap-upload-done"
          data-rows="${result.validRows}">Proses ${result.validRows} baris
        </button></div></div>`;
}

function kirimDialog() {
  const periode = state.data.laporan.periode;
  return html`<div class="grid gap-3.5 px-6 py-7 md:px-8">
    <h2 class="text-[19px] font-bold">Kirim Laporan Periode ${periode}?</h2>
    <p class="text-sm leading-relaxed text-base-content/70">Keempat laporan
      akan berstatus <b>Terkirim</b> dan tidak dapat diubah lagi. Pastikan
      seluruh data sudah benar.</p>
    <p id="kirim-error" class="text-sm font-semibold text-error"
      aria-live="polite" hidden></p>
    <div class="flex justify-end gap-2.5">
      <form method="dialog"><button class="${BTN_OUTLINE}">Periksa lagi
      </button></form>
      <button type="button" class="${BTN}" data-action="lap-kirim"
        data-testid="laporan-btn-kirim-konfirmasi">Kirim laporan</button>
    </div></div>`;
}

/** Submit handler for #lap-upload-form (bound in main). */
export async function submitUpload(form) {
  const file = upload.file;
  const body = {
    role: state.role, kode: state.data.laporanDef[upload.idx].kode,
    fileName: file.name, fileSize: file.size,
    mimeType: file.type || undefined,
    deskripsi: qs('#lap-deskripsi', form).value.trim(),
  };
  const result = validateLaporanUpload(body);
  const errors = {};
  if (!result.valid) {
    errors['lap-file'] = result.errors.fileName ?? result.errors.fileSize ??
      Object.values(result.errors)[0];
    if (result.errors.deskripsi) {
      errors['lap-deskripsi'] = result.errors.deskripsi;
    }
  }
  if (showErrors(form, errors)) {
    return;
  }
  const button = qs('[type="submit"]', form);
  button.disabled = true;
  form.setAttribute('aria-busy', 'true');
  try {
    const preview = await uploadLaporan(body);
    setHtml(qs(`#${MODAL} [data-dialog-body]`), uploadStepTwo(preview));
  } catch (error) {
    button.disabled = false;
    form.removeAttribute('aria-busy');
    showErrors(form, { 'lap-file': error.message });
  }
}

/** File input change inside the upload dialog. */
export function pickFile(input) {
  const file = input.files?.[0];
  if (!file) {
    return;
  }
  upload = { ...upload, file };
  qs('#lap-file-name').textContent = file.name;
  qs('#lap-file-size').textContent = fileLabel(file);
}

export const actions = {
  'lap-upload'(el) {
    upload = { idx: Number(el.dataset.idx), file: DEMO_FILE };
    openDialog(MODAL, uploadStepOne(), 'max-w-3xl');
  },
  'lap-upload-done'(el) {
    closeDialog(MODAL);
    toast(`${el.dataset.rows} baris diproses.`);
  },
  'lap-open-kirim'() {
    openDialog(MODAL, kirimDialog(), 'max-w-lg');
  },
  async 'lap-kirim'(el) {
    el.disabled = true;
    el.setAttribute('aria-busy', 'true');
    try {
      await submitLaporan({ role: state.role,
        periode: state.data.laporan.periode, agree: true });
      await reloadCollection('laporan');
      closeDialog(MODAL);
      refreshView();
    } catch (error) {
      el.disabled = false;
      el.removeAttribute('aria-busy');
      const slot = qs('#kirim-error');
      slot.textContent = error.message;
      slot.hidden = false;
    }
  },
};
