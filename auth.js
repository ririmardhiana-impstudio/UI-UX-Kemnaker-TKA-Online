/**
 * @fileoverview Account routes (§6.4, §7.1): login with loginStatusId
 * semantics, 5-step registration (AK-13/14/15/16), OSS lookup by kode
 * WLKP, cek operator ke SIAPKerja, email verification, password reset.
 */

import {
  validateLogin,
  validatePasswordResetConfirm,
  validatePasswordResetRequest,
} from '../../contracts/auth.js';
import {
  validateCompanyLookup, validateOperatorCheck, validateRegister,
} from '../../contracts/registration.js';
import { EMAIL_VERIFY_TOKENS } from '../fixtures.js';
import {
  OSS_REGISTRY, OSS_UNAVAILABLE_WLKP, SIAPKERJA_OPERATOR_EMAILS,
} from '../fixtures/operator.js';
import {
  accepted, created, fail, invalid, ok, route,
} from '../router.js';

/** Failed attempts before reCAPTCHA is required (loginStatusId 4). */
const CAPTCHA_AFTER_FAILURES = 3;
const RESET_COOLDOWN_SECONDS = 299;
const SESSION_MINUTES = 60;

export const AUTH_ROUTES = [
  route('POST', '/auth/login', login, {
    tag: 'Akun', summary: 'Login; loginStatusId 0/1 ok, 3 SSO, 4 captcha, 5 gagal.',
    request: 'LoginRequest',
    example: { body: { username: 'nbp.hrd', password: 'rahasia123' } },
    responses: {
      401: 'Username/password salah (INVALID_CREDENTIALS).',
      403: 'SSO_REQUIRED (3) atau LOGIN_FAILED (5).',
      428: 'CAPTCHA_REQUIRED (4).',
    },
  }),
  route('POST', '/auth/register', register, {
    tag: 'Akun', summary: 'Pendaftaran pemberi kerja (5 langkah); masuk ' +
      'antrean Verifikator dengan status "Menunggu verifikasi" (AK-15).',
    request: 'RegisterRequest',
    responses: { 409: 'NPWP sudah terdaftar.' },
  }),
  route('POST', '/auth/register/company-lookup', companyLookup, {
    tag: 'Akun', summary: 'Cari data perusahaan di OSS dari kode ' +
      'pendaftaran WLKP: NIB, WLKP, NPWP (AK-14). Kode demo ' +
      `${OSS_UNAVAILABLE_WLKP} = OSS tidak tersedia.`,
    request: 'CompanyLookupRequest',
    example: { body: { kodeWlkp: '3216.2015.004512' } },
    responses: {
      422: 'Kode WLKP tidak terdaftar di OSS (WLKP_NOT_FOUND).',
      503: 'Layanan OSS tidak tersedia (OSS_UNAVAILABLE).',
    },
  }),
  route('POST', '/auth/register/operator-check', operatorCheck, {
    tag: 'Akun', summary: 'Cek email operator ke SIAPKerja (AK-16).',
    request: 'OperatorCheckRequest',
    example: { body: { email: 'hrd@nusantarabaja.co.id' } },
  }),
  route('GET', '/auth/email-verifications/:token', verifyEmail, {
    tag: 'Akun', summary: 'Hasil tautan verifikasi email.',
    example: { params: { token: 'verify-ok' } },
    responses: { 410: 'Tautan tidak valid / kedaluwarsa.' },
  }),
  route('POST', '/auth/password-reset', requestReset, {
    tag: 'Akun', summary: 'Kirim tautan reset password (jeda 5 menit).',
    request: 'PasswordResetRequest',
    example: { body: { email: 'hrd@nusantarabaja.co.id' } },
    responses: { 429: 'Kirim ulang sebelum jeda berakhir.' },
  }),
  route('POST', '/auth/password-reset/confirm', confirmReset, {
    tag: 'Akun', summary: 'Simpan password baru dari tautan reset.',
    request: 'PasswordResetConfirm',
    example: { body: { token: 'mock-reset-token',
      password: 'BajaPresisi#26', passwordConfirm: 'BajaPresisi#26' } },
    responses: { 400: 'Token tidak valid.' },
  }),
];

function login({ body, store }) {
  const result = validateLogin(body);
  if (!result.valid) {
    return invalid(result);
  }
  const username = body.username.trim();
  const failures = store.loginFailures[username] ?? 0;
  if (failures >= CAPTCHA_AFTER_FAILURES && !body.captchaToken) {
    return fail(428, 'CAPTCHA_REQUIRED', 'Selesaikan reCAPTCHA.',
      { loginStatusId: 4 });
  }
  const account = store.accounts.find((a) => a.username === username);
  if (!account || account.password !== body.password) {
    store.loginFailures[username] = failures + 1;
    return fail(401, 'INVALID_CREDENTIALS', 'Username atau password salah.',
      { attemptsLeft: Math.max(0, CAPTCHA_AFTER_FAILURES - failures - 1) });
  }
  store.loginFailures[username] = 0;
  return loginOutcome(account);
}

function loginOutcome(account) {
  if (account.loginStatusId === 3) {
    return fail(403, 'SSO_REQUIRED', 'Masuk melalui SSO SIAPkerja.',
      { loginStatusId: 3 });
  }
  if (account.loginStatusId === 5) {
    return fail(403, 'LOGIN_FAILED',
      'Akun dinonaktifkan atau belum diverifikasi petugas.',
      { loginStatusId: 5 });
  }
  const now = Date.now();
  return ok({
    loginStatusId: account.loginStatusId,
    token: `mock.jwt.${account.username}.${now}`,
    expiresAt: new Date(now + SESSION_MINUTES * 60000).toISOString(),
    claims: {
      mustChangePassword: false, mustVerifyEmail: false,
      mustUpdateProfile: false, ...account.claims,
    },
    user: {
      username: account.username, name: account.name, email: account.email,
      kind: account.kind, companyKey: account.companyKey,
    },
  });
}

/**
 * AK-15: berkas masuk antrean Verifikator terlebih dahulu ("Menunggu
 * verifikasi"); operator baru mendapat akses setelah Verifikator
 * menyetujui (lihat routes/pendaftar.js `activate`), bukan segera saat
 * submit. Dipicu dari menu layanan TKA Online setelah login SIAPKerja,
 * bukan dari akun/password terpisah — tidak ada username/password di sini.
 */
function register({ body, store }) {
  const result = validateRegister(body);
  if (!result.valid) {
    return invalid(result);
  }
  const duplicate = findDuplicate(store, body);
  if (duplicate) {
    return fail(409, 'DUPLICATE', duplicate.message,
      { field: duplicate.field });
  }
  const pendaftar = {
    nama: body.namaPemberiKerja.trim(),
    statusPenanamModal: body.statusPenanamModal,
    kategori: body.jenisPemberiKerja,
    npwp: formatNpwp(body.npwp), tgl: '30 Sep 2026', sso: store.sso.name,
    operatorEmails: body.operatorEmails.map((o) => o.email),
    // Data untuk halaman detail akun Verifikator (AK-20); emailAdmin =
    // email SIAPkerja pendaftar yang sedang login.
    metodePendaftaran: body.metodePendaftaran, nib: body.nib ?? '',
    kodeWlkp: body.kodeWlkp ?? '', emailAdmin: store.sso.email,
    operators: body.operatorEmails.map(({ email, nama }) =>
      ({ email, nama: nama ?? '', terdaftar: true })),
    dokumen: body.documents?.[0] ?? null,
    status: 'Menunggu verifikasi', tone: 'amber', email: false,
  };
  store.pendaftar.unshift(pendaftar);
  return created(pendaftar);
}

/** AK-14: cari data perusahaan di OSS dari kode WLKP (pola sama OP-06). */
function companyLookup({ body }) {
  const result = validateCompanyLookup(body);
  if (!result.valid) {
    return invalid(result);
  }
  const kodeWlkp = body.kodeWlkp.trim();
  if (kodeWlkp === OSS_UNAVAILABLE_WLKP) {
    return fail(503, 'OSS_UNAVAILABLE',
      'Layanan OSS sedang tidak tersedia. Coba lagi beberapa saat.');
  }
  const entry = Object.entries(OSS_REGISTRY)
    .find(([, data]) => data.kodeWlkp === kodeWlkp);
  if (!entry) {
    return fail(422, 'WLKP_NOT_FOUND',
      'Kode pendaftaran WLKP tidak ditemukan di OSS.',
      { field: 'kodeWlkp' });
  }
  const [nib, ossData] = entry;
  return ok({
    status: 'Ditemukan', nib, wlkp: ossData.kodeWlkp, npwp: ossData.npwp,
    namaPemberiKerja: ossData.namaPerusahaan, ossData: { ...ossData },
    checkedAt: new Date().toISOString(),
  });
}

/**
 * AK-16: cek email operator ke SIAPKerja. Email yang sudah dikenal
 * (`SIAPKERJA_OPERATOR_EMAILS`) mengembalikan namanya yang sebenarnya;
 * email lain tetap dianggap "Data Ditemukan" dengan nama dummy yang
 * diturunkan dari alamatnya, supaya wizard bisa ditest dengan email apa
 * saja, bukan cuma 4 alamat yang sudah dihardcode.
 *
 * Demo [I] (bukan business rule — JANGAN diimplementasi apa adanya di
 * BE): produksi WAJIB benar-benar mencocokkan ke SIAPKerja dan
 * mengembalikan `terdaftar: false` untuk operator yang sungguh belum
 * terdaftar (lihat deskripsi asli AK-16 di business-rules.md).
 */
function operatorCheck({ body }) {
  const result = validateOperatorCheck(body);
  if (!result.valid) {
    return invalid(result);
  }
  const email = body.email.trim().toLowerCase();
  const nama = SIAPKERJA_OPERATOR_EMAILS[email] ?? deriveDummyNama(email);
  return ok({ email: body.email.trim(), terdaftar: true, nama });
}

/** "budi.santoso@x.co.id" -> "Budi Santoso" (nama dummy, demo-only). */
function deriveDummyNama(email) {
  const local = email.split('@')[0] ?? '';
  const words = local.split(/[._\-0-9]+/).filter(Boolean);
  return words.length
    ? words.map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')
    : 'Operator';
}

/**
 * Duplicate check against pending registrations (pendaftar) and accounts
 * created through this endpoint. The demo companies are deliberately not
 * checked: the legacy flow registers PT Nusantara Baja Presisi itself.
 */
function findDuplicate(store, body) {
  const npwp = digits(body.npwp);
  // Non-OSS tidak mengumpulkan NPWP sama sekali (AK-18) — npwp kosong
  // tidak boleh dianggap "duplikat" terhadap entri lain yang juga kosong
  // atau tidak punya NPWP (mis. seed "Kedutaan Besar Republik Estonia").
  if (!npwp) {
    return null;
  }
  return store.pendaftar.some((p) => digits(p.npwp) === npwp)
    ? { field: 'npwp', message: 'NPWP sudah terdaftar.' }
    : null;
}

function verifyEmail({ params }) {
  const outcome = EMAIL_VERIFY_TOKENS[params.token];
  if (!outcome) {
    return fail(410, 'INVALID_LINK',
      'Tautan verifikasi kedaluwarsa atau tidak dikenali.');
  }
  return ok({ result: outcome, alreadyVerified: outcome !== 'Berhasil' });
}

function requestReset({ body, store }) {
  const result = validatePasswordResetRequest(body);
  if (!result.valid) {
    return invalid(result);
  }
  const email = body.email.trim().toLowerCase();
  const last = store.passwordResets[email];
  const elapsed = last ? Math.floor((Date.now() - last) / 1000) : Infinity;
  if (elapsed < RESET_COOLDOWN_SECONDS) {
    return fail(429, 'RATE_LIMITED', 'Tunggu sebelum mengirim ulang.',
      { retryAfterSeconds: RESET_COOLDOWN_SECONDS - elapsed });
  }
  store.passwordResets[email] = Date.now();
  return accepted({
    sentTo: body.email.trim(), resendAvailableInSeconds: RESET_COOLDOWN_SECONDS,
  });
}

function confirmReset({ body, store }) {
  const result = validatePasswordResetConfirm(body);
  if (!result.valid) {
    return invalid(result);
  }
  if (!store.issuedResetTokens.has(body.token)) {
    return fail(400, 'INVALID_TOKEN', 'Tautan reset tidak valid.',
      { field: 'token' });
  }
  store.issuedResetTokens.delete(body.token);
  return ok({ passwordUpdated: true });
}

function digits(value) {
  return String(value ?? '').replace(/\D/g, '');
}

function formatNpwp(value) {
  return digits(value).replace(/(\d{4})(?=\d)/g, '$1 ');
}
