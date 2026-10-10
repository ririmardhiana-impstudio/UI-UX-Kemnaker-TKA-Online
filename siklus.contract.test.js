/**
 * @fileoverview Contract tests — Siklus RPTKA (KAK Modul 4): perpanjangan
 * dengan cakupan wilayah, pencabutan oleh Direktur + persetujuan Dirjen,
 * surat keterangan (SK-01..SK-09).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createClient } from './client.js';

const ROLE = { role: 'swasta' };
const PRP = { basisBarcode: '26004518', tkaIds: ['25103377'],
  cakupanWilayah: 'satu-kabupaten' };
const KP = { barcode: '25118840', dasar: 'Hasil pengawasan',
  uraian: 'Hasil pengawasan: TKA bekerja di luar jabatan yang disahkan.',
  lampiranNama: 'bap-pengawasan.pdf' };
const SKET = { jenis: 'Keterangan Status Pengesahan RPTKA',
  keperluan: 'Persyaratan perpanjangan izin tinggal di Imigrasi.',
  barcode: '24871365' };

const perpanjangan = (api, body, query = ROLE) =>
  api('POST', '/perpanjangan', { query, body });
const usulkan = (api, body = KP) =>
  api('POST', '/keputusan-pencabutan', { body });
const decide = (api, id, body) =>
  api('POST', `/keputusan-pencabutan/${id}/decision`, { body });
const ajukanSurat = (api, body = SKET, query = ROLE) =>
  api('POST', '/surat-keterangan', { query, body });

describe('POST /perpanjangan (cakupan wilayah)', () => {
  it('requires ?role= (400)', async () => {
    const res = await perpanjangan(createClient(), PRP, {});
    assert.equal(res.status, 400);
    assert.equal(res.body.error.field, 'role');
  });

  for (const [cakupan, extra, unit] of [
    ['satu-kabupaten', {}, 'Dinas Tenaga Kerja Kab/Kota'],
    ['satu-provinsi', { kabupatenTujuan: ['KAB. KARAWANG'] },
      'Dinas Tenaga Kerja Provinsi'],
    ['lintas-provinsi', { provinsiTujuan: ['BANTEN'] },
      'Direktorat PPTKA Kemnaker'],
  ]) {
    it(`${cakupan} -> 201 diproses ${unit}`, async () => {
      const res = await perpanjangan(createClient(),
        { ...PRP, cakupanWilayah: cakupan, ...extra });
      assert.equal(res.status, 201);
      assert.equal(res.body.data.diprosesOleh, unit);
      assert.match(res.body.data.noPermohonan, /^\d{12}$/);
    });
  }

  it('lintas-provinsi requires >= 1 provinsi tujuan (400)', async () => {
    const res = await perpanjangan(createClient(),
      { ...PRP, cakupanWilayah: 'lintas-provinsi' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.field, 'provinsiTujuan');
  });

  it('lintas-provinsi needs a province other than the origin', async () => {
    const res = await perpanjangan(createClient(), { ...PRP,
      cakupanWilayah: 'lintas-provinsi', provinsiTujuan: ['JAWA BARAT'] });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.field, 'provinsiTujuan');
  });

  it('satu-provinsi rejects a kabupaten outside the origin', async () => {
    const res = await perpanjangan(createClient(), { ...PRP,
      cakupanWilayah: 'satu-provinsi', kabupatenTujuan: ['KOTA CILEGON'] });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.field, 'kabupatenTujuan');
  });

  it('TKA outside the 90-day window -> 422 with ids', async () => {
    const res = await perpanjangan(createClient(),
      { ...PRP, tkaIds: ['25103377', '26045102'] });
    assert.equal(res.status, 422);
    assert.deepEqual(res.body.error.ids, ['26045102']);
  });

  it('short-term RPTKA (Sementara) cannot be extended (422)', async () => {
    const res = await perpanjangan(createClient(),
      { ...PRP, basisBarcode: '26002760' });
    assert.equal(res.status, 422);
    assert.equal(res.body.error.field, 'basisBarcode');
  });

  it('TKA of another employer is hidden (404)', async () => {
    const res = await perpanjangan(createClient(),
      { ...PRP, tkaIds: ['25188230'] });
    assert.equal(res.status, 404);
  });

  it('TKA already in a running perpanjangan -> 409', async () => {
    const api = createClient();
    await perpanjangan(api, PRP);
    const res = await perpanjangan(api, PRP);
    assert.equal(res.status, 409);
    assert.deepEqual(res.body.error.ids, ['25103377']);
  });
});

describe('keputusan pencabutan oleh Direktur', () => {
  it('lists seeded proposals', async () => {
    const res = await createClient()('GET', '/keputusan-pencabutan');
    assert.equal(res.status, 200);
    assert.ok(res.body.data.length >= 3);
  });

  it('creates "Menunggu persetujuan Dirjen" (201)', async () => {
    const res = await usulkan(createClient());
    assert.equal(res.status, 201);
    assert.equal(res.body.data.status, 'Menunggu persetujuan Dirjen');
    assert.equal(res.body.data.role, 'swasta');
  });

  it('uraian 30–2000 chars and dasar enum (400)', async () => {
    const api = createClient();
    const short = await usulkan(api, { ...KP, uraian: 'Terlalu singkat.' });
    assert.equal(short.body.error.field, 'uraian');
    const dasar = await usulkan(api, { ...KP, dasar: 'Lain' });
    assert.equal(dasar.body.error.field, 'dasar');
  });

  it('unknown barcode -> 404', async () => {
    const res = await usulkan(createClient(), { ...KP, barcode: '99999999' });
    assert.equal(res.status, 404);
  });

  it('pending or already revoked -> 409', async () => {
    const api = createClient();
    const pending = await usulkan(api, { ...KP, barcode: '24902211' });
    assert.equal(pending.status, 409);
    const revoked = await usulkan(api, { ...KP, barcode: '26010554' });
    assert.equal(revoked.status, 409);
  });

  it('Dirjen setujui -> Dicabut + noSk; second decision 409', async () => {
    const api = createClient();
    const res = await decide(api, 'kp3', { decision: 'setujui' });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, 'Dicabut');
    assert.ok(res.body.data.noSk);
    const again = await decide(api, 'kp3', { decision: 'kembalikan',
      catatan: 'Mohon dikaji ulang.' });
    assert.equal(again.status, 409);
  });

  it('kembalikan requires catatan, then allows a new proposal', async () => {
    const api = createClient();
    const missing = await decide(api, 'kp3', { decision: 'kembalikan' });
    assert.equal(missing.status, 400);
    assert.equal(missing.body.error.field, 'catatan');
    const back = await decide(api, 'kp3', { decision: 'kembalikan',
      catatan: 'Lengkapi berita acara pengawasan.' });
    assert.equal(back.body.data.status, 'Dikembalikan ke Direktur');
    const again = await usulkan(api, { ...KP, barcode: '24902211' });
    assert.equal(again.status, 201);
  });
});

describe('GET /keputusan-pencabutan/target (cek sebelum usul)', () => {
  const target = (api, barcode) =>
    api('GET', '/keputusan-pencabutan/target', { query: { barcode } });

  it('returns TKA + pemberi kerja, no blocker', async () => {
    const res = await target(createClient(), KP.barcode);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.barcode, KP.barcode);
    assert.ok(res.body.data.nama);
    assert.ok(res.body.data.pemberiKerja);
    assert.equal(res.body.data.blocker, null);
  });

  it('reports blocker for pending / revoked barcodes', async () => {
    const api = createClient();
    const pending = await target(api, '24902211');
    assert.match(pending.body.data.blocker, /menunggu persetujuan/);
    const revoked = await target(api, '26010554');
    assert.ok(revoked.body.data.blocker);
  });

  it('non 8-digit -> 400, unknown -> 404', async () => {
    const api = createClient();
    const bad = await target(api, '123');
    assert.equal(bad.status, 400);
    assert.equal(bad.body.error.field, 'barcode');
    const unknown = await target(api, '99999999');
    assert.equal(unknown.status, 404);
  });
});

describe('surat keterangan', () => {
  it('GET list/detail are role-scoped', async () => {
    const api = createClient();
    const noRole = await api('GET', '/surat-keterangan');
    assert.equal(noRole.status, 400);
    const detail = await api('GET', '/surat-keterangan/sk1',
      { query: ROLE });
    assert.equal(detail.body.data.status, 'Terbit');
    assert.ok(detail.body.data.riwayat.length >= 3);
    const other = await api('GET', '/surat-keterangan/sk1',
      { query: { role: 'lembaga' } });
    assert.equal(other.status, 404);
  });

  it('creates Diajukan with riwayat (201)', async () => {
    const res = await ajukanSurat(createClient());
    assert.equal(res.status, 201);
    assert.equal(res.body.data.status, 'Diajukan');
    assert.equal(res.body.data.riwayat.length, 1);
  });

  it('barcode required for SK-based jenis (400)', async () => {
    const res = await ajukanSurat(createClient(),
      { ...SKET, barcode: undefined });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.field, 'barcode');
  });

  it('keperluan 10–500 chars (400)', async () => {
    const res = await ajukanSurat(createClient(),
      { ...SKET, keperluan: 'Singkat' });
    assert.equal(res.body.error.field, 'keperluan');
  });

  it('same jenis + barcode still in process -> 409', async () => {
    const api = createClient();
    await ajukanSurat(api);
    const res = await ajukanSurat(api);
    assert.equal(res.status, 409);
  });

  it('"tidak sedang pencabutan" refused while a pencabutan runs (422)',
    async () => {
      const res = await ajukanSurat(createClient(), { ...SKET,
        jenis: 'Keterangan Tidak Sedang Dalam Proses Pencabutan',
        barcode: '24902211' });
      assert.equal(res.status, 422);
    });

  it('transition Diajukan -> Diproses -> Terbit; Terbit is final',
    async () => {
      const api = createClient();
      const { body } = await ajukanSurat(api);
      const path = `/surat-keterangan/${body.data.id}/transition`;
      const skip = await api('POST', path,
        { query: ROLE, body: { status: 'Terbit' } });
      assert.equal(skip.status, 409);
      await api('POST', path, { query: ROLE, body: { status: 'Diproses' } });
      const done = await api('POST', path,
        { query: ROLE, body: { status: 'Terbit' } });
      assert.equal(done.body.data.status, 'Terbit');
      assert.ok(done.body.data.nomorSurat);
      const reject = await api('POST', path, { query: ROLE,
        body: { status: 'Ditolak', catatan: 'Data tidak sesuai.' } });
      assert.equal(reject.status, 409);
    });
});
