/**
 * @fileoverview Legacy-regime services (Sisa RPTKA Lama, Sisa Notifikasi,
 * Peralihan, Start-up / Vokasi). Rows come from GET /legacy (fixture +
 * genLegacy) and are loaded when the view opens.
 */

import { html } from '../../components/dom.js';
import { loadLegacyRows } from './data.js';
import { state } from './state.js';
import {
  BTN, BTN_OUTLINE, CALLOUT_INFO, CARD, THEAD, mountPaged, noopAttrs,
  pageTitle, pagerSlot,
} from './ui.js';

const GROUP_DESC = {
  'Sisa RPTKA Lama': 'Layanan rezim sebelum PP 34/2021 untuk RPTKA lama yang masih berlaku.',
  'Sisa Notifikasi': 'Notifikasi/IMTA rezim lama yang masih berjalan. IMTA sudah tidak diterbitkan lagi.',
  'Peralihan': 'Menerbitkan Pengesahan RPTKA dari RPTKA lama yang masih berlaku, tanpa HPK baru.',
  'Start-up / Vokasi': 'Surat penggunaan TKA tanpa Pengesahan RPTKA, paling lama 3 bulan, diterbitkan Direktur.',
};
const PENARIKAN_DOCS = ['Surat permohonan', 'Surat kuasa', 'SK Pencabutan',
  'Bukti setor DKPTKA', 'Bukti TKA batal datang',
  'Rekening bank USD atas nama pemberi kerja', 'NPWP'];
const STARTUP_STEPS = [
  ['1 · Isi data calon TKA', 'Tanpa HPK dan tanpa Pengesahan RPTKA.'],
  ['2 · Verifikasi petugas', 'Kelengkapan data dan dokumen.'],
  ['3 · Surat penggunaan TKA', 'Diterbitkan Direktur, berlaku maks. 3 bulan.'],
];

function rowsKey() {
  return `legacy:${state.p.grp}:${state.p.layanan ?? ''}`;
}

/** Fetch rows before render. */
export function load() {
  return loadLegacyRows(state.p.grp, state.p.layanan ?? '');
}

function row(x) {
  return html`<tr>
    <td class="font-mono text-xs font-bold">${x.a}</td><td>${x.b}</td>
    <td>${x.c}</td><td class="text-base-content/70">${x.d}</td>
    <td class="text-right"><button type="button" class="${BTN_OUTLINE}
      btn-sm text-xs" ${noopAttrs(`Cetak ${x.a}`)}>Cetak</button></td></tr>`;
}

/** legacy view. */
export function render() {
  const { grp, layanan } = state.p;
  const isStartup = grp === 'Start-up / Vokasi';
  const add = isStartup ? html`<button type="button" class="${BTN}"
    ${noopAttrs('Tambah Baru')}>+ Tambah Baru</button>` : '';
  return html`
    ${pageTitle({ eyebrow: grp, title: layanan ?? '',
      desc: GROUP_DESC[grp] ?? '', actions: add })}
    ${isStartup ? html`<ol class="${CARD} grid gap-4 p-5.5 text-[13px]
        leading-relaxed md:grid-cols-3">${STARTUP_STEPS.map(([t, d]) => html`
      <li><b class="mb-1 block">${t}</b>${d}</li>`)}</ol>` : ''}
    ${layanan === 'Penarikan' ? html`<section class="${CARD} p-5.5 text-[13px]
        leading-7"><h2 class="text-[15px] font-bold">Syarat penarikan DKPTKA
      </h2><ul class="mt-2 grid gap-x-5 gap-y-1 text-base-content/80
        md:grid-cols-2">${PENARIKAN_DOCS.map((d) => html`<li>• ${d}</li>`)}
      </ul></section>` : ''}
    <p class="${CALLOUT_INFO}">Layanan warisan rezim sebelum PP 34/2021. Hanya
      menampilkan dokumen yang masih memiliki data aktif pada akun Anda.</p>
    <section class="${CARD} overflow-hidden">
      <div class="overflow-x-auto"><table class="table min-w-[900px]
          text-[13px]"><thead><tr class="${THEAD}"><th>Nomor dokumen</th>
          <th>Jenis</th><th>Jabatan</th><th>Masa berlaku</th>
          <th class="w-[110px]"><span class="sr-only">Aksi</span></th></tr>
        </thead><tbody id="lg-body"></tbody></table></div>
      ${pagerSlot('lg-pager')}</section>`;
}

/** @param {!Element} root */
export function mount(root) {
  mountPaged(root, {
    body: '#lg-body', footer: '#lg-pager',
    items: state.extra[rowsKey()] ?? [], row,
    empty: html`<tr><td colspan="5" class="p-10 text-center text-sm
      text-base-content/60">Tidak ada data aktif untuk layanan ini.</td></tr>`,
  });
}
