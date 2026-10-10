/**
 * @fileoverview Prototype status per page (drives js/prototype-banner.js).
 * Status: 'progress' (In Progress) | 'ready' (Ready for Development) |
 * 'done' (Selesai Develop). Update via `/imp.prototype-status` or manually
 * + devlog audit.
 */

export const PAGE_STATUS = [
  { pattern: 'index.html', status: 'progress' },
  { pattern: 'landing.html', status: 'progress' },
  { pattern: 'akun-login.html', status: 'progress' },
  { pattern: 'registrasi-pemberi-kerja.html', status: 'progress' },
  { pattern: 'portal-pemberi-kerja.html', status: 'progress' },
  { pattern: 'verifikator-akun.html', status: 'progress' },
  { pattern: 'petugas-ekspos.html', status: 'progress' },
  { pattern: 'validator-hpk.html', status: 'progress' },
  { pattern: 'direktur-hpk.html', status: 'progress' },
  { pattern: 'disnaker-akun.html', status: 'progress' },
  { pattern: 'imigrasi-akun.html', status: 'progress' },
  { pattern: 'hotline.html', status: 'progress' },
  { pattern: 'back-office.html', status: 'progress' },
];

/** Paths that never show the banner (tooling / docs). */
export const EXCLUDED_PATHS = ['design-system/', 'scaffold/', 'docs/'];

const DEFAULT_STATUS = 'progress';

/**
 * Resolve banner status from a URL pathname.
 * @param {string} pathname e.g. '/portal-pemberi-kerja.html' or '/'.
 * @return {?string} Status key, or null when the page is excluded.
 */
export function resolvePageStatus(pathname) {
  if (EXCLUDED_PATHS.some((prefix) => pathname.includes(`/${prefix}`))) {
    return null;
  }
  const file = pathname.endsWith('/')
    ? 'index.html'
    : pathname.split('/').pop();
  const entry = PAGE_STATUS.find(({ pattern }) => pattern === file);
  return entry ? entry.status : DEFAULT_STATUS;
}
