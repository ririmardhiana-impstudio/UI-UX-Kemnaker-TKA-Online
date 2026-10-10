/**
 * @fileoverview Perubahan Pengesahan RPTKA — list (legacy "perubahanList")
 * and "Tambah Perubahan" (legacy "perubahanNew": pilih Nomor RPTKA dari
 * `state.data.tka` — TKA dengan Pengesahan RPTKA yang sudah terbit milik
 * akun ini, revisi akun pemberi kerja poin 5; sebelumnya mengetik barcode
 * manual lewat `GET /tka?barcode=` — lihat devlog — lalu POST /perubahan
 * untuk membuat draf).
 */

import { createPerubahan } from '../../api/perubahan.js';
import { html, qs, qsa, raw } from '../../components/dom.js';
import { statusBadge } from '../../components/status-badge.js';
import {
  JABATAN_TANPA_PENDAMPING, PERUBAHAN_JENIS, validateCreatePerubahan,
} from '../../contracts/perubahan.js';
import { reloadCollection } from './data.js';
import { parseIndoDate } from './format.js';
import {
  NEW_LOKASI, jenisPanels, pendampingSemula,
} from './perubahan-panels.js';
import { openRingkasanDoc } from './documents.js';
import { adaRelasi, relasiTka } from './rptka-data.js';
import { go, setUi, state } from './state.js';
import {
  BTN, BTN_OUTLINE, CARD, LINK, LINK_MUTED, THEAD, field, mountPaged,
  navAttrs, pageTitle, pagerSlot, riwayatTerkaitRingkas, showErrors,
  validityMessage,
} from './ui.js';

const MIN_QUERY = 3;
const SMALL_BTN = 'btn btn-sm h-auto min-h-8 py-1.5 text-xs font-bold';
const PENDAMPING = 3;

/** Back link to the list. */
export function backToList() {
  return html`<button type="button" class="${LINK} text-[13px]"
    ${navAttrs('perubahanList')}>← Daftar perubahan</button>`;
}

function check(ok, label) {
  return html`<span class="font-bold ${ok ? 'text-success' : 'text-error'}">
    ${ok ? '✓' : '✗'} ${label}</span>`;
}

function listRow(c) {
  return html`<tr>
    <td class="font-mono font-bold">${c.barcode}</td>
    <td><span class="font-mono">${c.skBarcode}</span><p class="text-[11px]
      leading-snug text-base-content/60">${c.skNo}<br>${c.skTgl}</p></td>
    <td><b>${c.nama}</b><p class="text-xs text-base-content/60">${c.paspor}
      · ${c.jabatan}</p></td>
    <td>${c.jenis}<p class="text-xs text-base-content/60">${c.detail}</p></td>
    <td class="text-xs leading-relaxed">${check(c.dok, 'Dokumen')}<br>
      ${check(c.pengurus, 'Pengurus')}</td>
    <td>${statusBadge(c.status, c.tone)}</td>
    <td><div class="grid justify-items-end gap-1">
      ${c.verif === 'Perbaikan' ? html`<p class="max-w-48 text-end text-xs
        text-error">Alasan: ${c.verifAlasan}</p><button type="button"
        class="${SMALL_BTN} btn-primary" data-action="chg-resubmit"
        data-id="${c.id}">Ajukan kembali</button>` : ''}
      ${c.statusId === 1 ? html`<button type="button"
        class="${SMALL_BTN} btn-primary"
        ${navAttrs('perubahanDetail', { id: c.id })}>Edit</button>` : ''}
      ${c.statusId === 6 ? html`<button type="button"
        class="${SMALL_BTN} ${BTN_OUTLINE}" data-action="open-doc"
        data-doc="skChg" data-id="${c.id}">Cetak SK</button>` : ''}
      <button type="button" class="${LINK_MUTED} text-xs" data-action="riwayat"
        data-kind="chg" data-id="${c.id}">Riwayat</button></div></td></tr>`;
}

/** perubahanList view. */
export function renderList() {
  const add = html`<button type="button" class="${BTN}"
    ${navAttrs('perubahanNew')} data-testid="perubahan-btn-tambah">+ Tambah
    Baru</button>`;
  return html`
    ${pageTitle({ title: 'Perubahan Pengesahan RPTKA',
      desc: 'Ubah data TKA, alamat pemberi kerja, lokasi kerja, atau nama TKI pendamping pada pengesahan yang sudah terbit. SK Perubahan terbit ≤ 2 hari.',
      actions: add })}
    <div class="${CARD} flex items-center gap-2.5 px-3.5 py-1">
      <label for="chg-search" class="sr-only">Cari perubahan</label>
      <span class="text-base-content/50" aria-hidden="true">⌕</span>
      <input id="chg-search" type="search" class="input input-ghost h-10
        flex-1 px-0 text-sm focus:outline-none"
        placeholder="Cari barcode, nama TKA, atau paspor (min. 3 karakter)">
    </div>
    <section class="${CARD} overflow-hidden">
      <div class="overflow-x-auto"><table class="table min-w-[1040px]
          text-[13px]"><thead><tr class="${THEAD}">
          <th class="w-[100px]">Barcode</th><th>Pengesahan RPTKA</th>
          <th>Nama TKA</th><th>Jenis perubahan</th>
          <th class="w-[120px]">Persyaratan</th><th class="w-[140px]">Status
          </th><th class="w-[110px]"><span class="sr-only">Aksi</span></th>
        </tr></thead><tbody id="chg-body"></tbody></table></div>
      ${pagerSlot('chg-pager')}</section>`;
}

/** @param {!Element} root */
export function mountList(root) {
  const draw = (query) => {
    const q = query.toLowerCase();
    const items = state.data.perubahan.filter((c) => q.length < MIN_QUERY ||
      [c.barcode, c.nama, c.paspor].some((v) =>
        String(v).toLowerCase().includes(q)));
    mountPaged(root, {
      body: '#chg-body', footer: '#chg-pager', items, row: listRow,
      empty: html`<tr><td colspan="7" class="py-10 text-center text-sm
        text-base-content/60">Belum ada permohonan perubahan.</td></tr>`,
    });
  };
  draw('');
  const search = qs('#chg-search', root);
  search.addEventListener('input', () => {
    const footer = qs('#chg-pager', root);
    footer.replaceWith(footer.cloneNode(false));
    draw(search.value.trim());
  });
}

/** Default TKA = legacy lookupTka (Direktur Teknik or first TKA). */
function defaultTka() {
  const tka = state.data.tka;
  return tka.find((t) => t.jabatan === 'Direktur Teknik') ?? tka[0] ?? null;
}

function lookupSummary(t) {
  const cells = [['SK No.', t.skNo], ['Nama Pemberi Kerja',
    state.data.company.nama], ['Nama TKA', t.nama],
  ['Lokasi Kerja', t.lokasi]];
  return html`<dl class="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))]
      gap-px overflow-hidden rounded-box border border-base-300 bg-base-300
      text-[13px]">${cells.map(([label, value]) => html`<div
      class="bg-base-200 p-3.5"><dt class="text-base-content/60">${label}</dt>
      <dd class="font-bold">${value}</dd></div>`)}</dl>`;
}

function jenisCards(t) {
  const noPdp = JABATAN_TANPA_PENDAMPING.test(t.jabatan);
  return html`<fieldset class="grid gap-2.5 md:grid-cols-2 lg:grid-cols-4">
    <legend class="sr-only">Jenis perubahan</legend>
    ${PERUBAHAN_JENIS.map((label, i) => html`<label class="flex cursor-pointer
      items-center gap-2.5 rounded-box border-2 p-3.5 text-sm font-bold
      has-checked:border-secondary has-checked:bg-info/10
      border-base-content/20 has-disabled:cursor-not-allowed
      has-disabled:opacity-60">
      <input type="radio" name="chg-jenis" value="${i}"
        class="radio radio-secondary radio-sm" data-chg-jenis
        ${i === PENDAMPING && noPdp ? 'disabled' : ''}
        ${state.chgJenis === i ? 'checked' : ''}>${label}${i === PENDAMPING &&
        noPdp ? html`<span class="text-xs font-medium">(tidak berlaku untuk
        direksi/komisaris)</span>` : ''}</label>`)}
  </fieldset>`;
}

function inputForm(t) {
  return html`<form id="chg-form" novalidate class="${CARD} grid gap-4.5
      px-5 py-6 md:px-7">
    <h2 class="text-base font-bold">2 · Input data perubahan</h2>
    <div class="grid gap-3.5 md:grid-cols-2">
      ${field({ id: 'chg-surat', label: 'No. surat permohonan',
        value: '048/NBP-HRD/IX/2026', attrs: raw('required maxlength="60"') })}
      ${field({ id: 'chg-surat-tgl', label: 'Tanggal surat permohonan',
        value: '30 September 2026', attrs: raw('required maxlength="40"'),
        hint: `Tidak boleh sebelum tanggal SK (${t.skTgl}).` })}
      ${field({ id: 'chg-ket', label: 'Keterangan', span: 'md:col-span-2',
        value: 'Penerbitan paspor baru karena paspor lama hampir habis masa berlakunya.',
        attrs: raw('maxlength="250"') })}</div>
    ${jenisCards(t)}${jenisPanels(t)}
    <p id="chg-form-error" class="text-sm font-semibold text-error"
      aria-live="polite" hidden></p>
    <div class="flex justify-end gap-2.5">
      <button type="button" class="${BTN_OUTLINE}" data-action="chg-preview"
        data-testid="perubahan-btn-preview-doc">Preview Dokumen</button>
      <button type="button" class="${BTN_OUTLINE}"
        ${navAttrs('perubahanList')}>Batal</button>
      <button type="submit" class="${BTN}"
        data-testid="perubahan-btn-simpan">Simpan &amp; lanjut</button></div>
  </form>`;
}

/**
 * Tombol "Preview Dokumen" (revisi akun pemberi kerja, poin 6) — BELUM
 * ada contoh dokumen resmi (SK Perubahan) untuk dibandingkan, jadi
 * ringkasan data isian saat ini (bukan dokumen sah, lihat
 * `openRingkasanDoc`).
 */
function previewChg(form, t) {
  const value = (id) => qs(`#${id}`, form)?.value.trim() ?? '';
  const jenis = PERUBAHAN_JENIS[state.chgJenis];
  openRingkasanDoc(`Perubahan RPTKA — ${jenis}`, [
    ['Nomor RPTKA', t.skNo], ['Nama TKA', t.nama], ['Paspor', t.paspor],
    ['Jabatan', t.jabatan], ['Jenis perubahan', jenis],
    ['No. surat permohonan', value('chg-surat')],
    ['Tanggal surat permohonan', value('chg-surat-tgl')],
    ['Keterangan', value('chg-ket') || '—'],
  ]);
}

/**
 * Pemilih "Nomor RPTKA" (revisi akun pemberi kerja, poin 5): sumbernya
 * `state.data.tka` — TKA dengan Pengesahan RPTKA yang sudah terbit milik
 * akun ini (sudah dipakai `GET /tka?barcode=` sebelumnya, sekarang tampil
 * sebagai pilihan langsung, bukan diketik manual).
 */
function rptkaOption(t, selected) {
  return html`<option value="${t.barcode}" ${t.barcode === selected?.barcode
    ? 'selected' : ''}>${t.skNo} · ${t.nama} (${t.jabatan})</option>`;
}

/** perubahanNew view. */
export function renderNew() {
  const t = state.ui.lookup ?? defaultTka();
  // Riwayat Terkait (revisi akun pemberi kerja, poin 7) — relasi RPTKA
  // terpilih, supaya pengguna tahu bila sudah ada Perubahan/Pencabutan
  // lain atas TKA yang sama sebelum mengajukan lagi. Relasi Perpanjangan
  // cuma muncul bila cache-nya sudah dimuat (halaman Form RPTKA sendiri
  // yang memuatnya) — keterbatasan yang disengaja, lihat devlog.
  const relasi = t ? relasiTka(t) : null;
  return html`
    <div>${backToList()}<h1 class="mt-2 text-[26px] font-extrabold
      tracking-tight">Tambah Perubahan Pengesahan RPTKA</h1></div>
    <form id="lookup-form" novalidate class="${CARD} grid gap-4 px-5 py-6
        md:px-7">
      <h2 class="text-base font-bold">1 · Nomor RPTKA</h2>
      <div class="grid max-w-lg gap-1.5">
        <label for="chg-rptka" class="sr-only">Nomor RPTKA</label>
        <select id="chg-rptka" class="select h-11 w-full"
          data-testid="perubahan-select-rptka">
          <option value="">Pilih Nomor RPTKA…</option>
          ${state.data.tka.map((row) => rptkaOption(row, t))}</select>
      </div>
      ${t ? lookupSummary(t) : ''}
      ${relasi && adaRelasi(relasi) ? riwayatTerkaitRingkas(relasi) : ''}
      </form>
    ${t ? inputForm(t) : ''}`;
}

function buildBody(form, t) {
  const co = state.data.company;
  const value = (id) => qs(`#${id}`, form)?.value.trim() ?? '';
  const jenis = PERUBAHAN_JENIS[state.chgJenis];
  const base = { role: state.role, skBarcode: t.barcode, jenis,
    surat: value('chg-surat'), suratTgl: value('chg-surat-tgl'),
    keterangan: value('chg-ket') || undefined };
  if (state.chgJenis === 0) {
    const details = qsa('[name="chg-detail"]:checked', form)
      .map((b) => b.value);
    return { ...base, detail: details.join(', '),
      semula: `${t.paspor} · ${t.negara}`,
      menjadi: `${value('chg-paspor')} · ${value('chg-negara')}` };
  }
  if (state.chgJenis === PENDAMPING) {
    return { ...base, detail: 'Penggantian Tenaga Kerja Pendamping',
      semula: pendampingSemula(t), menjadi: `${value('chg-pdp-nama')} · ` +
        value('chg-pdp-jabatan'), pendampingNama: value('chg-pdp-nama'),
      pendampingJabatan: value('chg-pdp-jabatan') };
  }
  if (state.chgJenis === 1) {
    return { ...base, detail: 'Perubahan alamat',
      semula: `${co.jalan}, ${co.kel}, ${co.kec}, ${co.kab}, ${co.prov} ` +
        co.kodepos,
      menjadi: `${value('chg-jalan')}, ${co.kel}, ${co.kec}, ${co.kab}, ` +
        `${co.prov} ${value('chg-kodepos')}` };
  }
  return { ...base, detail: `+ ${NEW_LOKASI.split(',')[0]}`,
    semula: `${co.kab}, ${co.prov}`,
    menjadi: `${co.kab}, ${co.prov}; ${NEW_LOKASI}` };
}

/** Cross-field + HTML5 checks for the visible jenis panel. */
function validateForm(form, body, t) {
  const errors = {};
  const panel = qs(`[data-jenis-panel="${state.chgJenis}"]`, form);
  const inputs = [...qsa('#chg-surat, #chg-surat-tgl, #chg-ket', form),
    ...qsa('input[id]', panel)];
  for (const input of inputs) {
    if (input.required && !input.value.trim()) {
      errors[input.id] = 'Wajib diisi.';
    } else if (!input.checkValidity()) {
      errors[input.id] = validityMessage(input);
    }
  }
  if (state.chgJenis === 0 && !body.detail) {
    errors['chg-detail'] = 'Pilih minimal satu data yang diubah.';
  }
  const suratTgl = parseIndoDate(body.suratTgl);
  const skTgl = parseIndoDate(t.skTgl);
  if (!errors['chg-surat-tgl'] && !suratTgl) {
    errors['chg-surat-tgl'] = 'Format tanggal: 30 September 2026.';
  } else if (suratTgl && skTgl && suratTgl < skTgl) {
    errors['chg-surat-tgl'] =
      `Tidak boleh sebelum tanggal SK (${t.skTgl}).`;
  }
  const contract = validateCreatePerubahan(body);
  const map = { surat: 'chg-surat', suratTgl: 'chg-surat-tgl',
    keterangan: 'chg-ket', pendampingNama: 'chg-pdp-nama',
    pendampingJabatan: 'chg-pdp-jabatan' };
  for (const [key, message] of Object.entries(contract.errors)) {
    errors[map[key] ?? 'chg-form'] ??= message;
  }
  return !showErrors(form, errors);
}

/** Nomor RPTKA dipilih dari daftar — langsung, tanpa panggilan API lagi. */
function selectRptka(barcode) {
  const row = state.data.tka.find((t) => t.barcode === barcode) ?? null;
  setUi({ lookup: row });
}

async function save(form) {
  const t = state.ui.lookup ?? defaultTka();
  const body = buildBody(form, t);
  if (!validateForm(form, body, t)) {
    return;
  }
  const submit = qs('[type="submit"]', form);
  submit.disabled = true;
  form.setAttribute('aria-busy', 'true');
  try {
    const draft = await createPerubahan(body);
    await reloadCollection('perubahan');
    go('perubahanDetail', { id: draft.id });
  } catch (error) {
    submit.disabled = false;
    form.removeAttribute('aria-busy');
    showErrors(form, { 'chg-form': error.message });
  }
}

/** @param {!Element} root */
export function mountNew(root) {
  root.addEventListener('submit', (event) => {
    event.preventDefault();
    if (event.target.id === 'chg-form') {
      save(event.target);
    }
  });
  root.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-action="chg-preview"]');
    if (btn) {
      previewChg(qs('#chg-form', root), state.ui.lookup ?? defaultTka());
    }
  });
  root.addEventListener('change', (event) => {
    if (event.target.id === 'chg-rptka') {
      selectRptka(event.target.value);
      return;
    }
    if (!event.target.matches('[data-chg-jenis]')) {
      return;
    }
    state.chgJenis = Number(event.target.value);
    for (const panel of qsa('[data-jenis-panel]', root)) {
      panel.hidden = Number(panel.dataset.jenisPanel) !== state.chgJenis;
    }
  });
}
