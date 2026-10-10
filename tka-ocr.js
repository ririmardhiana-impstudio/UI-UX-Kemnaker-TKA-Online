/**
 * @fileoverview OCR paspor for the Data calon TKA wizard (KAK Modul 6):
 * upload paspor -> POST /ocr/extractions -> ocrPanel -> "Terapkan ke
 * formulir" fills nama / no. paspor / kewarganegaraan / berlaku s.d.
 * Result + applied values live in state.ui (reset on navigation).
 */

import { ApiError } from '../../api/http.js';
import { extractDocument, ocrRequestFromFile } from '../../api/ocr.js';
import { html, qs, raw, setHtml } from '../../components/dom.js';
import { ocrPanel, ocrSummary } from '../../components/ocr-panel.js';
import { validateOcrRequest } from '../../contracts/analitik.js';
import { state } from './state.js';
import { toast } from './ui.js';

const FILE_INPUT_ID = 't-ocr-file';
const UNREADABLE_MESSAGE =
  'Dokumen tidak terbaca, unggah ulang yang lebih jelas.';

/** OCR field key -> wizard input id + candidate key. */
const FIELD_MAP = {
  nama: { input: 't-nama', key: 'nama' },
  nomorPaspor: { input: 't-paspor', key: 'paspor' },
  kewarganegaraan: { input: 't-negara', key: 'negara' },
  berlakuSampai: { input: 't-paspor-exp', key: 'pasporExp' },
};

let lastFile = null;

/**
 * Candidate values with applied OCR values on top.
 * @param {!Object} tf
 * @return {!Object}
 */
export function withOcrValues(tf) {
  return { pasporExp: '14 Maret 2031', ...tf,
    ...(state.ui.tkaOcrApplied ?? {}) };
}

/** Upload block shown at the top of the "Data calon TKA" step. */
export function ocrBlock() {
  return html`<div class="grid gap-3 rounded-box border border-dashed
      border-info/40 bg-base-200/50 p-4">
    <div class="grid items-center gap-3 md:grid-cols-[1fr_auto]">
      <div>
        <label for="${FILE_INPUT_ID}" class="text-sm font-bold">Isi otomatis
          dari paspor (OCR)</label>
        <p id="${FILE_INPUT_ID}-hint" class="text-xs text-base-content/70">
          Hanya untuk isi otomatis (JPG, PNG, atau PDF, maks. 2 MB); berkas
          paspor resmi tetap diunggah di langkah Dokumen (JPG berwarna,
          maks. 250 KB). Hasil baca tetap wajib diperiksa.</p>
      </div>
      <input id="${FILE_INPUT_ID}" type="file"
        accept="image/jpeg,image/png,application/pdf"
        class="file-input file-input-sm w-full md:w-64"
        aria-describedby="${FILE_INPUT_ID}-hint ${FILE_INPUT_ID}-error"
        data-testid="tka-wizard-input-ocr">
    </div>
    <p id="${FILE_INPUT_ID}-error" class="text-xs font-semibold text-error"
      aria-live="polite" hidden></p>
    <p id="t-ocr-status" role="status" class="sr-only"></p>
    <div id="t-ocr-result" aria-busy="false">
      ${state.ui.tkaOcr ? resultPanel(state.ui.tkaOcr) : ''}</div>
    <div id="t-ocr-undo">${state.ui.tkaOcrPrev ? undoBar() : ''}</div>
  </div>`;
}

function undoBar() {
  return html`<p class="flex flex-wrap items-center gap-2 text-xs
      text-base-content/70">Data paspor diterapkan ke formulir.
    <button type="button" class="btn btn-ghost btn-xs text-secondary"
      data-action="tka-ocr-undo" data-testid="tka-wizard-btn-ocr-undo">
      Batalkan penerapan</button></p>`;
}

function announce(message) {
  const status = qs('#t-ocr-status');
  if (status) {
    status.textContent = message;
  }
}

/** Mark (or clear) an input whose OCR confidence is below the threshold. */
function markLowConfidence(input, keyakinan, ambang) {
  const hintId = `${input.id}-ocr-hint`;
  qs(`#${hintId}`)?.remove();
  const ids = (input.getAttribute('aria-describedby') ?? '').split(' ')
    .filter((id) => id && id !== hintId);
  const isLow = keyakinan !== null && keyakinan < ambang;
  input.classList.toggle('input-warning', isLow);
  if (isLow) {
    const hint = document.createElement('p');
    hint.id = hintId;
    hint.className = 'text-xs font-semibold text-warning';
    hint.textContent = 'Periksa: keyakinan OCR ' +
      `${Math.round(keyakinan * 100)}%`;
    input.after(hint);
    ids.push(hintId);
  }
  input.setAttribute('aria-describedby', ids.join(' '));
}

function resultPanel(result) {
  return ocrPanel({
    id: 't-ocr-panel', title: 'Hasil baca paspor',
    fileName: result.fileName, fields: result.fields,
    perluPeriksa: result.perluPeriksa, ambang: result.ambangKeyakinan,
    apply: { attrs: raw('data-action="tka-ocr-apply" ' +
      'data-testid="tka-wizard-btn-ocr-apply"') },
  });
}

function showError(message, withRetry = false) {
  const errorEl = qs(`#${FILE_INPUT_ID}-error`);
  const input = qs(`#${FILE_INPUT_ID}`);
  if (!errorEl) {
    return;
  }
  errorEl.hidden = !message;
  errorEl.textContent = message;
  input?.setAttribute('aria-invalid', String(Boolean(message)));
  input?.classList.toggle('file-input-error', Boolean(message));
  if (withRetry) {
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'btn btn-xs ms-2';
    retry.dataset.action = 'tka-ocr-retry';
    retry.textContent = 'Coba lagi';
    errorEl.append(retry);
  }
}

async function readPassport(file) {
  const resultEl = qs('#t-ocr-result');
  if (!file || !resultEl) {
    return;
  }
  lastFile = file;
  const request = ocrRequestFromFile('Paspor', file);
  const check = validateOcrRequest(request);
  if (!check.valid) {
    showError(check.errors.ukuranKb ?? check.errors.fileName ??
      Object.values(check.errors)[0]);
    return;
  }
  showError('');
  state.ui.tkaOcr = null;
  resultEl.setAttribute('aria-busy', 'true');
  setHtml(resultEl, html`<div class="grid gap-2">
    <span class="text-xs text-base-content/70">Membaca paspor…</span>
    <div class="skeleton h-28 w-full"></div></div>`);
  try {
    const result = await extractDocument(request);
    state.ui.tkaOcr = result;
    setHtml(resultEl, resultPanel(result));
    announce(ocrSummary('Hasil baca paspor', result));
  } catch (error) {
    setHtml(resultEl, html``);
    const unreadable = error instanceof ApiError &&
      error.code === 'OCR_UNREADABLE';
    if (unreadable) {
      qs(`#${FILE_INPUT_ID}`).value = '';
    }
    showError(unreadable ? UNREADABLE_MESSAGE
      : `Gagal membaca dokumen: ${error.message}`, !unreadable);
    announce('');
  } finally {
    resultEl.setAttribute('aria-busy', 'false');
  }
}

document.addEventListener('change', (event) => {
  if (event.target?.id === FILE_INPUT_ID) {
    readPassport(event.target.files?.[0]);
  }
});

export const ocrActions = {
  'tka-ocr-retry'() {
    readPassport(lastFile);
  },
  'tka-ocr-apply'() {
    const result = state.ui.tkaOcr;
    if (!result) {
      return;
    }
    const applied = {};
    const previous = { values: {}, applied: state.ui.tkaOcrApplied ?? null };
    for (const f of result.fields) {
      const target = FIELD_MAP[f.kunci];
      const input = target ? qs(`#${target.input}`) : null;
      if (input) {
        previous.values[target.input] = input.value;
        input.value = f.nilai;
        applied[target.key] = f.nilai;
        markLowConfidence(input, f.keyakinan, result.ambangKeyakinan);
      }
    }
    state.ui.tkaOcrApplied = applied;
    state.ui.tkaOcrPrev = previous;
    setHtml(qs('#t-ocr-undo'), undoBar());
    qs(`#${FIELD_MAP.nama.input}`)?.focus();
    toast(result.perluPeriksa
      ? 'Data paspor diterapkan. Periksa kembali field berkeyakinan rendah.'
      : 'Data paspor diterapkan ke formulir.',
    result.perluPeriksa ? 'warning' : 'success');
  },
  'tka-ocr-undo'() {
    const previous = state.ui.tkaOcrPrev;
    if (!previous) {
      return;
    }
    for (const [id, value] of Object.entries(previous.values)) {
      const input = qs(`#${id}`);
      if (input) {
        input.value = value;
        markLowConfidence(input, null, 0);
      }
    }
    state.ui.tkaOcrApplied = previous.applied;
    state.ui.tkaOcrPrev = null;
    setHtml(qs('#t-ocr-undo'), html``);
    qs(`#${FIELD_MAP.nama.input}`)?.focus();
    toast('Penerapan data paspor dibatalkan.', 'info');
  },
};
