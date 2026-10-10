/**
 * @fileoverview Document annotations on the Back Office review screen
 * (KAK Modul 5 "alat verifikasi dan validasi dokumen dengan catatan
 * anotasi", usulan [I]). Clicking the preview places a numbered pin; the
 * "Tambah anotasi" form is the keyboard path (halaman + "Bagian halaman"
 * 3×3 region select for the pin position). Only the stage currently
 * holding the file may add or delete its own pins (API: 409 otherwise).
 */

import {
  addAnnotation, deleteAnnotation, listAnnotations,
} from '../../api/antrian.js';
import { html, qs, setHtml } from '../../components/dom.js';
import { emptyState } from '../../components/empty-state.js';
import {
  ANNOTATION_NOTE_MAX, validateAnnotation,
} from '../../contracts/back-office.js';
import {
  clampPercent, positionText, regionSelect,
} from './annotation-position.js';
import {
  CARD, ensureDialog, errorSlot, setButtonBusy, showFieldErrors, showToast,
} from './ui.js';

/** Page shown by the static preview ("1 / 3"). */
const PREVIEW_PAGE = 1;
const DEFAULT_DRAFT = { rqId: null, x: 50, y: 50, placed: false,
  halaman: '1', catatan: '' };

/**
 * @param {{state: !Object, setState: function(!Object), role: function()}} ctx
 * @return {{ensure: function(string), overlay: function(!Object, string):
 *     !Object, panel: function(!Object, string): !Object}}
 */
export function createAnnotationView(ctx) {
  const reviewEl = qs('#page-review');
  const confirmDialog = ensureDialog('annotation-confirm',
    'annotation-confirm-title');
  /**
   * Pins per antrian id.
   * @type {!Object<string, {status: string, items: !Array, error: ?string}>}
   */
  const cache = {};
  let draft = { ...DEFAULT_DRAFT };
  let pendingDelete = null;

  reviewEl.addEventListener('click', onClick);
  reviewEl.addEventListener('input', onInput);
  reviewEl.addEventListener('submit', onSubmit);
  confirmDialog.addEventListener('click', onConfirmClick);

  function current() {
    const { state } = ctx;
    return state.data.antrian.find((q) => q.id === state.sel) ?? null;
  }

  function canAnnotate(rq) {
    return (ctx.role().stages ?? []).includes(rq.tahap);
  }

  /** Load the pins of an application once (re-render when done). */
  function ensure(id) {
    if (!cache[id]) {
      load(id);
    }
  }

  async function load(id) {
    cache[id] = { status: 'loading', items: [], error: null };
    try {
      cache[id] = { status: 'ok', items: await listAnnotations(id),
        error: null };
    } catch (error) {
      cache[id] = { status: 'error', items: [],
        error: error.message || 'Anotasi gagal dimuat.' };
    }
    ctx.setState({});
  }

  /** Start a fresh draft when another application is opened. */
  function syncDraft(rq) {
    if (draft.rqId !== rq.id) {
      draft = { ...DEFAULT_DRAFT, rqId: rq.id };
    }
  }

  /** Pins + click target rendered inside the preview page. */
  function overlay(rq, docActive) {
    syncDraft(rq);
    const entry = cache[rq.id];
    const pins = (entry?.items ?? []).filter((a) =>
      a.dokumen === docActive && a.halaman === PREVIEW_PAGE);
    const editable = canAnnotate(rq);
    return html`
      ${editable ? html`<button type="button" data-action="pin-place"
        data-focus-key="pin-place"
        class="absolute inset-0 cursor-crosshair rounded-none
               focus-visible:outline-2 focus-visible:outline-secondary"
        aria-label="Tempatkan pin anotasi pada ${docActive} halaman 1.
          Dengan keyboard, pilih Bagian halaman di formulir Tambah anotasi."
        ></button>`
        : ''}
      ${pins.map((a) => html`<button type="button" data-action="pin-focus"
        data-id="${a.id}" data-focus-key="pin-${a.id}"
        class="absolute z-10 grid size-6 -translate-x-1/2 -translate-y-1/2
               place-items-center rounded-full bg-error text-[11px]
               font-extrabold text-error-content shadow-md"
        style="left: ${a.x}%; top: ${a.y}%"
        aria-label="Anotasi ${a.nomor}: ${a.catatan}">${a.nomor}</button>`)}
      ${editable && draft.placed ? html`<span aria-hidden="true"
        class="absolute z-10 grid size-6 -translate-x-1/2 -translate-y-1/2
               place-items-center rounded-full border-2 border-secondary
               bg-base-100 text-[11px] font-extrabold text-secondary"
        style="left: ${draft.x}%; top: ${draft.y}%">+</span>` : ''}`;
  }

  /** Annotation list + "Tambah anotasi" form card. */
  function panel(rq, docActive) {
    syncDraft(rq);
    ensure(rq.id);
    const entry = cache[rq.id];
    const editable = canAnnotate(rq);
    const count = entry.status === 'ok' ? ` (${entry.items.length})` : '';
    return html`
      <section class="${CARD} overflow-auto" aria-labelledby="ann-title"
        aria-busy="${entry.status === 'loading'}">
        <h2 id="ann-title" tabindex="-1" class="border-b border-base-200
          px-4.5 py-3.5 font-bold focus:outline-none">
          Anotasi dokumen${count}</h2>
        ${listBody(entry, rq, editable)}
        ${editable ? form(docActive)
          : html`<p class="border-t border-base-200 px-4.5 py-3 text-xs
              text-base-content/70">Anotasi hanya dapat ditambahkan oleh
              tahap yang sedang memegang berkas (${rq.tahap}).</p>`}
      </section>`;
  }

  function listBody(entry, rq, editable) {
    if (entry.status === 'loading') {
      return html`<div class="grid gap-2 p-4.5">
        <div class="skeleton h-4 w-3/4"></div>
        <div class="skeleton h-4 w-1/2"></div></div>`;
    }
    if (entry.status === 'error') {
      return html`<div role="alert" class="alert alert-error alert-soft m-4
          text-sm"><span>${entry.error}</span>
        <button type="button" data-action="ann-retry"
          class="btn btn-sm btn-error">Coba lagi</button></div>`;
    }
    if (!entry.items.length) {
      return html`<div class="p-4.5">${emptyState({ icon: '⌖',
        title: 'Belum ada anotasi',
        body: editable ? 'Klik pratinjau dokumen atau isi formulir di bawah '
          + 'untuk menandai bagian yang perlu diperbaiki.' : '' })}</div>`;
    }
    return html`<ol class="grid">${entry.items.map((a) =>
      item(a, editable && a.tahap === rq.tahap))}</ol>`;
  }

  function item(a, isDeletable) {
    return html`
      <li id="ann-item-${a.id}" tabindex="-1"
        class="grid grid-cols-[auto_1fr_auto] items-start gap-3 border-t
               border-base-200 px-4.5 py-3 text-sm first:border-t-0
               focus:bg-info/10 focus:outline-none">
        <span class="grid size-6 place-items-center rounded-full bg-error
          text-[11px] font-extrabold text-error-content"
          aria-hidden="true">${a.nomor}</span>
        <div><p class="font-semibold">
            <span class="sr-only">Anotasi ${a.nomor}: </span>${a.catatan}</p>
          <p class="mt-0.5 text-xs text-base-content/70">
            ${a.dokumen} · hal. ${a.halaman} · ${a.penulis} · ${a.tahap}
            ${a.halaman === PREVIEW_PAGE ? '' : html`<span class="badge
              badge-ghost badge-sm ms-1">tidak tampil di pratinjau</span>`}
          </p>
        </div>
        ${isDeletable ? html`<button type="button" data-action="ann-delete"
          data-id="${a.id}" data-focus-key="ann-del-${a.id}"
          class="btn btn-ghost btn-xs text-error"
          aria-label="Hapus anotasi ${a.nomor}">Hapus</button>`
          : html`<span></span>`}
      </li>`;
  }

  function form(docActive) {
    return html`
      <form id="ann-form" novalidate
        class="grid gap-2.5 border-t border-base-200 px-4.5 py-3.5">
        <h3 class="text-sm font-bold">Tambah anotasi</h3>
        <p class="text-xs text-base-content/70">Dokumen
          <b class="text-base-content">${docActive}</b> ·
          <span id="ann-position" aria-live="polite">${positionText(draft, PREVIEW_PAGE)}</span>.
        </p>
        <div class="grid gap-2.5 sm:grid-cols-[96px_1fr]">
          <div>
            <label for="ann-halaman" class="text-xs font-bold">Halaman</label>
            <input id="ann-halaman" name="halaman" type="number" min="1"
              step="1" required data-focus-key="ann-halaman"
              value="${draft.halaman}"
              class="input input-sm mt-1 w-full"
              aria-describedby="ann-halaman-error">
            ${errorSlot('ann-halaman-error', 'halaman')}
          </div>
          <div>
            <label for="ann-catatan" class="text-xs font-bold">Catatan</label>
            <textarea id="ann-catatan" name="catatan" rows="2" required
              data-focus-key="ann-catatan"
              minlength="5" maxlength="${ANNOTATION_NOTE_MAX}"
              class="textarea textarea-sm mt-1 w-full resize-y"
              aria-describedby="ann-catatan-error"
              placeholder="Mis. paraf pemberi kerja belum ada"
              >${draft.catatan}</textarea>
            ${errorSlot('ann-catatan-error', 'catatan')}
          </div>
          ${regionSelect(draft)}
        </div>
        <div class="flex justify-end">
          <button type="submit" class="btn btn-primary btn-sm font-bold">
            Simpan anotasi</button>
        </div>
      </form>`;
  }

  function onClick(event) {
    const button = event.target.closest('button[data-action]');
    const rq = button && current();
    if (!rq) {
      return;
    }
    const { action, id } = button.dataset;
    if (action === 'pin-place') {
      placePin(event, button);
    } else if (action === 'pin-focus') {
      qs(`#ann-item-${CSS.escape(id)}`, reviewEl)?.focus();
    } else if (action === 'ann-delete') {
      openConfirm(rq, cache[rq.id].items.find((a) => a.id === id));
    } else if (action === 'ann-retry') {
      load(rq.id);
    }
  }

  /** Mouse click -> pin at the pointer; keyboard -> region select. */
  function placePin(event, button) {
    if (event.detail === 0) {
      qs('#ann-bagian', reviewEl)?.focus();
      return;
    }
    const rect = button.getBoundingClientRect();
    draft.x = clampPercent((event.clientX - rect.left) / rect.width);
    draft.y = clampPercent((event.clientY - rect.top) / rect.height);
    draft.placed = true;
    draft.halaman = String(PREVIEW_PAGE);
    ctx.setState({});
    qs('#ann-catatan', reviewEl)?.focus();
  }

  function onInput(event) {
    const { name, value } = event.target;
    if (event.target.form?.id !== 'ann-form') {
      return;
    }
    if (name === 'catatan') {
      draft.catatan = value;
    } else if (name === 'halaman') {
      draft.halaman = value;
      if (Number(value) !== PREVIEW_PAGE && draft.placed) {
        // A pin clicked on page 1 does not belong to another page.
        Object.assign(draft, { placed: false, x: 50, y: 50 });
        ctx.setState({});
      }
      updatePositionText();
    } else if (name === 'bagian' && value) {
      const [x, y] = value.split(',').map(Number);
      Object.assign(draft, { x, y,
        placed: Number(draft.halaman) === PREVIEW_PAGE });
      ctx.setState({});
      updatePositionText();
    }
  }

  function updatePositionText() {
    const slot = qs('#ann-position', reviewEl);
    if (slot) {
      slot.textContent = positionText(draft, PREVIEW_PAGE);
    }
  }

  async function onSubmit(event) {
    if (event.target.id !== 'ann-form') {
      return;
    }
    event.preventDefault();
    const formEl = event.target;
    const rq = current();
    const docActive = qs('#review-doc-name', reviewEl)?.textContent.trim();
    const body = { dokumen: docActive, halaman: Number(draft.halaman),
      catatan: draft.catatan.trim(), x: draft.x, y: draft.y,
      tahap: rq.tahap, penulis: ctx.role().nama };
    const check = validateAnnotation(body);
    if (showFieldErrors(formEl, check.errors)) {
      return;
    }
    const submit = qs('button[type="submit"]', formEl);
    setButtonBusy(submit, true);
    try {
      const created = await addAnnotation(rq.id, body);
      cache[rq.id].items.push(created);
      draft = { ...DEFAULT_DRAFT, rqId: rq.id };
      showToast(`Anotasi ${created.nomor} ditambahkan.`);
      ctx.setState({});
      qs(`#ann-item-${CSS.escape(created.id)}`, reviewEl)?.focus();
    } catch (error) {
      setButtonBusy(submit, false);
      if (error.status === 400) {
        showFieldErrors(formEl, error.fields);
      } else {
        showToast(error.message || 'Anotasi gagal disimpan.', 'error');
      }
    }
  }

  function openConfirm(rq, annotation) {
    if (!annotation) {
      return;
    }
    pendingDelete = { rq, annotation };
    setHtml(confirmDialog, html`
      <div class="modal-box grid max-w-md gap-3.5 p-7">
        <h2 id="annotation-confirm-title" class="text-lg font-bold">
          Hapus anotasi ${annotation.nomor}?</h2>
        <p class="text-sm text-base-content/80">${annotation.catatan}</p>
        <p class="text-xs text-base-content/70">Anotasi yang dihapus tidak
          tampil lagi bagi tahap berikutnya.</p>
        <p id="annotation-confirm-error" role="alert" tabindex="-1"
          class="text-sm font-semibold text-error" hidden></p>
        <div class="modal-action mt-1">
          <button type="button" data-confirm="cancel" class="btn">Batal</button>
          <button type="button" data-confirm="delete"
            class="btn btn-error font-bold">Hapus anotasi</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button type="submit">Tutup</button></form>`);
    confirmDialog.showModal();
    qs('[data-confirm="cancel"]', confirmDialog).focus();
  }

  async function onConfirmClick(event) {
    const button = event.target.closest('[data-confirm]');
    if (!button || !pendingDelete) {
      return;
    }
    if (button.dataset.confirm === 'cancel') {
      confirmDialog.close();
      return;
    }
    const { rq, annotation } = pendingDelete;
    setButtonBusy(button, true);
    try {
      await deleteAnnotation(rq.id, annotation.id, rq.tahap);
      const entry = cache[rq.id];
      entry.items = entry.items.filter((a) => a.id !== annotation.id);
      confirmDialog.close();
      showToast(`Anotasi ${annotation.nomor} dihapus.`);
      ctx.setState({});
      qs('#ann-title', reviewEl)?.focus();
    } catch (error) {
      setButtonBusy(button, false);
      const slot = qs('#annotation-confirm-error', confirmDialog);
      slot.textContent = error.message || 'Anotasi gagal dihapus. Coba lagi.';
      slot.hidden = false;
      slot.focus();
    }
  }

  return { ensure, overlay, panel };
}
