/**
 * @fileoverview "Data Perusahaan" panel of the register wizard (langkah
 * 3) — HANYA untuk metode `OSS` (AK-18); metode `Non-OSS` melewati
 * langkah ini sepenuhnya (lihat register.js `sequence()`). Cari NIB,
 * WLKP, dan NPWP ke OSS dari kode pendaftaran WLKP yang diketik pengguna
 * (AK-14, usulan KAK Modul 1), tombol lanjut terkunci sampai hasil
 * "Ditemukan" — pola UI sama dengan kartu "Verifikasi NIB ke OSS" di
 * Profil Perusahaan (js/pages/portal/akun.js `nibCard`).
 */

import { lookupCompanyByWlkp } from '../../api/auth.js';
import { ApiError } from '../../api/http.js';
import { html, qs, setHtml } from '../../components/dom.js';
import { statusBadge } from '../../components/status-badge.js';
import { WLKP_PATTERN } from '../../contracts/registration.js';

const OSS_FIELDS = [['namaPerusahaan', 'Nama di OSS'], ['kbli', 'KBLI'],
  ['alamat', 'Alamat'], ['statusPerizinan', 'Status perizinan']];

/**
 * @param {!HTMLFormElement} form Wizard form (`#reg-form`).
 * @return {{refresh: function(), isGateOpen: function(): boolean,
 *     reset: function(), result: function(): ?Object}}
 */
export function createRegisterCompany(form) {
  const panel = qs('#reg-company-panel', form);
  const resultEl = qs('#reg-company-result', panel);
  const button = qs('#reg-company-lookup', panel);
  const input = qs('#reg-kode-wlkp', form);
  let check = { status: 'idle' };

  button.addEventListener('click', run);
  input.addEventListener('input', () => {
    if (check.status !== 'idle') {
      check = { status: 'idle' };
      draw();
    }
  });

  function isGateOpen() {
    return check.status === 'done' && check.result.status === 'Ditemukan';
  }

  async function run() {
    const kodeWlkp = input.value.trim();
    if (!new RegExp(WLKP_PATTERN).test(kodeWlkp)) {
      check = { status: 'error',
        message: 'Format kode WLKP: 0000.0000.000000.' };
      draw();
      return;
    }
    check = { status: 'loading' };
    draw();
    try {
      check = { status: 'done', result: await lookupCompanyByWlkp(kodeWlkp) };
    } catch (error) {
      check = { status: 'error', message: error instanceof ApiError
        ? error.message : 'Pencarian OSS gagal. Coba lagi.' };
    }
    draw();
  }

  function draw() {
    const busy = check.status === 'loading';
    resultEl.setAttribute('aria-busy', String(busy));
    button.disabled = busy;
    setHtml(resultEl, renderResult());
  }

  function renderResult() {
    if (check.status === 'loading') {
      return html`<p class="flex items-center gap-2 text-sm
        text-base-content/70"><span class="loading loading-spinner
        loading-sm" aria-hidden="true"></span>Menghubungi OSS…</p>`;
    }
    if (check.status === 'error') {
      return html`<div role="alert" class="alert alert-error alert-soft
        text-sm"><span>${check.message}</span>
        <button type="button" class="btn btn-sm" data-company-retry>Coba
        lagi</button></div>`;
    }
    if (check.status !== 'done') {
      return html`<p class="text-sm text-base-content/60">Belum dicari.
        Isi kode pendaftaran WLKP lalu klik "Cek ke OSS" untuk
        melanjutkan.</p>`;
    }
    const r = check.result;
    return html`<div class="grid gap-3 rounded-box border border-success/30
        bg-success/10 p-4">
      <p class="flex flex-wrap items-center gap-2 text-sm font-bold">
        ${statusBadge(r.status, 'green')}
        <span>NIB ${r.nib} · NPWP ${r.npwp}</span></p>
      <dl class="grid gap-x-4 gap-y-1.5 text-[13px] md:grid-cols-[160px_1fr]">
        ${OSS_FIELDS.map(([key, label]) => html`<dt
          class="text-base-content/70">${label}</dt>
          <dd class="font-semibold">${r.ossData[key]}</dd>`)}</dl></div>`;
  }

  resultEl.addEventListener('click', (event) => {
    if (event.target.closest('[data-company-retry]')) {
      run();
    }
  });
  draw();

  return {
    refresh: draw,
    isGateOpen,
    result: () => (check.status === 'done' ? check.result : null),
    reset() {
      check = { status: 'idle' };
      draw();
    },
  };
}
