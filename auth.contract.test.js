/** @fileoverview Contract tests — account rules (§2.2, §6.4, §7.1). */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createClient } from './client.js';

const VALID_REGISTER = {
  statusPenanamModal: 'Penanam Modal',
  jenisPemberiKerja: 'Perusahaan dengan modal asing',
  metodePendaftaran: 'OSS',
  kodeWlkp: '3216.2015.004512',
  nib: '9120301234567', npwp: '0012345678012000',
  namaPemberiKerja: 'PT Nusantara Baja Presisi',
  operatorEmails: [{ email: 'hrd@nusantarabaja.co.id',
    nama: 'Rina Wulandari', terdaftar: true }],
  documents: [{ jenis: 'Surat Penunjukan Operator/PIC',
    fileName: 'surat-penunjukan.pdf', fileSize: 1000,
    mimeType: 'application/pdf' }],
};

const login = (api, username, password, extra = {}) =>
  api('POST', '/auth/login', { body: { username, password, ...extra } });
const register = (api, patch) =>
  api('POST', '/auth/register', { body: { ...VALID_REGISTER, ...patch } });

describe('POST /auth/login', () => {
  it('returns a session for a valid account (loginStatusId 0)', async () => {
    const res = await login(createClient(), 'nbp.hrd', 'rahasia123');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.loginStatusId, 0);
    assert.ok(res.body.data.token);
    assert.equal(res.body.data.user.companyKey, 'swasta');
  });

  it('rejects wrong password with 401 INVALID_CREDENTIALS', async () => {
    const res = await login(createClient(), 'nbp.hrd', 'salah');
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'INVALID_CREDENTIALS');
  });

  it('requires reCAPTCHA (4) after 3 failed attempts', async () => {
    const api = createClient();
    for (let i = 0; i < 3; i++) {
      await login(api, 'nbp.hrd', 'salah');
    }
    const res = await login(api, 'nbp.hrd', 'rahasia123');
    assert.equal(res.status, 428);
    assert.equal(res.body.error.loginStatusId, 4);
    const withCaptcha = await login(api, 'nbp.hrd', 'rahasia123',
      { captchaToken: 'ok' });
    assert.equal(withCaptcha.status, 200);
  });

  it('returns SSO_REQUIRED (3) and LOGIN_FAILED (5)', async () => {
    const api = createClient();
    const sso = await login(api, 'nbp.sso', 'rahasia123');
    assert.equal(sso.body.error.loginStatusId, 3);
    const blocked = await login(api, 'nbp.nonaktif', 'rahasia123');
    assert.equal(blocked.status, 403);
    assert.equal(blocked.body.error.loginStatusId, 5);
  });

  it('exposes mustChangePassword claim', async () => {
    const res = await login(createClient(), 'nbp.baru', 'sementara01');
    assert.equal(res.body.data.claims.mustChangePassword, true);
  });

  it('rejects username longer than 20 characters', async () => {
    const res = await login(createClient(), 'a'.repeat(21), 'x');
    assert.equal(res.status, 400);
    assert.equal(res.body.error.field, 'username');
  });
});

describe('POST /auth/register', () => {
  const cases = [
    ['status penanam modal is required',
      { statusPenanamModal: '' }, 'statusPenanamModal'],
    ['jenis pemberi kerja must match status penanam modal (AK-13)',
      { jenisPemberiKerja: 'Instansi Pemerintah' }, 'jenisPemberiKerja'],
    ['kode WLKP must match 0000.0000.000000',
      { kodeWlkp: '12345' }, 'kodeWlkp'],
    ['metode pendaftaran is required',
      { metodePendaftaran: '' }, 'metodePendaftaran'],
    ['kode WLKP is required when metode is OSS (AK-18)',
      { kodeWlkp: '' }, 'kodeWlkp'],
    ['NIB must be 13 digits', { nib: '12345' }, 'nib'],
    ['NPWP must be 15/16 digits', { npwp: '123' }, 'npwp'],
    ['at least one operator email is required',
      { operatorEmails: [] }, 'operatorEmails'],
    ['every operator email must be verified in SIAPKerja (AK-16)',
      { operatorEmails: [{ email: 'belum@siapkerja.go.id', terdaftar: false }] },
      'operatorEmails'],
    ['document must be "Surat Penunjukan Operator/PIC"',
      { documents: [{ ...VALID_REGISTER.documents[0], jenis: 'Lainnya' }] },
      'documents'],
    ['document must be PDF or image',
      { documents: [{ ...VALID_REGISTER.documents[0],
        mimeType: 'application/zip' }] }, 'documents'],
  ];
  for (const [name, patch, field] of cases) {
    it(`400 when ${name}`, async () => {
      const res = await register(createClient(), patch);
      assert.equal(res.status, 400);
      assert.ok(field in res.body.error.fields, JSON.stringify(res.body));
    });
  }

  it('201 then 409 DUPLICATE for the same NPWP', async () => {
    const api = createClient();
    const first = await register(api, {});
    assert.equal(first.status, 201);
    assert.equal(first.body.data.status, 'Menunggu verifikasi');
    const again = await register(api, {});
    assert.equal(again.status, 409);
    assert.equal(again.body.error.field, 'npwp');
  });

  it('accepts a second operator email', async () => {
    const res = await register(createClient(), { npwp: '0220104455667000',
      operatorEmails: [...VALID_REGISTER.operatorEmails,
        { email: 'fikri.r@nusantarabaja.co.id', nama: 'Fikri Ramadhan',
          terdaftar: true }] });
    assert.equal(res.status, 201);
  });

  it('accepts metode Non-OSS with no company data at all (AK-18)', async () => {
    const res = await register(createClient(), {
      metodePendaftaran: 'Non-OSS', kodeWlkp: '', nib: '', npwp: '',
      namaPemberiKerja: '',
      documents: [{ jenis: 'Surat Permohonan Pengajuan TKA',
        fileName: 'surat-permohonan.pdf', fileSize: 1000,
        mimeType: 'application/pdf' }] });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.npwp, '');
    assert.equal(res.body.data.nama, '');
  });

  it('two Non-OSS registrations (both without NPWP) do not collide ' +
      '(AK-18)', async () => {
    const payload = { metodePendaftaran: 'Non-OSS', kodeWlkp: '', nib: '',
      npwp: '', namaPemberiKerja: '',
      documents: [{ jenis: 'Surat Permohonan Pengajuan TKA',
        fileName: 'surat-permohonan.pdf', fileSize: 1000,
        mimeType: 'application/pdf' }] };
    const api = createClient();
    const first = await register(api, payload);
    assert.equal(first.status, 201);
    const second = await register(api,
        { ...payload, operatorEmails: [{ email: 'fikri.r@nusantarabaja.co.id',
          nama: 'Fikri Ramadhan', terdaftar: true }] });
    assert.equal(second.status, 201);
  });

  it('rejects the OSS document jenis when metode is Non-OSS (AK-18)',
      async () => {
        const res = await register(createClient(), {
          npwp: '0556677889900000', metodePendaftaran: 'Non-OSS',
          kodeWlkp: '', nib: '' });
        assert.equal(res.status, 400);
        assert.equal(res.body.error.field, 'documents');
      });
});

describe('POST /auth/register/company-lookup (AK-14)', () => {
  const lookup = (api, kodeWlkp) =>
    api('POST', '/auth/register/company-lookup', { body: { kodeWlkp } });

  it('finds NIB/WLKP/NPWP from a known kode WLKP', async () => {
    const res = await lookup(createClient(), '3216.2015.004512');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, 'Ditemukan');
    assert.equal(res.body.data.nib, '9120301234567');
    assert.equal(res.body.data.npwp, '0012345678012000');
    assert.equal(res.body.data.namaPemberiKerja, 'PT Nusantara Baja Presisi');
  });

  it('unknown kode WLKP -> 422 WLKP_NOT_FOUND', async () => {
    const res = await lookup(createClient(), '9999.9999.999999');
    assert.equal(res.status, 422);
    assert.equal(res.body.error.code, 'WLKP_NOT_FOUND');
  });

  it('demo kode WLKP -> 503 OSS_UNAVAILABLE', async () => {
    const res = await lookup(createClient(), '0000.0000.000000');
    assert.equal(res.status, 503);
    assert.equal(res.body.error.code, 'OSS_UNAVAILABLE');
  });

  it('rejects a malformed kode WLKP', async () => {
    const res = await lookup(createClient(), 'bukan-kode');
    assert.equal(res.status, 400);
    assert.equal(res.body.error.field, 'kodeWlkp');
  });
});

describe('POST /auth/register/operator-check (AK-16)', () => {
  const check = (api, email) =>
    api('POST', '/auth/register/operator-check', { body: { email } });

  it('known SIAPKerja email -> terdaftar true + nama', async () => {
    const res = await check(createClient(), 'hrd@nusantarabaja.co.id');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.terdaftar, true);
    assert.equal(res.body.data.nama, 'Rina Wulandari');
  });

  it('unknown email -> still terdaftar true with a dummy nama (demo, ' +
      'AK-16) so the wizard can be tested with any email', async () => {
    const res = await check(createClient(), 'budi.santoso@example.com');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.terdaftar, true);
    assert.equal(res.body.data.nama, 'Budi Santoso');
  });

  it('unknown email with no readable local part -> dummy nama "Operator"',
      async () => {
        const res = await check(createClient(), '12345@example.com');
        assert.equal(res.status, 200);
        assert.equal(res.body.data.terdaftar, true);
        assert.equal(res.body.data.nama, 'Operator');
      });

  it('rejects an invalid email format', async () => {
    const res = await check(createClient(), 'bukan-email');
    assert.equal(res.status, 400);
    assert.equal(res.body.error.field, 'email');
  });
});

describe('password reset + email verification', () => {
  it('202 then 429 RATE_LIMITED within cooldown', async () => {
    const api = createClient();
    const body = { email: 'hrd@nusantarabaja.co.id' };
    const first = await api('POST', '/auth/password-reset', { body });
    assert.equal(first.status, 202);
    const second = await api('POST', '/auth/password-reset', { body });
    assert.equal(second.status, 429);
  });

  it('reset token is single-use', async () => {
    const api = createClient();
    const body = { token: 'mock-reset-token', password: 'BajaPresisi#26',
      passwordConfirm: 'BajaPresisi#26' };
    const first = await api('POST', '/auth/password-reset/confirm', { body });
    assert.equal(first.status, 200);
    const reuse = await api('POST', '/auth/password-reset/confirm', { body });
    assert.equal(reuse.status, 400);
  });

  it('unknown verification link returns 410', async () => {
    const res = await createClient()('GET',
      '/auth/email-verifications/rusak');
    assert.equal(res.status, 410);
  });
});

describe('akun demo lembaga & pemerintah (AK-19)', () => {
  for (const [username, companyKey, email] of [
    ['ypkn.admin', 'lembaga', 'sekretariat@ypkn.or.id'],
    ['okta.jkt', 'pemerintah', 'admin.jakarta@okta-asia.org'],
  ]) {
    it(`${username} login membawa companyKey ${companyKey}`, async () => {
      const res = await login(createClient(), username, 'rahasia123');
      assert.equal(res.status, 200);
      assert.equal(res.body.data.user.companyKey, companyKey);
      assert.equal(res.body.data.user.email, email);
    });

    it(`${username}: pendaftar Aktif dengan email operator ${email}`,
      async () => {
        const res = await createClient()('GET', '/pendaftar');
        const row = res.body.data.find((p) =>
          p.operatorEmails?.includes(email));
        assert.equal(row?.status, 'Aktif');
      });
  }
});
