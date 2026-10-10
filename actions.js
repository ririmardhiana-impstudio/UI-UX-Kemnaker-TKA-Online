/**
 * @fileoverview Direktur actions: "Terbitkan HPK" (dialog pernyataan ->
 * POST /penerbitan-hpk/{id}/terbitkan), "TTE" (dialog konfirmasi -> POST
 * /penerbitan-hpk/{id}/tte, barcode) and the barcode viewer.
 */

import {
  jalankanTte, jalankanTteSemua, terbitkanHpk,
} from '../../api/penerbitan-hpk.js';
import { bukaPratinjau, opsiDariDataset } from '../../components/doc-preview.js';
import { html, qs } from '../../components/dom.js';
import { setButtonBusy } from '../../components/form-ui.js';
import { qrCode } from '../../components/qr-code.js';
import { validatePenerbitanHpk } from '../../contracts/penerbitan-hpk.js';
import { tanggal } from '../petugas-ekspos/format.js';
import {
  BTN_OUTLINE, closeDialog, dialogClose, fieldError, openDialog, showErrors,
  toast,
} from '../portal/ui.js';
import { pendingTte } from './list-view.js';
import { refreshView, state } from './state.js';

const DIALOG = 'direktur-modal';

function rowOf(id) {
  return state.detail?.id === id ? state.detail
    : state.rows.find((r) => r.id === id);
}

const header = (title) => html`<div class="flex items-start justify-between
    gap-3 border-b border-base-200 px-6 py-4">
  <h2 class="text-lg font-extrabold">${title}</h2>${dialogClose()}</div>`;

const alertBox = html`<div role="alert" id="direktur-error"
  class="alert alert-error alert-soft" hidden></div>`;

function terbitkanContent(row) {
  return html`${header('Terbitkan HPK')}
    <form id="direktur-form" data-kind="terbitkan" class="grid gap-4 px-6
        py-5 text-sm" novalidate data-id="${row.id}">
      <p>HPK <b>${row.noHpk}</b> milik <b>${row.pemohon}</b> (${row.jenis})
        sudah tervalidasi. Setelah diterbitkan, status menjadi
        <b>HPK Terbit</b> dan nomor surat dibuat.</p>
      <div class="grid gap-1.5">
        <label class="flex cursor-pointer items-start gap-3 font-semibold">
          <input type="checkbox" id="konfirmasi"
            class="checkbox checkbox-secondary mt-0.5"
            aria-describedby="konfirmasi-error" />
          <span>Saya menyetujui penerbitan surat HPK ini.</span></label>
        ${fieldError('konfirmasi')}</div>
      ${alertBox}
      <div class="flex justify-end gap-2">
        <button type="button" data-action="close-direktur"
          class="btn ${BTN_OUTLINE}">Batal</button>
        <button type="submit" class="btn btn-primary">Terbitkan HPK</button>
      </div></form>`;
}

function tteContent(row) {
  return html`${header('Jalankan TTE')}
    <form id="direktur-form" data-kind="tte" class="grid gap-4 px-6 py-5
        text-sm" novalidate data-id="${row.id}">
      <p>Sistem akan menjalankan tanda tangan elektronik (TTE) berupa
        <b>barcode</b> pada surat HPK <b class="font-mono">${row.noHpk}</b>
        milik <b>${row.pemohon}</b>.${row.aksi.terbitkan ? html` HPK ini
        masih <b>Tervalidasi</b>, jadi akan <b>langsung diterbitkan</b> dan
        tampil di akun pemberi kerja.` : ''}</p>
      ${alertBox}
      <div class="flex justify-end gap-2">
        <button type="button" data-action="close-direktur"
          class="btn ${BTN_OUTLINE}">Batal</button>
        <button type="submit" class="btn btn-primary">Jalankan TTE</button>
      </div></form>`;
}

function tteSemuaContent(pending) {
  return html`${header('TTE otomatis semua')}
    <form id="direktur-form" data-kind="tte-semua" class="grid gap-4 px-6
        py-5 text-sm" novalidate>
      <p>Sistem akan menjalankan tanda tangan elektronik (TTE) berupa
        <b>barcode</b> pada <b>${pending.length} surat HPK</b> yang belum
        ber-TTE. HPK yang masih Tervalidasi <b>langsung diterbitkan</b> dan
        tampil di akun pemberi kerja:</p>
      <ul class="max-h-56 divide-y divide-base-200 overflow-y-auto rounded-box
          border border-base-300">${pending.map((r) => html`<li class="flex
          flex-wrap items-center justify-between gap-2 px-3.5 py-2.5">
        <span class="font-semibold">${r.pemohon}</span>
        <span class="font-mono text-xs text-base-content/60">${r.noHpk}
          · ${r.status}</span></li>`)}</ul>
      ${alertBox}
      <div class="flex justify-end gap-2">
        <button type="button" data-action="close-direktur"
          class="btn ${BTN_OUTLINE}">Batal</button>
        <button type="submit" class="btn btn-primary">Jalankan TTE semua
        </button></div></form>`;
}

function barcodeContent(row) {
  const { tte } = row.surat;
  return html`${header('Barcode TTE')}
    <div class="grid justify-items-center gap-2 px-6 py-6 text-center">
      ${qrCode({ value: tte.barcode, size: 'size-44',
    label: `Barcode TTE ${row.surat.nomor}` })}
      <p class="font-mono text-sm font-semibold">${tte.barcode}</p>
      <p class="text-xs text-base-content/60">${row.pemohon} ·
        ${row.surat.nomor} · ${tanggal(tte.tgl)} · ${tte.oleh}</p>
      <p class="text-xs text-base-content/60">Barcode peraga prototipe;
        BE mengganti dengan barcode TTE sungguhan.</p></div>`;
}

function showAlert(message) {
  const el = qs('#direktur-error');
  el.textContent = message;
  el.hidden = !message;
}

/** Replace the row(s) in the list + the open detail after a server change. */
function applyUpdate(updated) {
  const changed = [].concat(updated);
  state.rows = state.rows.map((r) => {
    const next = changed.find((c) => c.id === r.id);
    return next ? { ...r, ...next } : r;
  });
  const open = changed.find((c) => c.id === state.detail?.id);
  if (open) {
    state.detail = { ...state.detail, ...open };
  }
  refreshView();
}

const SUBMIT = {
  async terbitkan(form) {
    const konfirmasi = qs('#konfirmasi', form).checked;
    const check = validatePenerbitanHpk({ konfirmasi });
    if (showErrors(form, check.valid ? {}
      : { konfirmasi: check.errors.konfirmasi })) {
      return null;
    }
    const updated = await terbitkanHpk(form.dataset.id, konfirmasi);
    return [updated, `HPK ${updated.noHpk} terbit: ${updated.surat.nomor}.`];
  },
  async tte(form) {
    const updated = await jalankanTte(form.dataset.id);
    return [updated, `TTE barcode dijalankan untuk ${updated.noHpk}.`];
  },
  async 'tte-semua'() {
    const { jumlah, rows } = await jalankanTteSemua();
    return [rows, `TTE otomatis dijalankan untuk ${jumlah} surat HPK.`];
  },
};

async function submitForm(form) {
  const submit = qs('button[type="submit"]', form);
  showAlert('');
  setButtonBusy(submit, true);
  try {
    const result = await SUBMIT[form.dataset.kind](form);
    if (!result) {
      setButtonBusy(submit, false);
      return;
    }
    closeDialog(DIALOG);
    applyUpdate(result[0]);
    toast(result[1], 'success');
  } catch (error) {
    setButtonBusy(submit, false);
    showAlert(error.message || 'Aksi gagal diproses.');
  }
}

/** Delegated data-action handlers. */
export const actions = {
  'terbitkan-open'(el) {
    openDialog(DIALOG, terbitkanContent(rowOf(el.dataset.id)), 'max-w-xl');
  },
  'tte-open'(el) {
    openDialog(DIALOG, tteContent(rowOf(el.dataset.id)), 'max-w-xl');
  },
  'tte-semua-open'() {
    openDialog(DIALOG, tteSemuaContent(pendingTte()), 'max-w-xl');
  },
  'barcode-open'(el) {
    openDialog(DIALOG, barcodeContent(rowOf(el.dataset.id)), 'max-w-md');
  },
  'close-direktur'() {
    closeDialog(DIALOG);
  },
  'preview-doc'(el) {
    bukaPratinjau(opsiDariDataset(el.dataset));
  },
};

/** Submit handler for the dialog forms (event delegation on the dialog). */
export function onDialogSubmit(event) {
  if (event.target.id === 'direktur-form') {
    event.preventDefault();
    submitForm(event.target);
  }
}
