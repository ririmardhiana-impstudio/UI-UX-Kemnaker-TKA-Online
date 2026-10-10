/**
 * @fileoverview Kemnaker logo tile + product name ("TKA Online"), as used
 * in every legacy header/sidebar.
 *
 * Usage: setHtml(qs('#brand'), brand({ subtitle: 'Pemberi Kerja' }));
 */

import { html } from './dom.js';

export const LOGO_SRC = 'uploads/kemnaker_new.svg';

const SIZES = {
  sm: { tile: 'rounded-lg p-1', img: 'size-6.5', title: 'text-base' },
  md: { tile: 'rounded-lg p-1.5', img: 'size-7', title: 'text-base' },
  lg: { tile: 'rounded-xl p-1.5', img: 'size-8.5', title: 'text-lg' },
};

/**
 * @param {{title: (string|undefined), subtitle: (string|undefined),
 *     href: (string|undefined), size: (string|undefined)}=} options
 *     size: sm (Hotline/Back Office) | md (Portal) | lg (Index/Landing).
 *     Text inherits color from the parent (dark header = light text).
 * @return {!Object} SafeHtml
 */
export function brand(options = {}) {
  const size = SIZES[options.size ?? 'md'];
  const title = options.title ?? 'TKA Online';
  const inner = html`
    <span class="grid shrink-0 bg-base-100 ${size.tile}">
      <img src="${LOGO_SRC}" alt="Logo Kementerian Ketenagakerjaan"
           class="${size.img} object-contain" width="28" height="27">
    </span>
    <span class="grid leading-tight">
      <b class="${size.title}">${title}</b>
      ${options.subtitle
        ? html`<span class="text-xs font-medium opacity-70">
            ${options.subtitle}</span>`
        : ''}
    </span>`;
  const cls = 'flex items-center gap-2.5 no-underline';
  return options.href
    ? html`<a href="${options.href}" class="${cls}">${inner}</a>`
    : html`<span class="${cls}">${inner}</span>`;
}
