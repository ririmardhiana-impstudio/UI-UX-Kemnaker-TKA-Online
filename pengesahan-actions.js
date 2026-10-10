/**
 * @fileoverview Validator actions for Pengesahan RPTKA (VP-01..VP-05): "Verifikasi"
 * (sistem otomatis menerbitkan kode billing DKPTKA) dan "Tolak" (alasan ->
 * status Perbaikan). Dialog dipakai dari tabel maupun halaman detail.
 */

import {
  rejectPengesahanValidasi, verifyPengesahanValidasi,
} from '../../api/pengesahan-validasi.js';
import { html, qs } from '../../components/dom.js';
import { setButtonBusy } from '../../components/form-ui.js';
import {
  validatePengesahanValidasiReject,
} from '../../contracts/pengesahan-validasi.js';
import {
  BTN_OUTLINE, closeDialog, dialogClose, openDialog, showErrors, textareaField,
  toast,
} from '../portal/ui.js';
import { PENG, refreshView, scopeOf, state } from './state.js';

const DIALOG = 'validator-modal';
const rupiah = (n) => `Rp${n.toLocaleString('id-ID')}`;

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

function dkptkaText(d) {
  return d.bebas
    ? html`${d.alasanBebas} Tidak ada kode billing yang diterbitkan.`
    : html`DKPTKA <b>${rupiah(d.rupiah)}</b> (${d.jumlahTka} TKA ×
      ${d.bulan} bulan × ${rupiah(d.tarif)}); kode billing
      terbit <b>otomatis</b> dan tagihan diterima pemberi kerja.`;
}

const isKabKota = (row) => scopeOf(row) === 'kabkota';

/** Lintas Kab/Kota = retribusi daerah: diteruskan ke Disnaker untuk SKRD. */
function skrdText(d) {
  return d.bebas
    ? html`${d.alasanBebas} Tidak ada SKRD yang diterbitkan.`
    : html`Retribusi <b>${rupiah(d.rupiah)}</b> (${d.jumlahTka} TKA ×
      ${d.bulan} bulan × ${rupiah(d.tarif)}); berkas diteruskan ke
      <b>Dinas Ketenagakerjaan setempat</b> yang menerbitkan Surat Ketetapan
      Retribusi Daerah (SKRD) kepada pemberi kerja.`;
}

function verifyContent(row) {
  const kabkota = isKabKota(row);
  const aksi = kabkota ? 'Validasi' : 'Verifikasi';
  const label = kabkota ? aksi : `${aksi} & terbitkan billing`;
  return html`${header(label)}
    <div class="grid gap-4 px-6 py-5 text-sm">
      <p>${who(row)} dinyatakan <b>sesuai</b>.
        ${kabkota ? skrdText(row.dkptka) : dkptkaText(row.dkptka)}</p>
      <div role="alert" id="peng-verify-error"
        class="alert alert-error alert-soft" hidden></div>
    </div>
    <div class="flex justify-end gap-2 border-t border-base-200 px-6 py-4">
      <button type="button" data-action="close-validator"
        class="btn ${BTN_OUTLINE}">Batal</button>
      <button type="button" data-action="peng-confirm-verify"
        data-id="${row.id}" class="btn btn-primary">
        ${label}</button></div>`;
}

function rejectContent(row) {
  return html`${header('Tolak RPTKA')}
    <form id="peng-reject-form" class="grid gap-4 px-6 py-5 text-sm"
        novalidate data-id="${row.id}">
      <p>${who(row)} akan dikembalikan dengan status <b>Perbaikan</b>.
        Pemberi kerja memperbaiki lalu submit ulang langsung ke Validator.
      </p>
      ${textareaField({ id: 'alasan', label: 'Alasan penolakan', rows: 4,
        max: 1000, min: 10,
        placeholder: 'Mis. Data pengurus belum lengkap, lengkapi ulang.' })}
      <div role="alert" id="peng-reject-error"
        class="alert alert-error alert-soft" hidden></div>
      <div class="flex justify-end gap-2">
        <button type="button" data-action="close-validator"
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
    const updated = await verifyPengesahanValidasi(row.id);
    closeDialog(DIALOG);
    applyUpdate(updated);
    toast(updated.status === PENG.BEBAS
      ? `RPTKA ${row.nomorRptka}: bebas DKPTKA, tanpa kode billing.`
      : updated.status === PENG.SKRD_WAIT
        ? `RPTKA ${row.nomorRptka} divalidasi; diteruskan ke Disnaker untuk SKRD.`
        : `Kode billing ${updated.billing.kode} terbit untuk RPTKA ${row.nomorRptka}.`);
  } catch (error) {
    setButtonBusy(button, false);
    showAlert('peng-verify-error', error.message || 'Verifikasi gagal.');
  }
}

async function submitReject(form) {
  const row = rowOf(form.dataset.id);
  const alasan = qs('#alasan', form).value.trim();
  const check = validatePengesahanValidasiReject({ alasan });
  showAlert('peng-reject-error', '');
  if (showErrors(form, check.valid ? {} : { alasan: check.errors.alasan })) {
    return;
  }
  const submit = qs('button[type="submit"]', form);
  setButtonBusy(submit, true);
  try {
    applyUpdate(await rejectPengesahanValidasi(row.id, alasan));
    closeDialog(DIALOG);
    toast(`RPTKA ${row.nomorRptka} ditolak — status Perbaikan.`, 'info');
  } catch (error) {
    setButtonBusy(submit, false);
    showAlert('peng-reject-error', error.message || 'Penolakan gagal.');
  }
}

/** Delegated data-action handlers. */
export const pengesahanActions = {
  'peng-verify'(el) {
    openDialog(DIALOG, verifyContent(rowOf(el.dataset.id)), 'max-w-xl');
  },
  'peng-reject'(el) {
    openDialog(DIALOG, rejectContent(rowOf(el.dataset.id)), 'max-w-xl');
  },
  'peng-confirm-verify': confirmVerify,
};

/** Submit handler for the reject form; true when the event was handled. */
export function onPengesahanSubmit(event) {
  if (event.target.id !== 'peng-reject-form') {
    return false;
  }
  event.preventDefault();
  submitReject(event.target);
  return true;
}
