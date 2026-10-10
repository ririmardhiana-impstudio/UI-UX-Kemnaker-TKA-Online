/** @fileoverview Contract tests — resend verification, password/email change. */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createClient } from './client.js';

const NEW_PASSWORD = 'BajaPresisi#26';
const change = (overrides = {}) => ({
  username: 'nbp.baru', oldPassword: 'sementara01',
  password: NEW_PASSWORD, passwordConfirm: NEW_PASSWORD, ...overrides,
});

describe('POST /auth/email-verifications', () => {
  it('accepts, then rate-limits a second resend (429)', async () => {
    const api = createClient();
    const body = { email: 'hrd@nusantarabaja.co.id' };
    const first = await api('POST', '/auth/email-verifications', { body });
    assert.equal(first.status, 202);
    const second = await api('POST', '/auth/email-verifications', { body });
    assert.equal(second.status, 429);
    assert.ok(second.body.error.retryAfterSeconds > 0);
  });

  it('validates the email format', async () => {
    const res = await createClient()('POST', '/auth/email-verifications',
      { body: { email: 'bukan-email' } });
    assert.equal(res.status, 400);
  });
});

describe('POST /auth/password-change', () => {
  it('changes the password and clears mustChangePassword', async () => {
    const api = createClient();
    const res = await api('POST', '/auth/password-change', { body: change() });
    assert.equal(res.status, 200);
    const login = await api('POST', '/auth/login',
      { body: { username: 'nbp.baru', password: NEW_PASSWORD } });
    assert.equal(login.status, 200);
    assert.equal(login.body.data.claims.mustChangePassword, false);
  });

  it('rejects a wrong old password (401, field oldPassword)', async () => {
    const res = await createClient()('POST', '/auth/password-change',
      { body: change({ oldPassword: 'salah' }) });
    assert.equal(res.status, 401);
    assert.equal(res.body.error.field, 'oldPassword');
  });

  it('new password must differ from the old one (400)', async () => {
    const res = await createClient()('POST', '/auth/password-change',
      { body: change({ oldPassword: 'Sementara#01',
        password: 'Sementara#01', passwordConfirm: 'Sementara#01' }) });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.field, 'password');
  });

  it('enforces strength + confirmation (400)', async () => {
    const res = await createClient()('POST', '/auth/password-change',
      { body: change({ password: 'lemahsekali', passwordConfirm: 'x' }) });
    assert.equal(res.status, 400);
    assert.ok(res.body.error.fields.password);
    assert.ok(res.body.error.fields.passwordConfirm);
  });
});

describe('POST /auth/email-change', () => {
  it('changes an unverified email', async () => {
    const res = await createClient()('POST', '/auth/email-change',
      { body: { username: 'nbp.baru', email: 'tka.admin@nusantarabaja.co.id' } });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.email, 'tka.admin@nusantarabaja.co.id');
  });

  it('refuses an already verified account (409)', async () => {
    const res = await createClient()('POST', '/auth/email-change',
      { body: { username: 'nbp.hrd', email: 'baru@nusantarabaja.co.id' } });
    assert.equal(res.status, 409);
  });

  it('refuses the same email (400)', async () => {
    const res = await createClient()('POST', '/auth/email-change',
      { body: { username: 'nbp.baru', email: 'hrd@nusantarabaja.co.id' } });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.field, 'email');
  });
});
