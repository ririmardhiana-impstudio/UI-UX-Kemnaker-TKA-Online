/**
 * @fileoverview Account pages: Upload Dokumen Pengguna, Profil Perusahaan,
 * Ganti Password (VR-08/VR-09 client check, then back to login as in the
 * legacy flow) and Ganti Alamat Email (3 steps: form -> OTP -> sukses).
 * Profil also carries the "Verifikasi NIB ke OSS" card (KAK Modul 1,
 * POST /companies/{role}/nib-verifications; hidden for kelompok C).
 */

import { verifyNib } from '../../api/operators.js';
import { html, qs, qsa, raw, setHtml } from '../../components/dom.js';
import { statusBadge } from '../../components/status-badge.js';
import { checkPasswordStrength } from '../../contracts/auth.js';
import { NIB_PATTERN } from '../../contracts/operator.js';
import { EMAIL_PATTERN } from '../../contracts/schema.js';
import { setUi, state } from './state.js';
import {
  BTN, BTN_OUTLINE, CARD, CALLOUT_WARN, THEAD, cardHeader, field,
  fieldError, navAttrs, noopAttrs, pageTitle, readonlyField, showErrors,
  toast, validityMessage,
} from './ui.js';

const DOCS_C = ['Surat penunjukan / keterangan instansi',
  'Surat persetujuan instansi berwenang', 'Identitas penanggung jawab'];
const DOCS_AB = ['NPWP pemberi kerja', 'NIB dan/atau izin usaha',
  'Akta pendirian + SK pengesahan', 'Akta perubahan terakhir + SK',
  'Bukti WLKP', 'Domisili pemberi kerja', 'Bagan struktur organisasi'];
const DOC_DATES = ['12 Jan 2026', '12 Jan 2026', '3 Mar 2015', '20 Feb 2025',
  '5 Jan 2026', '12 Jan 2026', '—', '18 Mar 2026'];
const MISSING_DOC = 6;
const OTP_DEMO = ['4', '8', '2', '0', '7', ''];
const LOGIN_URL = 'akun-login.html';
const OSS_FIELDS = [['namaPerusahaan', 'Nama di OSS'], ['kbli', 'KBLI'],
  ['alamat', 'Alamat'], ['statusPerizinan', 'Status perizinan']];

/** Last NIB check per role: {role, status: idle|loading|done|error, ...}. */
let nibCheck = { role: null, status: 'idle' };

function userDocs() {
  const grup = state.data.company.grup;
  if (grup === 'C') {
    return DOCS_C;
  }
  return grup === 'B'
    ? [...DOCS_AB, 'Surat persetujuan pembebasan DKPTKA'] : DOCS_AB;
}

/** dokumen view. */
export function renderDokumen() {
  return html`
    ${pageTitle({ title: 'Upload Dokumen Pengguna',
      desc: 'Unggah dokumen perusahaan sekali untuk dipakai di semua permohonan. Pindai berwarna dari dokumen asli; PDF atau JPG/PNG, maks. 2 MB.' })}
    <section class="${CARD} overflow-x-auto">
      <table class="table min-w-[760px] text-sm"><thead><tr class="${THEAD}">
        <th>Dokumen</th><th class="w-[160px]">Status</th>
        <th class="w-[150px]">Diunggah</th>
        <th class="w-[200px]"><span class="sr-only">Aksi</span></th></tr>
      </thead><tbody>${userDocs().map((nama, i) => {
        const missing = i === MISSING_DOC;
        return html`<tr><td class="font-semibold">${nama}</td>
          <td>${statusBadge(missing ? 'Belum diunggah' : 'Terverifikasi',
            missing ? 'amber' : 'green')}</td>
          <td class="text-[13px] text-base-content/70">${missing ? '—'
            : DOC_DATES[i]}</td>
          <td><div class="flex justify-end gap-2">
            <button type="button" class="${BTN_OUTLINE} btn-sm"
              ${noopAttrs(`Pratinjau ${nama}`)}>Pratinjau</button>
            <button type="button" class="${BTN} btn-sm"
              ${noopAttrs(`Unggah ${nama}`)}>Unggah</button></div></td>
        </tr>`;
      })}</tbody></table></section>`;
}

/** profil view. */
export function renderProfil() {
  const co = state.data.company;
  const badge = html`<span class="badge badge-soft badge-warning h-auto
    py-1.5 font-bold">Kelengkapan 90% · 1 dokumen belum diunggah</span>`;
  return html`
    ${pageTitle({ title: 'Profil Perusahaan', actions: badge })}
    <form id="profil-form" novalidate class="${CARD} grid gap-4 px-5 py-6
        md:grid-cols-3 md:px-7">
      ${readonlyField({ id: 'pf-nama', label: 'Nama pemberi kerja',
        value: co.nama, span: 'md:col-span-2' })}
      ${readonlyField({ id: 'pf-kategori', label: 'Kategori badan usaha',
        value: co.kategori })}
      ${readonlyField({ id: 'pf-npwp', label: 'NPWP', value: co.npwp })}
      ${field({ id: 'pf-nib', label: 'NIB', value: co.nib })}
      ${field({ id: 'pf-wlkp', label: 'Kode WLKP', value: co.wlkp })}
      ${field({ id: 'pf-akta', label: 'Akta pendirian', value: co.akta })}
      ${field({ id: 'pf-akta-sah', label: 'Pengesahan akta',
        value: co.aktaSah, span: 'md:col-span-2' })}
      ${field({ id: 'pf-jalan', label: 'Alamat', value: co.jalan,
        span: 'md:col-span-3', attrs: raw('required') })}
      ${readonlyField({ id: 'pf-prov', label: 'Provinsi / Kab. Kota',
        value: `${co.prov} · ${co.kab}` })}
      ${readonlyField({ id: 'pf-kec', label: 'Kecamatan / Kelurahan',
        value: `${co.kec} · ${co.kel}` })}
      ${field({ id: 'pf-kodepos', label: 'Kode pos', value: co.kodepos,
        attrs: raw('required pattern="[0-9]{5}" inputmode="numeric"') })}
      ${field({ id: 'pf-telp', label: 'Telepon', value: co.telp,
        type: 'tel' })}
      ${field({ id: 'pf-fax', label: 'Faksimil', value: co.fax, type: 'tel' })}
      <div class="grid content-start gap-1.5"><p class="text-sm font-bold">
        Email akun</p><p class="flex h-11 items-center justify-between
        rounded-field border border-base-300 bg-base-200/50 px-3.5 text-sm">
        <span>${co.email}</span><button type="button" class="link
          link-hover link-secondary font-bold" ${navAttrs('email')}>Ganti
        </button></p></div>
      <div class="flex flex-wrap items-center justify-between gap-3 border-t
          border-base-200 pt-2 md:col-span-3">
        <p class="text-[13px] text-base-content/60">Nama, kategori, dan NPWP
          hanya dapat diubah melalui user.pptka@kemnaker.go.id.</p>
        <button type="submit" class="${BTN}" data-testid="profil-btn-simpan">
          Simpan perubahan</button></div></form>
    ${co.grup === 'C' ? '' : nibCard()}`;
}

function currentNibCheck() {
  return nibCheck.role === state.role ? nibCheck
    : { role: state.role, status: 'idle' };
}

function nibResult() {
  const check = currentNibCheck();
  if (check.status === 'loading') {
    return html`<p class="flex items-center gap-2 text-sm
      text-base-content/70"><span class="loading loading-spinner loading-sm"
      aria-hidden="true"></span>Menghubungi OSS…</p>`;
  }
  if (check.status === 'error') {
    return html`<div role="alert" class="alert alert-error alert-soft">
      <span>${check.message}</span>
      <button type="button" class="btn btn-sm" data-nib-verify>Coba lagi
      </button></div>`;
  }
  if (check.status !== 'done') {
    return html`<p class="text-sm text-base-content/60">Belum diverifikasi
      pada sesi ini.</p>`;
  }
  const r = check.result;
  const isMatch = r.status === 'Sesuai';
  return html`<div class="grid gap-3 rounded-box border p-4 ${isMatch
      ? 'border-success/30 bg-success/10' : 'border-error/30 bg-error/10'}">
    <p class="flex flex-wrap items-center gap-2 text-sm font-bold">
      ${statusBadge(r.status, isMatch ? 'green' : 'red')}
      <span>NIB ${r.nib}</span></p>
    <p class="text-[13px] text-base-content/80">${r.catatan}</p>
    <dl class="grid gap-x-4 gap-y-1.5 text-[13px] md:grid-cols-[160px_1fr]">
      ${OSS_FIELDS.map(([key, label]) => html`<dt
        class="text-base-content/70">${label}</dt>
        <dd class="font-semibold">${r.ossData[key]}</dd>`)}</dl></div>`;
}

function nibCard() {
  const isLoading = currentNibCheck().status === 'loading';
  return html`<section class="${CARD} overflow-hidden"
      aria-labelledby="nib-title">
    ${cardHeader(html`<span id="nib-title">Verifikasi NIB ke OSS</span>`,
      html`<button type="button" class="${BTN_OUTLINE} btn-sm" data-nib-verify
        data-testid="profil-btn-verifikasi-nib"
        ${isLoading ? 'disabled' : ''}>Verifikasi ke OSS</button>`)}
    <div class="grid gap-3 px-5 py-4">
      <p class="text-[13px] text-base-content/70">Mencocokkan NIB pada isian
        di atas dengan data Online Single Submission (OSS): nama, KBLI,
        alamat, dan status perizinan.</p>
      <div id="nib-result" aria-live="polite"
        aria-busy="${isLoading}">${nibResult()}</div></div></section>`;
}

async function runNibCheck(root) {
  const form = qs('#profil-form', root);
  const nib = qs('#pf-nib', form).value.trim();
  if (!new RegExp(NIB_PATTERN).test(nib)) {
    showErrors(form, { 'pf-nib': 'NIB harus 13 digit angka.' });
    return;
  }
  showErrors(form, {});
  const role = state.role;
  nibCheck = { role, status: 'loading' };
  drawNib(root);
  try {
    nibCheck = { role, status: 'done', result: await verifyNib(role, nib) };
  } catch (error) {
    nibCheck = { role, status: 'error',
      message: error.message || 'Verifikasi NIB gagal.' };
    if (error.field === 'nib') {
      showErrors(form, { 'pf-nib': error.message });
    }
  }
  if (role === state.role) {
    drawNib(root);
  }
}

/** Redraw only the NIB card (keeps unsaved profil form edits). */
function drawNib(root) {
  const card = qs('section[aria-labelledby="nib-title"]', root);
  if (!card) {
    return;
  }
  const isLoading = nibCheck.status === 'loading';
  const result = qs('#nib-result', card);
  result.setAttribute('aria-busy', String(isLoading));
  setHtml(result, nibResult());
  qs('[data-testid="profil-btn-verifikasi-nib"]', card).disabled = isLoading;
}

/** password view. */
export function renderPassword() {
  return html`
    <h1 class="text-[26px] font-extrabold tracking-tight">Ganti Password</h1>
    <form id="password-form" novalidate class="${CARD} grid max-w-[520px]
        gap-4 p-7">
      ${field({ id: 'pw-lama', label: 'Password lama', type: 'password',
        value: 'rahasia123', attrs: raw('required autocomplete="current-password"') })}
      ${field({ id: 'pw-baru', label: 'Password baru', type: 'password',
        value: 'BajaPresisi#26',
        attrs: raw('required minlength="8" maxlength="20" autocomplete="new-password"') })}
      ${field({ id: 'pw-ulang', label: 'Konfirmasi password baru',
        type: 'password', value: 'BajaPresisi#26',
        attrs: raw('required autocomplete="new-password"') })}
      <p class="${CALLOUT_WARN}">Setelah berhasil, Anda akan keluar otomatis
        dan perlu masuk kembali.</p>
      <button type="submit" class="${BTN}" data-testid="password-btn-ganti">
        Ganti password</button></form>`;
}

function emailStepForm() {
  return html`<p class="text-sm text-base-content/70">Email saat ini: <b
      class="text-base-content">${state.data.company.email}</b></p>
    ${field({ id: 'em-password', label: 'Password saat ini',
      type: 'password', value: 'rahasia123', attrs: raw('required') })}
    ${field({ id: 'em-baru', label: 'Email baru', type: 'email',
      value: state.ui.newEmail, attrs: raw('required autocomplete="email"') })}
    <button type="submit" class="${BTN}" data-testid="email-btn-otp">Kirim
      kode OTP</button>`;
}

function emailStepOtp() {
  return html`<p class="text-sm leading-normal text-base-content/70">Kode 6
      digit dikirim ke <b class="text-base-content">${state.ui.newEmail}</b>.
      Berlaku 10 menit.</p>
    <fieldset aria-describedby="em-otp-error"><legend class="sr-only">Kode
      OTP 6 digit</legend><div class="grid grid-cols-6 gap-2">
      ${OTP_DEMO.map((d, i) => html`<input type="text" inputmode="numeric"
        maxlength="1" pattern="[0-9]" value="${d}" data-otp
        aria-label="Digit ${i + 1}" class="input h-13.5 w-full text-center
        text-[22px] font-extrabold ${d ? 'border-secondary' : ''}">`)}
    </div></fieldset>${fieldError('em-otp')}
    <div class="flex justify-between text-[13px]"><span
      class="text-base-content/60">Berlaku 09:12</span><button type="button"
      class="font-bold text-base-content/50" disabled>Kirim ulang</button>
    </div>
    <button type="submit" class="${BTN}" data-testid="email-btn-konfirmasi">
      Konfirmasi</button>`;
}

/** email view. */
export function renderEmail() {
  const step = state.ui.emailStep;
  let body = emailStepForm();
  if (step === 1) {
    body = emailStepOtp();
  } else if (step === 2) {
    body = html`<p role="status" class="rounded-box bg-success/10 p-4 text-sm
      font-semibold leading-normal text-success">Email akun berhasil diganti
      menjadi ${state.ui.newEmail}.</p>`;
  }
  return html`
    <h1 class="text-[26px] font-extrabold tracking-tight">Ganti Alamat Email
    </h1>
    <form id="email-form" novalidate class="${CARD} grid max-w-[520px] gap-4
        p-7">${body}</form>`;
}

function submitPassword(form) {
  const baru = qs('#pw-baru', form).value;
  const errors = {};
  if (!qs('#pw-lama', form).value) {
    errors['pw-lama'] = 'Wajib diisi.';
  }
  const strength = checkPasswordStrength(baru);
  if (!strength.length || !strength.mixedCase || !strength.digitOrSymbol) {
    errors['pw-baru'] = '8–20 karakter, huruf besar dan kecil, serta angka ' +
      'atau simbol.';
  }
  if (qs('#pw-ulang', form).value !== baru) {
    errors['pw-ulang'] = 'Konfirmasi password tidak sama.';
  }
  if (!showErrors(form, errors)) {
    window.location.href = LOGIN_URL;
  }
}

function submitEmail(form) {
  const step = state.ui.emailStep;
  if (step === 0) {
    const email = qs('#em-baru', form).value.trim();
    const errors = {};
    if (!qs('#em-password', form).value) {
      errors['em-password'] = 'Wajib diisi.';
    }
    if (!new RegExp(EMAIL_PATTERN).test(email)) {
      errors['em-baru'] = 'Format email tidak valid.';
    }
    if (!showErrors(form, errors)) {
      setUi({ emailStep: 1, newEmail: email });
    }
    return;
  }
  const digits = qsa('[data-otp]', form).map((i) => i.value.trim());
  if (!digits.every((d) => /^[0-9]$/.test(d))) {
    showErrors(form, { 'em-otp': 'Masukkan 6 digit kode OTP.' });
    return;
  }
  setUi({ emailStep: 2 });
}

/** @param {!Element} root */
export function mount(root) {
  root.addEventListener('click', (event) => {
    if (event.target.closest('[data-nib-verify]:not(:disabled)')) {
      runNibCheck(root);
    }
  });
  root.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.target;
    if (form.id === 'password-form') {
      submitPassword(form);
    } else if (form.id === 'email-form') {
      submitEmail(form);
    } else if (form.id === 'profil-form') {
      const errors = {};
      for (const input of qsa('input[required]', form)) {
        if (!input.checkValidity()) {
          errors[input.id] = validityMessage(input);
        }
      }
      if (!showErrors(form, errors)) {
        toast('Perubahan profil disimpan (simulasi prototipe).');
      }
    }
  });
}
