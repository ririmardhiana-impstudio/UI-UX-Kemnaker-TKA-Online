/**
 * @fileoverview Form pengajuan HPK (params {baru} / {edit: id}): pilih
 * jenis HPK -> isian (merah = otomatis dari OSS, hitam = input) dan dokumen
 * (merah = data OSS, biru = berkas OSS, hitam = upload + cek OCR) sesuai
 * skema GET /penilaian-kelayakan/formulir; Simpan (Draft) atau Submit.
 * Kolom per jenis HPK adalah usulan [I] menunggu dokumen probis.
 */

import { ApiError } from '../../api/http.js';
import { extractDocument, ocrRequestFromFile } from '../../api/ocr.js';
import {
  createPenilaianKelayakan, getFormulirPenilaian, submitPenilaianKelayakan,
  updatePenilaianKelayakan,
} from '../../api/penilaian-kelayakan.js';
import { simpanBerkas } from '../../components/berkas-store.js';
import { html, qs, qsa, setHtml } from '../../components/dom.js';
import { emptyState } from '../../components/empty-state.js';
import { ocrPanel, ocrSummary } from '../../components/ocr-panel.js';
import { validateOcrRequest } from '../../contracts/analitik.js';
import {
  PK_JENIS, PK_SUMBER_DOKUMEN as SD, PK_SUMBER_ISIAN, validatePenilaianKelayakan,
  validatePenilaianKelayakanSubmit,
} from '../../contracts/penilaian-kelayakan.js';
import { withRetry } from './data.js';
import { PAGE, cache, invalidate } from './hpk-hasil-data.js';
import {
  JABATAN_KOSONG, bodyHtml, jabatanRows, previewLink, uploadBadge,
  uploadStatus,
} from './hpk-hasil-fields.js';
import { go, state } from './state.js';
import {
  BTN, BTN_OUTLINE, CALLOUT_INFO, CALLOUT_WARN, CARD, LINK, fieldError, navAttrs, pageTitle, showErrors, toast,
} from './ui.js';

const OCR_JENIS = 'Dokumen Pendukung';
const UNREADABLE = 'Dokumen tidak terbaca, unggah ulang yang lebih jelas.';

/** Working copy of the open form (reset on every mount). */
let current = { formulir: null, uploads: {}, files: {} };

const toId = (key) => `pk-${key.replaceAll('.', '-')}`;
function backLink(edit) {
  const attrs = edit ? navAttrs(PAGE, { id: edit.id }) : navAttrs(PAGE);
  return html`<button type="button" class="${LINK} text-[13px]" ${attrs}>
    ← ${edit ? 'Detail HPK' : 'Daftar HPK'}</button>`;
}

const PLACEHOLDER = html`<p class="${CARD} px-5 py-8 text-center text-sm
  text-base-content/70">Pilih jenis HPK untuk menampilkan isian dan dokumen
  yang dibutuhkan.</p>`;

/** hpkHasil view when params carry {baru} or {edit}. */
export function render() {
  const edit = state.p.edit ? cache().detail : null;
  if (edit && !edit.bisaDiubah) {
    return html`${pageTitle({ back: backLink(edit),
      title: `HPK ${edit.noHpk}` })}${emptyState({ icon: '🔒',
      title: 'Pengajuan tidak dapat diubah',
      body: `Status ${edit.status}: data hanya dapat diubah saat Draft atau `
        + 'Ditolak/Perlu Perbaikan.',
      action: { label: 'Lihat detail', attrs: navAttrs(PAGE, { id: edit.id }) } })}`;
  }
  current = { formulir: edit?.formulir ?? null, uploads: {}, files: {} };
  for (const d of current.formulir?.dokumen ?? []) {
    if (d.sumber === SD.UPLOAD && d.namaBerkas) {
      current.uploads[d.kunci] = { namaBerkas: d.namaBerkas,
        berkasId: d.berkasId ?? undefined,
        ukuranKb: d.ukuranKb };
    }
  }
  const locked = Boolean(edit?.jenisTerkunci);
  return html`${pageTitle({ back: backLink(edit),
    title: edit ? `Ubah HPK ${edit.noHpk}` : 'Ajukan HPK',
    desc: 'Pilih jenis HPK, lengkapi isian dan dokumen, lalu simpan sebagai ' +
      'Draft atau submit ke verifikator.' })}
    ${edit?.catatan ? html`<p role="note" class="${CALLOUT_WARN}">
      <b>Catatan perbaikan:</b> ${edit.catatan}</p>` : ''}
    <p class="${CALLOUT_INFO}">Isian dan dokumen mengikuti ketentuan tiap jenis
      HPK. Pembagian sumber data (OSS atau unggah) masih usulan [I].</p>
    <form id="hpk-form" novalidate class="grid gap-5"
        data-item-id="${edit?.id ?? ''}">
      <section class="${CARD} grid gap-1.5 px-5 py-6 md:px-7">
        <label for="pk-jenis" class="text-sm font-bold">Jenis HPK</label>
        <select id="pk-jenis" name="jenis" class="select h-11 w-full
          md:max-w-xl" required ${locked ? 'disabled' : ''}
          aria-describedby="pk-jenis-hint pk-jenis-error">
          <option value="">Pilih jenis HPK…</option>
          ${PK_JENIS.map((j) => html`<option ${j === edit?.jenis
            ? 'selected' : ''}>${j}</option>`)}</select>
        <p id="pk-jenis-hint" class="text-xs text-base-content/70">
          ${locked ? 'Jenis HPK terkunci setelah pengajuan pernah disubmit.'
            : 'Isian dan dokumen menyesuaikan jenis yang dipilih. HPK ' +
              'Direksi/Komisaris tidak melalui ekspose.'}</p>
        ${fieldError('pk-jenis')}</section>
      <div id="hpk-form-body" class="grid gap-5" aria-busy="false">
        ${current.formulir ? bodyHtml(current.formulir, current.uploads)
          : PLACEHOLDER}</div>
      <p id="hpk-form-error" role="alert" class="text-sm font-semibold
        text-error" hidden></p>
      <div class="grid justify-items-end gap-2">
        <div class="flex flex-wrap justify-end gap-2.5">
          <button type="button" class="${BTN_OUTLINE}"
            ${edit ? navAttrs(PAGE, { id: edit.id }) : navAttrs(PAGE)}>Batal
          </button>
          <button type="button" class="${BTN_OUTLINE}"
            data-action="hpk-save" data-submit="0"
            data-testid="hpk-btn-simpan">Simpan sebagai Draft</button>
          <button type="button" class="${BTN}" data-action="hpk-save"
            data-submit="1" data-testid="hpk-btn-submit">Submit pengajuan
          </button></div>
        <p class="text-xs text-base-content/70">Setelah disubmit, data tidak
          dapat diubah kecuali dikembalikan verifikator untuk perbaikan.</p>
      </div></form>`;
}

/** Baris jabatan apa adanya dari DOM (termasuk yang masih kosong). */
function readJabatanRaw() {
  return qsa('[data-jab-row]').map((li) => ({
    nama: qs('[data-jab="nama"]', li).value,
    jumlahTka: qs('[data-jab="jumlahTka"]', li).value }));
}

/** Daftar jabatan untuk payload: baris kosong dibuang. */
function readJabatan() {
  return readJabatanRaw().filter((r) => r.nama.trim() || r.jumlahTka !== '')
    .map((r) => ({ nama: r.nama.trim(),
      jumlahTka: r.jumlahTka === '' ? undefined : Number(r.jumlahTka) }));
}

function readIsian() {
  const out = {};
  for (const f of current.formulir?.fields ?? []) {
    if (f.tipe === 'daftar-jabatan' && qs('#pk-jabatan-list')) {
      const rows = readJabatan();
      if (rows.length) {
        out[f.kunci] = rows;
      }
      continue;
    }
    const el = qs(`#pk-isian-${f.kunci}`);
    if (f.sumber !== PK_SUMBER_ISIAN.INPUT || !el || el.value.trim() === '') {
      continue;
    }
    out[f.kunci] = f.tipe === 'angka' ? Number(el.value) : el.value.trim();
  }
  return out;
}

function payload(form) {
  return { jenis: qs('#pk-jenis', form).value, isian: readIsian(),
    dokumen: { ...current.uploads } };
}

function bodyState(form, content, busy) {
  const body = qs('#hpk-form-body', form);
  body.setAttribute('aria-busy', String(busy));
  setHtml(body, content);
}

async function changeJenis(form, jenis) {
  const keep = readIsian();
  if (!jenis) {
    current.formulir = null;
    bodyState(form, PLACEHOLDER, false);
    return;
  }
  bodyState(form, html`<div class="skeleton h-64 w-full"></div>
    <span class="sr-only" role="status">Memuat formulir…</span>`, true);
  try {
    const formulir = await withRetry(
      () => getFormulirPenilaian(state.role, jenis));
    for (const f of formulir.fields) {
      f.nilai = keep[f.kunci] ?? f.nilai;
    }
    const kunci = formulir.dokumen.map((d) => d.kunci);
    current.uploads = Object.fromEntries(Object.entries(current.uploads)
      .filter(([k]) => kunci.includes(k)));
    current.formulir = formulir;
    bodyState(form, bodyHtml(formulir, current.uploads), false);
  } catch (error) {
    current.formulir = null;
    bodyState(form, html`<div role="alert" class="alert alert-error
      alert-soft"><span>Gagal memuat formulir: ${error.message}</span>
      <button type="button" class="btn btn-sm" data-action="hpk-form-retry">
      Coba lagi</button></div>`, false);
  }
}

function docMessage(kunci, message) {
  const slot = qs(`#pk-dokumen-${kunci}-error`);
  const input = qs(`#pk-dokumen-${kunci}`);
  slot.textContent = message;
  slot.hidden = !message;
  input?.setAttribute('aria-invalid', String(Boolean(message)));
  input?.classList.toggle('file-input-error', Boolean(message));
}

async function markUploaded(kunci, file) {
  const berkasId = await simpanBerkas(file);
  current.uploads[kunci] = { namaBerkas: file.name,
    ukuranKb: Math.max(1, Math.ceil(file.size / 1024)),
    ...(berkasId ? { berkasId } : {}) };
  qs(`#pk-dokumen-${kunci}-status`).textContent =
    uploadStatus(current.uploads[kunci]);
  setHtml(qs(`#pk-dokumen-${kunci}-badge`),
    uploadBadge(current.uploads[kunci]));
  setHtml(qs(`#pk-dokumen-${kunci}-preview`), previewLink(
    qs(`label[for="pk-dokumen-${kunci}"]`).textContent.trim(),
    current.uploads[kunci]));
}

/** Validate, OCR-check and keep one uploaded document. */
async function pickDocument(kunci, file) {
  const slot = qs(`#pk-dokumen-${kunci}-ocr`);
  if (!file || !slot) {
    return;
  }
  current.files[kunci] = file;
  const request = ocrRequestFromFile(OCR_JENIS, file);
  const check = validateOcrRequest(request);
  setHtml(slot, html``);
  if (!check.valid) {
    qs(`#pk-dokumen-${kunci}`).value = '';
    docMessage(kunci, check.errors.ukuranKb ?? check.errors.fileName);
    return;
  }
  docMessage(kunci, '');
  slot.setAttribute('aria-busy', 'true');
  setHtml(slot, html`<div class="skeleton h-24 w-full"></div>`);
  try {
    const result = await extractDocument(request);
    await markUploaded(kunci, file);
    setHtml(slot, ocrPanel({ id: `pk-ocr-${kunci}`,
      title: 'Hasil baca dokumen', fileName: file.name,
      fields: result.fields, perluPeriksa: result.perluPeriksa,
      ambang: result.ambangKeyakinan }));
    qs(`#pk-dokumen-${kunci}-live`).textContent =
      ocrSummary('Hasil baca dokumen', result);
  } catch (error) {
    setHtml(slot, html``);
    const unreadable = error instanceof ApiError &&
      error.code === 'OCR_UNREADABLE';
    if (unreadable) {
      qs(`#pk-dokumen-${kunci}`).value = '';
    }
    docMessage(kunci, unreadable ? UNREADABLE
      : `Gagal membaca dokumen: ${error.message}`);
    if (!unreadable) {
      qs(`#pk-dokumen-${kunci}-error`).insertAdjacentHTML('beforeend',
        ` <button type="button" class="btn btn-xs" data-action="hpk-ocr-retry"
        data-kunci="${kunci}">Coba lagi</button>`);
    }
  } finally {
    slot.setAttribute('aria-busy', 'false');
  }
}

function mapErrors(errors) {
  return Object.fromEntries(Object.entries(errors)
    .map(([key, message]) => [toId(key), message]));
}

async function save(form, submit) {
  const body = payload(form);
  const check = submit ? validatePenilaianKelayakanSubmit(body)
    : validatePenilaianKelayakan(body);
  if (showErrors(form, mapErrors(check.errors))) {
    return;
  }
  const buttons = [...form.querySelectorAll('[data-action="hpk-save"]')];
  buttons.forEach((b) => { b.disabled = true; });
  form.setAttribute('aria-busy', 'true');
  try {
    const itemId = form.dataset.itemId;
    const saved = itemId
      ? await updatePenilaianKelayakan(state.role, itemId, body)
      : await createPenilaianKelayakan(state.role, body);
    form.dataset.itemId = saved.id;
    const done = submit
      ? await submitPenilaianKelayakan(state.role, saved.id) : saved;
    invalidate();
    toast(submit ? `Pengajuan ${done.noHpk} dikirim ke verifikator.`
      : `Draft ${done.noHpk} tersimpan.`);
    go(PAGE, { id: done.id });
  } catch (error) {
    buttons.forEach((b) => { b.disabled = false; });
    form.removeAttribute('aria-busy');
    const known = Object.fromEntries(Object.entries(mapErrors(
      error.fields ?? {})).filter(([id]) => qs(`#${id}-error`, form)));
    showErrors(form, Object.keys(known).length ? known
      : { 'hpk-form': error.message });
  }
}

export function mount(root) {
  const form = qs('#hpk-form', root);
  if (!form) {
    return;
  }
  form.addEventListener('input', ({ target }) => {
    const slot = target.id && qs(`#${target.id}-error`, form);
    if (slot && target.value !== '') {
      slot.hidden = true;
      target.removeAttribute('aria-invalid');
    }
  });
  form.addEventListener('change', (event) => {
    if (event.target.id === 'pk-jenis') {
      changeJenis(form, event.target.value);
    } else if (event.target.matches('[data-hpk-doc]')) {
      pickDocument(event.target.dataset.hpkDoc, event.target.files?.[0]);
    }
  });
}

/** Tambah / hapus baris jabatan; baris lain tetap mempertahankan isiannya. */
function changeJabatan(edit, fokusBaru) {
  const f = current.formulir?.fields.find((x) => x.tipe === 'daftar-jabatan');
  if (!f) {
    return;
  }
  const rows = edit(readJabatanRaw());
  f.nilai = rows;
  setHtml(qs('#pk-jabatan-list'), jabatanRows(f, rows));
  const target = fokusBaru ? qsa('[data-jab="nama"]').at(-1)
    : qs('[data-action="hpk-jab-add"]');
  target?.focus();
}

export const actions = {
  'hpk-jab-add'() {
    changeJabatan((rows) => [...rows, { ...JABATAN_KOSONG }], true);
  },
  'hpk-jab-del'(el) {
    changeJabatan((rows) => rows.filter((_, i) => i !== Number(el.dataset.idx)));
  },
  'hpk-save'(el) {
    save(qs('#hpk-form'), el.dataset.submit === '1');
  },
  'hpk-form-retry'() {
    const form = qs('#hpk-form');
    changeJenis(form, qs('#pk-jenis', form).value);
  },
  'hpk-ocr-retry'(el) {
    pickDocument(el.dataset.kunci, current.files[el.dataset.kunci]);
  },
};
