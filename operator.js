/**
 * @fileoverview "Operator & Akses" (KAK Modul 1, usulan desain): operators
 * of the employer account with level + status, invite dialog
 * (POST /operators), level change and deactivation (PATCH /operators/{id},
 * OP-02..OP-04), and the permission matrix per level. A demo selector
 * "Masuk sebagai" sets actorLevel; non-admins see actions disabled.
 */

import {
  inviteOperator, listOperators, updateOperator,
} from '../../api/operators.js';
import { html, qs, raw } from '../../components/dom.js';
import { emptyState } from '../../components/empty-state.js';
import { statusBadge } from '../../components/status-badge.js';
import {
  OPERATOR_LEVELS, OPERATOR_LEVEL_LABEL, OPERATOR_PERMISSIONS,
  OPERATOR_STATUS, validateInviteOperator,
} from '../../contracts/operator.js';
import { withRetry } from './data.js';
import { refreshView, state } from './state.js';
import {
  BTN, BTN_OUTLINE, CALLOUT_INFO, CALLOUT_WARN, CARD, THEAD, cardHeader,
  closeDialog, dialogClose, field, fieldError, mountPaged, openDialog,
  pageTitle, pagerSlot, showErrors, toast,
} from './ui.js';

const MODAL = 'portal-modal';
const READONLY_NOTE = 'op-readonly-note';
const STATUS_TONE = {
  [OPERATOR_STATUS.ACTIVE]: 'green',
  [OPERATOR_STATUS.INVITED]: 'blue',
  [OPERATOR_STATUS.INACTIVE]: 'gray',
};
/** Invite form field -> input id. */
const INVITE_IDS = { nama: 'op-nama', email: 'op-email', level: 'op-level' };

/** Demo: level of the operator using the portal (prototype only). */
let actorLevel = 'admin';

function isAdmin() {
  return actorLevel === 'admin';
}

function operators() {
  return state.extra.operators ?? [];
}

/** Fetch operators once per role (state.extra is reset on role switch). */
export async function load() {
  if (!state.extra.operators) {
    state.extra.operators = await withRetry(() => listOperators(state.role));
  }
}

function lockAttrs() {
  return isAdmin() ? '' : raw(`disabled aria-describedby="${READONLY_NOTE}"`);
}

function actorPicker() {
  return html`<fieldset class="${CARD} flex flex-wrap items-center gap-3
      px-5 py-4"><legend class="sr-only">Masuk sebagai (demo)</legend>
    <span class="text-sm font-bold" aria-hidden="true">Masuk sebagai
      (demo):</span>
    <div class="join">${OPERATOR_LEVELS.map((level) => html`<input
      type="radio" name="op-actor" value="${level}" data-op-actor
      data-focus-key="op-actor-${level}" class="join-item btn btn-sm" aria-label="${OPERATOR_LEVEL_LABEL[level]}"
      ${level === actorLevel ? 'checked' : ''}>`)}</div>
    <span class="text-xs text-base-content/70">Simulasi prototipe; sistem
      asli memakai akun yang sedang masuk.</span></fieldset>`;
}

function levelCell(o) {
  if (o.status === OPERATOR_STATUS.INACTIVE) {
    return statusBadge(OPERATOR_LEVEL_LABEL[o.level], 'gray');
  }
  return html`<label for="op-level-${o.id}" class="sr-only">Level
      ${o.nama}</label>
    <select id="op-level-${o.id}" data-op-level data-id="${o.id}"
      data-focus-key="op-level-${o.id}" class="select select-sm w-40" ${lockAttrs()}>
      ${OPERATOR_LEVELS.map((level) => html`<option value="${level}"
        ${level === o.level ? 'selected' : ''}>${OPERATOR_LEVEL_LABEL[level]}
      </option>`)}</select>`;
}

function rowAction(o) {
  const isInactive = o.status === OPERATOR_STATUS.INACTIVE;
  return html`<button type="button" class="${BTN_OUTLINE} btn-sm text-xs
      ${isInactive ? '' : 'text-error disabled:text-base-content/50'}"
    data-action="${isInactive ? 'op-activate' : 'op-deactivate'}"
    data-id="${o.id}" data-focus-key="op-row-${o.id}" ${lockAttrs()}>${
      isInactive ? 'Aktifkan kembali' : 'Nonaktifkan'}<span class="sr-only">
      ${o.nama}</span></button>`;
}

function operatorRow(o) {
  return html`<tr>
    <td><b>${o.nama}</b><p class="text-xs text-base-content/70">${o.email}
      </p></td>
    <td>${levelCell(o)}</td>
    <td>${statusBadge(o.status, STATUS_TONE[o.status] ?? 'gray')}</td>
    <td class="text-[13px] text-base-content/70">${o.status ===
      OPERATOR_STATUS.INVITED ? `Diundang ${o.diundangPada}`
      : o.loginTerakhir}</td>
    <td class="text-right">${rowAction(o)}</td></tr>`;
}

function permissionMatrix() {
  const mark = (ok) => (ok
    ? html`<span class="font-bold text-success" aria-hidden="true">✓</span>
      <span class="sr-only">Ya</span>`
    : html`<span class="text-base-content/50" aria-hidden="true">—</span>
      <span class="sr-only">Tidak</span>`);
  return html`<section class="${CARD} overflow-hidden"
      aria-labelledby="op-matrix-title">
    <div class="flex flex-wrap items-center justify-between gap-2.5 border-b
        border-base-200 px-5 py-4"><h2 id="op-matrix-title"
      class="text-[15px] font-bold">Matriks izin per level</h2>
      <span class="badge badge-soft badge-warning badge-sm font-bold">Usulan
        desain</span></div>
    <div class="overflow-x-auto"><table class="table min-w-[640px] text-[13px]">
      <thead><tr class="${THEAD}"><th scope="col">Izin</th>
        ${OPERATOR_LEVELS.map((level) => html`<th scope="col"
          class="w-[140px] text-center">${OPERATOR_LEVEL_LABEL[level]}</th>`)}
      </tr></thead>
      <tbody>${OPERATOR_PERMISSIONS.map((p) => html`<tr>
        <th scope="row" class="font-semibold">${p.label}</th>
        ${OPERATOR_LEVELS.map((level) => html`<td class="text-center">
          ${mark(p.levels.includes(level))}</td>`)}</tr>`)}</tbody>
    </table></div></section>`;
}

/** operator view. */
export function render() {
  const rows = operators();
  const invite = html`<button type="button" class="${BTN}"
    data-action="op-invite" data-testid="operator-btn-undang"
    data-focus-key="op-invite" ${lockAttrs()}>
    + Undang operator</button>`;
  const readonly = isAdmin() ? '' : html`<p id="${READONLY_NOTE}"
    class="${CALLOUT_WARN}" role="status">Anda masuk sebagai
    <b>${OPERATOR_LEVEL_LABEL[actorLevel]}</b>. Hanya admin perusahaan yang
    dapat mengundang, mengubah level, atau menonaktifkan operator.</p>`;
  const table = rows.length ? html`<div class="overflow-x-auto"><table
      class="table min-w-[820px] text-sm"><thead><tr class="${THEAD}">
      <th scope="col">Operator</th><th scope="col" class="w-[190px]">Level</th>
      <th scope="col" class="w-[160px]">Status</th>
      <th scope="col" class="w-[180px]">Login terakhir</th>
      <th scope="col" class="w-[170px]"><span class="sr-only">Aksi</span></th>
    </tr></thead><tbody id="op-body"></tbody></table></div>
    ${pagerSlot('op-pager')}`
    : html`<div class="p-5">${emptyState({ title: 'Belum ada operator',
      body: 'Undang rekan kerja agar dapat membantu mengurus permohonan.',
      icon: '+', action: isAdmin() ? { label: 'Undang operator',
        attrs: raw('data-action="op-invite"') } : undefined })}</div>`;
  return html`
    ${pageTitle({ title: 'Operator & Akses', actions: invite,
      desc: 'Satu akun pemberi kerja dapat memiliki beberapa operator dengan level akses berbeda. Admin perusahaan mengundang operator lewat email dan mengatur levelnya.' })}
    ${actorPicker()}${readonly}
    <section class="${CARD} overflow-hidden" aria-labelledby="op-list-title">
      ${cardHeader(html`<span id="op-list-title">Daftar operator</span>`,
        html`<span class="text-xs text-base-content/70">${rows.length}
          akun</span>`)}
      ${table}</section>
    ${permissionMatrix()}
    <p class="${CALLOUT_INFO}">Perusahaan wajib memiliki minimal satu admin
      aktif. Operator nonaktif tidak dapat masuk, tetapi riwayat permohonannya
      tetap tersimpan.</p>`;
}

/** @param {!Element} root */
export function mount(root) {
  mountPaged(root, {
    body: '#op-body', footer: '#op-pager', items: operators(),
    row: operatorRow,
  });
  root.addEventListener('change', (event) => {
    const target = event.target;
    if (target.matches('[data-op-actor]')) {
      actorLevel = target.value;
      refreshView();
    } else if (target.matches('[data-op-level]')) {
      changeLevel(target);
    }
  });
}

function replaceOperator(updated) {
  state.extra.operators = operators()
    .map((o) => (o.id === updated.id ? updated : o));
}

async function changeLevel(select) {
  const operator = operators().find((o) => o.id === select.dataset.id);
  select.disabled = true;
  select.setAttribute('aria-busy', 'true');
  try {
    const updated = await updateOperator(state.role, operator.id,
      { level: select.value, actorLevel });
    replaceOperator(updated);
    toast(`Level ${updated.nama} menjadi ` +
      `${OPERATOR_LEVEL_LABEL[updated.level]}.`);
    refreshView(`op-level-${updated.id}`);
  } catch (error) {
    select.value = operator.level;
    select.disabled = false;
    select.removeAttribute('aria-busy');
    toast(error.message || 'Level gagal diubah.', 'error');
  }
}

function inviteDialog() {
  return html`<div class="flex items-center justify-between border-b
      border-base-300 px-6 py-4.5"><h2 id="portal-modal-title"
      class="font-bold">Undang operator</h2>
      ${dialogClose()}</div>
    <form id="op-invite-form" novalidate class="grid gap-4 p-6">
      ${field({ id: 'op-nama', label: 'Nama lengkap',
        attrs: raw('required minlength="3" maxlength="80" autocomplete="name"') })}
      ${field({ id: 'op-email', label: 'Email kerja', type: 'email',
        hint: 'Tautan aktivasi dikirim ke alamat ini.',
        attrs: raw('required maxlength="120" autocomplete="email"') })}
      <div class="grid gap-1.5"><label for="op-level" class="text-sm
        font-bold">Level akses</label>
        <select id="op-level" name="op-level" class="select h-11 w-full"
          aria-describedby="op-level-error">
          ${OPERATOR_LEVELS.map((level) => html`<option value="${level}"
            ${level === 'operator' ? 'selected' : ''}>
            ${OPERATOR_LEVEL_LABEL[level]}</option>`)}</select>
        ${fieldError('op-level')}</div>
      <p id="op-invite-error" class="text-sm font-semibold text-error"
        aria-live="polite" hidden></p>
      <div class="flex justify-end gap-2.5">
        <button type="button" class="${BTN_OUTLINE}"
          data-action="close-modal">Batal</button>
        <button type="submit" class="${BTN}"
          data-testid="operator-btn-kirim-undangan">Kirim undangan</button>
      </div></form>`;
}

function showFormError(form, message) {
  const slot = qs('#op-invite-error', form);
  slot.textContent = message;
  slot.hidden = !message;
}

async function submitInvite(event) {
  event.preventDefault();
  const form = event.target;
  const body = {
    nama: qs('#op-nama', form).value.trim(),
    email: qs('#op-email', form).value.trim(),
    level: qs('#op-level', form).value, actorLevel,
  };
  const result = validateInviteOperator(body);
  const errors = Object.fromEntries(Object.entries(result.errors)
    .filter(([key]) => INVITE_IDS[key])
    .map(([key, message]) => [INVITE_IDS[key], message]));
  showFormError(form, '');
  if (showErrors(form, errors)) {
    return;
  }
  const button = qs('[type="submit"]', form);
  button.disabled = true;
  form.setAttribute('aria-busy', 'true');
  try {
    const created = await inviteOperator(state.role, body);
    state.extra.operators = [...operators(), created];
    closeDialog(MODAL);
    toast(`Undangan dikirim ke ${created.email}.`);
    refreshView('op-invite');
  } catch (error) {
    button.disabled = false;
    form.removeAttribute('aria-busy');
    if (error.field && INVITE_IDS[error.field]) {
      showErrors(form, { [INVITE_IDS[error.field]]: error.message });
    } else {
      showFormError(form, error.message || 'Undangan gagal dikirim.');
    }
  }
}

function confirmDialog(o) {
  return html`<div class="grid gap-3.5 px-6 py-7 md:px-8">
    <h2 id="portal-modal-title" class="text-[19px] font-bold">Nonaktifkan
      ${o.nama}?</h2>
    <p class="text-sm leading-relaxed text-base-content/70">${o.email} tidak
      dapat masuk ke portal sampai diaktifkan kembali. Permohonan yang pernah
      diajukan tetap tersimpan.</p>
    <p id="op-confirm-error" class="text-sm font-semibold text-error"
      aria-live="polite" hidden></p>
    <div class="flex justify-end gap-2.5">
      <form method="dialog"><button class="${BTN_OUTLINE}"
        data-op-cancel>Batal</button>
      </form>
      <button type="button" class="btn btn-error"
        data-action="op-confirm-deactivate" data-id="${o.id}"
        data-testid="operator-btn-nonaktifkan">Nonaktifkan</button>
    </div></div>`;
}

async function setActive(el, aktif, onError) {
  el.disabled = true;
  el.setAttribute('aria-busy', 'true');
  try {
    const updated = await updateOperator(state.role, el.dataset.id,
      { aktif, actorLevel });
    replaceOperator(updated);
    closeDialog(MODAL);
    toast(aktif ? `${updated.nama} diaktifkan kembali.`
      : `${updated.nama} dinonaktifkan.`);
    refreshView(`op-row-${updated.id}`);
  } catch (error) {
    el.disabled = false;
    el.removeAttribute('aria-busy');
    onError(error.message || 'Perubahan gagal disimpan.');
  }
}

export const actions = {
  'op-invite'() {
    openDialog(MODAL, inviteDialog(), 'max-w-lg');
    qs('#op-invite-form').addEventListener('submit', submitInvite);
    qs('#op-nama')?.focus();
  },
  'op-deactivate'(el) {
    const operator = operators().find((o) => o.id === el.dataset.id);
    openDialog(MODAL, confirmDialog(operator), 'max-w-lg');
    qs('[data-op-cancel]')?.focus();
  },
  'op-confirm-deactivate'(el) {
    setActive(el, false, (message) => {
      const slot = qs('#op-confirm-error');
      slot.textContent = message;
      slot.hidden = false;
    });
  },
  'op-activate'(el) {
    setActive(el, true, (message) => toast(message, 'error'));
  },
};
