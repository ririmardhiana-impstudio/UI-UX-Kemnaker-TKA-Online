/**
 * @fileoverview Navigasi tahap Form RPTKA: tab (tahap yang belum boleh
 * dibuka tampil disabled sampai tahap sebelumnya lengkap) dan footer
 * Sebelumnya / Simpan Draft / Lanjut / Submit.
 */

import { html, qsa } from '../../components/dom.js';
import { TABS } from './rptka-data.js';
import { blocker, groupErrors } from './rptka-gate.js';
import { BTN, BTN_OUTLINE } from './ui.js';

const KOSONG = { jabatan: (S) => S.w.jabatan.length,
  dokumen: (S) => S.w.tka.length, data: (S) => S.w.tka.length };

/** @param {!Object} S @param {!Object} groups hasil groupErrors */
export function tabBar(S, groups) {
  return html`<div role="tablist" aria-label="Form RPTKA"
      class="tabs tabs-border overflow-x-auto" data-rp-tablist>
    ${TABS.map((t) => {
    const done = KOSONG[t.key]?.(S) && !groups[t.key];
    const now = S.tab === t.key;
    const locked = !now && blocker(S, t.key, groups);
    return html`<button type="button" role="tab" id="rp-tab-${t.key}"
      aria-selected="${now}" aria-controls="rp-panel"
      tabindex="${now ? 0 : -1}" ${locked ? 'disabled' : ''}
      class="tab whitespace-nowrap ${now ? 'tab-active' : ''}"
      data-action="rptka-tab" data-tab="${t.key}">${done ? html`<span
      aria-hidden="true" class="me-1 text-success">✓</span><span
      class="sr-only">(lengkap) </span>` : ''}${t.label}</button>`;
  })}</div>`;
}

/** Buka/kunci tombol tab tanpa render ulang (dipanggil saat mengetik). */
export function syncTabs(S) {
  const groups = groupErrors(S);
  for (const button of qsa('[role="tab"]')) {
    button.disabled = S.tab !== button.dataset.tab &&
      Boolean(blocker(S, button.dataset.tab, groups));
  }
}

export function footer(S) {
  const first = S.tab === TABS[0].key;
  const last = S.tab === 'preview';
  return html`<div class="flex flex-wrap items-center justify-between gap-2.5
      border-t border-base-200 pt-3">
    <button type="button" class="${BTN_OUTLINE}" data-action="rptka-prev"
      ${first ? 'disabled' : ''}>← Sebelumnya</button>
    <div class="flex flex-wrap gap-2.5">
      ${S.w.perluRevisi ? '' : html`<button type="button"
        class="${BTN_OUTLINE}" data-action="rptka-save" data-rp-busy
        data-testid="rptka-btn-simpan">Simpan Draft</button>`}
      ${last && S.w.perluRevisi ? html`<button type="button" class="${BTN}"
        data-action="rptka-resubmit" data-rp-busy
        data-testid="rptka-btn-resubmit">Kirim Ulang</button>`
    : last ? html`<button type="button" class="${BTN}"
        data-action="rptka-submit" data-rp-busy
        data-testid="rptka-btn-submit">Submit Pengajuan</button>`
    : html`<button type="button" class="${BTN}" data-action="rptka-next"
        data-testid="rptka-btn-lanjut">Lanjut →</button>`}</div></div>
    <p id="rptka-error" role="alert" class="text-sm font-semibold text-error"
      hidden></p>
    <p class="text-xs text-base-content/70">Tahap berikutnya terbuka setelah
      tahap sebelumnya lengkap. Draft dapat disimpan kapan saja dan
      dilanjutkan dari daftar pengajuan. Setelah disubmit,
      permohonan dikirim ke Verifikator dengan status Menunggu Verifikasi dan
      tidak dapat diubah.</p>`;
}
