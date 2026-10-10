/**
 * @fileoverview Back Office "Notifikasi" (admin pusat, KAK Modul 7:
 * notifikasi dapat dikonfigurasi administrator). Table of events with
 * aktif / email / SMS toggles (push disabled until the mobile app exists),
 * pengingat hari for deadline events, template editor dialog, save per row
 * with validation (PUT /notification-settings/{event}). Page key
 * "notifikasi"; loads its own data (PAGE_NEEDS.notifikasi = []).
 */

import { ApiError } from '../../api/http.js';
import {
  listNotificationSettings, updateNotificationSetting,
} from '../../api/notifikasi.js';
import { html, qs, setHtml } from '../../components/dom.js';
import {
  PENGINGAT_MAX, PENGINGAT_MIN, PUSH_UNAVAILABLE_MESSAGE, TEMPLATE_MAX,
  TEMPLATE_MIN, validateNotificationSetting,
} from '../../contracts/notifikasi.js';
import { renderTemplateDialog } from './notif-template.js';
import { CARD, THEAD, pageHeader, preserveFocus, showToast } from './ui.js';

const TOGGLE = 'toggle toggle-sm toggle-secondary';
/** Error key -> data-field of the control to focus / mark invalid. */
const ERROR_FIELD = { kanal: 'email', pengingatHari: 'pengingatHari',
  aktif: 'aktif', template: 'template' };

/**
 * Called as createNotifConfigViews(ctx) like the other views; the view keeps
 * its own state, so the shared ctx is not needed.
 * @return {{renderNotifConfig: function()}}
 */
export function createNotifConfigViews() {
  const root = qs('#page-notifikasi');
  const view = { mounted: false, status: 'idle', error: '', rows: [],
    drafts: {}, errors: {}, busy: null };
  const dialog = renderTemplateDialog({ onSave: saveTemplate });

  root.addEventListener('change', onChange);
  root.addEventListener('input', onChange);
  root.addEventListener('click', onClick);

  function renderNotifConfig() {
    if (!view.mounted) {
      view.mounted = true;
      load();
    }
  }

  async function load() {
    view.status = 'loading';
    render();
    try {
      view.rows = await listNotificationSettings();
      view.status = 'ok';
    } catch (error) {
      view.status = 'error';
      view.error = error.message;
    }
    render();
  }

  function draftOf(event) {
    const row = view.rows.find((r) => r.event === event);
    view.drafts[event] ??= structuredClone({ aktif: row.aktif,
      kanal: row.kanal, template: row.template,
      pengingatHari: row.pengingatHari });
    return view.drafts[event];
  }

  function isDirty(row) {
    const draft = view.drafts[row.event];
    return Boolean(draft) && JSON.stringify(draft) !== JSON.stringify({
      aktif: row.aktif, kanal: row.kanal, template: row.template,
      pengingatHari: row.pengingatHari });
  }

  function render() {
    preserveFocus(root, () => setHtml(root, page()));
    fillErrors();
  }

  /**
   * Error slots are rendered empty and filled after render so the
   * aria-live region sees a text change and announces it.
   */
  function fillErrors() {
    for (const [eventKey, errors] of Object.entries(view.errors)) {
      const message = Object.values(errors ?? {}).join(' ');
      const slot = qs(`#ntc-${CSS.escape(eventKey)}-error`, root);
      if (slot) {
        slot.textContent = message;
        slot.hidden = !message;
      }
    }
  }

  function page() {
    return html`
      ${pageHeader({ id: 'notifikasi-title', eyebrow: 'Admin Pusat',
        title: 'Pengaturan notifikasi' })}
      <p class="rounded-box border border-info/20 bg-info/10 px-4 py-3.5
        text-sm leading-relaxed text-base-content/80">Notifikasi otomatis
        dikirim lewat <b>email</b> dan/atau <b>SMS</b> untuk perubahan status
        permohonan, pengingat tenggat dokumen, konfirmasi pembayaran, dan
        pemberitahuan pengesahan. ${PUSH_UNAVAILABLE_MESSAGE}</p>
      ${body()}`;
  }

  function body() {
    if (view.status === 'loading') {
      return html`<div class="grid gap-3" aria-busy="true">
        <span class="sr-only" role="status">Memuat pengaturan…</span>
        ${[1, 2, 3, 4].map(() => html`<div class="skeleton h-14"></div>`)}
      </div>`;
    }
    if (view.status === 'error') {
      return html`<div role="alert" class="alert alert-error alert-soft">
        <span>Pengaturan gagal dimuat: ${view.error}</span>
        <button type="button" class="btn btn-sm btn-error"
          data-action="retry">Coba lagi</button></div>`;
    }
    return html`<div class="${CARD} overflow-x-auto">
      <table class="table min-w-[980px] text-sm">
        <caption class="sr-only">Event notifikasi dan kanalnya</caption>
        <thead class="${THEAD}"><tr>
          <th scope="col">Event</th><th scope="col">Aktif</th>
          <th scope="col">Email</th><th scope="col">SMS</th>
          <th scope="col">Push</th><th scope="col">Pengingat</th>
          <th scope="col">Template</th>
          <th scope="col"><span class="sr-only">Aksi</span></th>
        </tr></thead>
        <tbody>${view.rows.map(row)}</tbody>
      </table></div>`;
  }

  function isInvalid(r, key) {
    return Object.keys(view.errors[r.event] ?? {})
      .some((k) => ERROR_FIELD[k] === key);
  }

  function toggle(r, key, label, checked, disabled = false) {
    const errorId = `ntc-${r.event}-error`;
    return html`<input type="checkbox" class="${TOGGLE}"
      data-event="${r.event}" data-field="${key}"
      data-focus-key="${r.event}-${key}" aria-label="${label}: ${r.nama}"
      aria-describedby="${errorId}" aria-invalid="${isInvalid(r, key)}"
      ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}>`;
  }

  function row(r) {
    const d = view.drafts[r.event] ?? r;
    const errors = view.errors[r.event] ?? {};
    const dirty = isDirty(r);
    const busy = view.busy === r.event;
    const errorId = `ntc-${r.event}-error`;
    return html`<tr class="border-base-200 align-top">
      <th scope="row" class="max-w-[280px] font-normal">
        <span class="block font-bold">${r.nama}</span>
        <span class="block text-xs text-base-content/70">${r.kategori} ·
          ${r.deskripsi}</span>
        ${dirty ? html`<span class="badge badge-soft badge-warning badge-sm
          mt-1 font-bold">Belum disimpan</span>` : ''}
        <p id="${errorId}" class="mt-1 text-xs font-semibold text-error"
          aria-live="polite" hidden></p></th>
      <td>${toggle(r, 'aktif', 'Aktif', d.aktif)}</td>
      <td>${toggle(r, 'email', 'Email', d.kanal.email)}</td>
      <td>${toggle(r, 'sms', 'SMS', d.kanal.sms)}</td>
      <td>${toggle(r, 'push', 'Push (belum tersedia)', false, true)}</td>
      <td>${r.dapatPengingat ? html`<label class="flex items-center gap-1.5
          text-xs">H-<input type="number" class="input input-xs w-16
          ${errors.pengingatHari ? 'input-error' : ''}"
          min="${PENGINGAT_MIN}" max="${PENGINGAT_MAX}"
          value="${d.pengingatHari ?? ''}" data-event="${r.event}"
          data-field="pengingatHari" data-focus-key="${r.event}-pengingat"
          aria-label="Pengingat (hari sebelum tenggat): ${r.nama}"
          aria-describedby="${errorId}"
          aria-invalid="${Boolean(errors.pengingatHari)}"> hari</label>`
        : html`<span class="text-base-content/70" aria-hidden="true">—</span>
          <span class="sr-only">Tidak berlaku</span>`}</td>
      <td class="max-w-[240px]"><p class="line-clamp-2 text-xs
          text-base-content/70">${d.template}</p>
        <button type="button" class="link link-secondary text-xs font-bold"
          data-action="template" data-event="${r.event}" data-field="template"
          aria-invalid="${isInvalid(r, 'template')}"
          data-focus-key="${r.event}-template">Ubah template</button></td>
      <td class="text-right"><button type="button"
        class="btn btn-sm ${dirty ? 'btn-primary' : 'btn-disabled'}"
        data-action="save" data-event="${r.event}"
        data-focus-key="${r.event}-save" aria-busy="${busy}"
        aria-disabled="${!dirty || busy}">
        ${busy ? html`<span class="loading loading-spinner loading-xs"
          aria-hidden="true"></span>` : ''}Simpan</button></td>
    </tr>`;
  }

  function onChange(event) {
    const el = event.target.closest('[data-field]');
    if (!el?.dataset.event) {
      return;
    }
    const draft = draftOf(el.dataset.event);
    const field = el.dataset.field;
    if (field === 'aktif') {
      draft.aktif = el.checked;
    } else if (field === 'pengingatHari') {
      draft.pengingatHari = el.value === '' ? null : Number(el.value);
      if (event.type === 'input') {
        refreshSaveButton(el.dataset.event);
        return;
      }
    } else {
      draft.kanal[field] = el.checked;
    }
    render();
  }

  function refreshSaveButton(eventKey) {
    const r = view.rows.find((x) => x.event === eventKey);
    const button = qs(`[data-action="save"][data-event="${eventKey}"]`, root);
    if (button) {
      const dirty = isDirty(r);
      button.classList.toggle('btn-primary', dirty);
      button.classList.toggle('btn-disabled', !dirty);
      button.setAttribute('aria-disabled',
        String(!dirty || view.busy === eventKey));
    }
  }

  function onClick(event) {
    const el = event.target.closest('[data-action]');
    if (!el) {
      return;
    }
    if (el.dataset.action === 'retry') {
      load();
    } else if (el.dataset.action === 'save') {
      if (el.getAttribute('aria-disabled') !== 'true') {
        save(el.dataset.event);
      }
    } else if (el.dataset.action === 'template') {
      const r = view.rows.find((x) => x.event === el.dataset.event);
      dialog.open({ event: r.event, nama: r.nama,
        template: draftOf(r.event).template,
        variables: r.variabel ?? [], required: r.variabelWajib ?? [],
        otherDirty: isDirty({ ...r, template: draftOf(r.event).template }),
        returnFocus: () => qs(`[data-focus-key="${r.event}-template"]`, root) });
    }
  }

  function validate(r, draft) {
    const payload = { aktif: draft.aktif, kanal: draft.kanal,
      template: draft.template };
    if (r.dapatPengingat) {
      payload.pengingatHari = draft.pengingatHari;
    }
    const errors = { ...validateNotificationSetting(payload).errors };
    if (r.dapatPengingat && !Number.isInteger(draft.pengingatHari)) {
      errors.pengingatHari ??=
        `Pengingat wajib ${PENGINGAT_MIN}–${PENGINGAT_MAX} hari.`;
    }
    return { payload, errors };
  }

  /** Focus the first control of a row that has an error. */
  function focusInvalid(eventKey) {
    const first = Object.keys(view.errors[eventKey] ?? {})
      .map((k) => ERROR_FIELD[k]).find(Boolean);
    const control = first && qs(`[data-event="${CSS.escape(eventKey)}"]` +
      `[data-field="${first}"]`, root);
    control?.focus();
  }

  /**
   * Validate + PUT one row.
   * @param {string} eventKey
   * @param {!Object=} source Values to send (default: the row draft). The
   *     template dialog sends the saved row + new template only.
   * @param {boolean=} fromDialog Errors are shown in the dialog.
   * @return {!Promise<boolean>}
   */
  async function save(eventKey, source = draftOf(eventKey),
    fromDialog = false) {
    const r = view.rows.find((x) => x.event === eventKey);
    if (view.busy) {
      return false;
    }
    const { payload, errors } = validate(r, source);
    view.errors[eventKey] = errors;
    if (Object.keys(errors).length) {
      render();
      if (!fromDialog) {
        focusInvalid(eventKey);
      }
      return false;
    }
    view.busy = eventKey;
    render();
    try {
      const updated = await updateNotificationSetting(eventKey, payload);
      view.rows = view.rows.map((x) => (x.event === eventKey ? updated : x));
      const draft = view.drafts[eventKey];
      if (draft && source !== draft) {
        draft.template = updated.template;
      }
      if (!draft || source === draft || !isDirty(updated)) {
        delete view.drafts[eventKey];
      }
      showToast(`Pengaturan "${r.nama}" disimpan.`);
      return true;
    } catch (error) {
      view.errors[eventKey] = error instanceof ApiError &&
        Object.keys(error.fields).length ? error.fields
        : { server: error.message || 'Gagal menyimpan.' };
      if (!fromDialog) {
        showToast(`Gagal menyimpan: ${error.message}`, 'error');
      }
      return false;
    } finally {
      view.busy = null;
      render();
    }
  }

  /** Dialog callback: validate template length, then save the row. */
  async function saveTemplate(eventKey, template) {
    const text = template.trim();
    if (text.length < TEMPLATE_MIN || text.length > TEMPLATE_MAX) {
      return `Template ${TEMPLATE_MIN}–${TEMPLATE_MAX} karakter.`;
    }
    const r = view.rows.find((x) => x.event === eventKey);
    const saved = await save(eventKey, { aktif: r.aktif,
      kanal: structuredClone(r.kanal), template: text,
      pengingatHari: r.pengingatHari }, true);
    if (saved) {
      return '';
    }
    const errors = view.errors[eventKey] ?? {};
    return errors.template ?? (Object.values(errors)[0] ||
      'Gagal menyimpan.');
  }

  return { renderNotifConfig };
}
