/**
 * @fileoverview Contract tests — Pencabutan RPTKA per TKA di akun Validator
 * (PV-01..PV-05): pengajuan pemberi kerja tampil real time, Detail,
 * Validasi | Tolak, submit ulang langsung ke Validator.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  PENCABUTAN_JENIS, pencabutanDokumenContoh,
} from '../../js/contracts/pengajuan-verifikasi.js';
import { createClient } from './client.js';

const BASE = '/pencabutan-validasi';
const role = { role: 'swasta' };
const get = (api, path) => api('GET', path);
const post = (api, path, body = {}) => api('POST', path, { body });
const submit = (api, barcode = '25103377') => api('POST', '/pencabutan', {
  body: { ...role, barcode, jenis: PENCABUTAN_JENIS[0],
    alasan: 'TKA telah keluar dengan EPO.',
    dokumen: pencabutanDokumenContoh(PENCABUTAN_JENIS[0]) } });
const forward = (api, id) => post(api, `/pencabutan-verifikasi/${id}/verify`);
const validate = (api, id) => post(api, `${BASE}/${id}/validate`);
const reject = (api, id, alasan) => post(api, `${BASE}/${id}/reject`,
  { alasan });

describe('pengajuan pencabutan pemberi kerja tampil real time (PV-01)', () => {
  it('tabel kosong sebelum ada pengajuan', async () => {
    assert.deepEqual((await get(createClient(), BASE)).body.data, []);
  });

  it('pengajuan langsung tampil Menunggu Verifikator, read-only', async () => {
    const api = createClient();
    const sub = await submit(api);
    assert.equal(sub.status, 201, JSON.stringify(sub.body));
    const rows = (await get(api, BASE)).body.data;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].status, 'Menunggu Verifikator');
    assert.equal(rows[0].aksi.validasi, false);
    assert.equal((await validate(api, rows[0].id)).status, 409,
      'Validator tidak melompati Verifikator');
  });

  it('setelah Verifikator meneruskan: Menunggu validasi + aksi aktif',
    async () => {
      const api = createClient();
      const id = (await submit(api)).body.data.id;
      await forward(api, id);
      const row = (await get(api, `${BASE}/${id}`)).body.data;
      assert.equal(row.status, 'Menunggu validasi');
      assert.deepEqual(row.aksi, { validasi: true });
    });
});

describe('GET /pencabutan-validasi/{id} (PV-02)', () => {
  it('memuat isian per TKA dan dokumen yang diupload', async () => {
    const api = createClient();
    const id = (await submit(api)).body.data.id;
    const d = (await get(api, `${BASE}/${id}`)).body.data;
    assert.ok(d.isian.some((i) => i.label === 'Nama TKA' && i.value));
    assert.ok(d.isian.some((i) => i.label === 'Barcode / Nomor RPTKA'));
    assert.ok(d.dokumen.length >= 7);
  });

  it('404 untuk id tidak dikenal', async () => {
    assert.equal((await get(createClient(), `${BASE}/pc999`)).status, 404);
  });
});

describe('POST /pencabutan-validasi/{id}/validate (PV-03)', () => {
  it('Tervalidasi, tanpa billing, notifikasi + audit, hanya sekali',
    async () => {
      const api = createClient();
      const id = (await submit(api)).body.data.id;
      await forward(api, id);
      const res = await validate(api, id);
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.equal(res.body.data.status, 'Tervalidasi');
      assert.deepEqual(res.body.data.aksi, { validasi: false });
      assert.equal((await validate(api, id)).status, 409);
      const notif = (await api('GET', '/notifikasi', { query: role }))
        .body.data.find((n) => /divalidasi/i.test(n.judul));
      assert.ok(notif);
      const audit = (await api('GET', '/audit-logs',
        { query: { pengguna: 'Maya' } })).body.data;
      assert.ok(audit.some((e) => e.aksi === 'Validasi' &&
        e.objek.startsWith('Pencabutan')));
      const mine = (await api('GET', '/pencabutan', { query: role })).body.data
        .find((p) => p.id === id);
      assert.match(mine.status, /Divalidasi/);
    });
});

describe('POST /pencabutan-validasi/{id}/reject (PV-04)', () => {
  it('400 bila alasan < 10 karakter', async () => {
    const api = createClient();
    const id = (await submit(api)).body.data.id;
    await forward(api, id);
    const res = await reject(api, id, 'pendek');
    assert.equal(res.status, 400);
    assert.equal(res.body.error.field, 'alasan');
  });

  it('Perbaikan + alasan; submit ulang pemberi kerja LANGSUNG ke Validator',
    async () => {
      const api = createClient();
      const id = (await submit(api)).body.data.id;
      await forward(api, id);
      const res = await reject(api, id, 'Surat pernyataan belum ditandatangani.');
      assert.equal(res.body.data.status, 'Perbaikan');
      assert.match(res.body.data.alasan, /Surat pernyataan/);
      assert.equal((await validate(api, id)).status, 409);
      const mine = (await api('GET', '/pencabutan', { query: role })).body.data
        .find((p) => p.id === id);
      assert.equal(mine.verif, 'Perbaikan');
      assert.match(mine.verifAlasan, /Surat pernyataan/);
      const again = await post(api, `/pencabutan-verifikasi/${id}/resubmit`);
      assert.equal(again.status, 200);
      assert.equal(again.body.data.status, 'Diteruskan ke Validator');
      const row = (await get(api, `${BASE}/${id}`)).body.data;
      assert.equal(row.status, 'Menunggu validasi');
      assert.equal((await validate(api, id)).status, 200);
    });

  it('ditolak Verifikator: submit ulang kembali ke Verifikator', async () => {
    const api = createClient();
    const id = (await submit(api)).body.data.id;
    await post(api, `/pencabutan-verifikasi/${id}/reject`,
      { alasan: 'Dokumen pendukung tidak terbaca.' });
    assert.equal((await get(api, `${BASE}/${id}`)).body.data.status,
      'Menunggu Verifikator');
    await post(api, `/pencabutan-verifikasi/${id}/resubmit`);
    assert.equal((await get(api, `${BASE}/${id}`)).body.data.status,
      'Menunggu Verifikator');
    assert.equal((await validate(api, id)).status, 409);
  });
});
