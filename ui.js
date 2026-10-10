/**
 * @fileoverview Markup fragments shared by the portal views (cards, page
 * titles, form fields, wizard step nav, document rows, pager slots,
 * dialogs, toast). Every fragment returns SafeHtml built with html``.
 */

import { html, qs, qsa, raw, setHtml } from '../../components/dom.js';
import { createPager } from '../../components/pagination.js';
import { statusBadge } from '../../components/status-badge.js';

export const CARD = 'rounded-box border border-base-300 bg-base-100';
export const BTN = 'btn btn-primary';
export const BTN_OUTLINE =
  'btn border-base-content/20 bg-base-100 shadow-none hover:bg-base-200';
export const LINK = 'link link-hover link-secondary font-bold';
export const LINK_MUTED = 'link link-hover font-bold text-base-content/70';
export const H1 = 'text-[26px] font-extrabold tracking-tight';
export const EYEBROW = 'text-sm text-base-content/60';
export const THEAD = 'bg-base-200/50 text-xs font-bold text-base-content/60';
export const MONO = 'font-mono';
/** Yellow badge on navy/warning surfaces (`.badge-highlight`, css/base.css). */
export const BADGE_HIGHLIGHT = 'badge badge-highlight border-0';
export const CALLOUT_INFO =
  'rounded-box border border-info/20 bg-info/10 px-4 py-3.5 text-sm ' +
  'leading-relaxed text-base-content/80';
export const CALLOUT_WARN =
  'rounded-box border border-warning/30 bg-warning/10 px-4 py-3.5 ' +
  'text-sm leading-relaxed text-base-content/80';

/** Attributes for a navigation button: data-action="go". */
export function navAttrs(page, params = {}) {
  return html`data-action="go" data-page="${page}"
    data-params="${JSON.stringify(params)}"`;
}

/**
 * Ringkasan "Riwayat Terkait" (revisi akun pemberi kerja, poin 7): daftar
 * Perubahan/Pencabutan/Perpanjangan untuk satu TKA (lihat `rptka-data.js`
 * `relasiTka`), dipakai di pemilih "Nomor RPTKA" pada Perpanjangan,
 * Perubahan, dan Pencabutan — satu komponen bersama supaya tampilannya
 * konsisten di ketiga alur. Perpanjangan & Perubahan punya halaman
 * detail yang bisa ditautkan langsung; Pencabutan belum (lihat
 * `pencabutan.js`), jadi barisnya cukup teks ringkasan.
 * @param {{perubahan: !Array, pencabutan: !Array, perpanjangan: !Array}} relasi
 */
export function riwayatTerkaitRingkas(relasi) {
  const grup = (judul, items, row) => items.length ? html`<div>
    <p class="text-xs font-semibold text-base-content/60">${judul}</p>
    <ul class="grid gap-1">${items.map(row)}</ul></div>` : '';
  return html`<div class="${CALLOUT_INFO} grid gap-3">
    <p class="font-bold">Riwayat Terkait</p>
    ${grup('Perpanjangan RPTKA', relasi.perpanjangan, (r) => html`<li>
      <button type="button" class="${LINK} text-[13px]"
        ${navAttrs('rptka', { id: r.id })}>${r.noAjuan} ·
        ${statusBadge(r.status, r.tone)}</button></li>`)}
    ${grup('Perubahan RPTKA', relasi.perubahan, (c) => html`<li>
      <button type="button" class="${LINK} text-[13px]"
        ${navAttrs('perubahanDetail', { id: c.id })}>${c.jenis} ·
        ${statusBadge(c.status, c.tone)}</button></li>`)}
    ${grup('Pencabutan RPTKA', relasi.pencabutan, (x) => html`<li
      class="text-[13px]">${x.alasan} · ${x.tgl} ·
      ${statusBadge(x.status, x.tone)}</li>`)}
  </div>`;
}

/** Button that is visible in the legacy UI but has no behavior yet. */
export function noopAttrs(label) {
  return html`data-action="noop" data-label="${label}"`;
}

/**
 * Page heading (h1 + description) with optional actions. The location trail
 * lives only in the navbar breadcrumb (`#crumb`), so there is no eyebrow;
 * any `eyebrow` option passed by callers is ignored.
 * @param {{title: string, desc: (string|undefined),
 *     actions: (!Object|undefined), back: (!Object|undefined)}} options
 */
export function pageTitle({ title, desc, actions, back }) {
  return html`
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div class="min-w-0">
        ${back ?? ''}
        <h1 class="${H1} mt-1">${title}</h1>
        ${desc ? html`<p class="mt-1.5 max-w-3xl text-sm leading-relaxed
          text-base-content/70">${desc}</p>` : ''}
      </div>
      ${actions ?? ''}
    </div>`;
}

/** Card with a bold header row. */
export function cardHeader(title, extra = '') {
  return html`<div class="flex flex-wrap items-center justify-between gap-2.5
      border-b border-base-200 px-5 py-4">
    <h2 class="text-[15px] font-bold">${title}</h2>${extra}</div>`;
}

/** Centered muted empty text. */
export function emptyText(text, extraClass = '') {
  return html`<p class="px-5 py-7 text-center text-sm text-base-content/60
    ${extraClass}">${text}</p>`;
}

/** Text input with label + error slot. */
export function field({
  id, label, value = '', span = '', type = 'text', attrs = '', hint = '',
  inputClass = '',
}) {
  const hintEl = hint
    ? html`<p id="${id}-hint" class="text-xs text-base-content/60">
        ${hint}</p>`
    : '';
  const describedBy = hint ? `${id}-hint ${id}-error` : `${id}-error`;
  return html`<div class="grid content-start gap-1.5 ${span}">
    <label for="${id}" class="text-sm font-bold">${label}</label>
    <input id="${id}" name="${id}" type="${type}" value="${value}"
      class="input h-11 w-full ${inputClass}"
      aria-describedby="${describedBy}" ${attrs}>
    ${hintEl}${fieldError(id)}</div>`;
}

/** Read-only value displayed like a disabled input. */
export function readonlyField({ id, label, value, span = '' }) {
  return html`<div class="grid content-start gap-1.5 ${span}">
    <label for="${id}" class="text-sm font-bold">${label}</label>
    <input id="${id}" type="text" readonly value="${value ?? ''}"
      class="input h-11 w-full border-base-300 bg-base-200/50"></div>`;
}

/** Select with fixed options. */
export function selectField({ id, label, options, selected, span = '' }) {
  return html`<div class="grid content-start gap-1.5 ${span}">
    <label for="${id}" class="text-sm font-bold">${label}</label>
    <select id="${id}" name="${id}" class="select h-11 w-full">
      ${options.map((o) => html`<option ${o === selected ? 'selected' : ''}>
        ${o}</option>`)}
    </select></div>`;
}

/** Textarea with label, live counter and error slot. */
export function textareaField({
  id, label, value = '', rows = 3, span = '', max = 0, min = 0,
  placeholder = '',
}) {
  const counter = max
    ? html`<span class="font-normal text-base-content/60" aria-hidden="true"
        data-counter-for="${id}">${value.length} / ${max}</span>`
    : '';
  const limits = raw(`${max ? `maxlength="${max}"` : ''}
    ${min ? `minlength="${min}"` : ''}`);
  return html`<div class="grid gap-1.5 ${span}">
    <label for="${id}" class="flex justify-between text-sm font-bold">
      <span>${label}</span>${counter}</label>
    <textarea id="${id}" name="${id}" rows="${rows}" ${limits}
      placeholder="${placeholder}" data-counter="${max ? 'on' : ''}"
      class="textarea w-full text-sm leading-relaxed"
      aria-describedby="${id}-error">${value}</textarea>
    ${fieldError(id)}</div>`;
}

/** Hidden error slot for a field (filled by showErrors). */
export function fieldError(id) {
  return html`<p id="${id}-error" class="text-xs font-semibold text-error"
    aria-live="polite" hidden></p>`;
}

/**
 * Indonesian message for an invalid input (browser validationMessage
 * follows the browser locale). Empty string when the input is valid.
 * @param {!HTMLInputElement} input
 * @return {string}
 */
export function validityMessage(input) {
  const v = input.validity;
  if (v.valid) {
    return '';
  }
  if (v.valueMissing) {
    return 'Wajib diisi.';
  }
  if (v.rangeUnderflow || v.rangeOverflow || v.badInput) {
    return `Isi angka ${input.min}–${input.max}.`;
  }
  if (v.tooShort || v.tooLong) {
    return `Panjang ${input.minLength > 0 ? `min. ${input.minLength} ` : ''}` +
      `${input.maxLength > 0 ? `maks. ${input.maxLength} ` : ''}karakter.`;
  }
  return 'Format tidak valid.';
}

/**
 * Show validation messages next to fields; clears previous ones in root.
 * @param {!Element} root
 * @param {!Object<string, string>} errors id -> message
 * @return {boolean} true when there were errors.
 */
export function showErrors(root, errors) {
  for (const el of qsa('[id$="-error"]', root)) {
    el.hidden = true;
    el.textContent = '';
  }
  for (const el of qsa('[aria-invalid="true"]', root)) {
    el.removeAttribute('aria-invalid');
  }
  const entries = Object.entries(errors);
  for (const [id, message] of entries) {
    const slot = qs(`#${id}-error`, root);
    const input = qs(`#${id}`, root);
    if (slot) {
      slot.textContent = message;
      slot.hidden = false;
    }
    input?.setAttribute('aria-invalid', 'true');
  }
  if (entries.length) {
    qs(`#${entries[0][0]}`, root)?.focus();
  }
  return entries.length > 0;
}

/** Native checkbox bound to state.ui.agree (see main change handler). */
export function agreeCheck(label, checked) {
  return html`<label class="flex cursor-pointer items-center gap-3 text-sm
      font-semibold">
    <input type="checkbox" class="checkbox checkbox-secondary" data-agree
      ${checked ? 'checked' : ''}>${label}</label>`;
}

const DOT_CLASS = {
  err: 'bg-error text-error-content',
  done: 'bg-success text-success-content',
  cur: 'bg-secondary text-secondary-content',
  todo: 'bg-base-300 text-base-content/70',
};

/**
 * Vertical wizard step navigation.
 * @param {!Array<{label: string, kind: string, dot: string,
 *     note: (string|undefined)}>} steps
 * @param {number} current
 * @param {string} action data-action handling step clicks.
 */
export function stepNav(steps, current, action) {
  return html`<nav aria-label="Langkah permohonan"
      class="${CARD} p-2.5 lg:sticky lg:top-32">
    <ol class="grid gap-0.5">${steps.map((s, i) => html`<li>
      <button type="button" data-action="${action}" data-step="${i}"
        ${i === current ? raw('aria-current="step"') : ''}
        class="flex w-full items-center gap-3 rounded-field px-3 py-2.5
          text-left ${i === current
            ? 'bg-info/10 text-primary'
            : 'text-base-content/80 hover:bg-base-200'}">
        <span class="grid size-6 flex-none place-items-center rounded-full
          text-[11px] font-extrabold ${DOT_CLASS[s.kind]}"
          aria-hidden="true">${s.dot}</span>
        <span class="text-sm font-semibold leading-snug">${s.label}
          ${s.note ? html`<span class="block text-[11px] text-error">
            ${s.note}</span>` : ''}</span>
      </button></li>`)}</ol></nav>`;
}

/**
 * Document row (upload lists).
 * @param {{nama: string, sub: string, badge: !Object,
 *     note: (string|undefined), actions: !Object}} doc
 */
export function docRow({ nama, sub, badge, note, actions }) {
  return html`<li class="grid items-center gap-3 rounded-box border
      border-base-300 px-4 py-3 md:grid-cols-[minmax(160px,1fr)_130px_auto]">
    <div><p class="text-sm font-semibold">${nama}</p>
      <p class="text-xs text-base-content/60">${sub}</p>
      ${note ? html`<p class="mt-0.5 text-xs font-semibold text-error">
        Alasan: ${note}</p>` : ''}</div>
    <div>${badge}</div>
    <div class="flex justify-start gap-1.5 md:justify-end">${actions}</div>
  </li>`;
}

/** Empty footer slot for createPager. */
export function pagerSlot(id) {
  return html`<div id="${id}" class="border-t border-base-200
    bg-base-200/50" hidden></div>`;
}

/**
 * Paginate `items` into `bodySelector` using the shared pager.
 * @param {!Element} root
 * @param {{body: string, footer: string, items: !Array<*>,
 *     row: function(*): !Object, empty: (!Object|undefined)}} options
 */
export function mountPaged(root, { body, footer, items, row, empty }) {
  const bodyEl = qs(body, root);
  const footerEl = qs(footer, root);
  if (!bodyEl || !footerEl) {
    return;
  }
  const pager = createPager(footerEl, { onChange: draw });
  function draw() {
    const rows = pager.update(items);
    setHtml(bodyEl, rows.length ? html`${rows.map(row)}` : (empty ?? html``));
  }
  draw();
}

/** Loading skeleton for the main view. */
export function loadingView() {
  return html`<div class="grid gap-5" aria-busy="true">
    <span class="sr-only" role="status">Memuat data…</span>
    <div class="skeleton h-9 w-72"></div>
    <div class="grid gap-4 md:grid-cols-4">
      ${[1, 2, 3, 4].map(() => html`<div class="skeleton h-28"></div>`)}
    </div>
    <div class="skeleton h-64 w-full"></div></div>`;
}

/** Error state with retry button. */
export function errorView(message, action = 'retry') {
  return html`<div role="alert" class="alert alert-error alert-soft">
    <span>${message}</span>
    <button type="button" class="btn btn-sm" data-action="${action}"
      data-testid="portal-btn-retry">Coba lagi</button></div>`;
}

/** Open a <dialog> with content; size = max-w class of .modal-box. */
export function openDialog(id, content, size = 'max-w-3xl') {
  const dialog = qs(`#${id}`);
  const box = qs('.modal-box', dialog);
  if (box.dataset.size) {
    box.classList.remove(box.dataset.size);
  }
  box.classList.add(size);
  box.dataset.size = size;
  setHtml(qs('[data-dialog-body]', dialog), content);
  nameDialog(dialog);
  if (!dialog.open) {
    dialog.showModal();
  }
}

/**
 * Accessible name from the dialog's own heading (falls back to the static
 * aria-label of the shared dialog when the content has no heading).
 * @param {!HTMLDialogElement} dialog
 */
function nameDialog(dialog) {
  const heading = qs('[data-dialog-body] h2, [data-dialog-body] h3', dialog);
  if (!heading) {
    dialog.removeAttribute('aria-labelledby');
    return;
  }
  heading.id ||= `${dialog.id}-title`;
  dialog.setAttribute('aria-labelledby', heading.id);
}

/** Close a <dialog> if open. */
export function closeDialog(id) {
  const dialog = qs(`#${id}`);
  if (dialog?.open) {
    dialog.close();
  }
}

/** Close button (form method=dialog) for dialog headers. */
export function dialogClose() {
  return html`<form method="dialog"><button class="btn btn-ghost btn-sm
    btn-square text-xl text-base-content/60" aria-label="Tutup">×</button>
    </form>`;
}

const TOAST_MS = 3000;

/** Transient message (DaisyUI toast + alert). */
export function toast(message, tone = 'success') {
  const host = qs('#toast');
  const el = document.createElement('div');
  el.className = `alert alert-${tone} text-sm shadow-lg animate-fade-in`;
  el.setAttribute('role', 'status');
  el.textContent = message;
  host.append(el);
  setTimeout(() => el.remove(), TOAST_MS);
}
