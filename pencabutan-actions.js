/**
 * @fileoverview Direktur action for Pencabutan RPTKA (PD-03): "TTE otomatis
 * semua" — dialog konfirmasi -> POST /pencabutan-direktur/tte-semua. Tidak
 * ada TTE per baris.
 */

import { tteSemuaPencabutan } from '../../api/pencabutan-direktur.js';
import { html, qs } from '../../components/dom.js';
import { setButtonBusy } from '../../components/form-ui.js';
import {
  BTN_OUTLINE, closeDialog, dialogClose, openDialog, toast,
} from '../portal/ui.js';
import { pendingPencabutan } from './pencabutan-list-view.js';
import { refreshView, state } from './state.js';

const DIALOG = 'direktur-modal';
const FORM_ID = 'penc-tte-form';

function tteSemuaContent(pending) {
  return html`<div class="flex items-start justify-between gap-3 border-b
      border-base-200 px-6 py-4">
    <h2 class="text-lg font-extrabold">TTE otomatis semua</h2>
    ${dialogClose()}</div>
    <form id="${FORM_ID}" class="grid gap-4 px-6 py-5 text-sm" novalidate>
      <p>Sistem akan menandatangani <b>${pending.length} pengajuan
        pencabutan RPTKA</b> dengan <b>TTE</b> atas nama Direktur sekaligus;
        dokumen Pencabutan (nomor, TTE, QR Code) dibuat dan SK Pencabutan
        diterbitkan ke pemberi kerja:</p>
      <ul class="max-h-56 divide-y divide-base-200 overflow-y-auto rounded-box
          border border-base-300">${pending.map((r) => html`<li class="flex
          flex-wrap items-center justify-between gap-2 px-3.5 py-2.5">
        <span class="font-semibold">${r.nama}
          <span class="font-normal text-base-content/60">·
          ${r.pemohon}</span></span>
        <span class="font-mono text-xs text-base-content/60">${r.nomor}
        </span></li>`)}</ul>
      <div role="alert" id="penc-tte-error" class="alert alert-error
        alert-soft" hidden></div>
      <div class="flex justify-end gap-2">
        <button type="button" data-action="close-direktur"
          class="btn ${BTN_OUTLINE}">Batal</button>
        <button type="submit" class="btn btn-primary">Jalankan TTE semua
        </button></div></form>`;
}

function showAlert(message) {
  const el = qs('#penc-tte-error');
  el.textContent = message;
  el.hidden = !message;
}

/** Replace the signed rows in the list + the open detail. */
function applyUpdate(rows) {
  state.pencRows = state.pencRows.map((r) => rows.find((c) => c.id === r.id)
    ?? r);
  const open = rows.find((c) => c.id === state.pencDetail?.id);
  if (open) {
    state.pencDetail = open;
  }
  refreshView();
}

async function submitTte(form) {
  const submit = qs('button[type="submit"]', form);
  showAlert('');
  setButtonBusy(submit, true);
  try {
    const { jumlah, rows } = await tteSemuaPencabutan();
    closeDialog(DIALOG);
    applyUpdate(rows);
    toast(`TTE otomatis dijalankan untuk ${jumlah} pencabutan RPTKA.`,
      'success');
  } catch (error) {
    setButtonBusy(submit, false);
    showAlert(error.message || 'TTE gagal dijalankan.');
  }
}

/** Delegated data-action handlers. */
export const pencabutanActions = {
  'penc-tte-semua-open'() {
    openDialog(DIALOG, tteSemuaContent(pendingPencabutan()), 'max-w-xl');
  },
};

/** Submit handler of the TTE form; true when the event was handled. */
export function onPencabutanSubmit(event) {
  if (event.target.id !== FORM_ID) {
    return false;
  }
  event.preventDefault();
  submitTte(event.target);
  return true;
}
