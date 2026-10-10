/**
 * @fileoverview Pin position helpers for document annotations
 * (annotation-view.js): 3×3 page regions as the keyboard alternative to
 * clicking the preview, the position sentence and percent clamping.
 */

import { html } from '../../components/dom.js';

const AXIS_X = [['Kiri', 17], ['Tengah', 50], ['Kanan', 83]];
const AXIS_Y = [['atas', 17], ['tengah', 50], ['bawah', 83]];
/** Keyboard pin positions: 3×3 regions of the page ("Kiri atas" …). */
const REGIONS = AXIS_Y.flatMap(([vy, y]) => AXIS_X.map(([vx, x]) => ({
  value: `${x},${y}`, x, y,
  label: vx === 'Tengah' && vy === 'tengah' ? 'Tengah' : `${vx} ${vy}`,
})));

/**
 * Position sentence under the form (live region).
 * @param {{halaman: string, x: number, y: number, placed: boolean}} draft
 * @param {number} previewPage Page shown by the static preview.
 * @return {string}
 */
export function positionText(draft, previewPage) {
  if (Number(draft.halaman) !== previewPage) {
    return `halaman ${draft.halaman || '?'} tidak dipratinjau; pin ` +
      `disimpan di ${draft.x}% × ${draft.y}% tanpa ditampilkan`;
  }
  return draft.placed ? `pin di ${draft.x}% × ${draft.y}% dari pratinjau`
    : 'pin di tengah halaman (klik pratinjau atau pilih bagian halaman)';
}

/**
 * "Bagian halaman" select: the keyboard path for the pin position.
 * @param {{x: number, y: number}} draft
 * @return {!Object} SafeHtml
 */
export function regionSelect(draft) {
  const match = REGIONS.find((r) => r.x === draft.x && r.y === draft.y);
  return html`<div class="sm:col-span-2">
    <label for="ann-bagian" class="text-xs font-bold">Bagian halaman</label>
    <select id="ann-bagian" name="bagian" data-focus-key="ann-bagian"
      class="select select-sm mt-1 w-full" aria-describedby="ann-position">
      ${match ? '' : html`<option value="" selected>Sesuai klik pratinjau
        (${draft.x}% × ${draft.y}%)</option>`}
      ${REGIONS.map((r) => html`<option value="${r.value}"
        ${r === match ? 'selected' : ''}>${r.label}</option>`)}
    </select></div>`;
}

/** 0–1 ratio -> integer percent 0–100. */
export function clampPercent(ratio) {
  return Math.min(100, Math.max(0, Math.round(ratio * 100)));
}
