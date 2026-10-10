/**
 * @fileoverview Validator HPK action "Verifikasi": dialog pernyataan
 * kesesuaian isian + dokumen -> POST /validasi-hpk/{id}/validate (status
 * Tervalidasi).
 */

import { validateHpk } from '../../api/validasi-hpk.js';
import { bukaPratinjau, opsiDariDataset } from '../../components/doc-preview.js';
import { html, qs } from '../../components/dom.js';
import { setButtonBusy } from '../../components/form-ui.js';
import { validateValidasiHpk } from '../../contracts/validasi-hpk.js';
import {
  BTN_OUTLINE, closeDialog, dialogClose, fieldError, openDialog, showErrors,
  toast,
} from '../portal/ui.js';
import { refreshView, state } from './state.js';

const DIALOG = 'validator-modal';

function rowOf(id) {
  return state.detail?.id === id ? state.detail
    : state.rows.find((r) => r.id === id);
}

function verifikasiContent(row) {
  return html`<div class="flex items-start justify-between gap-3 border-b
      border-base-200 px-6 py-4">
    <h2 class="text-lg font-extrabold">Verifikasi HPK</h2>${dialogClose()}
    </div>
    <form id="validator-form" class="grid gap-4 px-6 py-5 text-sm" novalidate
        data-id="${row.id}">
      <p>HPK <b>${row.noHpk}</b> milik <b>${row.pemohon}</b>
        (${row.jenis}), BAP <b>${row.bap.nomor}</b> sudah disetujui. Setelah
        diverifikasi, status menjadi <b>Tervalidasi</b>.</p>
      <div class="grid gap-1.5">
        <label class="flex cursor-pointer items-start gap-3 font-semibold">
          <input type="checkbox" id="konfirmasi"
            class="checkbox checkbox-secondary mt-0.5"
            aria-describedby="konfirmasi-error" />
          <span>Saya telah memeriksa data isian dan dokumen HPK, dan
            menyatakan keduanya sesuai ketentuan.</span></label>
        ${fieldError('konfirmasi')}</div>
      <div role="alert" id="validator-error" class="alert alert-error
        alert-soft" hidden></div>
      <div class="flex justify-end gap-2">
        <button type="button" data-action="close-validator"
          class="btn ${BTN_OUTLINE}">Batal</button>
        <button type="submit" class="btn btn-primary">Verifikasi HPK</button>
      </div></form>`;
}

function showAlert(message) {
  const el = qs('#validator-error');
  el.textContent = message;
  el.hidden = !message;
}

/** Replace the row in the list + the open detail after a server change. */
function applyUpdate(updated) {
  state.rows = state.rows.map((r) => (r.id === updated.id
    ? { ...r, ...updated } : r));
  if (state.detail?.id === updated.id) {
    state.detail = updated;
  }
  refreshView();
}

async function submitVerifikasi(form) {
  const konfirmasi = qs('#konfirmasi', form).checked;
  const check = validateValidasiHpk({ konfirmasi });
  showAlert('');
  if (showErrors(form, check.valid ? {}
    : { konfirmasi: check.errors.konfirmasi })) {
    return;
  }
  const submit = qs('button[type="submit"]', form);
  setButtonBusy(submit, true);
  try {
    const updated = await validateHpk(form.dataset.id, konfirmasi);
    closeDialog(DIALOG);
    applyUpdate(updated);
    toast(`HPK ${updated.noHpk} tervalidasi.`, 'success');
  } catch (error) {
    setButtonBusy(submit, false);
    showAlert(error.message || 'Verifikasi gagal diproses.');
  }
}

/** Delegated data-action handlers. */
export const actions = {
  'validasi-open'(el) {
    openDialog(DIALOG, verifikasiContent(rowOf(el.dataset.id)), 'max-w-xl');
  },
  'close-validator'() {
    closeDialog(DIALOG);
  },
  'preview-doc'(el) {
    bukaPratinjau(opsiDariDataset(el.dataset));
  },
};

/** Submit handler for the verifikasi form (event delegation on the dialog). */
export function onDialogSubmit(event) {
  if (event.target.id === 'validator-form') {
    event.preventDefault();
    submitVerifikasi(event.target);
  }
}
