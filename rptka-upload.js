/**
 * @fileoverview Unggah dokumen Form RPTKA: cek format & ukuran (RP-05),
 * OCR dokumen (paspor, ijazah) yang langsung mengisi Data TKA, pratinjau
 * gambar JPG langsung di baris dokumen, simpan metadata berkas ke sesi kerja.
 * Berkas asli hanya ada di memori sesi (S.files).
 */

import { ApiError } from '../../api/http.js';
import { extractDocument } from '../../api/ocr.js';
import { simpanBerkas } from '../../components/berkas-store.js';
import { html, qs, setHtml } from '../../components/dom.js';
import { bukaPratinjau } from '../../components/doc-preview.js';
import {
  DOKUMEN, KOLOM_TKA, tanggalIsoDariId, validateRptkaFile,
} from '../../contracts/pengesahan-rptka.js';
import { docId } from './rptka-docs-view.js';
import { berkasKey } from './rptka-data.js';
import { toast } from './ui.js';

const UNREADABLE = 'Dokumen tidak terbaca, unggah ulang yang lebih jelas.';
const sizeKb = (file) => Math.max(1, Math.ceil(file.size / 1024));

/** @param {string} scope "t<i>" | "j<i>" | "p" @return {{kind: string, i: number}} */
function parseScope(scope) {
  return { kind: scope[0], i: Number(scope.slice(1)) || 0 };
}

function message(id, text) {
  const slot = qs(`#${id}-error`);
  const input = qs(`#${id}`);
  if (slot) {
    slot.textContent = text;
    slot.hidden = !text;
  }
  input?.setAttribute('aria-invalid', String(Boolean(text)));
  input?.classList.toggle('file-input-error', Boolean(text));
}

/**
 * Isi Data TKA dari hasil OCR (nilai + keyakinan per kolom); `terisi` =
 * label kolom yang terisi, dipakai ringkasan di baris dokumen.
 */
function applyOcr(S, i, kunci, result) {
  const t = S.w.tka[i];
  result.terisi = [];
  for (const f of result.fields) {
    const col = KOLOM_TKA.find((c) => c.ocr === f.kunci);
    const nilai = col?.tipe === 'tanggal' ? tanggalIsoDariId(f.nilai)
      : f.nilai;
    if (col && nilai) {
      t.data[col.kunci] = nilai;
      t.ocr[col.kunci] = f.keyakinan;
      result.terisi.push(col.label);
    }
  }
  S.ocr[berkasKey(t, kunci)] = result;
}

/** Kunci berkas sesi: tahan terhadap pergeseran indeks jabatan/TKA. */
function fileKey(S, scope, kunci) {
  const { kind, i } = parseScope(scope);
  if (kind === 'p') {
    return `permohonan:${kunci}`;
  }
  return kind === 't' ? berkasKey(S.w.tka[i], kunci)
    : `${S.w.jabatan[i].nama}:${kunci}`;
}

/** Simpan berkas (IndexedDB, agar bisa dipratinjau akun lain) + metadata. */
async function commit(S, scope, kunci, file) {
  const { kind, i } = parseScope(scope);
  const berkasId = await simpanBerkas(file);
  const saved = { namaBerkas: file.name, ukuranKb: sizeKb(file),
    ...(berkasId ? { berkasId } : {}) };
  if (kind === 'p') {
    (S.w.dokumenPermohonan ??= {})[kunci] = saved;
  } else if (kind === 't') {
    S.w.tka[i].dokumen[kunci] = saved;
  } else {
    const nama = S.w.jabatan[i].nama;
    (S.w.dokumenJabatan[nama] ??= {})[kunci] = saved;
  }
  const key = fileKey(S, scope, kunci);
  S.files.set(key, file);
  URL.revokeObjectURL(S.urls.get(key));
  S.urls.delete(key);
  if (/\.(jpe?g|png)$/i.test(file.name)) {
    S.urls.set(key, URL.createObjectURL(file));
  }
  delete S.errors[errorKey(S, scope, kunci)];
}

/** Path error validator untuk sebuah slot dokumen. */
export function errorKey(S, scope, kunci) {
  const { kind, i } = parseScope(scope);
  if (kind === 'p') {
    return `dokumenPermohonan.${kunci}`;
  }
  return kind === 't' ? `tka.${i}.dokumen.${kunci}`
    : `dokumenJabatan.${S.w.jabatan[i]?.nama}.${kunci}`;
}

/**
 * Validasi + (OCR) + simpan satu berkas yang dipilih.
 * @param {!Object} S sesi kerja
 * @param {!HTMLInputElement} input
 * @param {function(string)} repaint dipanggil dengan id input untuk fokus
 */
export async function pickDocument(S, input, repaint) {
  const file = input.files?.[0];
  const { rpDoc: scope, kunci } = input.dataset;
  if (!file) {
    return;
  }
  const rule = DOKUMEN[kunci];
  const id = docId(scope, kunci);
  const problem = validateRptkaFile({ namaBerkas: file.name,
    ukuranKb: sizeKb(file) }, rule);
  if (problem) {
    input.value = '';
    message(id, problem);
    return;
  }
  message(id, '');
  if (!rule.ocr) {
    await commit(S, scope, kunci, file);
    repaint(`${id}-ganti`);
    return;
  }
  await readOcr(S, { scope, kunci, file, id, input, jenis: rule.ocr },
    repaint);
}

async function readOcr(S, ctx, repaint) {
  const { scope, kunci, file, id, input, jenis } = ctx;
  const slot = qs(`#${id}-ocr`);
  slot.setAttribute('aria-busy', 'true');
  setHtml(slot, html`<div class="skeleton h-24 w-full"></div>
    <span class="sr-only" role="status">Membaca dokumen…</span>`);
  try {
    const result = await extractDocument({ jenisDokumen: jenis,
      fileName: file.name, ukuranKb: sizeKb(file) });
    const { i } = parseScope(scope);
    await commit(S, scope, kunci, file);
    applyOcr(S, i, kunci, result);
    const n = result.terisi.length;
    toast(result.perluPeriksa
      ? `${n} kolom Data TKA terisi otomatis. Periksa kolom berkeyakinan rendah.`
      : `${n} kolom Data TKA terisi otomatis dari dokumen.`,
    result.perluPeriksa ? 'warning' : 'success');
    repaint(`${id}-ganti`);
  } catch (error) {
    setHtml(slot, html``);
    slot.setAttribute('aria-busy', 'false');
    const unreadable = error instanceof ApiError &&
      error.code === 'OCR_UNREADABLE';
    if (unreadable) {
      input.value = '';
    }
    message(id, unreadable ? UNREADABLE
      : `Gagal membaca dokumen: ${error.message}`);
    if (!unreadable) {
      qs(`#${id}-error`).insertAdjacentHTML('beforeend', ' <button ' +
        `type="button" class="btn btn-xs" data-action="rptka-ocr-retry" ` +
        `data-input="${id}">Coba lagi</button>`);
    }
  }
}

/** Pratinjau berkas (dari berkas-store; lembar contoh bila tidak ada). */
export function previewDialog(S, scope, kunci) {
  const { kind, i } = parseScope(scope);
  const saved = kind === 'p' ? S.w.dokumenPermohonan[kunci]
    : kind === 't' ? S.w.tka[i].dokumen[kunci]
      : S.w.dokumenJabatan[S.w.jabatan[i].nama][kunci];
  return bukaPratinjau({ judul: DOKUMEN[kunci].label,
    namaBerkas: saved.namaBerkas, ukuranKb: saved.ukuranKb,
    berkasId: saved.berkasId ?? null });
}
