/**
 * @fileoverview Verifikator actions for Pengesahan RPTKA (AK-22):
 * "Verifikasi" (diteruskan ke Validator) dan "Tolak" (alasan -> status
 * Perbaikan). Dialog dipakai dari tabel maupun halaman detail.
 */

import { rejectPengesahan, verifyPengesahan } from
  '../../api/pengesahan-verifikasi.js';
import { html, qs } from '../../components/dom.js';
import { setButtonBusy } from '../../components/form-ui.js';
import { validatePengesahanReject } from '../../contracts/back-office.js';
import {
  BTN_OUTLINE, closeDialog, dialogClose, openDialog, showErrors, textareaField,
  toast,
} from '../portal/ui.js';
import { refreshView, state } from './state.js';

const DIALOG = 'verif-modal';
const TAHAP = 'verifikasi';

function rowOf(id) {
  return state.pengDetail?.id === id ? state.pengDetail
    : state.pengRows.find((r) => r.id === id);
}

function header(title) {
  return html`<div class="flex items-start justify-between gap-3 border-b
      border-base-200 px-6 py-4">
    <h2 class="text-lg font-extrabold">${title}</h2>${dialogClose()}</div>`;
}

function who(row) {
  return html`RPTKA <b>${row.nomorRptka}</b> milik <b>${row.pemohon}</b>
    (${row.jenisRptka})`;
}

function verifyContent(row) {
  return html`${header('Verifikasi RPTKA')}
    <div class="grid gap-4 px-6 py-5 text-sm">
      <p>${who(row)} dinyatakan <b>sesuai</b>. Setelah dikonfirmasi,
        permohonan <b>diteruskan ke Validator</b>.</p>
      <div role="alert" id="peng-verify-error"
        class="alert alert-error alert-soft" hidden></div>
    </div>
    <div class="flex justify-end gap-2 border-t border-base-200 px-6 py-4">
      <button type="button" data-action="close-verif"
        class="btn ${BTN_OUTLINE}">Batal</button>
      <button type="button" data-action="peng-confirm-verify"
        data-id="${row.id}" class="btn btn-primary">
        Verifikasi & teruskan ke Validator</button></div>`;
}

function rejectContent(row) {
  return html`${header('Tolak RPTKA')}
    <form id="peng-reject-form" class="grid gap-4 px-6 py-5 text-sm"
        novalidate data-id="${row.id}">
      <p>${who(row)} akan dikembalikan dengan status <b>Perbaikan</b>.
        Pemberi kerja dapat memperbaiki lalu submit ulang.</p>
      ${textareaField({ id: 'alasan', label: 'Alasan penolakan', rows: 4,
        max: 1000, min: 10,
        placeholder: 'Mis. Paspor tidak terbaca, unggah ulang.' })}
      <div role="alert" id="peng-reject-error"
        class="alert alert-error alert-soft" hidden></div>
      <div class="flex justify-end gap-2">
        <button type="button" data-action="close-verif"
          class="btn ${BTN_OUTLINE}">Batal</button>
        <button type="submit" class="btn btn-primary">Tolak RPTKA</button>
      </div></form>`;
}

function showAlert(id, message) {
  const el = qs(`#${id}`);
  el.textContent = message;
  el.hidden = !message;
}

/** Replace the row in the list + the open detail after a server change. */
function applyUpdate(updated) {
  state.pengRows = state.pengRows.map((r) => (r.id === updated.id
    ? { ...r, ...updated } : r));
  if (state.pengDetail?.id === updated.id) {
    state.pengDetail = updated;
  }
  refreshView();
}

async function confirmVerify(button) {
  const row = rowOf(button.dataset.id);
  showAlert('peng-verify-error', '');
  setButtonBusy(button, true);
  try {
    const updated = await verifyPengesahan(row.id, TAHAP);
    closeDialog(DIALOG);
    applyUpdate(updated);
    toast(`RPTKA ${row.nomorRptka} diteruskan ke Validator.`);
  } catch (error) {
    setButtonBusy(button, false);
    showAlert('peng-verify-error', error.message || 'Verifikasi gagal.');
  }
}

async function submitReject(form) {
  const row = rowOf(form.dataset.id);
  const alasan = qs('#alasan', form).value.trim();
  const check = validatePengesahanReject({ tahap: TAHAP, alasan });
  showAlert('peng-reject-error', '');
  if (showErrors(form, check.valid ? {} : { alasan: check.errors.alasan })) {
    return;
  }
  const submit = qs('button[type="submit"]', form);
  setButtonBusy(submit, true);
  try {
    applyUpdate(await rejectPengesahan(row.id, TAHAP, alasan));
    closeDialog(DIALOG);
    toast(`RPTKA ${row.nomorRptka} ditolak — status Perbaikan.`, 'info');
  } catch (error) {
    setButtonBusy(submit, false);
    showAlert('peng-reject-error', error.message || 'Penolakan gagal.');
  }
}

/** Delegated data-action handlers. */
export const actions = {
  'peng-verify'(el) {
    openDialog(DIALOG, verifyContent(rowOf(el.dataset.id)), 'max-w-xl');
  },
  'peng-reject'(el) {
    openDialog(DIALOG, rejectContent(rowOf(el.dataset.id)), 'max-w-xl');
  },
  'peng-confirm-verify': confirmVerify,
};

/** Submit handler for the reject form (event delegation on the dialog). */
export function onPengesahanDialogSubmit(event) {
  if (event.target.id === 'peng-reject-form') {
    event.preventDefault();
    submitReject(event.target);
  }
}
