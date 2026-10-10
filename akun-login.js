/**
 * @fileoverview Akun & Login page (migrated from
 * legacy (git 2630ca4) Akun & Login.dc.html): 11 demo screens reachable from
 * the "Layar akun:" switcher — login SIAPkerja, password, email
 * verification, and the mandatory announcement screen. Registration
 * (menu layanan + wizard pendaftaran) lives on its own page,
 * registrasi-pemberi-kerja.html, reached only after a successful login.
 * Deep link: akun-login.html#<screenKey> (e.g. #sesi, #lupa).
 */

import { listPengumuman } from '../api/pengumuman.js';
import { getCompany } from '../api/companies.js';
import { getSsoSession } from '../api/reference.js';
import { brand } from '../components/brand.js';
import {
  fillSlots, qs, qsa, renderList, setHtml, setVisible,
} from '../components/dom.js';
import { setOperatorEmail, setOperatorRole } from '../components/operator-session.js';
import { renderScreenSwitcher } from '../components/screen-switcher.js';
import { initLogin } from './akun-login/login.js';
import { initPasswordScreens } from './akun-login/password.js';
import { initVerifyScreens } from './akun-login/verify.js';

const SCREENS = [
  ['ssoCheck', 'Cek sesi SSO'], ['ssoRequired', 'SSO belum aktif'],
  ['login', 'Login'], ['loginGagal', 'Login gagal'],
  ['emailVerify', 'Verifikasi email'], ['lupa', 'Lupa password'],
  ['reset', 'Reset password'], ['wajibPassword', 'Wajib ganti password'],
  ['wajibEmail', 'Wajib verifikasi email'],
  ['pengumuman', 'Pengumuman wajib baca'], ['sesi', 'Sesi berakhir'],
];
const SCREEN_KEYS = SCREENS.map(([key]) => key);
const DEFAULT_SCREEN = 'login';
const DEFAULT_COMPANY_ROLE = 'swasta';
/** Menu layanan + registrasi (usulan KAK Modul 1) pindah ke halaman sendiri,
 * hanya dapat diakses setelah login berhasil. */
const MENU_URL = 'registrasi-pemberi-kerja.html';
const VERIFIKATOR_URL = 'verifikator-akun.html';
const PETUGAS_EKSPOS_URL = 'petugas-ekspos.html';
const VALIDATOR_HPK_URL = 'validator-hpk.html';
const DIREKTUR_HPK_URL = 'direktur-hpk.html';
const DISNAKER_URL = 'disnaker-akun.html';
const IMIGRASI_URL = 'imigrasi-akun.html';
/** Same breakpoint as the `lg:` grid columns of <main>. */
const TWO_COLUMN_QUERY = '(min-width: 64rem)';

/** Identity level per screen: 0 = SSO pending, 1 = SSO ok, 2 = logged in. */
const SSO_PENDING = ['ssoCheck', 'ssoRequired'];
const ACCOUNT_PENDING = ['login', 'loginGagal', 'lupa', 'reset', 'sesi'];
const LAYER_STYLE = {
  pending: { dot: 'bg-warning-bright', text: 'text-warning-bright' },
  ok: { dot: 'bg-success-bright', text: 'text-success-bright' },
  idle: { dot: 'bg-primary-content/30', text: 'text-primary-content/60' },
};

/** Demo account behind the forced-change screens (mustChangePassword +
 * mustVerifyEmail) when they are opened directly from the switcher. */
const DEMO_FORCED_USERNAME = 'nbp.baru';

const state = { screen: DEFAULT_SCREEN, session: null };
let switcher;
let verify;

function init() {
  setHtml(qs('#brand'), brand({
    subtitle: 'Kementerian Ketenagakerjaan RI', href: 'landing.html',
    size: 'lg',
  }));
  switcher = renderScreenSwitcher(qs('#screen-switcher'), {
    label: 'Layar akun:',
    ariaLabel: 'Pilih layar akun (demo)',
    items: SCREENS.map(([key, label]) => ({ key, label })),
    activeKey: state.screen,
    onSelect: (key) => go(key),
  });
  initLogin({ go, onLoggedIn });
  const getUsername = () =>
    state.session?.user.username ?? DEMO_FORCED_USERNAME;
  initPasswordScreens({ go, getUsername });
  verify = initVerifyScreens({ getUsername });

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-go]');
    if (trigger) {
      go(trigger.dataset.go);
    }
  });
  qs('#sso-retry').addEventListener('click', loadSso);
  qs('#ann-retry').addEventListener('click', loadAnnouncements);
  window.addEventListener('hashchange', () => {
    const key = readHash();
    if (key && key !== state.screen) {
      go(key, { focus: false });
    }
  });

  loadSso();
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
  renderIdentity();
  history.replaceState(null, '', `#${state.screen}`);
  enterScreen(state.screen);
  if (focus) {
    scrollToScreen();
    qs(`[data-screen-panel="${state.screen}"] [data-screen-heading]`)
      ?.focus({ preventScroll: true });
  }
}

/**
 * Two-column layout (lg): back to the top, as legacy. Stacked layout
 * (mobile): the identity panel sits above the screen, so scroll the screen
 * column just below the sticky switcher — otherwise a switch looks inert.
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
  const email = state.session?.user.email ?? null;
  const hooks = {
    emailVerify: () => verify.enterEmailVerify(),
    wajibEmail: () => verify.enterMustVerify(email),
    pengumuman: () => loadAnnouncements(),
  };
  hooks[key]?.();
}

function renderIdentity() {
  const { screen } = state;
  const level = SSO_PENDING.includes(screen) ? 0
    : ACCOUNT_PENDING.includes(screen) ? 1 : 2;
  paintLayer(1, level === 0 ? 'pending' : 'ok',
    level === 0 ? 'Memeriksa' : 'Aktif');
  const layer2 = ['idle', 'pending', 'ok'][level];
  paintLayer(2, layer2, ['—', 'Menunggu', 'Masuk'][level]);
}

function paintLayer(no, tone, label) {
  const dot = qs(`#layer-${no}-dot`);
  const status = qs(`#layer-${no}-status`);
  const all = Object.values(LAYER_STYLE);
  dot.classList.remove(...all.map((s) => s.dot));
  dot.classList.add(LAYER_STYLE[tone].dot);
  status.classList.remove(...all.map((s) => s.text));
  status.classList.add(LAYER_STYLE[tone].text);
  status.textContent = label;
}

/**
 * After POST /auth/login: enforce claims (AK-05), then open the menu
 * layanan (usulan KAK Modul 1, halaman terpisah) with the "TKA - Online"
 * card. Hotline agents have no TKA Online menu — they go straight to the
 * announcement screen as before.
 */
function onLoggedIn(session) {
  state.session = session;
  const { claims, user } = session;
  const next = user.kind === 'agen' ? 'hotline.html' : 'portal-pemberi-kerja.html';
  qs('#ann-continue').setAttribute('href', next);
  if (claims.mustChangePassword) {
    go('wajibPassword');
  } else if (claims.mustVerifyEmail) {
    go('wajibEmail');
  } else if (user.kind === 'agen') {
    go('pengumuman');
  } else if (user.kind === 'verifikator') {
    window.location.href = VERIFIKATOR_URL;
  } else if (user.kind === 'petugas-ekspos') {
    window.location.href = PETUGAS_EKSPOS_URL;
  } else if (user.kind === 'validator-hpk') {
    window.location.href = VALIDATOR_HPK_URL;
  } else if (user.kind === 'disnaker') {
    window.location.href = DISNAKER_URL;
  } else if (user.kind === 'direktur-hpk') {
    window.location.href = DIREKTUR_HPK_URL;
  } else if (user.kind === 'superadmin') {
    window.location.href = IMIGRASI_URL;
  } else {
    setOperatorEmail(user.email);
    setOperatorRole(user.companyKey);
    window.location.href = MENU_URL;
  }
}

async function loadSso() {
  setSsoState('loading');
  try {
    const sso = await getSsoSession();
    qs('#sso-name').textContent = sso.name;
    qs('#sso-initials').textContent = initials(sso.name);
    setSsoState('ready');
  } catch (error) {
    console.error('[akun-login] SSO session', error);
    setSsoState('error');
  }
}

function setSsoState(name) {
  qs('#sso-card').setAttribute('aria-busy', String(name === 'loading'));
  setVisible(qs('#sso-loading'), name === 'loading');
  setVisible(qs('#sso-error'), name === 'error');
  setVisible(qs('#sso-ready'), name === 'ready');
}

async function loadAnnouncements() {
  const body = qs('#ann-body');
  body.setAttribute('aria-busy', 'true');
  setVisible(qs('#ann-loading'), true);
  setVisible(qs('#ann-error'), false);
  setVisible(qs('#ann-list'), false);
  const role = state.session?.user.companyKey ?? DEFAULT_COMPANY_ROLE;
  try {
    const [items, company] = await Promise.all([
      listPengumuman(), getCompany(role),
    ]);
    renderList(qs('#ann-list'), qs('#ann-template'), items,
      (node, item) => fillSlots(node, item));
    qs('#ann-company').textContent = company.nama;
    setVisible(qs('#ann-list'), true);
  } catch (error) {
    console.error('[akun-login] pengumuman', error);
    setVisible(qs('#ann-error'), true);
  } finally {
    body.setAttribute('aria-busy', 'false');
    setVisible(qs('#ann-loading'), false);
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
