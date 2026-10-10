/**
 * @fileoverview Email verification screens: result of a verification link
 * demo (GET /auth/email-verifications/{token}, AK-08) and "Wajib
 * verifikasi email" (claim mustVerifyEmail), both with a resend countdown
 * (POST /auth/email-verifications, 429 cooldown) and "Ganti alamat email"
 * (POST /auth/email-change). The post-registration status tracker lives in
 * ./status.js (AK-15 reorders it ahead of email verification).
 */

import {
  changeEmail, resendEmailVerification, verifyEmail,
} from '../../api/auth.js';
import { ApiError } from '../../api/http.js';
import { html, qs, setHtml, setVisible } from '../../components/dom.js';
import { validateEmailChange } from '../../contracts/auth.js';
import {
  clearFieldErrors, createResendCountdown, nativeErrors, setButtonBusy,
  showFieldErrors, showToast,
} from '../../components/form-ui.js';

/** Legacy countdown value shown when the screen is opened directly. */
const MUST_RESEND_SECONDS = 138;
const RESEND_COOLDOWN_SECONDS = 299;

/** Demo tabs -> link token (verify-expired is unknown -> 410). */
const EV_TABS = [
  { label: 'Berhasil', token: 'verify-ok' },
  { label: 'Sudah terverifikasi', token: 'verify-used' },
  { label: 'Tidak valid', token: 'verify-expired' },
];

/** Screen copy per API outcome (UI config, legacy EV). */
const EV_COPY = {
  Berhasil: {
    icon: '✓', cls: ['bg-success/10', 'text-success'],
    title: 'Email berhasil diverifikasi',
    body: 'Terima kasih. Petugas PPTKA telah menyetujui pendaftaran PT Nusantara Baja Presisi dan akun Anda sudah aktif — silakan masuk untuk melanjutkan.',
    cta: 'Lanjut ke login',
  },
  'Sudah terverifikasi': {
    icon: 'i', cls: ['bg-info/10', 'text-secondary'],
    title: 'Email sudah terverifikasi',
    body: 'Tautan ini sudah pernah digunakan. Anda dapat langsung masuk ke TKA Online.',
    cta: 'Masuk',
  },
  INVALID_LINK: {
    icon: '!', cls: ['bg-error/10', 'text-error'],
    title: 'Tautan tidak valid',
    body: 'Tautan verifikasi kedaluwarsa atau tidak dikenali. Kirim ulang tautan ke email akun Anda.',
    cta: 'Kirim ulang tautan',
  },
};

/**
 * @param {{getUsername: function(): string}} deps Account of the
 *     "Wajib verifikasi email" screen (logged-in user or demo fallback).
 * @return {{enterEmailVerify: function(), enterMustVerify: function(?string)}}
 */
export function initVerifyScreens({ getUsername }) {
  const ev = initEmailVerify();
  const must = createResendCountdown(qs('#must-resend'), {
    idleLabel: 'Kirim ulang tautan',
    busyLabel: (clock) => `Kirim ulang tautan (${clock})`,
  });
  bindResend(qs('#must-resend'), must, () => qs('#must-email').textContent);
  initChangeEmail(must, getUsername);

  return {
    enterEmailVerify: ev.enter,
    enterMustVerify(email) {
      if (email) {
        qs('#must-email').textContent = email;
      }
      if (!must.isRunning()) {
        must.start(MUST_RESEND_SECONDS);
      }
    },
  };
}

/** Resend verification link; the server owns the 5-minute cooldown. */
function bindResend(button, countdown, getEmail) {
  button.addEventListener('click', async () => {
    const email = getEmail();
    setButtonBusy(button, true);
    try {
      const result = await resendEmailVerification(email);
      setButtonBusy(button, false);
      countdown.start(result.resendAvailableInSeconds);
      showToast(`Tautan verifikasi dikirim ulang ke ${result.sentTo}.`,
        'info');
    } catch (error) {
      setButtonBusy(button, false);
      if (error instanceof ApiError && error.code === 'RATE_LIMITED') {
        countdown.start(error.detail.retryAfterSeconds);
        return;
      }
      showToast(`${error.message} Silakan coba lagi.`, 'error');
    }
  });
}

function initChangeEmail(countdown, getUsername) {
  const toggle = qs('#must-change-email');
  const form = qs('#must-email-form');
  toggle.addEventListener('click', () => {
    const open = form.hidden;
    setVisible(form, open);
    toggle.setAttribute('aria-expanded', String(open));
    if (open) {
      form.elements.email.value = qs('#must-email').textContent;
      form.elements.email.focus();
    }
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFieldErrors(form);
    const payload = {
      username: getUsername(), email: form.elements.email.value.trim(),
    };
    const errors = {
      ...nativeErrors([form.elements.email]),
      ...validateEmailChange(payload).errors,
    };
    if (showFieldErrors(form, errors)) {
      return;
    }
    const button = qs('button[type="submit"]', form);
    setButtonBusy(button, true);
    try {
      const result = await changeEmail(payload.username, payload.email);
      qs('#must-email').textContent = result.email;
      setVisible(form, false);
      toggle.setAttribute('aria-expanded', 'false');
      countdown.start(result.resendAvailableInSeconds);
      showToast(`Tautan verifikasi dikirim ke ${result.email}.`, 'info');
    } catch (error) {
      const field = error instanceof ApiError && error.field === 'email';
      showFieldErrors(form, { email: field ? error.message
        : `${error.message} Silakan coba lagi.` });
    } finally {
      setButtonBusy(button, false);
    }
  });
}

function initEmailVerify() {
  const tabList = qs('#ev-tabs');
  let active = 0;
  let requestId = 0;

  setHtml(tabList, html`${EV_TABS.map((tab, index) => html`
    <button type="button" role="tab" id="ev-tab-${index}" data-index="${index}"
      aria-controls="ev-panel" class="tab h-auto flex-1 rounded-[7px] py-2">
      ${tab.label}</button>`)}`);
  qs('#ev-panel').setAttribute('aria-labelledby', 'ev-tab-0');

  tabList.addEventListener('click', (event) => {
    const button = event.target.closest('[role="tab"]');
    if (button) {
      select(Number(button.dataset.index));
    }
  });
  tabList.addEventListener('keydown', (event) => {
    const delta = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (delta) {
      event.preventDefault();
      select((active + delta + EV_TABS.length) % EV_TABS.length);
      qs(`#ev-tab-${active}`).focus();
    }
  });
  qs('#ev-retry').addEventListener('click', () => load());

  function select(index) {
    active = index;
    load();
  }

  function paintTabs() {
    EV_TABS.forEach((_, index) => {
      const tab = qs(`#ev-tab-${index}`);
      const selected = index === active;
      tab.classList.toggle('tab-active', selected);
      tab.classList.toggle('text-base-content/70', !selected);
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    qs('#ev-panel').setAttribute('aria-labelledby', `ev-tab-${active}`);
  }

  async function load() {
    paintTabs();
    const current = ++requestId;
    setState('loading');
    try {
      const result = await verifyEmail(EV_TABS[active].token);
      if (current === requestId) {
        paintResult(EV_COPY[result.result]);
      }
    } catch (error) {
      if (current !== requestId) {
        return;
      }
      if (error instanceof ApiError && error.code === 'INVALID_LINK') {
        paintResult(EV_COPY.INVALID_LINK);
      } else {
        setState('error');
      }
    }
  }

  function setState(name) {
    qs('#ev-panel').setAttribute('aria-busy', String(name === 'loading'));
    setVisible(qs('#ev-loading'), name === 'loading');
    setVisible(qs('#ev-error'), name === 'error');
    setVisible(qs('#ev-result'), name === 'result');
  }

  function paintResult(copy) {
    const icon = qs('#ev-icon');
    icon.className = 'mx-auto mb-5 grid size-16 place-items-center ' +
      `rounded-full text-[28px] font-extrabold ${copy.cls.join(' ')}`;
    icon.textContent = copy.icon;
    qs('#ev-title').textContent = copy.title;
    qs('#ev-body').textContent = copy.body;
    qs('#ev-cta').textContent = copy.cta;
    setState('result');
  }

  return { enter: load };
}
