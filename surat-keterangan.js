/**
 * @fileoverview Surat Keterangan (KAK use case "Surat Keterangan", page key
 * "suratKeterangan"): list with status filter + empty state, request form
 * (GET/POST /surat-keterangan?role=), detail with status riwayat and a
 * printable preview once Terbit. Params: {baru: 1} = form, {id} = detail.
 * Jenis surat are usulan [I] pending confirmation by Direktorat PPTKA.
 */

import {
  createSuratKeterangan, getSuratKeterangan, listSuratKeterangan,
} from '../../api/siklus.js';
import { LOGO_SRC } from '../../components/brand.js';
import { html, qs, raw, setHtml } from '../../components/dom.js';
import { emptyState } from '../../components/empty-state.js';
import { statusBadge } from '../../components/status-badge.js';
import {
  SURAT_KETERANGAN_BERBASIS_SK, SURAT_KETERANGAN_JENIS,
  SURAT_KETERANGAN_STATUS, validateSuratKeterangan,
} from '../../contracts/siklus.js';
import { withRetry } from './data.js';
import { go, state } from './state.js';
import {
  BTN, BTN_OUTLINE, CALLOUT_INFO, CARD, LINK, THEAD, dialogClose,
  fieldError, mountPaged, navAttrs, noopAttrs, openDialog, pageTitle,
  pagerSlot, showErrors, textareaField, toast,
} from './ui.js';

const PAGE = 'suratKeterangan';
const MODAL = 'portal-modal';
const KEPERLUAN_MAX = 500;
const FILTERS = ['', ...Object.values(SURAT_KETERANGAN_STATUS)];
const STAMP = 'bg-[repeating-linear-gradient(90deg,var(--color-base-content)_0_3px,var(--color-base-100)_3px_6px)]';
const DT = 'text-base-content/70';

/** Cached list / detail live in state.extra (reset on role switch). */
function cache() {
  state.extra.sket ??= { list: null, detail: null, filter: '' };
  return state.extra.sket;
}

/** VIEWS[PAGE].load — fetch the list or the opened detail once. */
export async function load() {
  const c = cache();
  const role = state.role;
  if (state.p.id) {
    if (c.detail?.id !== state.p.id) {
      c.detail = await withRetry(() => getSuratKeterangan(role, state.p.id));
    }
  } else if (!state.p.baru && !c.list) {
    c.list = await withRetry(() => listSuratKeterangan(role));
  }
}

function backLink() {
  return html`<button type="button" class="${LINK} text-[13px]"
    ${navAttrs(PAGE)}>← Daftar surat keterangan</button>`;
}

function listRow(s) {
  return html`<tr>
    <td class="font-mono font-bold">${s.noPermohonan}</td>
    <td>${s.jenis}<p class="text-xs text-base-content/70">${s.keperluan}</p>
    </td>
    <td>${s.barcode ? html`<span class="font-mono">${s.barcode}</span><p
      class="text-xs text-base-content/70">${s.namaTka}</p>` : '—'}</td>
    <td class="text-[13px]">${s.diajukan}</td>
    <td>${statusBadge(s.status, s.tone)}</td>
    <td class="text-right"><button type="button" class="${LINK} text-xs"
      ${navAttrs(PAGE, { id: s.id })}
      aria-label="Detail ${s.noPermohonan}">Detail</button></td></tr>`;
}

function renderList() {
  const c = cache();
  const add = html`<button type="button" class="${BTN}"
    ${navAttrs(PAGE, { baru: 1 })} data-testid="sket-btn-ajukan">+ Ajukan
    surat keterangan</button>`;
  const intro = pageTitle({ title: 'Surat Keterangan',
    desc: 'Ajukan surat keterangan terkait Pengesahan RPTKA atau pelaporan TKA. Surat terbit secara elektronik setelah diproses petugas.',
    actions: add });
  if (!c.list.length) {
    return html`${intro}${emptyState({ icon: '✉',
      title: 'Belum ada permohonan surat keterangan',
      body: 'Permohonan yang Anda ajukan akan tampil di sini beserta statusnya.',
      action: { label: 'Ajukan surat keterangan',
        attrs: navAttrs(PAGE, { baru: 1 }) } })}`;
  }
  return html`${intro}
    <div class="flex flex-wrap items-center gap-2">
      <label for="sket-filter" class="text-sm font-bold">Status</label>
      <select id="sket-filter" class="select select-sm h-9 w-auto">
        ${FILTERS.map((f) => html`<option value="${f}"
          ${f === c.filter ? 'selected' : ''}>${f || 'Semua'}</option>`)}
      </select></div>
    <section class="${CARD} overflow-hidden">
      <div id="sket-table" class="overflow-x-auto"><table
          class="table min-w-[900px]
          text-[13px]"><thead><tr class="${THEAD}">
          <th class="w-[150px]">No. permohonan</th><th>Jenis / keperluan</th>
          <th class="w-[150px]">SK Pengesahan</th>
          <th class="w-[140px]">Diajukan</th><th class="w-[110px]">Status</th>
          <th class="w-[80px]"><span class="sr-only">Aksi</span></th>
        </tr></thead><tbody id="sket-body"></tbody></table></div>
      <div id="sket-empty" hidden></div>
      ${pagerSlot('sket-pager')}</section>`;
}

function mountList(root) {
  const select = qs('#sket-filter', root);
  if (!select) {
    return;
  }
  const draw = () => {
    const c = cache();
    const items = c.list.filter((s) => !c.filter || s.status === c.filter);
    const empty = qs('#sket-empty', root);
    empty.hidden = items.length > 0;
    qs('#sket-table', root).hidden = !items.length;
    mountPaged(root, { body: '#sket-body', footer: '#sket-pager', items,
      row: listRow });
    qs('#sket-pager', root).hidden = !items.length;
    setHtml(empty, items.length ? html`` : emptyState({
      title: 'Tidak ada hasil',
      body: `Tidak ada permohonan berstatus ${c.filter}.`,
      action: { label: 'Tampilkan semua', attrs: raw('data-sket-reset') } }));
  };
  const applyFilter = (value) => {
    cache().filter = value;
    select.value = value;
    const footer = qs('#sket-pager', root);
    footer.replaceWith(footer.cloneNode(false));
    draw();
  };
  draw();
  select.addEventListener('change', () => applyFilter(select.value));
  qs('#sket-empty', root).addEventListener('click', (event) => {
    if (event.target.closest('[data-sket-reset]')) {
      applyFilter('');
      select.focus();
    }
  });
}

function tkaOptions() {
  return state.data.tka.filter((t) => !t.dicabut);
}

function renderForm() {
  /* The first jenis is preselected by the <select>. */
  const needsSk = SURAT_KETERANGAN_BERBASIS_SK
    .includes(SURAT_KETERANGAN_JENIS[0]);
  return html`${pageTitle({ back: backLink(),
    title: 'Ajukan Surat Keterangan' })}
    <form id="sket-form" novalidate class="${CARD} grid max-w-3xl gap-4 px-5
        py-6 md:px-7">
      <div class="grid gap-1.5">
        <label for="sket-jenis" class="text-sm font-bold">Jenis surat
          keterangan</label>
        <select id="sket-jenis" name="jenis" class="select h-11 w-full"
            required aria-describedby="sket-jenis-hint sket-jenis-error">
          ${SURAT_KETERANGAN_JENIS.map((j) => html`<option>${j}</option>`)}
        </select>
        <p id="sket-jenis-hint" class="text-xs text-base-content/70">Daftar
          jenis surat masih usulan dan menunggu konfirmasi Direktorat
          PPTKA.</p>${fieldError('sket-jenis')}</div>
      <div id="sket-barcode-wrap" class="grid gap-1.5"
          ${needsSk ? '' : 'hidden'}>
        <label for="sket-barcode" class="text-sm font-bold">SK Pengesahan
          RPTKA (TKA)</label>
        <select id="sket-barcode" name="barcode" class="select h-11 w-full"
            aria-describedby="sket-barcode-error">
          <option value="">Pilih TKA</option>
          ${tkaOptions().map((t) => html`<option value="${t.barcode}">
            ${t.barcode} · ${t.nama} · ${t.jabatan}</option>`)}
        </select>${fieldError('sket-barcode')}</div>
      ${textareaField({ id: 'sket-keperluan', label: 'Keperluan', rows: 4,
        max: KEPERLUAN_MAX, min: 10,
        placeholder: 'Contoh: persyaratan perpanjangan izin tinggal di Kantor Imigrasi' })}
      <p id="sket-form-error" role="alert" class="text-sm font-semibold
        text-error" hidden></p>
      <div class="flex justify-end gap-2.5">
        <button type="button" class="${BTN_OUTLINE}" ${navAttrs(PAGE)}>Batal
        </button>
        <button type="submit" class="${BTN}" data-testid="sket-btn-kirim">
          Ajukan</button></div></form>`;
}

const ERROR_ID = { jenis: 'sket-jenis', barcode: 'sket-barcode',
  keperluan: 'sket-keperluan' };

function toFieldErrors(errors) {
  const out = {};
  for (const [key, message] of Object.entries(errors)) {
    out[ERROR_ID[key] ?? 'sket-form'] ??= message;
  }
  return out;
}

async function submitForm(form) {
  const jenis = qs('#sket-jenis', form).value;
  const body = { jenis, keperluan: qs('#sket-keperluan', form).value.trim() };
  if (SURAT_KETERANGAN_BERBASIS_SK.includes(jenis)) {
    body.barcode = qs('#sket-barcode', form).value || undefined;
  }
  if (showErrors(form, toFieldErrors(validateSuratKeterangan(body).errors))) {
    return;
  }
  const button = qs('[type="submit"]', form);
  button.disabled = true;
  form.setAttribute('aria-busy', 'true');
  try {
    const item = await createSuratKeterangan(state.role, body);
    Object.assign(cache(), { list: null, detail: item });
    toast(`Permohonan ${item.noPermohonan} diajukan.`);
    go(PAGE, { id: item.id });
  } catch (error) {
    button.disabled = false;
    form.removeAttribute('aria-busy');
    const fields = error.field ? toFieldErrors({ [error.field]: error.message })
      : { 'sket-form': error.message };
    showErrors(form, fields);
  }
}

function mountForm(root) {
  const form = qs('#sket-form', root);
  form.addEventListener('change', (event) => {
    if (event.target.id === 'sket-jenis') {
      qs('#sket-barcode-wrap', form).hidden =
        !SURAT_KETERANGAN_BERBASIS_SK.includes(event.target.value);
    }
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submitForm(form);
  });
}

function riwayatList(riwayat) {
  return html`<ol class="grid gap-3" aria-label="Riwayat status">
    ${riwayat.map((r, i) => html`<li class="grid grid-cols-[20px_1fr] gap-3">
      <span class="mt-1 size-3 rounded-full ${i === riwayat.length - 1
        ? 'bg-secondary' : 'bg-base-300'}" aria-hidden="true"></span>
      <div><p class="text-sm font-bold">${r.status}
        <span class="font-medium text-base-content/70">· ${r.tgl}</span></p>
        <p class="text-xs text-base-content/70">${r.oleh}</p>
        ${r.catatan ? html`<p class="mt-0.5 text-[13px]
          text-base-content/80">${r.catatan}</p>` : ''}</div></li>`)}</ol>`;
}

function renderDetail() {
  const s = cache().detail;
  const co = state.data.company;
  const preview = s.status === SURAT_KETERANGAN_STATUS.TERBIT
    ? html`<button type="button" class="${BTN}" data-action="sket-preview"
        data-testid="sket-btn-pratinjau">Pratinjau surat</button>` : '';
  return html`${pageTitle({ back: backLink(), title: s.noPermohonan,
    desc: s.jenis, actions: html`<div class="flex items-center gap-3">
      ${statusBadge(s.status, s.tone)}${preview}</div>` })}
    <div class="grid items-start gap-5 lg:grid-cols-[minmax(0,1.4fr)_1fr]">
      <section class="${CARD} grid gap-4 px-5 py-6 md:px-7">
        <h2 class="text-base font-bold">Data permohonan</h2>
        <dl class="grid gap-x-5 gap-y-2.5 text-sm md:grid-cols-[180px_1fr]">
          <dt class="${DT}">Pemberi kerja</dt><dd class="font-bold">${co.nama}
          </dd><dt class="${DT}">Keperluan</dt><dd>${s.keperluan}</dd>
          <dt class="${DT}">SK Pengesahan</dt><dd>${s.barcode
            ? `${s.barcode} · ${s.namaTka}` : '—'}</dd>
          <dt class="${DT}">Diajukan</dt><dd>${s.diajukan}</dd>
          ${s.nomorSurat ? html`<dt class="${DT}">Nomor surat</dt>
            <dd><span class="font-mono font-bold">${s.nomorSurat}</span> ·
            ${s.terbit}</dd>`
            : ''}</dl>
        ${s.status === SURAT_KETERANGAN_STATUS.DITOLAK ? html`<p
          class="rounded-box border border-error/30 bg-error/10 px-4 py-3.5
          text-sm text-base-content/80"><b>Alasan penolakan:</b>
          ${s.catatan}</p>` : ''}
        ${[SURAT_KETERANGAN_STATUS.DIAJUKAN, SURAT_KETERANGAN_STATUS.DIPROSES]
          .includes(s.status) ? html`<p class="${CALLOUT_INFO}">Permohonan
          sedang ditangani petugas. Anda akan menerima notifikasi saat surat
          terbit.</p>` : ''}</section>
      <section class="${CARD} grid gap-4 px-5 py-6">
        <h2 class="text-base font-bold">Riwayat status</h2>
        ${riwayatList(s.riwayat)}</section></div>`;
}

function letter(s) {
  const co = state.data.company;
  return html`<div class="flex flex-wrap items-center justify-between gap-2
      border-b border-base-300 px-6 py-4.5"><h2 class="font-bold">Surat
      Keterangan · ${s.nomorSurat}</h2><div class="flex items-center gap-2">
      <button type="button" class="${BTN} btn-sm" ${noopAttrs('Cetak')}>
        Cetak</button>${dialogClose()}</div></div>
    <div class="px-6 py-8 text-[13px] leading-relaxed text-base-content/80
        md:px-10">
      <div class="mb-4.5 text-center"><img src="${LOGO_SRC}"
        alt="Logo Kementerian Ketenagakerjaan"
        class="mx-auto h-12.5 w-13 object-contain">
        <p class="mt-2 font-extrabold">KEMENTERIAN KETENAGAKERJAAN REPUBLIK
          INDONESIA<br>SURAT KETERANGAN</p>
        <p>Nomor: ${s.nomorSurat}</p></div>
      <p class="mb-3">Direktur Pengendalian Penggunaan Tenaga Kerja Asing
        menerangkan bahwa:</p>
      <dl class="mb-3.5 grid grid-cols-[160px_1fr] gap-x-2.5 gap-y-0.5">
        <dt>Pemberi kerja</dt><dd class="font-bold">${co.nama}</dd>
        <dt>Alamat</dt><dd>${co.kab}, ${co.prov}</dd>
        ${s.barcode ? html`<dt>Nama TKA</dt><dd class="font-bold">
          ${s.namaTka}</dd><dt>Barcode Pengesahan</dt><dd>${s.barcode}</dd>`
          : ''}</dl>
      <p class="mb-3">perihal <b>${s.jenis}</b>, sesuai data pada sistem TKA
        Online per tanggal ${s.terbit}.</p>
      <p class="mb-5">Surat keterangan ini dibuat untuk keperluan:
        ${s.keperluan}</p>
      <div class="flex justify-end"><div class="text-center text-xs">
        ${raw('a.n. Direktur Jenderal<br>Direktur Pengendalian Penggunaan TKA')}
        <div class="mx-auto my-2.5 size-18 border-4 border-base-100
          opacity-85 outline outline-base-content ${STAMP}"
          aria-hidden="true"></div>Ditandatangani secara elektronik</div></div>
      <p class="mt-4 text-[11px] text-base-content/70">Pratinjau prototipe;
        format resmi surat menunggu ketetapan Direktorat PPTKA.</p></div>`;
}

/** suratKeterangan view. */
export function render() {
  if (state.p.baru) {
    return renderForm();
  }
  return state.p.id ? renderDetail() : renderList();
}

/** @param {!Element} root */
export function mount(root) {
  if (state.p.baru) {
    mountForm(root);
  } else if (!state.p.id) {
    mountList(root);
  }
}

export const actions = {
  'sket-preview'() {
    const s = cache().detail;
    if (s?.status === SURAT_KETERANGAN_STATUS.TERBIT) {
      openDialog(MODAL, letter(s), 'max-w-3xl');
    }
  },
};
