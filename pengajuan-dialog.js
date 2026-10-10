/**
 * @fileoverview Aksi Verifikator untuk pengajuan Perubahan/Pencabutan
 * (AK-24): dialog Verifikasi (-> Validator) dan Tolak (alasan -> status
 * Perbaikan).
 */

import {
  rejectPengajuan, verifyPengajuan,
} from '../../api/pengajuan-verifikasi.js';
import { html, qs } from '../../components/dom.js';
import { setButtonBusy } from '../../components/form-ui.js';
import {
  validatePengajuanReject,
} from '../../contracts/pengajuan-verifikasi.js';
import {
  BTN_OUTLINE, closeDialog, dialogClose, openDialog, showErrors, textareaField,
  toast,
} from '../portal/ui.js';
import { KINDS, kindOf } from './pengajuan-views.js';
import { refreshView, state } from './state.js';

const DIALOG = 'verif-modal';

const cfgOf = () => KINDS[kindOf()];

function rowOf(id) {
  const cfg = cfgOf();
  return state[cfg.detail]?.id === id ? state[cfg.detail]
    : state[cfg.rows].find((r) => r.id === id);
}

function header(title) {
  return html`<div class="flex items-start justify-between gap-3 border-b
      border-base-200 px-6 py-4">
    <h2 class="text-lg font-extrabold">${title}</h2>${dialogClose()}</div>`;
}

function showAlert(id, message) {
  const el = qs(`#${id}`);
  el.textContent = message;
  el.hidden = !message;
}

function applyUpdate(updated) {
  const cfg = cfgOf();
  state[cfg.rows] = state[cfg.rows].map((r) => (r.id === updated.id
    ? { ...r, ...updated } : r));
  if (state[cfg.detail]?.id === updated.id) {
    state[cfg.detail] = updated;
  }
  refreshView();
}

function verifyContent(row) {
  return html`${header(`Verifikasi ${cfgOf().label}`)}
    <div class="grid gap-4 px-6 py-5 text-sm">
      <p>${cfgOf().label} <b>${row.nomor}</b> milik <b>${row.pemohon}</b>
        dinyatakan <b>sesuai</b>. Setelah dikonfirmasi, pengajuan
        <b>diteruskan ke Validator</b>.</p>
      <div role="alert" id="pj-verify-error"
        class="alert alert-error alert-soft" hidden></div></div>
    <div class="flex justify-end gap-2 border-t border-base-200 px-6 py-4">
      <button type="button" data-action="close-verif"
        class="btn ${BTN_OUTLINE}">Batal</button>
      <button type="button" data-action="pj-confirm-verify"
        data-id="${row.id}" class="btn btn-primary">
        Verifikasi & teruskan ke Validator</button></div>`;
}

function rejectContent(row) {
  return html`${header(`Tolak ${cfgOf().label}`)}
    <form id="pj-reject-form" class="grid gap-4 px-6 py-5 text-sm" novalidate
        data-id="${row.id}">
      <p>${cfgOf().label} <b>${row.nomor}</b> akan dikembalikan dengan
        status <b>Perbaikan</b>. Pemberi kerja dapat memperbaiki lalu
        mengajukan kembali.</p>
      ${textareaField({ id: 'alasan', label: 'Alasan penolakan', rows: 4,
        max: 1000, min: 10,
        placeholder: 'Mis. Dokumen pendukung tidak terbaca.' })}
      <div role="alert" id="pj-reject-error"
        class="alert alert-error alert-soft" hidden></div>
      <div class="flex justify-end gap-2">
        <button type="button" data-action="close-verif"
          class="btn ${BTN_OUTLINE}">Batal</button>
        <button type="submit" class="btn btn-primary">Tolak pengajuan
        </button></div></form>`;
}

async function confirmVerify(button) {
  const row = rowOf(button.dataset.id);
  showAlert('pj-verify-error', '');
  setButtonBusy(button, true);
  try {
    applyUpdate(await verifyPengajuan(kindOf(), row.id));
    closeDialog(DIALOG);
    toast(`${row.nomor} diteruskan ke Validator.`);
  } catch (error) {
    setButtonBusy(button, false);
    showAlert('pj-verify-error', error.message || 'Verifikasi gagal.');
  }
}

async function submitReject(form) {
  const row = rowOf(form.dataset.id);
  const alasan = qs('#alasan', form).value.trim();
  const check = validatePengajuanReject({ alasan });
  showAlert('pj-reject-error', '');
  if (showErrors(form, check.valid ? {} : { alasan: check.errors.alasan })) {
    return;
  }
  const submit = qs('button[type="submit"]', form);
  setButtonBusy(submit, true);
  try {
    applyUpdate(await rejectPengajuan(kindOf(), row.id, alasan));
    closeDialog(DIALOG);
    toast(`${row.nomor} ditolak — status Perbaikan.`, 'info');
  } catch (error) {
    setButtonBusy(submit, false);
    showAlert('pj-reject-error', error.message || 'Penolakan gagal.');
  }
}

export const actions = {
  'pj-verify'(el) {
    openDialog(DIALOG, verifyContent(rowOf(el.dataset.id)), 'max-w-xl');
  },
  'pj-reject'(el) {
    openDialog(DIALOG, rejectContent(rowOf(el.dataset.id)), 'max-w-xl');
  },
  'pj-confirm-verify': confirmVerify,
};

export function onPengajuanDialogSubmit(event) {
  if (event.target.id === 'pj-reject-form') {
    event.preventDefault();
    submitReject(event.target);
  }
}
