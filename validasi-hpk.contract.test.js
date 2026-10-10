/**
 * @fileoverview Contract tests — akun Validator HPK (VL-01..VL-05): daftar
 * pemberi kerja dengan BAP disetujui, detail (isian + dokumen), Verifikasi
 * -> Tervalidasi, akun demo.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createClient } from './client.js';

const BASE = '/validasi-hpk';
const get = (api, path) => api('GET', path);
const post = (api, path, body = {}) => api('POST', path, { body });
const validate = (api, id, body = { konfirmasi: true }) =>
  post(api, `${BASE}/${id}/validate`, body);

describe('GET /validasi-hpk (tabel daftar pemberi kerja)', () => {
  it('lists only HPK whose BAP is approved, oldest approval first',
    async () => {
      const res = await get(createClient(), BASE);
      assert.equal(res.status, 200);
      const rows = res.body.data;
      assert.ok(rows.length >= 4);
      assert.ok(rows.every((r) => ['Menunggu Divalidasi', 'Tervalidasi']
        .includes(r.status) && r.bap.tglSetuju && r.bap.penyetuju.nama));
      const keys = rows.map((r) => `${r.bap.tglSetuju} ${r.noHpk}`);
      assert.deepEqual(keys, [...keys].sort());
    });

  it('spans both employers (swasta + lembaga) and has waiting rows',
    async () => {
      const rows = (await get(createClient(), BASE)).body.data;
      assert.deepEqual([...new Set(rows.map((r) => r.role))].sort(),
        ['lembaga', 'swasta']);
      assert.ok(rows.filter((r) => r.status === 'Menunggu Divalidasi')
        .length >= 3);
    });
});

describe('GET /validasi-hpk/{id} (detail isian + dokumen)', () => {
  it('returns isian, dokumen, BAP and the validate action', async () => {
    const res = await get(createClient(), `${BASE}/pk5`);
    assert.equal(res.status, 200);
    const d = res.body.data;
    assert.ok(d.formulir.fields.length > 4);
    assert.ok(d.formulir.dokumen.length > 0);
    assert.equal(d.bap.disetujui, true);
    assert.deepEqual(d.aksi, { validasi: true });
  });

  it('404 for unknown id and for HPK without an approved BAP', async () => {
    const api = createClient();
    assert.equal((await get(api, `${BASE}/pk999`)).status, 404);
    assert.equal((await get(api, `${BASE}/pk6`)).status, 404);
  });
});

describe('POST /validasi-hpk/{id}/validate', () => {
  it('400 unless konfirmasi is true', async () => {
    const api = createClient();
    for (const body of [{}, { konfirmasi: false }]) {
      const res = await validate(api, 'pk5', body);
      assert.equal(res.status, 400);
      assert.ok(res.body.error.fields.konfirmasi);
    }
  });

  it('moves to Tervalidasi, drops the action, notifies the employer',
    async () => {
      const api = createClient();
      const res = await validate(api, 'pk5');
      assert.equal(res.status, 200);
      assert.equal(res.body.data.status, 'Tervalidasi');
      assert.deepEqual(res.body.data.aksi, { validasi: false });
      assert.equal(res.body.data.riwayat.at(-1).status, 'Tervalidasi');
      const notif = await api('GET', '/notifikasi',
        { query: { role: 'swasta' } });
      assert.ok(notif.body.data.some((n) => /tervalidasi/i.test(n.judul)));
    });

  it('409 when already validated', async () => {
    const api = createClient();
    await validate(api, 'pk5');
    const res = await validate(api, 'pk5');
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'INVALID_STATE');
  });

  it('records the validation in the audit log as Validator', async () => {
    const api = createClient();
    await validate(api, 'pk5');
    const res = await api('GET', '/audit-logs',
      { query: { pengguna: 'Maya' } });
    assert.ok(res.body.data.some((e) => e.aksi === 'Validasi' &&
      e.objek.includes('HPK-2609-0005')));
  });

  it('hands over to HPK Terbit (portal route), leaving Validator scope',
    async () => {
      const api = createClient();
      await validate(api, 'pk5');
      const res = await api('POST', '/penilaian-kelayakan/pk5/transition', {
        query: { role: 'swasta' }, body: { status: 'HPK Terbit' } });
      assert.equal(res.status, 200);
      assert.equal((await get(api, `${BASE}/pk5`)).status, 404);
    });
});

describe('akun demo Validator HPK', () => {
  it('validator.hpk logs in with kind validator-hpk', async () => {
    const res = await post(createClient(), '/auth/login',
      { username: 'validator.hpk', password: 'validator2026' });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.kind, 'validator-hpk');
  });
});
