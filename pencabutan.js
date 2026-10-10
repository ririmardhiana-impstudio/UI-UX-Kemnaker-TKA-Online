/**
 * @fileoverview Pencabutan Pengesahan RPTKA per TKA (pemberi kerja): daftar
 * pengajuan (No | No HPK | Tgl Pengajuan | Nomor RPTKA | Jenis Pencabutan |
 * Status) + form bertahap (pencabutan-form.js). Submit -> antrean
 * Verifikator (AK-24, `POST /pencabutan`); Draf dapat dilanjutkan; yang
 * ditolak dapat diajukan kembali. Sesi form: pencabutan-data.js.
 */

import { resubmitPengajuan } from '../../api/pengajuan-verifikasi.js';
import { html } from '../../components/dom.js';
import { emptyState } from '../../components/empty-state.js';
import { statusBadge } from '../../components/status-badge.js';
import { reloadCollection } from './data.js';
import { DRAF, load, riwayat } from './pencabutan-data.js';
import { formActions, mountForm, renderForm } from './pencabutan-form.js';
import { refreshView, state } from './state.js';
import {
  BTN, CARD, LINK, THEAD, cardHeader, mountPaged, navAttrs, pageTitle,
  pagerSlot, toast,
} from './ui.js';

export { load };

const inForm = () => Boolean(state.p.baru || state.p.id);

function aksi(x) {
  if (!x.id) {
    return '';
  }
  const draf = x.status === DRAF;
  const lagi = x.verif === 'Perbaikan'
    ? html`<button type="button" class="btn btn-xs btn-primary ms-2"
      data-action="cabut-resubmit" data-id="${x.id}">Ajukan kembali</button>`
    : '';
  return html`<button type="button" class="${LINK} text-xs"
    ${navAttrs('pencabutan', { id: x.id })}
    aria-label="${draf ? 'Lanjutkan' : 'Lihat'} ${x.noPermohonan}">${draf
    ? 'Lanjutkan' : 'Lihat'}</button>${lagi}`;
}

function baris(x) {
  return html`<tr>
    <td class="font-mono font-bold">${x.noPermohonan ?? '—'}</td>
    <td>${x.noHpk ?? '—'}</td>
    <td>${x.tglAjuan ?? '—'}</td>
    <td class="font-mono">${x.skNo ?? x.barcode ?? '—'}
      <p class="font-sans text-xs text-base-content/60">${x.nama}</p></td>
    <td>${x.jenis ?? x.alasan}</td>
    <td>${statusBadge(x.status, x.tone)}${x.verif === 'Perbaikan' &&
      x.verifAlasan ? html`<p class="mt-1 text-xs text-error">Alasan
      penolakan: ${x.verifAlasan}</p>` : ''}</td>
    <td class="text-right whitespace-nowrap">${aksi(x)}</td></tr>`;
}

function renderList() {
  const add = html`<button type="button" class="${BTN}"
    ${navAttrs('pencabutan', { baru: 1 })}
    data-testid="pencabutan-btn-ajukan">+ Ajukan Pencabutan</button>`;
  const rows = riwayat();
  return html`${pageTitle({ title: 'Pencabutan Pengesahan RPTKA',
    desc: 'Ajukan pencabutan Pengesahan RPTKA per TKA: pilih jenis ' +
      'pencabutan, lengkapi data isian dan dokumen. Hasilnya SK Pencabutan.',
    actions: add })}
    ${rows.length ? html`<section class="${CARD} overflow-hidden"
        aria-label="Pengajuan Pencabutan RPTKA" data-testid="pencabutan-list">
      ${cardHeader('Pengajuan Pencabutan RPTKA')}
      <div class="overflow-x-auto"><table class="table min-w-[860px]
          text-[13px]"><caption class="sr-only">Draft dan pengajuan
        Pencabutan RPTKA</caption><thead><tr class="${THEAD}">
        <th scope="col">No</th><th scope="col">No HPK</th>
        <th scope="col">Tgl Pengajuan</th><th scope="col">Nomor RPTKA</th>
        <th scope="col">Jenis Pencabutan</th><th scope="col">Status</th>
        <th scope="col" class="text-right">Aksi</th></tr></thead>
        <tbody id="cabut-body"></tbody></table></div>
      ${pagerSlot('cabut-pager')}</section>`
    : emptyState({ icon: '▤', title: 'Belum ada pengajuan',
      body: 'Draft dan pengajuan pencabutan RPTKA akan tampil di sini.',
      action: { label: 'Ajukan Pencabutan',
        attrs: navAttrs('pencabutan', { baru: 1 }) } })}`;
}

/** pencabutan view: daftar, atau form bila ?baru / ?id. */
export function render() {
  return inForm() ? renderForm() : renderList();
}

/** @param {!Element} root */
export function mount(root) {
  if (inForm()) {
    mountForm(root);
    return;
  }
  mountPaged(root, { body: '#cabut-body', footer: '#cabut-pager',
    items: riwayat(), row: baris });
}

async function ajukanKembali(button) {
  button.disabled = true;
  try {
    const row = await resubmitPengajuan('pencabutan', button.dataset.id);
    await reloadCollection('pencabutan');
    toast(row?.status === 'Diteruskan ke Validator'
      ? 'Pencabutan diajukan kembali langsung ke Validator.'
      : 'Pencabutan diajukan kembali ke Verifikator.');
  } catch (error) {
    button.disabled = false;
    toast(error.message, 'error');
  }
  refreshView();
}

export const actions = {
  ...formActions,
  'cabut-resubmit': ajukanKembali,
};
