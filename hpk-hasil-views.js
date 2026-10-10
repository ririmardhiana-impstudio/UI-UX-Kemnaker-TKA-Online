/**
 * @fileoverview Static markup of the HPK menu kept apart from the form /
 * detail logic: legenda sumber data.
 */

import { html } from '../../components/dom.js';

/** Legend explaining the red / blue / black convention of the form. */
export const LEGEND = html`<dl class="grid gap-2 text-xs text-base-content/70
    md:grid-cols-2">
  <div><dt class="font-bold text-base-content">Isian</dt><dd><span
    class="font-bold text-error">Merah</span> = otomatis dari OSS (tidak
    perlu diisi) · <span class="font-bold text-base-content">Hitam</span> =
    perlu diisi.</dd></div>
  <div><dt class="font-bold text-base-content">Dokumen</dt><dd><span
    class="font-bold text-error">Merah</span> = data dari OSS · <span
    class="font-bold text-secondary">Biru</span> = berkas di OSS (cukup
    lihat file) · <span class="font-bold text-base-content">Hitam</span> =
    perlu diunggah.</dd></div></dl>`;
