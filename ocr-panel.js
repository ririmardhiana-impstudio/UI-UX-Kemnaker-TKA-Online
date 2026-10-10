/**
 * @fileoverview OCR result panel (status: draft). Shows each field read
 * from a document with a confidence badge, a "Periksa kembali" warning when
 * any field is below the threshold, optional comparison with the values
 * typed in the form, and an optional "Terapkan ke formulir" button.
 * Use cases: paspor (Data calon TKA), NPWP/NIB (pendaftaran akun),
 * dokumen pengguna.
 */

import { html } from './dom.js';
import { statusBadge } from './status-badge.js';

const HIGH_CONFIDENCE = 0.95;
const percent = new Intl.NumberFormat('id-ID', { style: 'percent' });

/**
 * Confidence badge: >= 95% Tinggi (green), >= threshold Sedang (blue),
 * below threshold Rendah (amber).
 * @param {number} keyakinan 0–1
 * @param {number} ambang
 * @return {!Object} SafeHtml
 */
export function confidenceBadge(keyakinan, ambang) {
  const value = percent.format(keyakinan);
  if (keyakinan >= HIGH_CONFIDENCE) {
    return statusBadge(`Tinggi · ${value}`, 'green');
  }
  if (keyakinan >= ambang) {
    return statusBadge(`Sedang · ${value}`, 'blue');
  }
  return statusBadge(`Rendah · ${value}`, 'amber');
}

/**
 * @param {{id: string, title: string, fileName: (string|undefined),
 *     fields: !Array<{kunci: string, label: string, nilai: string,
 *       keyakinan: number, isian: (string|undefined),
 *       cocok: (boolean|undefined)}>,
 *     perluPeriksa: boolean, ambang: (number|undefined),
 *     apply: ({label: (string|undefined), attrs: *}|undefined),
 *     secondary: ({label: string, attrs: *}|undefined)}} options
 *     fields[].isian/cocok = typed value + comparison result (optional).
 *     apply.attrs = pre-rendered attributes for the apply button;
 *     secondary = extra outline action (e.g. "Perbaiki isian").
 *     The panel itself is not a live region: hosts announce a short
 *     summary (ocrSummary) once, when a new result arrives.
 * @return {!Object} SafeHtml
 */
export function ocrPanel({ id, title, fileName = '', fields, perluPeriksa,
  ambang = 0.85, apply, secondary }) {
  const hasCompare = fields.some((f) => f.isian !== undefined);
  const mismatches = fields.filter((f) => f.cocok === false);
  return html`<section id="${id}" aria-labelledby="${id}-title"
      class="grid gap-3 rounded-box border border-info/20 bg-info/10 p-4
        animate-fade-in">
    <div class="flex flex-wrap items-baseline justify-between gap-2">
      <h3 id="${id}-title" class="text-sm font-bold">${title}</h3>
      ${fileName ? html`<span class="truncate text-xs
        text-base-content/70">${fileName}</span>` : ''}
    </div>
    ${perluPeriksa ? html`<p class="rounded-field border
        border-warning/30 bg-warning/10 px-3 py-2 text-[13px] font-semibold
        text-base-content/80"><span class="text-warning">Periksa kembali.</span>
      Sebagian teks terbaca dengan keyakinan di bawah
      ${percent.format(ambang)}; cocokkan dengan dokumen asli.</p>` : ''}
    ${mismatches.length ? html`<p class="rounded-field border
        border-error/30 bg-error/10 px-3 py-2 text-[13px] font-semibold
        text-error">${mismatches.length} isian berbeda dengan dokumen:
      ${mismatches.map((f) => f.label).join(', ')}.</p>` : ''}
    <div class="overflow-x-auto rounded-field border border-base-300
        bg-base-100">
      <table class="table table-sm text-[13px]">
        <caption class="sr-only">Hasil pembacaan ${title}</caption>
        <thead><tr class="bg-base-200/50 text-xs font-bold
            text-base-content/70">
          <th scope="col">Field</th><th scope="col">Hasil baca</th>
          ${hasCompare ? html`<th scope="col">Isian formulir</th>` : ''}
          <th scope="col">Keyakinan</th></tr></thead>
        <tbody>${fields.map((f) => html`<tr>
          <th scope="row" class="font-medium text-base-content/70">
            ${f.label}</th>
          <td class="font-semibold">${f.nilai}</td>
          ${hasCompare ? html`<td class="${f.cocok === false
            ? 'font-semibold text-error' : ''}">${f.isian || '—'}
            ${f.cocok === false ? html`<span class="block text-[11px]">
              Tidak cocok</span>` : ''}</td>` : ''}
          <td>${confidenceBadge(f.keyakinan, ambang)}</td></tr>`)}</tbody>
      </table>
    </div>
    ${apply || secondary ? html`<div class="flex flex-wrap justify-end gap-2">
      ${secondary ? html`<button type="button" class="btn btn-sm btn-outline"
        ${secondary.attrs}>${secondary.label}</button>` : ''}
      ${apply ? html`<button type="button" class="btn btn-sm btn-primary"
        ${apply.attrs}>${apply.label ?? 'Terapkan ke formulir'}</button>`
        : ''}</div>` : ''}
  </section>`;
}

/**
 * One-line summary for a host's sr-only role="status" region.
 * @param {string} title Panel title (e.g. "Hasil baca paspor").
 * @param {{perluPeriksa: boolean, fields: !Array<{cocok: (boolean|undefined)}>}} result
 * @return {string}
 */
export function ocrSummary(title, { perluPeriksa, fields }) {
  const mismatches = fields.filter((f) => f.cocok === false).length;
  return [`${title} siap`,
    perluPeriksa ? 'sebagian perlu diperiksa kembali' : '',
    mismatches ? `${mismatches} isian berbeda dengan dokumen` : '',
  ].filter(Boolean).join('; ') + '.';
}
