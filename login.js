/**
 * @fileoverview Login form: HTML5 + validateLogin, POST /auth/login and
 * loginStatusId branching (AK-04): 3 -> SSO required, 4 -> reCAPTCHA,
 * 5 -> Login gagal. Demo toggle shows/hides the reCAPTCHA box.
 */

import { login } from '../../api/auth.js';
import { ApiError } from '../../api/http.js';
import { qs, qsa, setVisible } from '../../components/dom.js';
import { validateLogin } from '../../contracts/auth.js';
import {
  clearFieldErrors, nativeErrors, setAlert, setButtonBusy, showFieldErrors,
} from '../../components/form-ui.js';

/** Token sent when the (simulated) reCAPTCHA checkbox is ticked. */
const MOCK_CAPTCHA_TOKEN = 'mock-captcha-token';

/**
 * @param {{go: function(string), onLoggedIn: function(!Object)}} deps
 */
export function initLogin({ go, onLoggedIn }) {
  const form = qs('#login-form');
  const alertEl = qs('#login-alert');
  const captchaBox = qs('#login-captcha');
  const captchaCheck = qs('#login-captcha-check');
  const toggle = qs('#login-captcha-toggle');
  let captchaVisible = false;

  const setCaptcha = (visible) => {
    captchaVisible = visible;
    setVisible(captchaBox, visible);
    toggle.setAttribute('aria-expanded', String(visible));
    toggle.textContent = visible
      ? 'Demo: sembunyikan reCAPTCHA' : 'Demo: tampilkan reCAPTCHA';
    if (!visible) {
      captchaCheck.checked = false;
    }
  };
  toggle.addEventListener('click', () => setCaptcha(!captchaVisible));
  setCaptcha(false);

  // Akun demo (di bawah form): isi username/password, pengguna tetap
  // klik "Masuk" sendiri — bukan auto-submit.
  for (const demo of qsa('[data-demo-login]', qs('#login-demo-accounts'))) {
    demo.addEventListener('click', () => {
      form.elements.username.value = demo.dataset.demoLogin;
      form.elements.password.value = demo.dataset.demoPassword;
      clearFieldErrors(form);
      setAlert(alertEl, null);
      form.elements.username.focus();
    });
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFieldErrors(form);
    setAlert(alertEl, null);
    const payload = {
      username: form.elements.username.value.trim(),
      password: form.elements.password.value,
      captchaToken: captchaCheck.checked ? MOCK_CAPTCHA_TOKEN : undefined,
    };
    const errors = {
      ...nativeErrors([form.elements.username, form.elements.password]),
      ...validateLogin(payload).errors,
    };
    if (captchaVisible && !captchaCheck.checked) {
      errors.captcha = 'Centang "Saya bukan robot" terlebih dahulu.';
    }
    if (showFieldErrors(form, errors)) {
      return;
    }
    const button = qs('button[type="submit"]', form);
    setButtonBusy(button, true);
    try {
      const session = await login(payload);
      setCaptcha(false);
      onLoggedIn(session);
    } catch (error) {
      handleLoginError(error, payload.username);
    } finally {
      setButtonBusy(button, false);
    }
  });

  function handleLoginError(error, username) {
    if (!(error instanceof ApiError)) {
      setAlert(alertEl, 'Tidak dapat terhubung ke server. Coba lagi.');
      return;
    }
    switch (error.code) {
      case 'INVALID_CREDENTIALS':
        showFieldErrors(form, { password: invalidMessage(error) });
        return;
      case 'CAPTCHA_REQUIRED':
        setCaptcha(true);
        showFieldErrors(form, {
          captcha: 'Centang "Saya bukan robot" lalu masuk kembali.',
        });
        return;
      case 'SSO_REQUIRED':
        go('ssoRequired');
        return;
      case 'LOGIN_FAILED':
        qs('#failed-username').textContent = username;
        go('loginGagal');
        return;
      case 'VALIDATION_ERROR':
        showFieldErrors(form, error.fields);
        return;
      default:
        setAlert(alertEl, `${error.message} Silakan coba lagi.`);
    }
  }
}

function invalidMessage(error) {
  const left = error.detail.attemptsLeft;
  if (left === undefined) {
    return error.message;
  }
  return left > 0
    ? `${error.message} Sisa ${left} percobaan sebelum reCAPTCHA.`
    : `${error.message} Percobaan berikutnya wajib reCAPTCHA.`;
}
