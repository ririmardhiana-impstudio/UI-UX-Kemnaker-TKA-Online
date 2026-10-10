/**
 * @fileoverview Lightweight handoff of the logged-in SIAPkerja operator's
 * email from akun-login.html to registrasi-pemberi-kerja.html (separate
 * page loads, no shared JS state). NOT a real session manager — see
 * CLAUDE.md "Sesi" — just enough for the menu screen to recognize an
 * operator whose registration is already `Aktif` and skip the wizard.
 * sessionStorage: cleared when the tab closes, scoped to this origin/tab.
 */

const KEY = 'tka:operator-email';
const ROLE_KEY = 'tka:operator-role';

/** @param {?string} email */
export function setOperatorEmail(email) {
  try {
    sessionStorage.setItem(KEY, email ?? '');
  } catch {
    // Private mode / storage disabled: detection below just degrades to
    // "new registration", the existing default demo behavior.
  }
}

/** @return {?string} */
export function getOperatorEmail() {
  try {
    return sessionStorage.getItem(KEY) || null;
  } catch {
    return null;
  }
}

/** @param {?string} role Kelompok portal: swasta | lembaga | pemerintah. */
export function setOperatorRole(role) {
  try {
    sessionStorage.setItem(ROLE_KEY, role ?? '');
  } catch {
    // Degrades to the default portal role (swasta).
  }
}

/** @return {?string} */
export function getOperatorRole() {
  try {
    return sessionStorage.getItem(ROLE_KEY) || null;
  } catch {
    return null;
  }
}
