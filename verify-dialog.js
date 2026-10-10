/**
 * @fileoverview Verifikator actions: "Verifikasi" (dialog with the email
 * aktivasi preview -> POST /pendaftar/{id}/activate; sistem mengirim email
 * ke email admin dan setiap operator), "Tidak sesuai" (catatan ->
 * POST /pendaftar/{id}/request-fix) and the document preview stub.
 */

import { activatePendaftar, requestPendaftarFix } from '../../api/pendaftar.js';
import { bukaPratinjau, opsiDariDataset } from '../../components/doc-preview.js';
import { html, qs } from '../../components/dom.js';
import { setButtonBusy } from '../../components/form-ui.js';
import { validatePendaftarFix } from '../../contracts/back-office.js';
import {
  BTN_OUTLINE, closeDialog, dialogClose, openDialog, showErrors, textareaField,
  toast,
} from '../portal/ui.js';
import { refreshView, state } from './state.js';

const DIALOG = 'verif-modal';

/** Admin + operator addresses, one entry per unique email (preview of the
 * list the server returns as `emailTerkirim`). */
export function recipientsOf(row) {
  const byAddress = new Map();
  const add = (email, peran) => {
    const key = String(email ?? '').trim().toLowerCase();
    if (key) {
      const prev = byAddress.get(key);
      byAddress.set(key, { email: email.trim(),
        peran: prev ? `${prev.peran} & ${peran}` : peran });
    }
  };
  add(row.emailAdmin, 'Admin Pemberi Kerja');
  row.operators.forEach((op) => add(op.email, 'Operator'));
  return [...byAddress.values()];
}

function rowOf(id) {
  return state.detail?.id === id ? state.detail
    : state.rows.find((r) => r.id === id);
}

function header(title) {
  return html`<div class="flex items-start justify-between gap-3 border-b
      border-base-200 px-6 py-4">
    <h2 class="text-lg font-extrabold">${title}</h2>${dialogClose()}</div>`;
}

function verifyContent(row) {
  const recipients = recipientsOf(row);
  return html`${header('Verifikasi & aktivasi akun')}
    <div class="grid gap-4 px-6 py-5 text-sm">
      <p>Anda memverifikasi data <b>${row.nama}</b> (${row.kategori})
        sebagai <b>sesuai</b>. Setelah dikonfirmasi, status menjadi
        <b>Aktif</b> dan sistem mengirim email aktivasi ke:</p>
      <ul class="grid gap-2" aria-label="Penerima email aktivasi">
        ${recipients.map((r) => html`<li class="flex flex-wrap
            items-center justify-between gap-2 rounded-box border
            border-base-300 px-3.5 py-2.5">
          <span class="font-semibold">${r.email}</span>
          <span class="badge badge-soft badge-info badge-sm">${r.peran}
          </span></li>`)}</ul>
      ${recipients.length ? '' : html`<p role="alert" class="text-error">
        Tidak ada alamat email penerima pada data pendaftar ini.</p>`}
      <div class="overflow-hidden rounded-box border border-base-300">
        <p class="border-b border-base-300 bg-base-200/50 px-3.5 py-2 text-xs
          font-bold text-base-content/60">Contoh isi email (dummy)</p>
        <div class="grid gap-2 px-3.5 py-3 text-[13px] leading-relaxed">
          <p class="font-bold">Aktivasi akun TKA Online — ${row.nama}</p>
          <p>Pendaftaran pemberi kerja <b>${row.nama}</b> telah diverifikasi
            Verifikator Akun TKA Online. Gunakan tautan berikut untuk
            mengaktifkan akses akun TKA Online.</p>
          <p><span class="btn btn-primary btn-xs pointer-events-none">
            Aktifkan akun →</span></p>
          <p class="text-xs text-base-content/60">Contoh tampilan untuk
            peraga alur — tidak benar-benar terkirim.</p></div></div>
      <div role="alert" id="verify-error" class="alert alert-error alert-soft"
        hidden></div>
    </div>
    <div class="flex justify-end gap-2 border-t border-base-200 px-6 py-4">
      <button type="button" data-action="close-verif" class="btn
        ${BTN_OUTLINE}">Batal</button>
      <button type="button" data-action="confirm-verify"
        data-id="${row.id}" class="btn btn-primary"
        ${recipients.length ? '' : 'disabled'}>
        Verifikasi & kirim email aktivasi</button></div>`;
}

function rejectContent(row) {
  return html`${header('Tidak sesuai — minta perbaikan')}
    <form id="reject-form" class="grid gap-4 px-6 py-5 text-sm" novalidate
        data-id="${row.id}">
      <p>Pemohon <b>${row.nama}</b> akan diminta memperbaiki data dan
        mengunggah ulang dokumen. Tidak ada email aktivasi yang dikirim.</p>
      ${textareaField({ id: 'catatan', label: 'Catatan kekurangan',
        rows: 4, max: 1000, min: 10,
        placeholder: 'Mis. Dokumen buram, unggah ulang pindaian berwarna.' })}
      <div role="alert" id="reject-error" class="alert alert-error alert-soft"
        hidden></div>
      <div class="flex justify-end gap-2">
        <button type="button" data-action="close-verif" class="btn
          ${BTN_OUTLINE}">Batal</button>
        <button type="submit" class="btn btn-primary">
          Kirim permintaan perbaikan</button></div></form>`;
}

function showAlert(id, message) {
  const el = qs(`#${id}`);
  el.textContent = message;
  el.hidden = !message;
}

/** Replace the row in the list + the open detail after a server change. */
function applyUpdate(updated) {
  state.rows = state.rows.map((r) => (r.id === updated.id ? updated : r));
  if (state.detail?.id === updated.id) {
    state.detail = updated;
  }
  refreshView();
}

async function confirmVerify(button) {
  const row = rowOf(button.dataset.id);
  showAlert('verify-error', '');
  setButtonBusy(button, true);
  try {
    const updated = await activatePendaftar(row.id);
    closeDialog(DIALOG);
    applyUpdate(updated);
    toast(`${row.nama} diverifikasi. Email aktivasi dikirim ke ` +
      `${updated.emailTerkirim.length} alamat.`);
  } catch (error) {
    setButtonBusy(button, false);
    showAlert('verify-error', error.message || 'Verifikasi gagal.');
  }
}

async function submitReject(form) {
  const row = rowOf(form.dataset.id);
  const catatan = qs('#catatan', form).value.trim();
  const check = validatePendaftarFix({ catatan });
  showAlert('reject-error', '');
  if (showErrors(form, check.valid ? {} : { catatan: check.errors.catatan })) {
    return;
  }
  const submit = qs('button[type="submit"]', form);
  setButtonBusy(submit, true);
  try {
    const updated = await requestPendaftarFix(row.id, catatan);
    closeDialog(DIALOG);
    applyUpdate(updated);
    toast(`Permintaan perbaikan dikirim ke ${row.nama}.`, 'info');
  } catch (error) {
    setButtonBusy(submit, false);
    showAlert('reject-error', error.message || 'Permintaan gagal dikirim.');
  }
}

/** Delegated data-action handlers. */
export const actions = {
  verify(el) {
    openDialog(DIALOG, verifyContent(rowOf(el.dataset.id)), 'max-w-2xl');
  },
  reject(el) {
    openDialog(DIALOG, rejectContent(rowOf(el.dataset.id)), 'max-w-xl');
  },
  'confirm-verify': confirmVerify,
  'close-verif'() {
    closeDialog(DIALOG);
  },
  'preview-doc'(el) {
    bukaPratinjau(opsiDariDataset(el.dataset));
  },
};

/** Submit handler for the reject form (event delegation on the dialog). */
export function onDialogSubmit(event) {
  if (event.target.id === 'reject-form') {
    event.preventDefault();
    submitReject(event.target);
  }
}
