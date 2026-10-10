/**
 * @fileoverview Contract tests — Analitik & OCR (KAK Modul 6, AN-01..07).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createClient } from './client.js';

const OCR = { jenisDokumen: 'Paspor', fileName: 'paspor-ravi.jpg',
  ukuranKb: 240 };

describe('GET /analitik/dimensi', () => {
  it('lists 38 provinsi, kab/kota per provinsi, sektor and jabatan',
    async () => {
      const res = await createClient()('GET', '/analitik/dimensi');
      assert.equal(res.status, 200);
      const d = res.body.data;
      assert.equal(d.provinsi.length, 38);
      assert.ok(d.kabupaten['Jawa Barat'].includes('Kab. Bekasi'));
      assert.ok(d.sektor.length >= 10);
      assert.ok(d.jabatan.length >= 12);
      assert.match(d.periode.dari, /^\d{4}-\d{2}$/);
    });
});

describe('GET /analitik/penggunaan-tka', () => {
  it('defaults to the last 12 months with consistent totals', async () => {
    const res = await createClient()('GET', '/analitik/penggunaan-tka');
    assert.equal(res.status, 200);
    const d = res.body.data;
    assert.equal(d.perPeriode.length, 12);
    const sum = d.perPeriode.reduce((s, x) => s + x.tka, 0);
    assert.equal(d.ringkasan.totalTka, sum);
    const perProv = d.perProvinsi.reduce((s, x) => s + x.tka, 0);
    assert.equal(perProv, sum);
    assert.equal(d.perKabupaten, null);
    for (const key of ['totalPengesahan', 'pnbpRupiah', 'perusahaan']) {
      assert.ok(d.ringkasan[key] > 0, key);
    }
  });

  it('is deterministic between calls', async () => {
    const q = { query: { dari: '2025-01', sampai: '2025-06' } };
    const a = await createClient()('GET', '/analitik/penggunaan-tka', q);
    const b = await createClient()('GET', '/analitik/penggunaan-tka', q);
    assert.deepEqual(a.body.data.ringkasan, b.body.data.ringkasan);
  });

  it('provinsi filter narrows totals and adds perKabupaten', async () => {
    const api = createClient();
    const all = await api('GET', '/analitik/penggunaan-tka');
    const jabar = await api('GET', '/analitik/penggunaan-tka',
      { query: { provinsi: 'Jawa Barat' } });
    assert.equal(jabar.status, 200);
    assert.ok(jabar.body.data.ringkasan.totalTka <
      all.body.data.ringkasan.totalTka);
    assert.equal(jabar.body.data.perProvinsi.length, 1);
    assert.equal(jabar.body.data.perKabupaten.length, 3);
  });

  it('kabupaten without provinsi -> 400', async () => {
    const res = await createClient()('GET', '/analitik/penggunaan-tka',
      { query: { kabupaten: 'Kab. Bekasi' } });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.field, 'kabupaten');
  });

  it('kabupaten outside the provinsi -> 400', async () => {
    const res = await createClient()('GET', '/analitik/penggunaan-tka',
      { query: { provinsi: 'Bali', kabupaten: 'Kab. Bekasi' } });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.field, 'kabupaten');
  });

  it('dari > sampai -> 400 on dari', async () => {
    const res = await createClient()('GET', '/analitik/penggunaan-tka',
      { query: { dari: '2026-05', sampai: '2026-01' } });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.field, 'dari');
  });

  it('range above 24 months -> 400 on sampai', async () => {
    const res = await createClient()('GET', '/analitik/penggunaan-tka',
      { query: { dari: '2024-01', sampai: '2026-09' } });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.field, 'sampai');
  });

  it('bad period format -> 400', async () => {
    const res = await createClient()('GET', '/analitik/penggunaan-tka',
      { query: { dari: '2025-13' } });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.field, 'dari');
  });

  it('period outside available data -> 400', async () => {
    const res = await createClient()('GET', '/analitik/penggunaan-tka',
      { query: { dari: '2026-01', sampai: '2026-12' } });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.field, 'sampai');
  });

  it('unknown sektor -> 400', async () => {
    const res = await createClient()('GET', '/analitik/penggunaan-tka',
      { query: { sektor: 'Z' } });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.field, 'sektor');
  });
});

describe('analitik exports', () => {
  it('POST 202 -> GET Selesai with rows and file name', async () => {
    const api = createClient();
    const job = await api('POST', '/analitik/exports',
      { body: { format: 'xlsx', filter: { provinsi: 'Bali' } } });
    assert.equal(job.status, 202);
    assert.ok(job.body.data.exportId);
    const res = await api('GET',
      `/analitik/exports/${job.body.data.exportId}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, 'Selesai');
    assert.match(res.body.data.fileName, /\.xlsx$/);
    assert.ok(res.body.data.rows.length > 0);
    assert.ok(res.body.data.rows.every((r) => r.tka > 0));
  });

  it('rejects an unknown format', async () => {
    const res = await createClient()('POST', '/analitik/exports',
      { body: { format: 'docx', filter: {} } });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.field, 'format');
  });

  it('validates the nested filter', async () => {
    const res = await createClient()('POST', '/analitik/exports',
      { body: { format: 'pdf', filter: { dari: '2026-05',
        sampai: '2026-01' } } });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.field, 'filter.dari');
  });

  it('unknown export id -> 404', async () => {
    const res = await createClient()('GET', '/analitik/exports/EXP-9999');
    assert.equal(res.status, 404);
  });
});

describe('POST /ocr/extractions', () => {
  it('returns fields with keyakinan and perluPeriksa for Paspor',
    async () => {
      const res = await createClient()('POST', '/ocr/extractions',
        { body: OCR });
      assert.equal(res.status, 200);
      const d = res.body.data;
      assert.ok(d.fields.every((f) => f.keyakinan >= 0 && f.keyakinan <= 1));
      assert.equal(d.perluPeriksa,
        d.fields.some((f) => f.keyakinan < d.ambangKeyakinan));
      assert.equal(d.perluPeriksa, true);
      assert.ok(d.fields.some((f) => f.kunci === 'nomorPaspor'));
    });

  it('NPWP with high confidence does not need review', async () => {
    const res = await createClient()('POST', '/ocr/extractions',
      { body: { ...OCR, jenisDokumen: 'NPWP', fileName: 'npwp.pdf' } });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.perluPeriksa, false);
  });

  it('unreadable scan -> 422 OCR_UNREADABLE', async () => {
    const res = await createClient()('POST', '/ocr/extractions',
      { body: { ...OCR, fileName: 'paspor-buram.jpg' } });
    assert.equal(res.status, 422);
    assert.equal(res.body.error.code, 'OCR_UNREADABLE');
  });

  it('rejects files above 2 MB', async () => {
    const res = await createClient()('POST', '/ocr/extractions',
      { body: { ...OCR, ukuranKb: 2049 } });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.field, 'ukuranKb');
  });

  it('rejects an unknown jenis dokumen', async () => {
    const res = await createClient()('POST', '/ocr/extractions',
      { body: { ...OCR, jenisDokumen: 'KTP' } });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.field, 'jenisDokumen');
  });
});
