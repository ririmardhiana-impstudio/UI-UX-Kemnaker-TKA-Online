/**
 * @fileoverview Account maintenance routes (§7.1): resend verification
 * link, forced / voluntary password change, change of unverified email.
 * The prototype identifies the account through `username` in the body;
 * the real backend takes it from the session and ignores that field.
 */

import {
  validateEmailChange,
  validateEmailVerificationResend,
  validatePasswordChange,
} from '../../contracts/auth.js';
import { accepted, fail, invalid, ok, route } from '../router.js';

/** Same 5-minute window as the password reset link (AK-06). */
const RESEND_COOLDOWN_SECONDS = 299;

export const ACCOUNT_ROUTES = [
  route('POST', '/auth/email-verifications', resendVerification, {
    tag: 'Akun', summary: 'Kirim ulang tautan verifikasi email (jeda 5 menit).',
    request: 'EmailVerificationResendRequest',
    example: { body: { email: 'hrd@nusantarabaja.co.id' } },
    responses: { 429: 'Kirim ulang sebelum jeda berakhir (RATE_LIMITED).' },
  }),
  route('POST', '/auth/password-change', changePassword, {
    tag: 'Akun',
    summary: 'Ganti password (claim mustChangePassword); sesi diakhiri.',
    request: 'PasswordChangeRequest',
    example: { body: { username: 'nbp.baru', oldPassword: 'sementara01',
      password: 'BajaPresisi#26', passwordConfirm: 'BajaPresisi#26' } },
    responses: { 401: 'Password lama salah (INVALID_CREDENTIALS).' },
  }),
  route('POST', '/auth/email-change', changeEmail, {
    tag: 'Akun',
    summary: 'Ganti email akun yang belum terverifikasi; tautan dikirim ' +
      'ke alamat baru.',
    request: 'EmailChangeRequest',
    example: { body: { username: 'nbp.baru',
      email: 'tka.admin@nusantarabaja.co.id' } },
    responses: {
      401: 'Akun tidak dikenal (UNAUTHENTICATED).',
      409: 'Email akun sudah terverifikasi (EMAIL_ALREADY_VERIFIED).',
    },
  }),
];

/**
 * Start (or refuse) the resend window for an email address.
 * @return {?{status: number, body: !Object}} 429 response or null.
 */
function takeResendSlot(store, email) {
  const key = email.trim().toLowerCase();
  const last = store.verificationResends[key];
  const elapsed = last ? Math.floor((Date.now() - last) / 1000) : Infinity;
  if (elapsed < RESEND_COOLDOWN_SECONDS) {
    return fail(429, 'RATE_LIMITED', 'Tunggu sebelum mengirim ulang.',
      { retryAfterSeconds: RESEND_COOLDOWN_SECONDS - elapsed });
  }
  store.verificationResends[key] = Date.now();
  return null;
}

function resendVerification({ body, store }) {
  const result = validateEmailVerificationResend(body);
  if (!result.valid) {
    return invalid(result);
  }
  const limited = takeResendSlot(store, body.email);
  return limited ?? accepted({
    sentTo: body.email.trim(),
    resendAvailableInSeconds: RESEND_COOLDOWN_SECONDS,
  });
}

function findAccount(store, username) {
  return store.accounts.find((a) => a.username === username.trim()) ?? null;
}

function changePassword({ body, store }) {
  const result = validatePasswordChange(body);
  if (!result.valid) {
    return invalid(result);
  }
  const account = findAccount(store, body.username);
  if (!account || account.password !== body.oldPassword) {
    return fail(401, 'INVALID_CREDENTIALS', 'Password lama salah.',
      { field: 'oldPassword' });
  }
  account.password = body.password;
  account.claims = { ...account.claims, mustChangePassword: false };
  if (account.loginStatusId === 1 && !account.claims.mustVerifyEmail) {
    account.loginStatusId = 0;
  }
  return ok({ passwordUpdated: true, signedOut: true });
}

function changeEmail({ body, store }) {
  const result = validateEmailChange(body);
  if (!result.valid) {
    return invalid(result);
  }
  const account = findAccount(store, body.username);
  if (!account) {
    return fail(401, 'UNAUTHENTICATED', 'Sesi tidak valid. Silakan masuk.');
  }
  if (!account.claims?.mustVerifyEmail) {
    return fail(409, 'EMAIL_ALREADY_VERIFIED',
      'Email akun sudah terverifikasi; ubah lewat menu Ganti email.');
  }
  const email = body.email.trim();
  if (email.toLowerCase() === account.email.toLowerCase()) {
    return fail(400, 'VALIDATION_ERROR',
      'Email baru sama dengan email saat ini.', { field: 'email' });
  }
  const limited = takeResendSlot(store, email);
  if (limited) {
    return limited;
  }
  account.email = email;
  return ok({ email, resendAvailableInSeconds: RESEND_COOLDOWN_SECONDS });
}
