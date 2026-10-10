/**
 * @fileoverview Contract tests — akun Disnaker setempat (DN-01..DN-03):
 * tabel Perpanjangan RPTKA Lintas Kab/Kota dalam 1 Provinsi yang sudah
 * divalidasi Validator, Detail, Terbitkan SKRD -> diterima pemberi kerja.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createClient } from './client.js';

const BASE = '/skrd-disnaker';
const ROLE = { role: 'swasta' };
const get = (api, path, query) => api('GET', path, { query });
const terbitkan = (api, id, body = { konfirmasi: true }) =>
  api('POST', `${BASE}/${id}/terbitkan`, { body });

describe('GET /skrd-disnaker (tabel)', () => {
  it('hanya Lintas Kab/Kota yang sudah divalidasi, Menunggu SKRD', async () => {
    const rows = (await get(createClient(), BASE)).body.data;
    assert.ok(['qkk1', 'qkk2', 'qkk3'].every((id) =>
      rows.some((r) => r.id === id)));
    assert.ok(rows.every((r) => /Lintas Kab\/Kota/.test(r.jenisRptka)));
    assert.ok(rows.every((r) => r.nomorRptka && r.noHpk && r.status));
    const menunggu = rows.find((r) => r.id === 'qkk1');
    assert.equal(menunggu.status, 'Menunggu SKRD');
    assert.equal(menunggu.aksi.terbitkan, true);
    assert.equal(menunggu.skrd, null);
  });

  it('Detail memuat isian, dokumen, dan perhitungan retribusi', async () => {
    const res = await get(createClient(), `${BASE}/qkk2`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.isian.tka.length, 2);
    assert.ok(res.body.data.dokumen.length > 0);
    assert.equal(res.body.data.dkptka.jumlahTka, 2);
  });

  it('404 untuk baris di luar wewenang Disnaker', async () => {
    const res = await get(createClient(), `${BASE}/qpl5`);
    assert.equal(res.status, 404);
  });
});

describe('POST /skrd-disnaker/{id}/terbitkan', () => {
  it('menerbitkan SKRD dan pemberi kerja menerimanya', async () => {
    const api = createClient();
    const before = (await get(api, '/billing', ROLE)).body.data.length;
    const res = await terbitkan(api, 'qkk1');
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const { data } = res.body;
    assert.equal(data.status, 'SKRD terbit');
    assert.match(data.skrd.nomor, /^SKRD\/\d{5}\/\d{8}$/);
    assert.equal(data.skrd.statusBayar, 'Belum dibayar');
    assert.equal(data.skrd.diterimaPemberiKerja, true);
    assert.equal(data.aksi.terbitkan, false);
    const bills = (await get(api, '/billing', ROLE)).body.data;
    assert.equal(bills.length, before + 1);
    const skrd = bills.find((b) => b.kode === data.skrd.nomor);
    assert.equal(skrd.jenis, 'SKRD');
    const notif = (await get(api, '/notifikasi', ROLE)).body.data;
    assert.ok(notif.some((n) => n.judul.startsWith('SKRD diterima')));
  });

  it('pemberi kerja bayar (dengan bukti pembayaran) -> Lunas di tabel ' +
    'Disnaker + masuk Direktur + bukti diteruskan ke Disnaker', async () => {
    const api = createClient();
    const { data } = (await terbitkan(api, 'qkk3')).body;
    const bill = (await get(api, '/billing', ROLE)).body.data
      .find((b) => b.kode === data.skrd.nomor);
    const buktiBayar = { namaBerkas: 'bukti-transfer-bank-daerah.pdf',
      ukuranKb: 180, berkasId: 'bkt-qkk3' };
    const paid = await api('POST', `/billing/${bill.id}/confirm-bayar`,
      { query: ROLE, body: { konfirmasi: true, buktiBayar } });
    assert.equal(paid.status, 200, JSON.stringify(paid.body));
    const after = await get(api, `${BASE}/qkk3`);
    assert.equal(after.body.data.status, 'Lunas');
    assert.deepEqual(after.body.data.skrd.buktiBayar, buktiBayar);
    const dir = (await get(api, '/pengesahan-direktur')).body.data;
    assert.ok(dir.some((r) => r.id === 'qkk3'));
  });

  it('400 tanpa buktiBayar untuk tagihan SKRD', async () => {
    const api = createClient();
    const { data } = (await terbitkan(api, 'qkk1')).body;
    const bill = (await get(api, '/billing', ROLE)).body.data
      .find((b) => b.kode === data.skrd.nomor);
    const res = await api('POST', `/billing/${bill.id}/confirm-bayar`,
      { query: ROLE, body: { konfirmasi: true } });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.field, 'buktiBayar');
  });

  it('400 tanpa konfirmasi, 409 bila sudah terbit, 404 di luar wewenang',
    async () => {
      const api = createClient();
      assert.equal((await terbitkan(api, 'qkk2', {})).status, 400);
      assert.equal((await terbitkan(api, 'qkk2')).status, 200);
      const again = await terbitkan(api, 'qkk2');
      assert.equal(again.status, 409);
      assert.equal(again.body.error.code, 'INVALID_STATE');
      assert.equal((await terbitkan(api, 'qpl5')).status, 404);
    });
});

describe('akun demo Disnaker', () => {
  it('disnaker.bekasi logs in with kind disnaker', async () => {
    const res = await createClient()('POST', '/auth/login',
      { body: { username: 'disnaker.bekasi', password: 'disnaker2026' } });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.kind, 'disnaker');
  });
});
