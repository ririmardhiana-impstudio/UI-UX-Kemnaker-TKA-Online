/**
 * @fileoverview Tab Preview Pencabutan RPTKA: ringkasan Data Isian +
 * dokumen, daftar kekurangan menurut validator submit, dan (untuk
 * pengajuan yang sudah terkirim) status + alasan penolakan Verifikator.
 */

import { html } from '../../components/dom.js';
import { statusBadge } from '../../components/status-badge.js';
import {
  pencabutanDokumen, validatePencabutanSubmit,
} from '../../contracts/pengajuan-verifikasi.js';
import { editable, riwayat, tkaOf, toBody } from './pencabutan-data.js';
import { state } from './state.js';
import { BTN_OUTLINE, CALLOUT_WARN } from './ui.js';

/** Baris ringkasan untuk dialog "Preview Dokumen" (bukan dokumen resmi). */
export function ringkasanRows(S) {
  const t = tkaOf(S.w.barcode);
  const dokumen = pencabutanDokumen(S.w.jenis)
    .map((d) => `${d}${S.w.dokumen[d] ? ' ✓' : ' ✗'}`).join(', ');
  return [['Pemberi kerja', state.data.company.nama],
    ['Jenis pencabutan', S.w.jenis || '—'], ['Nomor RPTKA', t?.skNo ?? '—'],
    ['Nama TKA', t?.nama ?? '—'], ['Paspor', t?.paspor ?? '—'],
    ['Jabatan', t?.jabatan ?? '—'], ['Alasan pencabutan', S.w.alasan || '—'],
    ['Dokumen', dokumen]];
}

function statusCard(S) {
  const baris = riwayat().find((x) => x.id === S.w.id);
  if (!baris) {
    return '';
  }
  return html`<div class="grid gap-1.5 rounded-box border border-base-300
      bg-base-100 px-5 py-4"><p class="text-sm font-bold">Status:
      ${statusBadge(baris.status, baris.tone)}</p>
    ${S.w.verifAlasan ? html`<p class="text-[13px] text-error">Alasan
      penolakan: ${S.w.verifAlasan}</p>` : ''}</div>`;
}

export function panelPreview(S) {
  const ro = !editable(S);
  const kurang = ro ? {} : validatePencabutanSubmit(toBody(S, false)).errors;
  return html`${ro ? statusCard(S) : ''}
    ${Object.keys(kurang).length ? html`<div class="${CALLOUT_WARN}"
      role="status"><b>Belum lengkap untuk disubmit:</b><ul
      class="mt-1 list-disc ps-5">${Object.values(kurang).map((m) => html`
      <li>${m}</li>`)}</ul></div>` : ''}
    <dl class="grid gap-x-5 gap-y-2 rounded-box border border-base-300
      bg-base-100 px-5 py-4 text-sm md:grid-cols-[200px_1fr]">
      ${ringkasanRows(S).map(([k, v]) => html`<dt class="text-base-content/70">
        ${k}</dt><dd class="font-semibold">${v}</dd>`)}</dl>
    <div class="flex justify-end"><button type="button" class="${BTN_OUTLINE}"
      data-action="cabut-preview-ringkasan"
      data-testid="pencabutan-btn-preview-doc">Preview Dokumen</button></div>`;
}
