/**
 * @fileoverview Contract tests — menu Pengesahan RPTKA akun Validator
 * (VP-01..VP-05): tabel permohonan yang sudah diverifikasi Verifikator,
 * detail + DKPTKA, Verifikasi (billing otomatis) | Tolak (Perbaikan).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createClient } from './client.js';

const BASE = '/pengesahan-validasi';
const get = (api, path) => api('GET', path);
const post = (api, path, body) => api('POST', path, { body });
const verify = (api, id) => post(api, `${BASE}/${id}/verify`);
const reject = (api, id, alasan) =>
  post(api, `${BASE}/${id}/reject`, { alasan });

describe('GET /pengesahan-validasi (tabel)', () => {
  it('lists every pengajuan: at the Verifikator (read-only) and beyond', async () => {
    const api = createClient();
    const rows = (await get(api, BASE)).body.data;
    const ids = rows.map((r) => r.id);
    assert.ok(['q19', 'q20', 'gq16'].every((id) => ids.includes(id)));
    const verifikator = rows.find((r) => r.id === 'q3');
    assert.equal(verifikator.status, 'Menunggu Verifikator');
    assert.equal(verifikator.aksi.verifikasi, false);
    assert.ok(ids.includes('q15'));
    assert.ok(!ids.includes('q6') && !ids.includes('q7'),
      'sudah melewati tahap Validator di Back Office');
    assert.ok(rows.every((r) => r.nomorRptka && r.jenisRptka &&
      r.tanggalPengajuan && r.noHpk && r.status));
    assert.ok(rows.some((r) => r.status === 'Menunggu verifikasi'));
  });

  it('a pengajuan appears at once and becomes actionable after the Verifikator',
    async () => {
      const api = createClient();
      const before = await get(api, `${BASE}/q14`);
      assert.equal(before.body.data.status, 'Menunggu Verifikator');
      assert.equal((await verify(api, 'q14')).status, 409,
        'Validator tidak bisa melompati Verifikator');
      await post(api, '/pengesahan-verifikasi/q14/verify',
        { tahap: 'verifikasi' });
      const res = await get(api, `${BASE}/q14`);
      assert.equal(res.status, 200);
      assert.equal(res.body.data.status, 'Menunggu verifikasi');
    });
});

describe('GET /pengesahan-validasi/{id} (detail)', () => {
  it('returns isian, dokumen and the DKPTKA calculation', async () => {
    const res = await get(createClient(), `${BASE}/q20`);
    assert.equal(res.status, 200);
    const d = res.body.data;
    assert.ok(d.isian.tka.length >= 1);
    assert.equal(d.dokumen.length, 6);
    assert.deepEqual([d.dkptka.bebas, d.dkptka.rupiah], [false, 18000000]);
    assert.deepEqual(d.aksi, { verifikasi: true });
  });

  it('404 for unknown id', async () => {
    assert.equal((await get(createClient(), `${BASE}/q999`)).status, 404);
  });
});

describe('POST /pengesahan-validasi/{id}/verify (billing DKPTKA)', () => {
  it('issues the billing code automatically, only once', async () => {
    const api = createClient();
    const res = await verify(api, 'q20');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, 'Billing terbit');
    assert.match(res.body.data.billing.kode, /^82\d{13}$/);
    assert.equal(res.body.data.billing.jumlah, 18000000);
    assert.deepEqual(res.body.data.aksi, { verifikasi: false });
    const again = await verify(api, 'q20');
    assert.equal(again.status, 409);
    assert.equal(again.body.error.code, 'INVALID_STATE');
  });

  it('DKPTKA depends on jenis pemberi kerja and jenis RPTKA', async () => {
    const api = createClient();
    const intl = await verify(api, 'q19');
    assert.equal(intl.body.data.status, 'Bebas DKPTKA');
    assert.equal(intl.body.data.billing, null);
    const nonDk = await verify(api, 'gq38');
    assert.equal(nonDk.body.data.status, 'Bebas DKPTKA');
  });

  it('records the billing in the audit log as Validator', async () => {
    const api = createClient();
    await verify(api, 'q20');
    const res = await api('GET', '/audit-logs', { query: { pengguna: 'Maya' } });
    assert.ok(res.body.data.some((e) => e.aksi === 'Setujui' &&
      e.peran.startsWith('Validator') && e.objek.startsWith('Pengesahan')));
  });
});

describe('POST /pengesahan-validasi/{id}/reject', () => {
  it('400 when alasan is shorter than 10 characters', async () => {
    const res = await reject(createClient(), 'gq16', 'pendek');
    assert.equal(res.status, 400);
    assert.equal(res.body.error.field, 'alasan');
  });

  it('sets Perbaikan with the reason; 409 on a second action', async () => {
    const api = createClient();
    const res = await reject(api, 'gq16', 'Data pengurus belum lengkap.');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, 'Perbaikan');
    assert.match(res.body.data.alasan, /pengurus/);
    assert.equal((await verify(api, 'gq16')).status, 409);
    assert.equal((await reject(api, 'gq16', 'Alasan kedua yang cukup.')).status,
      409);
  });

  it('employer resubmit returns straight to the Validator table',
    async () => {
      const api = createClient();
      await reject(api, 'gq16', 'Data pengurus belum lengkap.');
      const back = await post(api, '/pengesahan-verifikasi/gq16/resubmit',
        { tahap: 'billing' });
      assert.equal(back.status, 200);
      const row = (await get(api, `${BASE}/gq16`)).body.data;
      assert.equal(row.status, 'Menunggu verifikasi');
      assert.equal((await verify(api, 'gq16')).status, 200);
    });
});

describe('Perpanjangan RPTKA lintas provinsi di akun Validator (VP-06)', () => {
  const LINTAS = 'Perpanjangan Pengesahan RPTKA Lintas Provinsi';

  it('lists all lintas-provinsi pengajuan, incl. those still at the Verifikator',
    async () => {
      const rows = (await get(createClient(), BASE)).body.data
        .filter((r) => r.jenisRptka === LINTAS);
      assert.deepEqual(rows.map((r) => r.id).sort(), ['qd6', 'qd7', 'qpl1',
        'qpl2', 'qpl3', 'qpl4', 'qpl5', 'qpl6', 'qpl7']);
      // qd6 (Billing terbit) / qd7 (Bebas DKPTKA): sudah diproses Validator,
      // masuk menu Perpanjangan RPTKA akun Direktur.
      assert.deepEqual(rows.filter((r) => r.id.startsWith('qpl'))
        .map((r) => r.status), ['Menunggu Verifikator', 'Menunggu Verifikator',
        'Menunggu Verifikator', 'Menunggu verifikasi', 'Menunggu verifikasi',
        'Menunggu verifikasi', 'Menunggu verifikasi']);
      assert.deepEqual(rows.filter((r) => r.id.startsWith('qd'))
        .map((r) => r.status), ['Billing terbit', 'Bebas DKPTKA']);
    });

  it('a row verified by the Verifikator joins the Validator table',
    async () => {
      const api = createClient();
      assert.equal((await get(api, `${BASE}/qpl1`)).body.data.status,
        'Menunggu Verifikator');
      await post(api, '/pengesahan-verifikasi/qpl1/verify',
        { tahap: 'verifikasi' });
      assert.equal((await get(api, `${BASE}/qpl1`)).body.data.status,
        'Menunggu verifikasi');
    });

  it('detail carries 11 Perpanjangan documents and the DKPTKA', async () => {
    const d = (await get(createClient(), `${BASE}/qpl4`)).body.data;
    assert.equal(d.dokumen.length, 11);
    assert.equal(d.dkptka.bebas, false);
    assert.deepEqual(d.aksi, { verifikasi: true });
  });

  it('verify issues the billing; Yayasan is free of DKPTKA', async () => {
    const api = createClient();
    const paid = await verify(api, 'qpl4');
    assert.equal(paid.status, 200);
    assert.equal(paid.body.data.status, 'Billing terbit');
    const free = await verify(api, 'qpl5');
    assert.equal(free.body.data.dkptka.bebas, true);
    assert.notEqual(free.body.data.status, 'Menunggu verifikasi');
  });

  it('reject needs alasan, sets Perbaikan; resubmit returns to Validator',
    async () => {
      const api = createClient();
      assert.equal((await reject(api, 'qpl6', 'pendek')).status, 400);
      const res = await reject(api, 'qpl6', 'Laporan diklat belum lengkap.');
      assert.equal(res.body.data.status, 'Perbaikan');
      await post(api, '/pengesahan-verifikasi/qpl6/resubmit',
        { tahap: 'billing' });
      assert.equal((await get(api, `${BASE}/qpl6`)).body.data.status,
        'Menunggu verifikasi');
    });
});

describe('billing otomatis ke akun pemberi kerja (Perpanjangan)', () => {
  it('Validator verifikasi -> tagihan + baris Pengesahan + notifikasi muncul',
    async () => {
      const api = createClient();
      const res = await verify(api, 'qpl4');
      const kode = res.body.data.billing.kode;
      const role = { role: 'swasta' };
      const bill = (await api('GET', '/billing', { query: role })).body.data
        .find((b) => b.kode === kode);
      assert.equal(bill.status, 'Belum dibayar');
      const peng = (await api('GET', '/pengesahan', { query: role }))
        .body.data.find((p) => p.nama === 'Lars Eriksen');
      assert.equal(peng.billing, bill.id);
      assert.equal(peng.status, 'Menunggu pembayaran DKPTKA');
      const notif = (await api('GET', '/notifikasi', { query: role }))
        .body.data.find((n) => n.judul.includes('Kode billing DKPTKA'));
      assert.ok(notif);
    });
});

describe('sinkron real time: pengajuan pemberi kerja langsung tampil', () => {
  it('Form RPTKA yang baru disubmit muncul di tabel Validator', async () => {
    const api = createClient();
    const before = (await get(api, BASE)).body.data.length;
    const sub = await api('POST', '/pengesahan-rptka/rp3/submit',
      { query: { role: 'swasta' }, body: {} });
    assert.equal(sub.status, 200, JSON.stringify(sub.body));
    const rows = (await get(api, BASE)).body.data;
    assert.equal(rows.length, before + 1);
    const row = rows.find((r) => r.id === 'q-rp3-swasta');
    assert.equal(row.status, 'Menunggu Verifikator');
    assert.equal(row.pemohon, 'PT Nusantara Baja Presisi');
  });
});

describe('Perpanjangan Lintas Kab/Kota dalam 1 Provinsi (VP-07)', () => {
  const KK = 'Perpanjangan Lintas Kab/Kota dalam 1 Provinsi';
  const berkas = (nama) => ({ namaBerkas: nama, ukuranKb: 100 });
  const JABATAN = { nama: 'Rolling Mill Specialist', jumlahTka: 1,
    jangkaWaktuBulan: 12 };
  const DATA = { nama: 'Arjun Nair', tempatLahir: 'Chennai',
    tanggalLahir: '1988-04-12', jenisKelamin: 'Laki-laki', pendidikan: 'S2',
    statusPerkawinan: 'Kawin', kebangsaan: 'India', nomorPaspor: 'K1234567',
    tanggalTerbitPaspor: '2024-01-10', tanggalBerakhirPaspor: '2034-01-09',
    tempatTerbitPaspor: 'Chennai', alamatTinggal: 'Jl. Industri 5',
    kodePos: '17530', email: 'arjun@example.com', telepon: '081234567890',
    jaminanSosial: '0001234567', npwpTka: '123456789012345',
    lokasiKerja: 'KAB. BEKASI' };
  const body = { jenis: KK, hpkId: 'h5', jabatan: [JABATAN],
    tka: [{ jabatan: JABATAN.nama, urut: 1, data: DATA, ocr: {}, dokumen: {
      'p-perjanjian': berkas('pk.pdf'), 'p-izin-tinggal': berkas('itas.pdf'),
      'p-paspor': berkas('paspor.jpg'), 'p-pas-foto': berkas('foto.png') } }],
    dokumenJabatan: {},
    dokumenPermohonan: Object.fromEntries(['p-permohonan', 'p-tugas',
      'p-domisili', 'p-wajib-lapor', 'p-diklat', 'p-pendampingan', 'p-tki']
      .map((k) => [k, berkas(`${k}.pdf`)])) };
  const role = { role: 'swasta' };

  it('pengajuan pemberi kerja langsung tampil, lalu Validasi -> menunggu SKRD',
    async () => {
      const api = createClient();
      const created = await api('POST', '/pengesahan-rptka',
        { query: role, body });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      const id = created.body.data.id;
      const sub = await api('POST', `/pengesahan-rptka/${id}/submit`,
        { query: role, body: {} });
      assert.equal(sub.status, 200, JSON.stringify(sub.body));
      const q = `q-${id}-swasta`;
      const seen = await get(api, `${BASE}/${q}`);
      assert.equal(seen.body.data.jenisRptka, KK);
      assert.equal(seen.body.data.status, 'Menunggu Verifikator');
      assert.equal((await verify(api, q)).status, 409);
      await post(api, `/pengesahan-verifikasi/${q}/verify`,
        { tahap: 'verifikasi' });
      assert.equal((await get(api, `${BASE}/${q}`)).body.data.status,
        'Menunggu verifikasi');
      const res = await verify(api, q);
      assert.equal(res.status, 200, JSON.stringify(res.body));
      // Retribusi daerah: tidak ada billing PNBP, berkas menunggu SKRD Disnaker.
      assert.equal(res.body.data.status, 'Menunggu SKRD');
      assert.equal(res.body.data.billing, null);
      assert.equal(res.body.data.aksi.verifikasi, false);
      const bills = (await api('GET', '/billing', { query: role })).body.data;
      assert.ok(bills.every((b) => b.jenis !== 'SKRD'));
    });
});
