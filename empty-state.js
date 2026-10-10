/**
 * @fileoverview Empty state block for lists and filtered results (operator,
 * notifikasi, audit log, surat keterangan, ...). Icon + title + body + an
 * optional call to action rendered as a real <button type="button">.
 */

import { html } from './dom.js';

/**
 * @param {{title: string, body: (string|undefined), icon: (string|undefined),
 *     action: ({label: string, attrs: (*|undefined)}|undefined)}} options
 *     action.attrs = pre-rendered attributes (e.g. raw('data-action="x"')).
 * @return {!Object} html`` fragment.
 */
export function emptyState({ title, body = '', icon = '○', action } = {}) {
  return html`<div role="status"
      class="grid justify-items-center gap-2 rounded-box border border-dashed
        border-base-300 bg-base-200/50 px-6 py-10 text-center">
    <span aria-hidden="true" class="grid size-11 place-items-center
      rounded-full bg-base-100 text-lg text-base-content/60">${icon}</span>
    <p class="text-sm font-bold text-base-content">${title}</p>
    ${body ? html`<p class="max-w-md text-[13px] text-base-content/70">
      ${body}</p>` : ''}
    ${action ? html`<button type="button" ${action.attrs ?? ''}
      class="btn btn-sm btn-primary mt-2">${action.label}</button>` : ''}
  </div>`;
}
