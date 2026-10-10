/**
 * @fileoverview Registrasi Pemberi Kerja page (usulan KAK Modul 1, diagram
 * "Registrasi Operator TKA-Online"): menu layanan SIAPkerja (kartu
 * "TKA - Online"), wizard registrasi 5 langkah, dan status pendaftaran.
 * Hanya dapat diakses setelah login berhasil di akun-login.html (lihat
 * onLoggedIn() di sana) — halaman ini tidak punya entri login sendiri.
 * Deep link: registrasi-pemberi-kerja.html#<screenKey> (e.g. #daftar).
 */

import { listPendaftar } from '../api/pendaftar.js';
import { getSsoSession, getSystemInfo } from '../api/reference.js';
import { brand } from '../components/brand.js';
import { qs, qsa, setHtml, setVisible } from '../components/dom.js';
import { getOperatorEmail, getOperatorRole } from '../components/operator-session.js';
import { renderScreenSwitcher } from '../components/screen-switcher.js';
import { initRegister } from './registrasi-pemberi-kerja/register.js';
import { initStatusScreen } from './registrasi-pemberi-kerja/status.js';

const SCREENS = [
  ['menu', 'Menu layanan'], ['daftar', 'Daftar (5 langkah)'],
  ['daftarSelesai', 'Daftar selesai'],
];
const SCREEN_KEYS = SCREENS.map(([key]) => key);
const DEFAULT_SCREEN = 'menu';
/** Same breakpoint as the `lg:` grid columns of <main>. */
const TWO_COLUMN_QUERY = '(min-width: 64rem)';
/** Jeda simulasi deteksi status akun saat klik kartu "TKA - Online". */
const MENU_DETECT_MS = 650;

/** Status pendaftaran default when "Daftar selesai" is opened directly
 * from the switcher (demo), tanpa pendaftaran nyata di sesi ini. */
const DEMO_REGISTRATION = {
  npwp: '0012345678012000', nama: 'PT Nusantara Baja Presisi',
  sentAt: '30 September 2026, 10.42', email: 'hrd@nusantarabaja.co.id',
};

const state = { screen: DEFAULT_SCREEN, registered: null };
let switcher;
let register;
let statusScreen;

function init() {
  setHtml(qs('#brand'), brand({
    subtitle: 'Kementerian Ketenagakerjaan RI', href: 'landing.html',
    size: 'lg',
  }));
  switcher = renderScreenSwitcher(qs('#screen-switcher'), {
    label: 'Layar:',
    ariaLabel: 'Pilih layar (demo)',
    items: SCREENS.map(([key, label]) => ({ key, label })),
    activeKey: state.screen,
    onSelect: (key) => go(key),
  });
  register = initRegister({ go, onRegistered, onResubmitted });
  statusScreen = initStatusScreen({ onFixDocuments });

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-go]');
    if (trigger) {
      go(trigger.dataset.go);
    }
  });
  qs('#menu-tka-card').addEventListener('click', onMenuTkaClick);
  window.addEventListener('hashchange', () => {
    const key = readHash();
    if (key && key !== state.screen) {
      go(key, { focus: false });
    }
  });

  paintIdentity();
  go(readHash() ?? DEFAULT_SCREEN, { focus: false });
}

/**
 * Show one screen and run its entry hook.
 * @param {string} key
 * @param {{focus: boolean}=} options
 */
function go(key, { focus = true } = {}) {
  state.screen = SCREEN_KEYS.includes(key) ? key : DEFAULT_SCREEN;
  for (const panel of qsa('[data-screen-panel]')) {
    setVisible(panel, panel.dataset.screenPanel === state.screen);
  }
  switcher.setActive(state.screen);
  history.replaceState(null, '', `#${state.screen}`);
  enterScreen(state.screen);
  if (focus) {
    scrollToScreen();
    qs(`[data-screen-panel="${state.screen}"] [data-screen-heading]`)
      ?.focus({ preventScroll: true });
  }
}

/**
 * Two-column layout (lg): back to the top. Stacked layout (mobile): the
 * identity panel sits above the screen, so scroll the screen column just
 * below the sticky switcher — otherwise a switch looks inert.
 */
function scrollToScreen() {
  if (window.matchMedia(TWO_COLUMN_QUERY).matches) {
    window.scrollTo(0, 0);
    return;
  }
  const column = qs('#screen-column');
  const switcherHeight = qs('#screen-switcher').offsetHeight;
  const top = column.getBoundingClientRect().top + window.scrollY;
  window.scrollTo(0, Math.max(0, top - switcherHeight));
}

function enterScreen(key) {
  const hooks = {
    menu: () => loadMenuSso(),
    daftar: () => register.setStep(1),
    daftarSelesai: () =>
      statusScreen.enter(state.registered ?? DEMO_REGISTRATION),
  };
  hooks[key]?.();
}

/** AK-15 loop-back: re-open the wizard at Dokumen, in "perbaiki" mode. */
function onFixDocuments(npwp) {
  go('daftar');
  register.enterFixMode(npwp);
}

/**
 * Kartu "TKA - Online" di menu layanan (usulan KAK Modul 1): deteksi
 * otomatis status akun setelah login SIAPKerja. Operator yang emailnya
 * cocok dengan pendaftar berstatus "Aktif" (demo: akun nbp.hrd,
 * hrd@nusantarabaja.co.id) langsung masuk dashboard — belum terdaftar
 * diarahkan ke wizard registrasi.
 */
async function onMenuTkaClick() {
  const card = qs('#menu-tka-card');
  const status = qs('#menu-tka-status');
  card.disabled = true;
  card.setAttribute('aria-busy', 'true');
  setVisible(qs('#menu-tka-arrow'), false);
  setVisible(qs('#menu-tka-spinner'), true);
  status.textContent = 'Memeriksa status akun…';
  const [, active] = await Promise.all([
    new Promise((resolve) => window.setTimeout(resolve, MENU_DETECT_MS)),
    findActiveRegistration(),
  ]);
  card.disabled = false;
  card.setAttribute('aria-busy', 'false');
  setVisible(qs('#menu-tka-spinner'), false);
  setVisible(qs('#menu-tka-arrow'), true);
  status.textContent = '';
  if (active) {
    const role = getOperatorRole();
    window.location.href = role ? `portal-pemberi-kerja.html?role=${role}`
      : 'portal-pemberi-kerja.html';
    return;
  }
  go('daftar');
}

/**
 * Cocokkan email operator yang login (handoff dari akun-login.html, lihat
 * components/operator-session.js) ke pendaftar berstatus "Aktif". Tanpa
 * email tersimpan (mis. halaman dibuka langsung dari switcher demo) selalu
 * dianggap belum terdaftar — jalur wizard seperti sebelumnya.
 * @return {!Promise<boolean>}
 */
async function findActiveRegistration() {
  const email = getOperatorEmail();
  if (!email) {
    return false;
  }
  try {
    const rows = await listPendaftar();
    return rows.some((p) => p.status === 'Aktif' &&
      p.operatorEmails?.includes(email));
  } catch (error) {
    console.error('[registrasi-pemberi-kerja] cek pendaftar aktif', error);
    return false;
  }
}

/** Halaman ini hanya dicapai setelah login — status identitas statis. */
function paintIdentity() {
  const dot = qs('#layer-1-dot');
  const status = qs('#layer-1-status');
  dot.classList.add('bg-success-bright');
  status.classList.add('text-success-bright');
  status.textContent = 'Aktif';
}

async function onRegistered(pendaftar, email) {
  const sentAt = await formatSentAt();
  state.registered = { npwp: pendaftar.npwp, nama: pendaftar.nama, sentAt,
    email };
  go('daftarSelesai');
  statusScreen.enter(state.registered);
}

/** AK-15 loop-back: dokumen diunggah ulang, kembali ke status pendaftaran. */
function onResubmitted(pendaftar) {
  if (state.registered) {
    state.registered = { ...state.registered, npwp: pendaftar.npwp };
  }
  go('daftarSelesai');
  statusScreen.enter(state.registered ?? DEMO_REGISTRATION);
}

async function formatSentAt() {
  const time = new Date().toLocaleTimeString('id-ID',
    { hour: '2-digit', minute: '2-digit' }).replace(':', '.');
  try {
    const { today } = await getSystemInfo();
    return `${today}, ${time}`;
  } catch {
    return new Date().toLocaleDateString('id-ID',
      { day: 'numeric', month: 'long', year: 'numeric' }) + `, ${time}`;
  }
}

let menuSsoLoaded = false;

/**
 * Identity card on the "menu" screen; loaded once (lazy on first visit).
 * Also fills `[data-sso-name]` on the wizard header ("Didaftarkan oleh").
 */
async function loadMenuSso() {
  if (menuSsoLoaded) {
    return;
  }
  try {
    const sso = await getSsoSession();
    qs('#menu-sso-name').textContent = sso.name;
    qs('#menu-sso-initials').textContent = initials(sso.name);
    for (const el of qsa('[data-sso-name]')) {
      el.textContent = sso.name;
    }
    setVisible(qs('#menu-sso-loading'), false);
    setVisible(qs('#menu-sso-ready'), true);
    menuSsoLoaded = true;
  } catch (error) {
    console.error('[registrasi-pemberi-kerja] menu SSO session', error);
  }
}

function readHash() {
  const key = window.location.hash.slice(1);
  return SCREEN_KEYS.includes(key) ? key : null;
}

function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2)
    .map((part) => part[0].toUpperCase()).join('');
}

init();
