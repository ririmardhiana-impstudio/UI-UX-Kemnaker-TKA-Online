/**
 * @fileoverview Contract tests — akun Superadmin (IM-01..IM-14): data
 * Pengesahan RPTKA ber-Visa-ITAS dari integrasi Imigrasi (view-only),
 * perpanjangan RPTKA dari pemberi kerja, API integrasi masuk
 * (visa-itas, perlintasan).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createClient } from './client.js';

const BASE = '/imigrasi/tka';
/** Seed: pengesahan terbit yang BELUM menerima Visa/ITAS dari Imigrasi. */
const NEW_ID = 'swasta-p5';
/** Seed: sudah ber-Visa-ITAS (tampil di daftar Superadmin). */
const SEED_ID = 'swasta-p3';
const get = (api, path, query) => api('GET', path, { query });
const post = (api, id, action, body) => api('POST', `${BASE}/${id}/${action}`,
  { body });
const VISA = { nomorVisa: 'VITAS26100001', nomorItas: 'ITAS26100001A',
  berlakuSampai: '2027-01-31' };
const PERLINTASAN = { tanggalMasuk: '2026-09-30',
  tempatPemeriksaan: 'Soekarno-Hatta (Tangerang)' };
const list = async (api) => (await get(api, BASE)).body.data;

describe('GET /imigrasi/tka (IM-01)', () => {
  it('lists only TKA that already have Visa dan ITAS', async () => {
    const rows = await list(createClient());
    assert.ok(rows.length >= 5);
    assert.ok(rows.every((r) => r.statusVisa === 'Visa dan ITAS terbit' &&
      r.visa.nomorVisa && r.visa.nomorItas));
    assert.ok(rows.some((r) => r.id === SEED_ID));
    assert.ok(!rows.some((r) => r.id === NEW_ID));
  });

  it('detail is view-only data; 404 without Visa/ITAS', async () => {
    const api = createClient();
    const d = (await get(api, `${BASE}/${SEED_ID}`)).body.data;
    assert.equal(d.pengesahan.payload.tka.nama, d.nama);
    assert.equal(d.aksi, undefined, 'tidak ada aksi proses');
    assert.equal((await get(api, `${BASE}/${NEW_ID}`)).status, 404);
    assert.equal((await get(api, `${BASE}/zz`)).status, 404);
  });

  it('has no processing endpoints (receive / visa / rejection)', async () => {
    const api = createClient();
    for (const action of ['receive', 'visa', 'visa-rejection']) {
      const res = await post(api, SEED_ID, action, { konfirmasi: true });
      assert.equal(res.status, 404, action);
    }
  });
});

describe('API integrasi: Visa dan ITAS dari Imigrasi (IM-02..IM-05)', () => {
  it('validates nomor format and the berlaku s.d. window', async () => {
    const api = createClient();
    const bad = await post(api, NEW_ID, 'visa-itas',
      { ...VISA, nomorVisa: 'x' });
    assert.equal(bad.status, 400);
    assert.ok(bad.body.error.fields.nomorVisa);
    const late = await post(api, NEW_ID, 'visa-itas',
      { ...VISA, berlakuSampai: '2027-12-31' });
    assert.equal(late.status, 400);
    const past = await post(api, NEW_ID, 'visa-itas',
      { ...VISA, berlakuSampai: '2026-01-01' });
    assert.equal(past.status, 400);
    assert.equal((await post(api, 'zz', 'visa-itas', VISA)).status, 404);
  });

  it('received data appears in the Superadmin list, once only; audit + ' +
    'employer notified', async () => {
    const api = createClient();
    const res = await post(api, NEW_ID, 'visa-itas', VISA);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.statusPengesahan, 'Diterima Imigrasi');
    assert.equal(res.body.data.visa.nomorItas, VISA.nomorItas);
    assert.ok((await list(api)).some((r) => r.id === NEW_ID));
    assert.equal((await post(api, NEW_ID, 'visa-itas', VISA)).status, 409);
    const notif = await api('GET', '/notifikasi', { query: { role: 'swasta' } });
    assert.ok(notif.body.data.some((n) => n.judul.startsWith('Visa dan ITAS')));
    const log = await api('GET', '/audit-logs', { query: { modul: 'Permohonan',
      pengguna: 'Sistem Imigrasi' } });
    assert.ok(log.body.data.length >= 1);
  });
});

describe('API integrasi: perlintasan (IM-06..IM-07)', () => {
  it('needs Visa/ITAS received first (409)', async () => {
    const res = await post(createClient(), NEW_ID, 'perlintasan', PERLINTASAN);
    assert.equal(res.status, 409);
  });

  it('validates tanggal masuk and TPI', async () => {
    const api = createClient();
    await post(api, NEW_ID, 'visa-itas', VISA);
    for (const [patch, field] of [[{ tanggalMasuk: '2026-10-05' }, 'tanggalMasuk'],
      [{ tanggalMasuk: '2026-09-01' }, 'tanggalMasuk'],
      [{ tempatPemeriksaan: 'Pelabuhan Fiktif' }, 'tempatPemeriksaan']]) {
      const res = await post(api, NEW_ID, 'perlintasan',
        { ...PERLINTASAN, ...patch });
      assert.equal(res.status, 400, field);
      assert.ok(res.body.error.fields[field], field);
    }
  });

  it('is received once, shown in detail and notified', async () => {
    const api = createClient();
    await post(api, NEW_ID, 'visa-itas', VISA);
    const res = await post(api, NEW_ID, 'perlintasan', PERLINTASAN);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.statusPerlintasan,
      'Terkirim ke Direktorat PPTKA');
    assert.equal((await post(api, NEW_ID, 'perlintasan', PERLINTASAN)).status,
      409);
    const d = (await get(api, `${BASE}/${NEW_ID}`)).body.data;
    assert.equal(d.perlintasan.tanggalMasuk, PERLINTASAN.tanggalMasuk);
    const notif = await api('GET', '/notifikasi', { query: { role: 'swasta' } });
    assert.ok(notif.body.data.some((n) => n.judul.startsWith('TKA tercatat')));
  });
});

describe('data ITAS & lalu lintas di GET /pengesahan (pemberi kerja, IM-08)',
  () => {
    const peng = (api) => get(api, '/pengesahan', { role: 'swasta' })
      .then((res) => res.body.data);

    it('null sebelum Pengesahan RPTKA terbit (stepIdx < 6)', async () => {
      const p2 = (await peng(createClient())).find((p) => p.id === 'p2');
      assert.equal(p2.keimigrasian, null);
    });

    it('matches the integration data after Imigrasi sends it', async () => {
      const api = createClient();
      await post(api, NEW_ID, 'visa-itas', VISA);
      await post(api, NEW_ID, 'perlintasan', PERLINTASAN);
      const p5 = (await peng(api)).find((p) => p.id === 'p5');
      assert.equal(p5.keimigrasian.visa.nomorVisa, VISA.nomorVisa);
      assert.equal(p5.keimigrasian.visa.tone, 'green');
      assert.equal(p5.keimigrasian.perlintasan.tempatPemeriksaan,
        PERLINTASAN.tempatPemeriksaan);
      assert.equal(p5.imigrasi, true);
    });
  });

describe('dokumen permohonan (IM-13)', () => {
  it('every row carries its documents with preview metadata', async () => {
    const rows = await list(createClient());
    assert.ok(rows.every((r) => r.jumlahDokumen === r.dokumen.length));
    const row = rows.find((r) => r.id === SEED_ID);
    assert.ok(row.dokumen.length >= 5);
    for (const d of row.dokumen) {
      assert.ok(d.jenis && d.fileName && d.fileSize > 0 && d.mimeType);
    }
  });
});

describe('GET /imigrasi/perpanjangan (IM-14, view-only)', () => {
  const draft = {
    jenis: 'Perpanjangan Lintas Provinsi', hpkId: 'h5',
    jabatan: [{ nama: 'Rolling Mill Specialist', jumlahTka: 1,
      jangkaWaktuBulan: 12 }],
  };

  it('is empty while no perpanjangan was submitted, 404 for unknown id',
    async () => {
      const api = createClient();
      const res = await get(api, '/imigrasi/perpanjangan');
      assert.equal(res.status, 200);
      assert.ok(res.body.data.every((r) => /^RP-/.test(r.noAjuan)));
      assert.equal((await get(api, '/imigrasi/perpanjangan/zz')).status, 404);
    });

  it('shows a submitted perpanjangan (list + detail with documents)',
    async () => {
      const api = createClient();
      const bk = (nama, ukuranKb = 100) => ({ namaBerkas: nama, ukuranKb });
      const body = { ...draft,
        tka: [{ jabatan: 'Rolling Mill Specialist', urut: 1, ocr: {},
          data: { nama: 'Arjun Nair', tempatLahir: 'Chennai',
            tanggalLahir: '1988-04-12', jenisKelamin: 'Laki-laki',
            pendidikan: 'S2', statusPerkawinan: 'Kawin', kebangsaan: 'India',
            nomorPaspor: 'K1234567', tanggalTerbitPaspor: '2024-01-10',
            tanggalBerakhirPaspor: '2034-01-09', tempatTerbitPaspor: 'Chennai',
            alamatTinggal: 'Jl. Industri 5', kodePos: '17530',
            email: 'arjun@example.com', telepon: '081234567890',
            jaminanSosial: '0001234567', npwpTka: '123456789012345',
            lokasiKerja: 'KAB. BEKASI' },
          dokumen: { 'p-perjanjian': bk('pk.pdf'),
            'p-izin-tinggal': bk('itas.pdf'), 'p-paspor': bk('paspor.jpg'),
            'p-pas-foto': bk('foto.png') } }],
        dokumenJabatan: {},
        dokumenPermohonan: Object.fromEntries(['p-permohonan', 'p-tugas',
          'p-domisili', 'p-wajib-lapor', 'p-diklat', 'p-pendampingan',
          'p-tki'].map((k) => [k, bk(`${k}.pdf`, 500)])) };
      const created = await api('POST', '/pengesahan-rptka',
        { query: { role: 'swasta' }, body });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      const submit = await api('POST',
        `/pengesahan-rptka/${created.body.data.id}/submit`,
        { query: { role: 'swasta' }, body: {} });
      assert.equal(submit.status, 200, JSON.stringify(submit.body));
      const rows = (await get(api, '/imigrasi/perpanjangan')).body.data;
      assert.equal(rows.length, 1);
      assert.equal(rows[0].jenis, draft.jenis);
      const d = (await get(api, `/imigrasi/perpanjangan/${rows[0].id}`))
        .body.data;
      assert.equal(d.tka[0].nama, 'Arjun Nair');
      assert.ok(d.dokumen.length >= 7);
      assert.equal(d.cakupan, 'Lintas Provinsi');
      assert.ok(d.tka[0].identitas.some((c) => c.label === 'Nama TKA' &&
        c.nilai === 'Arjun Nair'));
      assert.ok(d.riwayat.length >= 1);

      // Lintas Kab/Kota dalam 1 Provinsi: masuk juga, bisa disaring.
      const kab = await api('POST', '/pengesahan-rptka', { query:
        { role: 'swasta' }, body: { ...body, hpkId: 'h1', jenis:
          'Perpanjangan Lintas Kab/Kota dalam 1 Provinsi',
          jabatan: [{ nama: 'Welding Inspector', jumlahTka: 1,
            jangkaWaktuBulan: 12 }],
          tka: [{ ...body.tka[0], jabatan: 'Welding Inspector' }] } });
      assert.equal(kab.status, 201, JSON.stringify(kab.body));
      const sent = await api('POST',
        `/pengesahan-rptka/${kab.body.data.id}/submit`,
        { query: { role: 'swasta' }, body: {} });
      assert.equal(sent.status, 200, JSON.stringify(sent.body));
      const all = (await get(api, '/imigrasi/perpanjangan')).body.data;
      assert.deepEqual(all.map((r) => r.cakupan).sort(),
        ['Lintas Kab/Kota dalam 1 Provinsi', 'Lintas Provinsi']);
      const only = (await get(api, '/imigrasi/perpanjangan',
        { cakupan: 'Lintas Kab/Kota dalam 1 Provinsi' })).body.data;
      assert.equal(only.length, 1);
      assert.equal(only[0].cakupan, 'Lintas Kab/Kota dalam 1 Provinsi');
    });

  it('never lists Draf and exposes no write endpoint', async () => {
    const api = createClient();
    await api('POST', '/pengesahan-rptka', { query: { role: 'swasta' },
      body: draft });
    const rows = (await get(api, '/imigrasi/perpanjangan')).body.data;
    assert.ok(rows.every((r) => r.status !== 'Draf'));
    const write = await api('POST', '/imigrasi/perpanjangan',
      { body: {} });
    assert.equal(write.status, 404);
  });
});
