/**
 * @fileoverview Perpanjangan Pengesahan RPTKA (legacy "perpanjangan"):
 * step 1 pick the previous HPK/pengesahan, step 2 select TKA (<= 90 days)
 * with prerequisite chips, step 3 choose the cakupan wilayah kerja (KAK
 * Modul 4) and submit POST /perpanjangan, then continue into the HPK or
 * TKA wizard to complete the application.
 */

import { createPerpanjangan } from '../../api/siklus.js';
import { listWilayah } from '../../api/wilayah.js';
import { html, qs, qsa, raw, setHtml } from '../../components/dom.js';
import {
  CAKUPAN_LABEL, CAKUPAN_WILAYAH, DIPROSES_OLEH, PERPANJANGAN_WINDOW_DAYS,
  validatePerpanjangan,
} from '../../contracts/siklus.js';
import { withRetry } from './data.js';
import { go, refreshView, setUi, state } from './state.js';
import {
  BTN, BTN_OUTLINE, CALLOUT_INFO, CALLOUT_WARN, CARD, THEAD, fieldError,
  mountPaged, pageTitle, pagerSlot, showErrors, toast,
} from './ui.js';

const STEPS = ['1 · Pilih RPTKA / HPK sebelumnya',
  '2 · Pilih TKA yang diperpanjang', '3 · Lengkapi permohonan'];
const CHECK = 'checkbox checkbox-secondary checkbox-sm';
const TITLES = ['Pilih dasar perpanjangan', 'Pilih TKA yang diperpanjang',
  'Cakupan wilayah kerja'];

function layananLabel() {
  return {
    lembaga: 'Perpanjangan Non DKPTKA',
    pemerintah: 'Perpanjangan tanpa penilaian kelayakan',
  }[state.role] ?? 'Perpanjangan';
}

/** RPTKA jangka pendek (Sementara) cannot be extended (copy below). */
function bases() {
  const { tka, hpk } = state.data;
  if (state.role === 'pemerintah') {
    return tka.map((t) => ({ a: t.barcode,
      b: `Pengesahan Non-HPK · ${t.jabatan}`, c: `s.d. ${t.akhir}` }));
  }
  return hpk.filter((h) => h.stepIdx >= 8 && !/Sementara/.test(h.layanan))
    .map((h) => ({ a: h.barcode, b: `HPK · ${h.layanan}`,
      c: h.jabatan.map((j) => j.nama).join(', ') }));
}

function candidates() {
  return state.data.tka.filter((t) => t.sisa <= PERPANJANGAN_WINDOW_DAYS);
}

function stepIndicator() {
  const active = state.ui.perStep;
  return html`<ol class="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))]
      gap-2 text-[13px] font-bold">${STEPS.map((label, i) => {
    let cls = 'border border-base-300 bg-base-100 text-base-content/50';
    if (i === active) {
      cls = 'bg-primary text-primary-content';
    } else if (i === active + 1) {
      cls = 'border border-base-300 bg-base-100 text-base-content/80';
    }
    return html`<li class="rounded-field px-3.5 py-3 ${cls}"
      ${i === active ? raw('aria-current="step"') : ''}>${label}</li>`;
  })}</ol>`;
}

function baseList() {
  return html`<ul class="${CARD} overflow-x-auto">${bases().map((h) => html`
    <li><button type="button" data-action="per-next" data-basis="${h.a}"
        class="grid w-full min-w-[900px] grid-cols-[28px_160px_minmax(0,1fr)_minmax(0,1fr)_100px]
          items-center gap-3.5 border-b border-base-200 px-5 py-4 text-left
          text-sm hover:bg-base-200/50">
      <span class="size-4.5 rounded-full border-2 border-base-content/20"
        aria-hidden="true"></span>
      <b class="font-mono">${h.a}</b><span>${h.b}</span>
      <span class="text-[13px] text-base-content/70">${h.c}</span>
      <span class="text-right text-[13px] font-bold text-secondary">Pilih →
      </span></button></li>`)}</ul>
    <p class="text-[13px] text-base-content/70">RPTKA jangka pendek
      (Sementara 1–6 bulan) tidak dapat diperpanjang dan tidak ditampilkan.</p>`;
}

function tkaRow(t) {
  const checked = state.perSel.has(t.barcode);
  const pre = [['BPJS aktif', t.bpjs], ['NPWP aktif di Coretax', t.npwp],
    ['Laporan pendampingan', t.lapor]];
  return html`<tr>
    <td><input type="checkbox" class="${CHECK}"
      data-per-sel="${t.barcode}" ${checked ? 'checked' : ''}
      aria-label="Pilih ${t.nama}"></td>
    <td><b class="text-sm">${t.nama}</b><p class="text-xs
      text-base-content/70">${t.jabatan} · ${t.paspor}</p></td>
    <td><span class="font-mono">${t.barcode}</span><p class="text-xs
      text-base-content/70">s.d. ${t.akhir}</p></td>
    <td class="font-bold">${t.sisa} hari lagi</td>
    <td><div class="flex flex-wrap gap-1.5">${pre.map(([label, ok]) => html`
      <span class="rounded-full px-2 py-1 text-[11px] font-bold ${ok
        ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}">
        ${ok ? '✓' : '✗'} ${label}</span>`)}</div></td></tr>`;
}

function tkaPicker() {
  const n = state.perSel.size;
  return html`<section class="${CARD} overflow-hidden">
      <div class="overflow-x-auto"><table class="table min-w-[900px]
          text-[13px]"><thead><tr class="${THEAD}">
          <th class="w-10"><span class="sr-only">Pilih</span></th><th>TKA</th>
          <th>SK / berakhir</th><th class="w-[150px]">Sisa waktu</th>
          <th>Prasyarat perpanjangan</th></tr></thead>
        <tbody id="per-body"></tbody></table></div>
      ${pagerSlot('per-pager')}</section>
    <div class="flex flex-wrap items-center justify-between gap-3">
      <button type="button" class="${BTN_OUTLINE}" data-action="per-back">
        ← Ganti dasar</button>
      <p class="flex-1 text-[13px] text-base-content/70" aria-live="polite">
        <span id="per-count">${n}</span> TKA dipilih · TKA dengan prasyarat ✗
        dapat dipilih, tetapi akan diminta melengkapi sebelum diproses.</p>
      <button type="button" class="${BTN}" data-action="per-go" id="per-go"
        data-testid="perpanjangan-btn-lanjut" ${n ? '' : 'disabled'}>
        Lanjut →</button></div>`;
}

function cakupanRadios(current) {
  return html`<fieldset id="per-cakupan" tabindex="-1"
      class="grid gap-2.5 md:grid-cols-3" aria-describedby="per-cakupan-error">
    <legend class="mb-2 text-sm font-bold">Cakupan wilayah kerja TKA</legend>
    ${CAKUPAN_WILAYAH.map((key) => html`<label class="grid cursor-pointer
      gap-1 rounded-box border-2 border-base-content/20 p-3.5
      has-checked:border-secondary has-checked:bg-info/10">
      <span class="flex items-center gap-2.5 text-sm font-bold"><input
        type="radio" name="per-cakupan" value="${key}" data-per-cakupan
        class="radio radio-secondary radio-sm"
        ${key === current ? 'checked' : ''}>${CAKUPAN_LABEL[key]}</span>
      <span class="ps-7 text-xs text-base-content/70">Diproses
        ${DIPROSES_OLEH[key]} [usulan]</span></label>`)}
  </fieldset>${fieldError('per-cakupan')}`;
}

function wilayahPanels(current) {
  const co = state.data.company;
  return html`<div data-cakupan-panel="satu-kabupaten"
      ${current === 'satu-kabupaten' ? '' : 'hidden'}>
      <p class="${CALLOUT_INFO}">Lokasi kerja tetap di <b>${co.kab},
        ${co.prov}</b>. Tidak perlu memilih wilayah tujuan.</p></div>
    <fieldset id="per-kab" tabindex="-1" data-cakupan-panel="satu-provinsi"
        class="grid gap-2"
        aria-describedby="per-kab-error"
        ${current === 'satu-provinsi' ? '' : 'hidden'}>
      <legend class="mb-1 text-sm font-bold">Kabupaten/kota tujuan di
        ${co.prov} (opsional)</legend>
      <div id="per-kab-list" class="flex flex-wrap gap-x-5 gap-y-2"></div>
      ${fieldError('per-kab')}</fieldset>
    <fieldset id="per-prov" tabindex="-1" data-cakupan-panel="lintas-provinsi"
        class="grid gap-2"
        aria-describedby="per-prov-error"
        ${current === 'lintas-provinsi' ? '' : 'hidden'}>
      <legend class="mb-1 text-sm font-bold">Provinsi tujuan (min. 1, selain
        ${co.prov})</legend>
      <div id="per-prov-list" class="flex flex-wrap gap-x-5 gap-y-2"></div>
      ${fieldError('per-prov')}</fieldset>
    <div id="per-wilayah-status" aria-live="polite"></div>`;
}

function cakupanForm() {
  const current = state.ui.perCakupan ?? state.p.cakupan ?? 'satu-kabupaten';
  return html`<form id="per-form" novalidate class="${CARD} grid gap-4 px-5
      py-6 md:px-7">
    <h2 class="text-base font-bold">Cakupan wilayah kerja</h2>
    <p class="text-[13px] text-base-content/70">${state.perSel.size} TKA
      dipilih dari dasar <span class="font-mono font-bold">
      ${state.ui.perBase}</span>. Unit pemroses mengikuti cakupan wilayah
      (usulan, menunggu konfirmasi Direktorat PPTKA).</p>
    ${cakupanRadios(current)}${wilayahPanels(current)}
    <p id="per-form-error" role="alert" class="text-sm font-semibold
      text-error" hidden></p>
    <div class="flex flex-wrap justify-between gap-2.5">
      <button type="button" class="${BTN_OUTLINE}" data-action="per-step1">
        ← Ubah pilihan TKA</button>
      <button type="submit" class="${BTN}" data-testid="perpanjangan-btn-ajukan">
        Simpan &amp; lanjutkan ke data permohonan</button></div></form>`;
}

function resultCard(r) {
  return html`<section class="${CARD} grid gap-3.5 px-5 py-6 md:px-7">
    <h2 id="per-result-title" tabindex="-1" class="text-base font-bold
      text-success focus:outline-none">✓ Permohonan perpanjangan dibuat</h2>
    <p class="${CALLOUT_WARN}">Permohonan <b>belum lengkap</b> dan belum
      diproses sampai data permohonan selesai diisi dan dikirim.</p>
    <dl class="grid gap-x-5 gap-y-2 text-sm md:grid-cols-[200px_1fr]">
      <dt class="text-base-content/70">No. permohonan</dt>
      <dd class="font-mono font-bold">${r.noPermohonan}</dd>
      <dt class="text-base-content/70">Cakupan wilayah</dt>
      <dd class="font-bold">${CAKUPAN_LABEL[r.cakupanWilayah]}</dd>
      <dt class="text-base-content/70">Diproses oleh</dt>
      <dd class="font-bold">${r.diprosesOleh}</dd>
      <dt class="text-base-content/70">TKA</dt>
      <dd>${r.tka.map((t) => t.nama).join(', ')}</dd></dl>
    <div class="flex justify-end"><button type="button" class="${BTN}"
      data-action="per-wizard">Lengkapi data permohonan →</button></div>
  </section>`;
}

function stepBody() {
  if (state.ui.perStep === 0) {
    return baseList();
  }
  if (state.ui.perStep === 1) {
    return tkaPicker();
  }
  return state.ui.perResult ? resultCard(state.ui.perResult) : cakupanForm();
}

/** perpanjangan view. */
export function render() {
  return html`
    ${pageTitle({ eyebrow: layananLabel(), title: state.ui.perResult
      ? 'Permohonan dibuat' : TITLES[state.ui.perStep] ?? TITLES[0] })}
    ${stepIndicator()}${stepBody()}`;
}

function checkboxes(name, items) {
  return html`${items.map((nama) => html`<label class="flex cursor-pointer
    items-center gap-2 text-[13px] font-semibold"><input type="checkbox"
    name="${name}" value="${nama}" class="${CHECK}">${nama}</label>`)}`;
}

/** Load provinsi + kabupaten (origin province) into the step-3 form. */
async function loadWilayah(root) {
  const status = qs('#per-wilayah-status', root);
  const origin = state.data.company.prov;
  const form = qs('#per-form', root);
  form.setAttribute('aria-busy', 'true');
  setHtml(status, html`<p class="flex items-center gap-2 text-xs
    text-base-content/70"><span class="loading loading-spinner loading-xs"
    aria-hidden="true"></span>Memuat daftar wilayah…</p>`);
  try {
    const [prov, kab] = await Promise.all([
      withRetry(() => listWilayah()),
      withRetry(() => listWilayah({ provinsi: origin }))
        .catch((error) => error),
    ]);
    setHtml(qs('#per-prov-list', root), checkboxes('per-prov',
      prov.map((p) => p.nama).filter((p) => p !== origin)));
    setHtml(qs('#per-kab-list', root), kabList(kab));
    setHtml(status, html``);
  } catch (error) {
    setHtml(status, html`<div role="alert" class="alert alert-error
      alert-soft text-sm"><span>Gagal memuat wilayah: ${error.message}</span>
      <button type="button" class="btn btn-sm" data-per-wilayah-retry>Coba
      lagi</button></div>`);
  } finally {
    form.removeAttribute('aria-busy');
  }
}

/** Kabupaten checkboxes; a failed load is an error, not "no data". */
function kabList(kab) {
  if (kab instanceof Error) {
    return html`<div role="alert" class="alert alert-error alert-soft
      text-sm"><span>Gagal memuat kabupaten/kota: ${kab.message}</span>
      <button type="button" class="btn btn-sm" data-per-wilayah-retry>Coba
      lagi</button></div>`;
  }
  return kab.length ? checkboxes('per-kab', kab.map((k) => k.nama))
    : html`<p class="text-xs text-base-content/70">Data kabupaten/kota
      belum tersedia; lanjutkan tanpa memilih.</p>`;
}

function buildBody(form) {
  const cakupanWilayah = qs('[name="per-cakupan"]:checked', form)?.value;
  const picked = (name) => qsa(`[name="${name}"]:checked`, form)
    .map((b) => b.value);
  const body = { basisBarcode: state.ui.perBase,
    tkaIds: [...state.perSel], cakupanWilayah };
  if (cakupanWilayah === 'lintas-provinsi') {
    body.provinsiTujuan = picked('per-prov');
  } else if (cakupanWilayah === 'satu-provinsi') {
    body.provinsiTujuan = [state.data.company.prov];
    body.kabupatenTujuan = picked('per-kab');
  }
  return body;
}

const ERROR_ID = { cakupanWilayah: 'per-cakupan', provinsiTujuan: 'per-prov',
  kabupatenTujuan: 'per-kab' };

function toFieldErrors(errors) {
  const out = {};
  for (const [key, message] of Object.entries(errors)) {
    out[ERROR_ID[key] ?? 'per-form'] ??= message;
  }
  return out;
}

async function submit(form) {
  const body = buildBody(form);
  const check = validatePerpanjangan(body);
  if (showErrors(form, toFieldErrors(check.errors))) {
    return;
  }
  const button = qs('[type="submit"]', form);
  button.disabled = true;
  form.setAttribute('aria-busy', 'true');
  try {
    const result = await createPerpanjangan(state.role, body);
    state.ui.perResult = result;
    refreshView('per-result-title');
    toast(`Permohonan perpanjangan ${result.noPermohonan} dibuat; ` +
      'lengkapi data permohonan.');
  } catch (error) {
    button.disabled = false;
    form.removeAttribute('aria-busy');
    const fields = toFieldErrors(error.fields ?? {});
    showErrors(form, Object.keys(fields).length ? fields
      : { 'per-form': error.message });
  }
}

function mountCakupan(root) {
  const form = qs('#per-form', root);
  if (!form) {
    return;
  }
  loadWilayah(root);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submit(form);
  });
  form.addEventListener('change', (event) => {
    if (!event.target.matches('[data-per-cakupan]')) {
      return;
    }
    state.ui.perCakupan = event.target.value;
    for (const panel of qsa('[data-cakupan-panel]', form)) {
      panel.hidden = panel.dataset.cakupanPanel !== state.ui.perCakupan;
    }
  });
  form.addEventListener('click', (event) => {
    if (event.target.closest('[data-per-wilayah-retry]')) {
      loadWilayah(root);
    }
  });
}

/** @param {!Element} root */
export function mount(root) {
  if (state.ui.perStep === 2) {
    mountCakupan(root);
    return;
  }
  if (state.ui.perStep !== 1) {
    return;
  }
  mountPaged(root, {
    body: '#per-body', footer: '#per-pager', items: candidates(),
    row: tkaRow,
  });
  root.addEventListener('change', (event) => {
    const box = event.target.closest('[data-per-sel]');
    if (!box) {
      return;
    }
    if (box.checked) {
      state.perSel.add(box.dataset.perSel);
    } else {
      state.perSel.delete(box.dataset.perSel);
    }
    qs('#per-count', root).textContent = String(state.perSel.size);
    qs('#per-go', root).disabled = state.perSel.size === 0;
  });
}

export const actions = {
  'per-next'(el) {
    setUi({ perStep: 1, perBase: el.dataset.basis });
  },
  'per-back'() {
    setUi({ perStep: 0 });
  },
  'per-step1'() {
    setUi({ perStep: 1 });
  },
  'per-go'() {
    if (state.perSel.size) {
      setUi({ perStep: 2, perResult: null });
    }
  },
  'per-wizard'() {
    if (state.data.company.hpk) {
      go('hpkWizard', { layanan: state.role === 'lembaga'
        ? 'Perpanjangan Non DKPTKA' : 'Perpanjangan' });
    } else {
      go('tkaWizard', { mode: 'nonhpk', jenis: 'Perpanjangan',
        nama: 'Kenji Watanabe', layanan: 'Perpanjangan' });
    }
  },
};
