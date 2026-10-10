/** @fileoverview Contract tests — Perubahan Pengesahan (§7.2). */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createClient } from './client.js';

const ROLE = 'swasta';
const DOC = { role: ROLE, nama: 'Paspor baru (berwarna)',
  fileName: 'paspor.jpg' };
const post = (api, path, body) => api('POST', path, { body });

describe('perubahan draft lifecycle', () => {
  it('Proses requires uploaded documents (422)', async () => {
    const res = await post(createClient(), '/perubahan/c1/submit',
      { role: ROLE, agree: true });
    assert.equal(res.status, 422);
    assert.equal(res.body.error.field, 'dok');
  });

  it('Proses requires Surat Pernyataan Penyangkalan (agree)', async () => {
    const api = createClient();
    await post(api, '/perubahan/c1/documents', DOC);
    const res = await post(api, '/perubahan/c1/submit',
      { role: ROLE, agree: false });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.field, 'agree');
  });

  it('Draf -> Diajukan (statusId 2)', async () => {
    const api = createClient();
    await post(api, '/perubahan/c1/documents', DOC);
    const res = await post(api, '/perubahan/c1/submit',
      { role: ROLE, agree: true });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.statusId, 2);
  });

  it('non-draft cannot be submitted or cancelled (409)', async () => {
    const api = createClient();
    const submit = await post(api, '/perubahan/c2/submit',
      { role: ROLE, agree: true });
    assert.equal(submit.status, 409);
    const cancel = await post(api, '/perubahan/c2/cancel',
      { role: ROLE, alasan: 'x' });
    assert.equal(cancel.status, 409);
  });

  it('cancel reason max 1000 chars; valid cancel -> statusId 9',
    async () => {
      const api = createClient();
      const tooLong = await post(api, '/perubahan/c1/cancel',
        { role: ROLE, alasan: 'a'.repeat(1001) });
      assert.equal(tooLong.status, 400);
      const ok = await post(api, '/perubahan/c1/cancel',
        { role: ROLE, alasan: 'Tidak jadi diubah.' });
      assert.equal(ok.body.data.statusId, 9);
    });
});

describe('POST /perubahan (create)', () => {
  const body = { role: ROLE, skBarcode: '25103377',
    jenis: 'Data Tenaga Kerja Asing', detail: 'Data Paspor',
    semula: 'EH4471028', menjadi: 'EK0923316',
    surat: '045/NBP-HRD/IX/2026', suratTgl: '28 September 2026' };

  it('creates a Draf for an SK owned by the role', async () => {
    const res = await post(createClient(), '/perubahan', body);
    assert.equal(res.status, 201);
    assert.equal(res.body.data.statusId, 1);
  });

  it('barcode is numeric, max 8 digits', async () => {
    const res = await post(createClient(), '/perubahan',
      { ...body, skBarcode: '123456789' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.field, 'skBarcode');
  });

  it('SK of another employer is hidden (404)', async () => {
    const res = await post(createClient(), '/perubahan',
      { ...body, role: 'lembaga' });
    assert.equal(res.status, 404);
  });

  it('stores optional keterangan (max 250)', async () => {
    const api = createClient();
    const saved = await post(api, '/perubahan',
      { ...body, keterangan: 'Paspor lama habis masa berlaku.' });
    assert.equal(saved.body.data.keterangan, 'Paspor lama habis masa berlaku.');
    const tooLong = await post(api, '/perubahan',
      { ...body, keterangan: 'x'.repeat(251) });
    assert.equal(tooLong.status, 400);
    assert.equal(tooLong.body.error.field, 'keterangan');
  });
});

describe('perubahan jenis "Nama TKI Pendamping" (KAK Modul 4)', () => {
  const body = { role: ROLE, skBarcode: '25103377',
    jenis: 'Nama TKI Pendamping', detail: 'Penggantian TKI pendamping',
    semula: 'Agus Setiawan', menjadi: 'Dimas Prasetyo · QC Engineer',
    surat: '049/NBP-HRD/X/2026', suratTgl: '1 Oktober 2026',
    pendampingNama: 'Dimas Prasetyo', pendampingJabatan: 'QC Engineer' };

  it('creates a Draf with the new pendamping', async () => {
    const res = await post(createClient(), '/perubahan', body);
    assert.equal(res.status, 201);
    assert.equal(res.body.data.pendampingNama, 'Dimas Prasetyo');
  });

  it('nama + jabatan pendamping baru are required (400)', async () => {
    const res = await post(createClient(), '/perubahan',
      { ...body, pendampingNama: '', pendampingJabatan: undefined });
    assert.equal(res.status, 400);
    assert.ok(res.body.error.fields.pendampingNama);
    assert.ok(res.body.error.fields.pendampingJabatan);
  });

  it('direksi/komisaris have no pendamping (422)', async () => {
    const res = await post(createClient(), '/perubahan',
      { ...body, skBarcode: '25009981' });
    assert.equal(res.status, 422);
    assert.equal(res.body.error.field, 'jenis');
  });
});
