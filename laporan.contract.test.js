/** @fileoverview Contract tests — annual report (§6.4, §7.3). */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createClient } from './client.js';

const UPLOAD = {
  role: 'swasta', kode: 'L1', fileName: 'laporan-penggunaan-tka-2025.xlsx',
  fileSize: 49152,
};

describe('POST /laporan (submit)', () => {
  it('requires the confirmation checkbox', async () => {
    const res = await createClient()('POST', '/laporan',
      { body: { role: 'swasta', periode: 2025, agree: false } });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.field, 'agree');
  });

  it('rejects a period other than the active one', async () => {
    const res = await createClient()('POST', '/laporan',
      { body: { role: 'swasta', periode: 2024, agree: true } });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.field, 'periode');
  });

  it('Draft -> Terkirim, then 409 on resubmit', async () => {
    const api = createClient();
    const body = { role: 'swasta', periode: 2025, agree: true };
    const first = await api('POST', '/laporan', { body });
    assert.equal(first.body.data.status, 'Terkirim');
    const again = await api('POST', '/laporan', { body });
    assert.equal(again.status, 409);
  });
});

describe('POST /laporan/uploads', () => {
  it('accepts .xlsx <= 1 MB and reports invalid rows', async () => {
    const res = await createClient()('POST', '/laporan/uploads',
      { body: UPLOAD });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.invalidRows, 1);
  });

  it('rejects non-.xlsx files', async () => {
    const res = await createClient()('POST', '/laporan/uploads',
      { body: { ...UPLOAD, fileName: 'laporan.xls' } });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.field, 'fileName');
  });

  it('rejects files above 1 MB', async () => {
    const res = await createClient()('POST', '/laporan/uploads',
      { body: { ...UPLOAD, fileSize: 1024 * 1024 + 1 } });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.field, 'fileSize');
  });

  it('409 once the period is Terkirim (lembaga)', async () => {
    const res = await createClient()('POST', '/laporan/uploads',
      { body: { ...UPLOAD, role: 'lembaga' } });
    assert.equal(res.status, 409);
  });
});
