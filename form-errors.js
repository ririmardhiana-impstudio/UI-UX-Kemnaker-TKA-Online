/**
 * @fileoverview Per-field error display shared by the hotline forms.
 * Error element convention: #<inputId>-error, linked via aria-describedby.
 */

import { qs, qsa } from '../../components/dom.js';

/**
 * Show `errors` (field name -> message) on the inputs of `form`.
 * @param {!HTMLFormElement} form
 * @param {!Object<string, string>} errors Keyed by input `name`.
 * @return {boolean} true when at least one error was shown.
 */
export function showFieldErrors(form, errors) {
  clearFieldErrors(form);
  let first = null;
  for (const [name, message] of Object.entries(errors)) {
    const input = form.elements.namedItem(name);
    const target = input instanceof RadioNodeList ? input[0] : input;
    const errorId = target?.getAttribute('aria-describedby') ??
      target?.closest('fieldset')?.getAttribute('aria-describedby');
    const errorEl = errorId ? qs(`#${errorId}`) : null;
    if (!errorEl) {
      continue;
    }
    errorEl.textContent = message;
    target.setAttribute('aria-invalid', 'true');
    first ??= target;
  }
  first?.focus();
  return first !== null;
}

/** Remove every error message + aria-invalid in `form`. */
export function clearFieldErrors(form) {
  for (const input of qsa('[aria-invalid]', form)) {
    input.removeAttribute('aria-invalid');
  }
  for (const input of qsa('[aria-describedby]', form)) {
    const errorEl = qs(`#${input.getAttribute('aria-describedby')}`);
    if (errorEl) {
      errorEl.textContent = '';
    }
  }
}

/**
 * Native HTML5 validation messages (required, pattern, type) per field.
 * @param {!HTMLFormElement} form
 * @return {!Object<string, string>}
 */
export function nativeErrors(form) {
  const errors = {};
  for (const input of form.elements) {
    if (input.name && input.willValidate && !input.validity.valid) {
      errors[input.name] ??= validityMessage(input);
    }
  }
  return errors;
}

/** Indonesian message for the first failing HTML5 constraint. */
function validityMessage(input) {
  const { validity } = input;
  if (validity.valueMissing) {
    return 'Wajib diisi.';
  }
  if (validity.typeMismatch && input.type === 'email') {
    return 'Format email tidak valid.';
  }
  if (validity.tooShort) {
    return `Minimal ${input.minLength} karakter.`;
  }
  if (validity.tooLong) {
    return `Maksimal ${input.maxLength} karakter.`;
  }
  if (validity.patternMismatch) {
    return input.dataset.patternMessage ?? 'Format tidak valid.';
  }
  return 'Format tidak valid.';
}

/** Disable a submit button + DaisyUI spinner while `task` runs. */
export async function withBusyButton(button, task) {
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  const spinner = document.createElement('span');
  spinner.className = 'loading loading-spinner loading-sm';
  spinner.setAttribute('aria-hidden', 'true');
  button.prepend(spinner);
  try {
    return await task();
  } finally {
    spinner.remove();
    button.disabled = false;
    button.removeAttribute('aria-busy');
  }
}
