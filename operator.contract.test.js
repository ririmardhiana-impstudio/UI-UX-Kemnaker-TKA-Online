/** @fileoverview Contract tests — operator perusahaan + verifikasi NIB OSS. */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createClient } from './client.js';

const ROLE = { role: 'swasta' };
const invite = (api, body, query = ROLE) =>
  api('POST', '/operators', { query, body });
const patch = (api, id, body) =>
  api('PATCH', `/operators/${id}`, { query: ROLE, body });
const NEW_OPERATOR = { nama: 'Galih Saputra',
  email: 'galih.saputra@nusantarabaja.co.id', level: 'operator',
  actorLevel: 'admin' };

describe('GET /operators', () => {
  it('lists operators with level and status', async () => {
    const res = await createClient()('GET', '/operators', { query: ROLE });
    assert.equal(res.status, 200);
    assert.ok(res.body.data.length >= 4);
    const admin = res.body.data.find((o) => o.level === 'admin');
    assert.equal(admin.status, 'Aktif');
    assert.ok(res.body.data.some((o) => o.status === 'Nonaktif'));
  });

  it('requires role (400)', async () => {
    const res = await createClient()('GET', '/operators');
    assert.equal(res.status, 400);
    assert.equal(res.body.error.field, 'role');
  });
});

describe('POST /operators', () => {
  it('admin invites an operator (201, Undangan terkirim)', async () => {
    const api = createClient();
    const res = await invite(api, NEW_OPERATOR);
    assert.equal(res.status, 201);
    assert.equal(res.body.data.status, 'Undangan terkirim');
    assert.equal(res.body.data.level, 'operator');
    const listRes = await api('GET', '/operators', { query: ROLE });
    assert.ok(listRes.body.data.some((o) => o.id === res.body.data.id));
  });

  it('non-admin actor is forbidden (403)', async () => {
    const res = await invite(createClient(),
      { ...NEW_OPERATOR, actorLevel: 'operator' });
    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, 'FORBIDDEN');
  });

  it('email is unique per company (409, case-insensitive)', async () => {
    const res = await invite(createClient(),
      { ...NEW_OPERATOR, email: 'FIKRI.R@nusantarabaja.co.id' });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.field, 'email');
  });

  it('same email may exist in another company', async () => {
    const res = await invite(createClient(),
      { ...NEW_OPERATOR, email: 'fikri.r@nusantarabaja.co.id' },
      { role: 'lembaga' });
    assert.equal(res.status, 201);
  });

  it('validates level and email (400)', async () => {
    const res = await invite(createClient(),
      { ...NEW_OPERATOR, level: 'superadmin', email: 'bukan-email' });
    assert.equal(res.status, 400);
    assert.ok(res.body.error.fields.level);
    assert.ok(res.body.error.fields.email);
  });
});

describe('PATCH /operators/{id}', () => {
  it('admin changes an operator level', async () => {
    const res = await patch(createClient(), 'op-s2',
      { level: 'lihat', actorLevel: 'admin' });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.level, 'lihat');
  });

  it('deactivate sets status Nonaktif', async () => {
    const res = await patch(createClient(), 'op-s3',
      { aktif: false, actorLevel: 'admin' });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, 'Nonaktif');
    assert.equal(res.body.data.aktif, false);
  });

  it('non-admin actor is forbidden (403)', async () => {
    const res = await patch(createClient(), 'op-s2',
      { level: 'admin', actorLevel: 'lihat' });
    assert.equal(res.status, 403);
  });

  it('last active admin cannot be demoted (409)', async () => {
    const res = await patch(createClient(), 'op-s1',
      { level: 'operator', actorLevel: 'admin' });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'LAST_ADMIN');
  });

  it('last active admin cannot be deactivated (409)', async () => {
    const res = await patch(createClient(), 'op-s1',
      { aktif: false, actorLevel: 'admin' });
    assert.equal(res.status, 409);
  });

  it('admin can step down once another admin exists', async () => {
    const api = createClient();
    await patch(api, 'op-s2', { level: 'admin', actorLevel: 'admin' });
    const res = await patch(api, 'op-s1',
      { level: 'operator', actorLevel: 'admin' });
    assert.equal(res.status, 200);
  });

  it('requires level or aktif (400)', async () => {
    const res = await patch(createClient(), 'op-s2', { actorLevel: 'admin' });
    assert.equal(res.status, 400);
  });

  it('unknown operator returns 404', async () => {
    const res = await patch(createClient(), 'op-x',
      { level: 'lihat', actorLevel: 'admin' });
    assert.equal(res.status, 404);
  });
});

describe('POST /companies/{role}/nib-verifications', () => {
  const verify = (role, nib) => createClient()('POST',
    `/companies/${role}/nib-verifications`, { body: { nib } });

  it('own NIB is Sesuai with OSS data', async () => {
    const res = await verify('swasta', '9120301234567');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, 'Sesuai');
    for (const key of ['namaPerusahaan', 'kbli', 'alamat',
      'statusPerizinan']) {
      assert.ok(res.body.data.ossData[key], key);
    }
  });

  it('NIB of another company is Tidak sesuai', async () => {
    const res = await verify('swasta', '8120005512349');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, 'Tidak sesuai');
  });

  it('NIB must be 13 digits (400)', async () => {
    const res = await verify('swasta', '91203');
    assert.equal(res.status, 400);
    assert.equal(res.body.error.field, 'nib');
  });

  it('NIB unknown to OSS (422)', async () => {
    const res = await verify('swasta', '1234567890123');
    assert.equal(res.status, 422);
    assert.equal(res.body.error.code, 'NIB_NOT_FOUND');
  });

  it('OSS unavailable for the demo NIB (503)', async () => {
    const res = await verify('swasta', '9999999999999');
    assert.equal(res.status, 503);
    assert.equal(res.body.error.code, 'OSS_UNAVAILABLE');
  });

  it('kelompok C does not use NIB (422)', async () => {
    const res = await verify('pemerintah', '9120301234567');
    assert.equal(res.status, 422);
    assert.equal(res.body.error.code, 'NIB_NOT_APPLICABLE');
  });
});
