/**
 * @fileoverview Contract tests — pengajuan pemberi kerja yang muncul
 * real time di akun Verifikator (AK-24): Perubahan, Pencabutan, serta
 * Pengesahan & Perpanjangan dari Form RPTKA.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  PENCABUTAN_JENIS, pencabutanDokumenContoh,
} from '../../js/contracts/pengajuan-verifikasi.js';
import { createClient } from './client.js';

const role = { role: 'swasta' };
const send = (api, method, path, body, query = role) =>
  api(method, path, { query, body });
const JABATAN = { nama: 'Rolling Mill Specialist', jumlahTka: 1,
  jangkaWaktuBulan: 12 };
const berkas = (nama, ukuranKb = 100) => ({ namaBerkas: nama, ukuranKb });
const DATA = { nama: 'Arjun Nair', tempatLahir: 'Chennai',
  tanggalLahir: '1988-04-12', jenisKelamin: 'Laki-laki', pendidikan: 'S2',
  statusPerkawinan: 'Kawin', kebangsaan: 'India', nomorPaspor: 'K1234567',
  tanggalTerbitPaspor: '2024-01-10', tanggalBerakhirPaspor: '2034-01-09',
  tempatTerbitPaspor: 'Chennai', alamatTinggal: 'Jl. Industri 5',
  kodePos: '17530', email: 'arjun@example.com', telepon: '081234567890',
  jaminanSosial: '0001234567', npwpTka: '123456789012345',
  lokasiKerja: 'KAB. BEKASI' };
const perpanjangan = (jenis) => ({ jenis, hpkId: 'h5', jabatan: [JABATAN],
  tka: [{ jabatan: JABATAN.nama, urut: 1, data: DATA, ocr: {}, dokumen: {
    'p-perjanjian': berkas('pk.pdf'), 'p-izin-tinggal': berkas('itas.pdf'),
    'p-paspor': berkas('paspor.jpg'), 'p-pas-foto': berkas('foto.png') } }],
  dokumenJabatan: {},
  dokumenPermohonan: Object.fromEntries(['p-permohonan', 'p-tugas',
    'p-domisili', 'p-wajib-lapor', 'p-diklat', 'p-pendampingan', 'p-tki']
    .map((k) => [k, berkas(`${k}.pdf`, 500)])) });

async function ajukanPerubahan(api) {
  const c = await send(api, 'POST', '/perubahan', { role: 'swasta',
    skBarcode: '24871365', jenis: 'Lokasi Kerja', detail: '+ KAB. BOGOR',
    semula: 'A', menjadi: 'B', surat: '9/X', suratTgl: '2 Oktober 2026' });
  const id = c.body.data.id;
  await send(api, 'POST', `/perubahan/${id}/documents`, { role: 'swasta',
    nama: 'Surat lokasi', fileName: 'lokasi.pdf' });
  await send(api, 'POST', `/perubahan/${id}/submit`,
    { role: 'swasta', agree: true });
  return id;
}

describe('Perubahan dari pemberi kerja -> Verifikator (AK-24)', () => {
  it('muncul hanya setelah Proses (Diajukan), bukan saat draf', async () => {
    const api = createClient();
    const draft = await send(api, 'POST', '/perubahan', { role: 'swasta',
      skBarcode: '24871365', jenis: 'Lokasi Kerja', detail: 'x',
      semula: 'A', menjadi: 'B', surat: '9/X', suratTgl: '2 Oktober 2026' });
    assert.equal(draft.status, 201);
    assert.deepEqual((await api('GET', '/perubahan-verifikasi')).body.data, []);
    await ajukanPerubahan(api);
    const rows = (await api('GET', '/perubahan-verifikasi')).body.data;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].status, 'Menunggu verifikasi');
    assert.match(rows[0].nomor, /^C-2610-\d{4}$/);
  });

  it('detail memuat isian + dokumen yang diunggah; 404 bila tak ada',
    async () => {
      const api = createClient();
      await ajukanPerubahan(api);
      const [row] = (await api('GET', '/perubahan-verifikasi')).body.data;
      const res = await api('GET', `/perubahan-verifikasi/${row.id}`);
      assert.equal(res.status, 200);
      assert.equal(res.body.data.dokumen[0].fileName, 'lokasi.pdf');
      assert.ok(res.body.data.isian.some((i) => i.label === 'Jenis perubahan'
        && i.value === 'Lokasi Kerja'));
      assert.equal(row.id, 'swasta.' + row.nomor);
      assert.equal((await api('GET', '/perubahan-verifikasi/x.y')).status, 404);
    });

  it('verifikasi, tolak (alasan wajib), ajukan kembali; status pemberi ' +
    'kerja ikut', async () => {
    const api = createClient();
    const id = await ajukanPerubahan(api);
    const [row] = (await api('GET', '/perubahan-verifikasi')).body.data;
    const bad = await send(api, 'POST', `/perubahan-verifikasi/${row.id}/reject`,
      { alasan: 'x' });
    assert.equal(bad.status, 400);
    const rej = await send(api, 'POST', `/perubahan-verifikasi/${row.id}/reject`,
      { alasan: 'Surat lokasi belum ditandatangani.' });
    assert.equal(rej.body.data.status, 'Perbaikan');
    const mine = (await send(api, 'GET', '/perubahan')).body.data
      .find((c) => c.id === id);
    assert.equal(mine.verif, 'Perbaikan');
    assert.match(mine.verifAlasan, /ditandatangani/);
    const again = await send(api, 'POST',
      `/perubahan-verifikasi/${row.id}/resubmit`);
    assert.equal(again.body.data.status, 'Menunggu verifikasi');
    const ok = await send(api, 'POST', `/perubahan-verifikasi/${row.id}/verify`);
    assert.equal(ok.body.data.status, 'Diteruskan ke Validator');
    assert.equal((await send(api, 'POST',
      `/perubahan-verifikasi/${row.id}/verify`)).status, 409);
  });
});

describe('Pencabutan dari pemberi kerja -> Verifikator (AK-24)', () => {
  const body = (extra = {}) => ({ role: 'swasta', barcode: '25103377',
    jenis: PENCABUTAN_JENIS[0], alasan: 'TKA telah keluar dengan EPO.',
    dokumen: pencabutanDokumenContoh(PENCABUTAN_JENIS[0]), ...extra });
  const submit = (api, extra) => send(api, 'POST', '/pencabutan', body(extra));

  it('mengajukan pencabutan membuat baris menunggu verifikasi', async () => {
    const api = createClient();
    const res = await submit(api);
    assert.equal(res.status, 201);
    assert.equal(res.body.data.status, 'Menunggu verifikasi Verifikator');
    const rows = (await api('GET', '/pencabutan-verifikasi')).body.data;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].jenis, 'EPO');
    const detail = (await api('GET', `/pencabutan-verifikasi/${rows[0].id}`))
      .body.data;
    assert.equal(detail.dokumen.length, 7);
    assert.ok(detail.dokumen.some((d) => /EPO/.test(d.jenis)));
    assert.ok(detail.isian.some((i) => i.label === 'Alasan pencabutan' &&
      /EPO/.test(i.value)));
  });

  it('validasi: barcode 8 digit, jenis enum, alasan >= 10, dokumen lengkap, ' +
    'TKA harus ada (404), tidak ganda (409)', async () => {
    const api = createClient();
    assert.equal((await submit(api, { barcode: '12' })).status, 400);
    assert.equal((await submit(api, { jenis: 'Lainnya' })).status, 400);
    assert.equal((await submit(api, { alasan: 'pendek' })).status, 400);
    const kurang = await submit(api, { dokumen: [] });
    assert.equal(kurang.status, 400);
    assert.ok(kurang.body.error.fields.dokumen);
    assert.equal((await submit(api, { barcode: '99999999' })).status, 404);
    assert.equal((await submit(api)).status, 201);
    assert.equal((await submit(api)).status, 409);
  });

  it('draf: hanya role + barcode, tidak tampil di Verifikator; ubah lalu ' +
    'submit memunculkannya', async () => {
    const api = createClient();
    const saved = await send(api, 'POST', '/pencabutan',
      { role: 'swasta', barcode: '25103377', draft: true });
    assert.equal(saved.status, 201);
    assert.equal(saved.body.data.status, 'Draf');
    assert.equal(
      (await api('GET', '/pencabutan-verifikasi')).body.data.length, 0);
    const { id } = saved.body.data;
    const bad = await send(api, 'PUT', `/pencabutan/${id}`, body({
      alasan: 'x' }));
    assert.equal(bad.status, 400);
    const sent = await send(api, 'PUT', `/pencabutan/${id}`, body());
    assert.equal(sent.status, 200);
    assert.equal(sent.body.data.status, 'Menunggu verifikasi Verifikator');
    assert.equal(
      (await api('GET', '/pencabutan-verifikasi')).body.data.length, 1);
    assert.equal((await send(api, 'PUT', `/pencabutan/${id}`, body()))
      .status, 409);
    assert.equal((await api('GET', `/pencabutan/${id}`,
      { query: role })).body.data.jenis, 'EPO');
  });

  it('tolak -> Perbaikan; pemberi kerja ajukan kembali; verifikasi',
    async () => {
      const api = createClient();
      await submit(api);
      const [{ id }] = (await api('GET', '/pencabutan-verifikasi')).body.data;
      await send(api, 'POST', `/pencabutan-verifikasi/${id}/reject`,
        { alasan: 'Bukti ERP tidak terbaca.' });
      assert.equal((await api('GET', '/pencabutan')).body.data[0].verif,
        'Perbaikan');
      await send(api, 'POST', `/pencabutan-verifikasi/${id}/resubmit`);
      const done = await send(api, 'POST', `/pencabutan-verifikasi/${id}/verify`);
      assert.equal(done.body.data.status, 'Diteruskan ke Validator');
    });
});

describe('Form RPTKA asli -> menu Verifikator (AK-22/AK-23)', () => {
  const kirim = async (api, jenis) => {
    const saved = await send(api, 'POST', '/pengesahan-rptka',
      perpanjangan(jenis));
    assert.equal(saved.status, 201, JSON.stringify(saved.body));
    const done = await send(api, 'POST',
      `/pengesahan-rptka/${saved.body.data.id}/submit`, {});
    assert.equal(done.status, 200, JSON.stringify(done.body));
    return `q-${saved.body.data.id}-swasta`;
  };

  it('Perpanjangan Lintas Provinsi muncul sebagai Menunggu verifikasi ' +
    'dengan nama jenis asli', async () => {
    const api = createClient();
    const id = await kirim(api, 'Perpanjangan Lintas Provinsi');
    const res = await api('GET', `/pengesahan-verifikasi/${id}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, 'Menunggu verifikasi');
    assert.equal(res.body.data.jenisRptka, 'Perpanjangan Lintas Provinsi');
    assert.match(res.body.data.pemohon, /Nusantara Baja/);
  });
});

describe('Perpanjangan Lintas Kab/Kota dari Form RPTKA (AK-25)', () => {
  it('pengajuan asli muncul dengan nama jenis aslinya dan bisa diverifikasi',
    async () => {
      const api = createClient();
      const saved = await send(api, 'POST', '/pengesahan-rptka', perpanjangan(
        'Perpanjangan Lintas Kab/Kota dalam 1 Provinsi'));
      assert.equal(saved.status, 201, JSON.stringify(saved.body));
      const sent = await send(api, 'POST',
        `/pengesahan-rptka/${saved.body.data.id}/submit`, {});
      assert.equal(sent.status, 200, JSON.stringify(sent.body));
      const id = `q-${saved.body.data.id}-swasta`;
      const rows = (await api('GET', '/pengesahan-verifikasi')).body.data;
      const row = rows.find((r) => r.id === id);
      assert.equal(row.jenisRptka, 'Perpanjangan Lintas Kab/Kota dalam 1 Provinsi');
      assert.equal(row.status, 'Menunggu verifikasi');
      const detail = await api('GET', `/pengesahan-verifikasi/${id}`);
      assert.ok(detail.body.data.dokumen.length >= 7);
      const ok = await send(api, 'POST', `/pengesahan-verifikasi/${id}/verify`,
        { tahap: 'verifikasi' });
      assert.equal(ok.body.data.status, 'Diteruskan ke Validator');
    });
});
