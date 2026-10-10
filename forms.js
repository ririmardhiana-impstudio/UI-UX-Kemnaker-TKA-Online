/**
 * @fileoverview Hotline forms: employer profile (first login), new ticket
 * (pemberi kerja) and agent login.
 */

import { login } from '../../api/auth.js';
import { saveHotlineProfile } from '../../api/hotline-profiles.js';
import { createTiket } from '../../api/tiket.js';
import { qs, setVisible } from '../../components/dom.js';
import { validateLogin } from '../../contracts/auth.js';
import {
  TIKET_CATEGORIES, validateCreateTiket, validateHotlineProfile,
} from '../../contracts/tiket.js';
import { DEFAULT_CATEGORY, PK_SESSION } from './config.js';
import {
  clearFieldErrors, nativeErrors, showFieldErrors, withBusyButton,
} from './form-errors.js';

const OPTION_ON = ['border-secondary', 'bg-base-200'];
const OPTION_OFF = ['border-base-300', 'bg-base-100'];

/**
 * "Lengkapi data profil hotline" -> PUT /hotline-profiles/{akun}, then
 * continues to "Tiket saya".
 * @param {{onSaved: function()}} deps
 */
export function bindProfilForm({ onSaved }) {
  const form = qs('#profil-form');
  const alertEl = qs('#profil-error');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setVisible(alertEl, false);
    const body = {
      penanggungJawab: form.elements.namedItem('penanggungJawab').value.trim(),
      telepon: form.elements.namedItem('telepon').value.trim(),
      email: form.elements.namedItem('email').value.trim(),
    };
    const errors = { ...validateHotlineProfile(body).errors,
      ...nativeErrors(form) };
    if (showFieldErrors(form, errors)) {
      return;
    }
    clearFieldErrors(form);
    await withBusyButton(qs('button[type="submit"]', form), async () => {
      try {
        await saveHotlineProfile(PK_SESSION.akun, body);
        onSaved();
      } catch (error) {
        if (!showFieldErrors(form, error.fields ?? {})) {
          alertEl.textContent = `${error.message} Silakan coba lagi.`;
          setVisible(alertEl, true);
        }
      }
    });
  });
}

/**
 * "Buat tiket baru" -> POST /tiket.
 * @param {{onCreated: function(!Object)}} deps
 */
export function bindBaruForm({ onCreated }) {
  const form = qs('#baru-form');
  const alertEl = qs('#baru-error');
  renderCategoryOptions(qs('#kategori-options'));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setVisible(alertEl, false);
    const body = {
      kategori: form.elements.namedItem('kategori').value,
      judul: form.elements.namedItem('judul').value.trim(),
      nomorTerkait: form.elements.namedItem('nomorTerkait').value.trim() ||
        undefined,
      rincian: form.elements.namedItem('rincian').value.trim(),
      perusahaan: PK_SESSION.perusahaan,
    };
    const errors = { ...validateCreateTiket(body).errors,
      ...nativeErrors(form) };
    if (showFieldErrors(form, errors)) {
      return;
    }
    await withBusyButton(qs('button[type="submit"]', form), async () => {
      try {
        onCreated(await createTiket(body));
      } catch (error) {
        if (!showFieldErrors(form, error.fields ?? {})) {
          alertEl.textContent = error.message;
          setVisible(alertEl, true);
        }
      }
    });
  });
}

function renderCategoryOptions(container) {
  container.replaceChildren(...TIKET_CATEGORIES.map((label, i) => {
    const option = document.createElement('label');
    option.className = 'flex cursor-pointer items-center rounded-[10px] ' +
      'border-2 px-3.5 py-3 text-sm font-semibold';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'kategori';
    input.value = label;
    input.required = true;
    input.id = `kategori-${i}`;
    input.className = 'sr-only';
    input.checked = label === DEFAULT_CATEGORY;
    option.append(input, label);
    return option;
  }));
  const sync = () => {
    for (const option of container.children) {
      const input = qs('input', option);
      option.classList.remove(...OPTION_ON, ...OPTION_OFF);
      option.classList.add(...(input.checked ? OPTION_ON : OPTION_OFF));
      // Visible focus ring for the visually hidden radio.
      option.classList.toggle('outline-2', input.matches(':focus-visible'));
    }
  };
  container.addEventListener('change', sync);
  container.addEventListener('focusin', sync);
  container.addEventListener('focusout', () => queueMicrotask(sync));
  sync();
}

/**
 * "Masuk agen hotline" -> POST /auth/login (akun agen).
 * @param {{onLoggedIn: function(string)}} deps Receives the agent name.
 */
export function bindLoginForm({ onLoggedIn }) {
  const form = qs('#login-form');
  const alertEl = qs('#login-error');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setVisible(alertEl, false);
    const body = {
      username: form.elements.namedItem('username').value.trim(),
      password: form.elements.namedItem('password').value,
    };
    const errors = { ...validateLogin(body).errors, ...nativeErrors(form) };
    if (showFieldErrors(form, errors)) {
      return;
    }
    await withBusyButton(qs('button[type="submit"]', form), async () => {
      try {
        const session = await login(body);
        if (session.user.kind !== 'agen') {
          throw new Error('Akun ini bukan akun agen hotline.');
        }
        onLoggedIn(session.user.name);
      } catch (error) {
        alertEl.textContent = error.message;
        setVisible(alertEl, true);
      }
    });
  });
}
