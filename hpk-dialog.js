/**
 * @fileoverview Verifikator actions for HPK: "Verifikasi" (konfirmasi ->
 * POST /hpk-verifikasi/{id}/verify, sistem generate jadwal ekspos) dan
 * "Tolak" (kolom alasan -> POST /hpk-verifikasi/{id}/reject, status
 * berubah menjadi Perbaikan data).
 */

import { rejectHpk, verifyHpk } from '../../api/hpk-verifikasi.js';
import { html, qs } from '../../components/dom.js';
import { setButtonBusy } from '../../components/form-ui.js';
import { validateHpkReject } from '../../contracts/back-office.js';
import {
  BTN_OUTLINE, closeDialog, dialogClose, openDialog, showErrors, textareaField,
  toast,
} from '../portal/ui.js';
import { refreshView, state } from './state.js';

const DIALOG = 'verif-modal';

function rowOf(id) {
  return state.hpkDetail?.id === id ? state.hpkDetail
    : state.hpkRows.find((r) => r.id === id);
}

function header(title) {
  return html`<div class="flex items-start justify-between gap-3 border-b
      border-base-200 px-6 py-4">
    <h2 class="text-lg font-extrabold">${title}</h2>${dialogClose()}</div>`;
}

function verifyContent(row) {
  return html`${header('Verifikasi HPK')}
    <div class="grid gap-4 px-6 py-5 text-sm">
      <p>HPK <b>${row.noPermohonan}</b> milik <b>${row.pemohon}</b>
        (${row.layanan}) dinyatakan <b>sesuai</b>. Setelah dikonfirmasi,
        tahap menjadi <b>Jadwal Ekspos</b> dan sistem otomatis membuat
        jadwal ekspos pada slot kalender kosong pertama.</p>
      <div role="alert" id="hpk-verify-error"
        class="alert alert-error alert-soft" hidden></div>
    </div>
    <div class="flex justify-end gap-2 border-t border-base-200 px-6 py-4">
      <button type="button" data-action="close-verif"
        class="btn ${BTN_OUTLINE}">Batal</button>
      <button type="button" data-action="hpk-confirm-verify"
        data-id="${row.id}" class="btn btn-primary">
        Verifikasi & buat jadwal ekspos</button></div>`;
}

function rejectContent(row) {
  return html`${header('Tolak HPK')}
    <form id="hpk-reject-form" class="grid gap-4 px-6 py-5 text-sm" novalidate
        data-id="${row.id}">
      <p>HPK <b>${row.noPermohonan}</b> milik <b>${row.pemohon}</b> akan
        dikembalikan dengan status <b>Perbaikan data</b>. Pemberi kerja
        dapat memperbaiki lalu submit ulang.</p>
      ${textareaField({ id: 'alasan', label: 'Alasan penolakan', rows: 4,
        max: 1000, min: 10,
        placeholder: 'Mis. Uraian jabatan kurang dari 350 karakter.' })}
      <div role="alert" id="hpk-reject-error"
        class="alert alert-error alert-soft" hidden></div>
      <div class="flex justify-end gap-2">
        <button type="button" data-action="close-verif"
          class="btn ${BTN_OUTLINE}">Batal</button>
        <button type="submit" class="btn btn-primary">Tolak HPK</button>
      </div></form>`;
}

function showAlert(id, message) {
  const el = qs(`#${id}`);
  el.textContent = message;
  el.hidden = !message;
}

/** Replace the row in the list + the open detail after a server change. */
function applyUpdate(updated) {
  state.hpkRows = state.hpkRows.map((r) => (r.id === updated.id
    ? { ...r, ...updated } : r));
  if (state.hpkDetail?.id === updated.id) {
    state.hpkDetail = updated;
  }
  refreshView();
}

async function confirmVerify(button) {
  const row = rowOf(button.dataset.id);
  showAlert('hpk-verify-error', '');
  setButtonBusy(button, true);
  try {
    const updated = await verifyHpk(row.id);
    closeDialog(DIALOG);
    applyUpdate(updated);
    toast(`HPK ${row.noPermohonan} diverifikasi. Jadwal ekspos: ` +
      `${updated.ekspos.hari}, ${updated.ekspos.jam} WIB.`);
  } catch (error) {
    setButtonBusy(button, false);
    showAlert('hpk-verify-error', error.message || 'Verifikasi gagal.');
  }
}

async function submitReject(form) {
  const row = rowOf(form.dataset.id);
  const alasan = qs('#alasan', form).value.trim();
  const check = validateHpkReject({ alasan });
  showAlert('hpk-reject-error', '');
  if (showErrors(form, check.valid ? {} : { alasan: check.errors.alasan })) {
    return;
  }
  const submit = qs('button[type="submit"]', form);
  setButtonBusy(submit, true);
  try {
    const updated = await rejectHpk(row.id, alasan);
    closeDialog(DIALOG);
    applyUpdate(updated);
    toast(`HPK ${row.noPermohonan} ditolak — status Perbaikan data.`, 'info');
  } catch (error) {
    setButtonBusy(submit, false);
    showAlert('hpk-reject-error', error.message || 'Penolakan gagal.');
  }
}

/** Delegated data-action handlers. */
export const actions = {
  'hpk-verify'(el) {
    openDialog(DIALOG, verifyContent(rowOf(el.dataset.id)), 'max-w-xl');
  },
  'hpk-reject'(el) {
    openDialog(DIALOG, rejectContent(rowOf(el.dataset.id)), 'max-w-xl');
  },
  'hpk-confirm-verify': confirmVerify,
};

/** Submit handler for the reject form (event delegation on the dialog). */
export function onHpkDialogSubmit(event) {
  if (event.target.id === 'hpk-reject-form') {
    event.preventDefault();
    submitReject(event.target);
  }
}
