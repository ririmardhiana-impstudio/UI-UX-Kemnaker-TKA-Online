/**
 * @fileoverview Dialog konfirmasi Form RPTKA (submit, ganti HPK, hapus
 * jabatan): judul + isi + Batal + satu tombol aksi di `portal-modal`.
 */

import { html, raw } from '../../components/dom.js';
import { MODAL } from './rptka-data.js';
import { BTN, BTN_OUTLINE, openDialog } from './ui.js';

/**
 * @param {{judul: string, isi: string, ok: string, action: string,
 *     data: (!Object<string, string>|undefined), danger: (boolean|undefined),
 *     testid: (string|undefined)}} options
 */
export function confirmDialog({ judul, isi, ok, action, data = {},
  danger = false, testid = '' }) {
  const attrs = Object.entries(data).map(([k, v]) =>
    `data-${k}="${String(v).replace(/[^\w.-]/g, '')}"`);
  openDialog(MODAL, html`<div class="grid gap-3 px-6 py-6">
    <h2 class="text-base font-bold">${judul}</h2>
    <p class="text-sm text-base-content/80">${isi}</p>
    <div class="flex justify-end gap-2.5"><button type="button"
      class="${BTN_OUTLINE}" data-action="close-modal">Batal</button>
      <button type="button" class="${danger ? 'btn btn-error' : BTN}"
        data-action="${action}" data-testid="${testid}"
        ${raw(attrs.join(' '))}>${ok}</button></div></div>`, 'max-w-md');
}
