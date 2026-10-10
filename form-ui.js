/**
 * @fileoverview Small form UI helpers shared across pages: per-field
 * errors, busy buttons, toast, resend countdown, formatters. Originally
 * scoped to the Akun & Login page; promoted here once the registration
 * wizard moved to its own page (registrasi-pemberi-kerja.html) and needed
 * the same helpers.
 */

import { html, qs, qsa, setHtml, setVisible } from './dom.js';

const TOAST_MS = 3000;

/**
 * Collect native HTML5 constraint errors of the given controls.
 * @param {!Iterable<!Element>} controls
 * @return {!Object<string, string>} name -> message.
 */
export function nativeErrors(controls) {
  const errors = {};
  for (const el of controls) {
    if (el.name && el.willValidate && !el.checkValidity()) {
      errors[el.name] = validityMessage(el);
    }
  }
  return errors;
}

/**
 * Indonesian message for the first failing HTML5 constraint (the browser's
 * validationMessage follows the browser locale).
 * @param {!Element} el
 * @return {string}
 */
function validityMessage(el) {
  const { validity } = el;
  if (validity.valueMissing) {
    return 'Wajib diisi.';
  }
  if (validity.typeMismatch && el.type === 'email') {
    return 'Format email tidak valid.';
  }
  if (validity.tooShort) {
    return `Minimal ${el.minLength} karakter.`;
  }
  if (validity.tooLong) {
    return `Maksimal ${el.maxLength} karakter.`;
  }
  return 'Format tidak valid.';
}

/**
 * Reset every error of a form that uses data-prefix + #<prefix>-<field>-error.
 * @param {!HTMLFormElement} form
 */
export function clearFieldErrors(form) {
  const prefix = form.dataset.prefix;
  for (const el of qsa(`[id^="${prefix}-"][id$="-error"]`, form)) {
    el.textContent = '';
    setVisible(el, false);
  }
  for (const el of qsa('[aria-invalid]', form)) {
    el.removeAttribute('aria-invalid');
    el.classList.remove('input-error', 'select-error', 'checkbox-error');
  }
}

/**
 * Show error messages next to their fields; focuses the first one.
 * @param {!HTMLFormElement} form
 * @param {!Object<string, string>} errors
 * @return {boolean} Whether at least one error was shown.
 */
export function showFieldErrors(form, errors) {
  const prefix = form.dataset.prefix;
  let first = null;
  for (const [field, message] of Object.entries(errors)) {
    const errorEl = qs(`#${prefix}-${field}-error`, form);
    if (!errorEl) {
      continue;
    }
    errorEl.textContent = message;
    setVisible(errorEl, true);
    const control = form.elements.namedItem(field);
    if (control instanceof HTMLElement) {
      control.setAttribute('aria-invalid', 'true');
      control.classList.add(errorClassFor(control));
      first ??= control;
    }
    first ??= errorEl;
  }
  if (first) {
    first.focus?.();
    form.classList.remove('animate-shake');
    void form.offsetWidth;
    form.classList.add('animate-shake');
  }
  return first !== null;
}

function errorClassFor(control) {
  if (control.tagName === 'SELECT') {
    return 'select-error';
  }
  return control.type === 'checkbox' ? 'checkbox-error' : 'input-error';
}

/**
 * Toggle loading state of a submit button (spinner + disabled + aria-busy).
 * @param {!HTMLButtonElement} button
 * @param {boolean} busy
 */
export function setButtonBusy(button, busy) {
  if (busy) {
    button.dataset.label = button.textContent.trim();
    setHtml(button, html`<span class="loading loading-spinner loading-sm"
      aria-hidden="true"></span>${button.dataset.label}`);
  } else if (button.dataset.label) {
    button.textContent = button.dataset.label;
  }
  button.disabled = busy;
  button.setAttribute('aria-busy', String(busy));
}

/**
 * Show a message in an alert element (form-level error).
 * @param {!Element} el
 * @param {?string} message null hides the alert.
 */
export function setAlert(el, message) {
  el.textContent = message ?? '';
  setVisible(el, Boolean(message));
}

/**
 * Transient toast (DaisyUI toast + alert), auto-hidden after 3 s.
 * @param {string} message
 * @param {'success'|'info'|'error'|'warning'} tone
 */
export function showToast(message, tone = 'success') {
  const region = qs('#toast-region');
  const toneClass = {
    success: 'alert-success', info: 'alert-info', error: 'alert-error',
    warning: 'alert-warning',
  }[tone];
  const item = document.createElement('div');
  item.className = `alert ${toneClass} animate-fade-in text-sm shadow-lg`;
  item.textContent = message;
  region.appendChild(item);
  window.setTimeout(() => item.remove(), TOAST_MS);
}

/** @param {number} seconds @return {string} mm:ss */
export function formatClock(seconds) {
  const safe = Math.max(0, Math.round(seconds));
  const mm = String(Math.floor(safe / 60)).padStart(2, '0');
  const ss = String(safe % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

/** @param {number} bytes @return {string} e.g. "412 KB", "1,1 MB". */
export function formatFileSize(bytes) {
  if (bytes >= 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    return `${mb.toLocaleString('id-ID', { maximumFractionDigits: 1 })} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** @param {string} npwp @return {string} "0012 3456 7801 2000" */
export function formatNpwp(npwp) {
  return String(npwp ?? '').replace(/\D/g, '').replace(/(\d{4})(?=\d)/g, '$1 ');
}

/**
 * Resend button with a countdown: disabled + "(<mm:ss>)" while running.
 * @param {!HTMLButtonElement} button
 * @param {{idleLabel: string, busyLabel: function(string): string}} labels
 * @return {{start: function(number), stop: function(), isRunning: function(): boolean}}
 */
export function createResendCountdown(button, labels) {
  let timer = null;
  let remaining = 0;
  const paint = () => {
    const running = timer !== null;
    button.textContent = running
      ? labels.busyLabel(formatClock(remaining)) : labels.idleLabel;
    button.disabled = running;
    button.classList.toggle('text-base-content/50', running);
  };
  const stop = () => {
    window.clearInterval(timer);
    timer = null;
    paint();
  };
  const start = (seconds) => {
    window.clearInterval(timer);
    remaining = seconds;
    timer = window.setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        stop();
      } else {
        paint();
      }
    }, 1000);
    paint();
  };
  paint();
  return { start, stop, isRunning: () => timer !== null };
}
