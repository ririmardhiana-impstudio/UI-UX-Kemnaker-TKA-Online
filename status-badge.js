/**
 * @fileoverview Status pill used by every list (HPK, pengesahan, billing,
 * tiket, antrian, ...). Data tones from TKA_DATA map to DaisyUI soft
 * badges: green -> success, blue -> info, amber -> warning, red -> error,
 * gray -> neutral soft.
 */

import { html } from './dom.js';

/** Tone -> DaisyUI badge modifier. */
export const TONE_BADGE_CLASS = {
  green: 'badge-success',
  blue: 'badge-info',
  amber: 'badge-warning',
  red: 'badge-error',
  gray: 'text-base-content/70',
};

/** Tone -> text color (step labels, inline status text). */
export const TONE_TEXT_CLASS = {
  green: 'text-success',
  blue: 'text-info',
  amber: 'text-warning',
  red: 'text-error',
  gray: 'text-base-content/70',
};

/** Tone -> soft background (callouts, icon circles). */
export const TONE_SOFT_BG_CLASS = {
  green: 'bg-success/10',
  blue: 'bg-info/10',
  amber: 'bg-warning/10',
  red: 'bg-error/10',
  gray: 'bg-base-200',
};

const BASE_CLASS =
  'badge badge-soft badge-sm h-auto border-transparent py-1 font-bold ' +
  'leading-snug';

/**
 * Class list for a status badge.
 * @param {string} tone green | blue | amber | red | gray
 * @return {string}
 */
export function statusBadgeClass(tone) {
  return `${BASE_CLASS} ${TONE_BADGE_CLASS[tone] ?? TONE_BADGE_CLASS.gray}`;
}

/**
 * Status badge markup (escaped). Usage: html`<td>${statusBadge(s, t)}</td>`
 * @param {string} label
 * @param {string} tone
 * @return {!Object} SafeHtml
 */
export function statusBadge(label, tone) {
  return html`<span class="${statusBadgeClass(tone)}">${label}</span>`;
}

/**
 * Status badge as a DOM element (for <template> based rendering).
 * @param {string} label
 * @param {string} tone
 * @return {!HTMLSpanElement}
 */
export function createStatusBadge(label, tone) {
  const el = document.createElement('span');
  el.className = statusBadgeClass(tone);
  el.textContent = label;
  return el;
}
