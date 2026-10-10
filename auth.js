/**
 * @fileoverview Account API (login, register, email verify, reset,
 * resend verification, password change, email change).
 */

import { apiGet, apiPost } from './http.js';

/**
 * Login. Resolves session on loginStatusId 0/1; rejects ApiError with
 * code INVALID_CREDENTIALS | CAPTCHA_REQUIRED | SSO_REQUIRED | LOGIN_FAILED
 * (error.detail.loginStatusId carries 3/4/5).
 * @param {{username: string, password: string, captchaToken: ?string}} body
 */
export function login(body) {
  return apiPost('/auth/login', body);
}

/** Register employer (all 5 wizard steps merged). */
export function register(body) {
  return apiPost('/auth/register', body);
}

/**
 * Cari data perusahaan di OSS dari kode pendaftaran WLKP (AK-14): NIB,
 * WLKP, NPWP, nama. 422 WLKP_NOT_FOUND, 503 OSS_UNAVAILABLE.
 * @param {string} kodeWlkp
 */
export function lookupCompanyByWlkp(kodeWlkp) {
  return apiPost('/auth/register/company-lookup', { kodeWlkp });
}

/**
 * Cek email operator ke SIAPKerja (AK-16).
 * @param {string} email
 */
export function checkOperatorEmail(email) {
  return apiPost('/auth/register/operator-check', { email });
}

/** Result of an email verification link token. */
export function verifyEmail(token) {
  return apiGet(`/auth/email-verifications/${encodeURIComponent(token)}`);
}

/** Send password reset link; 429 RATE_LIMITED within cooldown. */
export function requestPasswordReset(email) {
  return apiPost('/auth/password-reset', { email });
}

/** Save new password from reset link. */
export function confirmPasswordReset(body) {
  return apiPost('/auth/password-reset/confirm', body);
}

/** Resend verification link; 429 RATE_LIMITED within the 5-minute window. */
export function resendEmailVerification(email) {
  return apiPost('/auth/email-verifications', { email });
}

/**
 * Change password (claim mustChangePassword). 401 INVALID_CREDENTIALS
 * (field oldPassword) when the current password is wrong.
 * @param {{username: string, oldPassword: string, password: string,
 *     passwordConfirm: string}} body
 */
export function changePassword(body) {
  return apiPost('/auth/password-change', body);
}

/** Change unverified account email; resends the verification link. */
export function changeEmail(username, email) {
  return apiPost('/auth/email-change', { username, email });
}
