/** @fileoverview Contract tests — role scoping, billing, pemda. */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createClient } from './client.js';

describe('role-scoped collections', () => {
  for (const path of ['/tka', '/hpk', '/pengesahan', '/billing', '/ekspos',
    '/perubahan', '/laporan']) {
    it(`GET ${path} without role -> 400`, async () => {
      const res = await createClient()('GET', path);
      assert.equal(res.status, 400);
      assert.equal(res.body.error.field, 'role');
    });
  }

  it('group C has no HPK and no billing (DKPTKA-exempt)', async () => {
    const api = createClient();
    const hpk = await api('GET', '/hpk', { query: { role: 'pemerintah' } });
    const bill = await api('GET', '/billing',
      { query: { role: 'pemerintah' } });
    assert.equal(hpk.body.data.length, 0);
    assert.equal(bill.body.data.length, 0);
  });
});

describe('billing reissue (§6.2)', () => {
  it('only an expired code can be reissued', async () => {
    const api = createClient();
    const paid = await api('POST', '/billing/b3/reissue',
      { query: { role: 'swasta' } });
    assert.equal(paid.status, 409);
    const expired = await api('POST', '/billing/b2/reissue',
      { query: { role: 'swasta' } });
    assert.equal(expired.status, 200);
    assert.equal(expired.body.data.status, 'Belum dibayar');
  });
});

describe('pemda validation', () => {
  it('pending -> Tervalidasi; decided rows are immutable', async () => {
    const api = createClient();
    const ok = await api('POST', '/pemda-validations/d1/decision',
      { body: { decision: 'Tervalidasi' } });
    assert.equal(ok.body.data.status, 'Tervalidasi');
    const again = await api('POST', '/pemda-validations/d3/decision',
      { body: { decision: 'Ditolak' } });
    assert.equal(again.status, 409);
  });
});
