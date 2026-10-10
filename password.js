/**
 * @fileoverview Password screens: Lupa password (POST /auth/password-reset,
 * 429 cooldown AK-06), Reset password (POST /auth/password-reset/confirm,
 * single-use token AK-07) and Wajib ganti password (claim
 * mustChangePassword, AK-05, POST /auth/password-change). Strength
 * checklist = VR-08.
 */

import {
  changePassword, confirmPasswordReset, requestPasswordReset,
} from '../../api/auth.js';
import { ApiError } from '../../api/http.js';
import { qs, qsa, setVisible } from '../../components/dom.js';
import {
  checkPasswordStrength, validatePasswordChange, validatePasswordResetConfirm,
  validatePasswordResetRequest,
} from '../../contracts/auth.js';
import {
  clearFieldErrors, createResendCountdown, nativeErrors, setAlert,
  setButtonBusy, showFieldErrors, showToast,
} from '../../components/form-ui.js';

/** Token carried by the demo reset link ("Buka tautan (demo)"). */
const DEMO_RESET_TOKEN = 'mock-reset-token';
/** 4th strength bar lights up from this length ("kuat"). */
const STRONG_LENGTH = 16;

/**
 * @param {{go: function(string), getUsername: function(): string}} deps
 *     getUsername = logged-in account (demo fallback when the screen is
 *     opened directly from the switcher).
 */
export function initPasswordScreens({ go, getUsername }) {
  initForgot();
  initReset(go);
  initForcedChange(go, getUsername);
}

function initForgot() {
  const form = qs('#lupa-form');
  const button = qs('#lupa-submit');
  const sentBox = qs('#lupa-sent');
  const countdown = createResendCountdown(button, {
    idleLabel: 'Kirim tautan reset',
    busyLabel: (clock) => `Kirim ulang dalam ${clock}`,
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFieldErrors(form);
    const email = form.elements.email.value.trim();
    const errors = {
      ...nativeErrors([form.elements.email]),
      ...validatePasswordResetRequest({ email }).errors,
    };
    if (showFieldErrors(form, errors)) {
      return;
    }
    setButtonBusy(button, true);
    try {
      const result = await requestPasswordReset(email);
      setButtonBusy(button, false);
      qs('#lupa-sent-to').textContent = result.sentTo;
      qs('#reset-email').textContent = result.sentTo;
      setVisible(sentBox, true);
      countdown.start(result.resendAvailableInSeconds);
    } catch (error) {
      setButtonBusy(button, false);
      if (error instanceof ApiError && error.code === 'RATE_LIMITED') {
        setVisible(sentBox, true);
        countdown.start(error.detail.retryAfterSeconds);
        return;
      }
      const fields = error instanceof ApiError && error.field
        ? { [error.field]: error.message }
        : { email: `${error.message ?? 'Gagal mengirim.'} Silakan coba lagi.` };
      showFieldErrors(form, fields);
    }
  });
}

function initReset(go) {
  const form = qs('#reset-form');
  const alertEl = qs('#reset-alert');
  bindStrength(form);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFieldErrors(form);
    setAlert(alertEl, null);
    const payload = {
      token: DEMO_RESET_TOKEN,
      password: form.elements.password.value,
      passwordConfirm: form.elements.passwordConfirm.value,
    };
    const errors = {
      ...nativeErrors(form.elements),
      ...validatePasswordResetConfirm(payload).errors,
    };
    if (showFieldErrors(form, errors)) {
      return;
    }
    const button = qs('button[type="submit"]', form);
    setButtonBusy(button, true);
    try {
      await confirmPasswordReset(payload);
      showToast('Password baru tersimpan. Silakan masuk.');
      go('login');
    } catch (error) {
      if (error instanceof ApiError && error.code === 'INVALID_TOKEN') {
        setAlert(alertEl, 'Tautan reset tidak valid atau sudah dipakai. ' +
          'Minta tautan baru melalui Lupa password.');
      } else if (error instanceof ApiError && error.code === 'VALIDATION_ERROR') {
        showFieldErrors(form, error.fields);
      } else {
        setAlert(alertEl, `${error.message} Silakan coba lagi.`);
      }
    } finally {
      setButtonBusy(button, false);
    }
  });
}

/**
 * Forced change after login (claim mustChangePassword): POST
 * /auth/password-change, then the user is signed out.
 */
function initForcedChange(go, getUsername) {
  const form = qs('#change-form');
  const alertEl = qs('#change-alert');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFieldErrors(form);
    setAlert(alertEl, null);
    const payload = {
      username: getUsername(),
      oldPassword: form.elements.oldPassword.value,
      password: form.elements.password.value,
      passwordConfirm: form.elements.passwordConfirm.value,
    };
    const errors = {
      ...nativeErrors(form.elements),
      ...validatePasswordChange(payload).errors,
    };
    if (showFieldErrors(form, errors)) {
      return;
    }
    const button = qs('button[type="submit"]', form);
    setButtonBusy(button, true);
    try {
      await changePassword(payload);
      showToast('Password berhasil diganti. Anda telah keluar — silakan masuk kembali.');
      go('login');
    } catch (error) {
      if (error instanceof ApiError && error.field) {
        showFieldErrors(form, { ...error.fields, [error.field]: error.message });
      } else {
        setAlert(alertEl, `${error.message} Silakan coba lagi.`);
      }
    } finally {
      setButtonBusy(button, false);
    }
  });
}

/** Live strength bars + checklist under the reset password field. */
function bindStrength(form) {
  const input = form.elements.password;
  const bars = qsa('[data-strength-bars] > span', form);
  const items = qsa('[data-strength-list] [data-check]', form);
  const paint = () => {
    const checks = checkPasswordStrength(input.value);
    const passed = Object.values(checks).filter(Boolean).length;
    const score = passed + (passed === 3 && input.value.length >= STRONG_LENGTH ? 1 : 0);
    bars.forEach((bar, index) => {
      bar.classList.toggle('bg-success', index < score);
      bar.classList.toggle('bg-base-300', index >= score);
    });
    for (const item of items) {
      const ok = checks[item.dataset.check];
      item.classList.toggle('text-success', ok);
      item.classList.toggle('text-base-content/60', !ok);
      qs('[data-role="mark"]', item).textContent = ok ? '✓' : '○';
    }
  };
  input.addEventListener('input', paint);
  paint();
}
