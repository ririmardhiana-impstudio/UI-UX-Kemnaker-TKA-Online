/**
 * @fileoverview Validator actions for Pencabutan RPTKA per TKA (PV-03,
 * PV-04): "Validasi" (konfirmasi -> Tervalidasi) dan "Tolak" (alasan ->
 * status Perbaikan; pemberi kerja submit ulang langsung ke Validator).
 * Dialog dipakai dari halaman Detail.
 */

import {
  rejectPencabutanValidasi, validatePencabutan,
} from '../../api/pencabutan-validasi.js';
import { html, qs } from '../../components/dom.js';
import { setButtonBusy } from '../../components/form-ui.js';
import { validatePengajuanReject } from '../../contracts/pengajuan-verifikasi.js';
import {
  BTN_OUTLINE, closeDialog, dialogClose, openDialog, showErrors, textareaField,
  toast,
} from '../portal/ui.js';
import { refreshView, state } from './state.js';

const DIALOG = 'validator-modal';

function rowOf(id) {
  return state.pencDetail?.id === id ? state.pencDetail
    : state.pencRows.find((r) => r.id === id);
}

function header(title) {
  return html`<div class="flex items-start justify-between gap-3 border-b
      border-base-200 px-6 py-4">
    <h2 class="text-lg font-extrabold">${title}</h2>${dialogClose()}</div>`;
}

function who(row) {
  return html`Pencabutan <b>${row.nomor}</b> atas TKA <b>${row.nama}</b>
    milik <b>${row.pemohon}</b>`;
}

function validateContent(row) {
  return html`${header('Validasi pencabutan RPTKA')}
    <div class="grid gap-4 px-6 py-5 text-sm">
      <p>${who(row)} dinyatakan <b>sesuai</b>. Status menjadi
        <b>Tervalidasi</b> dan pemberi kerja diberi tahu.</p>
      <div role="alert" id="penc-validate-error"
        class="alert alert-error alert-soft" hidden></div>
    </div>
    <div class="flex justify-end gap-2 border-t border-base-200 px-6 py-4">
      <button type="button" data-action="close-validator"
        class="btn ${BTN_OUTLINE}">Batal</button>
      <button type="button" data-action="penc-confirm-validate"
        data-id="${row.id}" class="btn btn-primary">Validasi</button></div>`;
}

function rejectContent(row) {
  return html`${header('Tolak pencabutan RPTKA')}
    <form id="penc-reject-form" class="grid gap-4 px-6 py-5 text-sm"
        novalidate data-id="${row.id}">
      <p>${who(row)} akan dikembalikan dengan status <b>Perbaikan</b>.
        Pemberi kerja memperbaiki lalu submit ulang langsung ke Validator.
      </p>
      ${textareaField({ id: 'alasan', label: 'Alasan penolakan', rows: 4,
        max: 1000, min: 10,
        placeholder: 'Mis. Surat pernyataan belum ditandatangani.' })}
      <div role="alert" id="penc-reject-error"
        class="alert alert-error alert-soft" hidden></div>
      <div class="flex justify-end gap-2">
        <button type="button" data-action="close-validator"
          class="btn ${BTN_OUTLINE}">Batal</button>
        <button type="submit" class="btn btn-primary">Tolak pencabutan
        </button>
      </div></form>`;
}

function showAlert(id, message) {
  const el = qs(`#${id}`);
  el.textContent = message;
  el.hidden = !message;
}

/** Replace the row in the list + the open detail after a server change. */
function applyUpdate(updated) {
  state.pencRows = state.pencRows.map((r) => (r.id === updated.id
    ? { ...r, ...updated } : r));
  if (state.pencDetail?.id === updated.id) {
    state.pencDetail = updated;
  }
  refreshView();
}

async function confirmValidate(button) {
  const row = rowOf(button.dataset.id);
  showAlert('penc-validate-error', '');
  setButtonBusy(button, true);
  try {
    applyUpdate(await validatePencabutan(row.id));
    closeDialog(DIALOG);
    toast(`Pencabutan ${row.nomor} tervalidasi.`);
  } catch (error) {
    setButtonBusy(button, false);
    showAlert('penc-validate-error', error.message || 'Validasi gagal.');
  }
}

async function submitReject(form) {
  const row = rowOf(form.dataset.id);
  const alasan = qs('#alasan', form).value.trim();
  const check = validatePengajuanReject({ alasan });
  showAlert('penc-reject-error', '');
  if (showErrors(form, check.valid ? {} : { alasan: check.errors.alasan })) {
    return;
  }
  const submit = qs('button[type="submit"]', form);
  setButtonBusy(submit, true);
  try {
    applyUpdate(await rejectPencabutanValidasi(row.id, alasan));
    closeDialog(DIALOG);
    toast(`Pencabutan ${row.nomor} ditolak — status Perbaikan.`, 'info');
  } catch (error) {
    setButtonBusy(submit, false);
    showAlert('penc-reject-error', error.message || 'Penolakan gagal.');
  }
}

/** Delegated data-action handlers. */
export const pencabutanActions = {
  'penc-validate'(el) {
    openDialog(DIALOG, validateContent(rowOf(el.dataset.id)), 'max-w-xl');
  },
  'penc-reject'(el) {
    openDialog(DIALOG, rejectContent(rowOf(el.dataset.id)), 'max-w-xl');
  },
  'penc-confirm-validate': confirmValidate,
};

/** Submit handler for the reject form; true when the event was handled. */
export function onPencabutanSubmit(event) {
  if (event.target.id !== 'penc-reject-form') {
    return false;
  }
  event.preventDefault();
  submitReject(event.target);
  return true;
}
