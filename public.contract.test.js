/** @fileoverview Contract tests — public status lookup + wilayah. */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createClient } from './client.js';

const status = (jenis, nomor) =>
  createClient()('GET', '/status-permohonan', { query: { jenis, nomor } });

describe('GET /status-permohonan', () => {
  it('finds an HPK application by its 12-digit number', async () => {
    const res = await status('hpk', '260900012345');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.tahap, 'Jadwal Ekspos');
  });

  it('finds an issued RPTKA by barcode', async () => {
    const res = await status('rptka', '25103377');
    assert.equal(res.status, 200);
    assert.match(res.body.data.status, /^Berlaku s\.d\. /);
  });

  it('finds a DKPTKA billing code', async () => {
    const res = await status('billing', '820260930114572');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, 'Belum dibayar');
  });

  it('never returns personal data (public endpoint)', async () => {
    const res = await status('rptka', '25103377');
    for (const key of ['nama', 'paspor', 'tka', 'pemohon']) {
      assert.equal(key in res.body.data, false, key);
    }
  });

  it('validates the number format per jenis (400)', async () => {
    const res = await status('hpk', '26004518');
    assert.equal(res.status, 400);
    assert.equal(res.body.error.field, 'nomor');
  });

  it('rejects unknown jenis (400)', async () => {
    const res = await status('paspor', '123');
    assert.equal(res.status, 400);
    assert.equal(res.body.error.field, 'jenis');
  });

  it('returns 404 for an unknown number', async () => {
    const res = await status('billing', '999999999999999');
    assert.equal(res.status, 404);
  });

  it('finds a pendaftaran by NPWP, with spacing stripped (AK-17)', async () => {
    const res = await status('pendaftaran', '0761220441801000');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, 'Menunggu verifikasi');
  });

  it('surfaces the Verifikator catatan when status is Perlu perbaikan',
      async () => {
        const res = await status('pendaftaran', '0911003488304000');
        assert.equal(res.status, 200);
        assert.equal(res.body.data.status, 'Perlu perbaikan');
        assert.match(res.body.data.catatan, /NIB buram/);
      });

  it('validates the NPWP length for pendaftaran (400)', async () => {
    const res = await status('pendaftaran', '12345');
    assert.equal(res.status, 400);
    assert.equal(res.body.error.field, 'nomor');
  });

  it('returns 404 for an unregistered NPWP', async () => {
    const res = await status('pendaftaran', '9999999999999999');
    assert.equal(res.status, 404);
  });
});

describe('GET /wilayah', () => {
  it('lists provinces without query', async () => {
    const res = await createClient()('GET', '/wilayah');
    assert.equal(res.status, 200);
    assert.equal(res.body.meta.level, 'provinsi');
    assert.ok(res.body.data.some((w) => w.nama === 'JAWA BARAT'));
  });

  it('drills down to kelurahan', async () => {
    const res = await createClient()('GET', '/wilayah', { query: {
      provinsi: 'JAWA BARAT', kabupaten: 'KAB. BEKASI',
      kecamatan: 'CIKARANG SELATAN' } });
    assert.equal(res.body.meta.level, 'kelurahan');
    assert.ok(res.body.data.some((w) => w.nama === 'PASIRSARI'));
  });

  it('requires the parent level (400)', async () => {
    const res = await createClient()('GET', '/wilayah',
      { query: { kabupaten: 'KAB. BEKASI' } });
    assert.equal(res.status, 400);
  });

  it('returns 404 for an unknown parent', async () => {
    const res = await createClient()('GET', '/wilayah',
      { query: { provinsi: 'ATLANTIS' } });
    assert.equal(res.status, 404);
  });
});
