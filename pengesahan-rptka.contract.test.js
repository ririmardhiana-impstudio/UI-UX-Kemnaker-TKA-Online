/** @fileoverview Contract tests — Form RPTKA (RP-01..RP-12). */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createClient } from './client.js';

const query = { role: 'swasta' };
const LEBIH = 'Pekerjaan Lebih dari 6 bulan';
const JABATAN = { nama: 'Rolling Mill Specialist', jumlahTka: 1,
  jangkaWaktuBulan: 12 };
const DRAFT = { hpkId: 'h5', jenis: LEBIH, jabatan: [JABATAN] };
const get = (api, path, q = query) => api('GET', path, { query: q });
const send = (api, method, path, body, q = query) =>
  api(method, path, { query: q, body });
const field = (res, key) => res.body.error.fields[key];

describe('GET /pengesahan-rptka/hpk (RP-01)', () => {
  it('lists only active HPK with sisa kuota', async () => {
    const res = await get(createClient(), '/pengesahan-rptka/hpk');
    assert.equal(res.status, 200);
    const ids = res.body.data.map((h) => h.id);
    assert.ok(ids.includes('h5'));
    assert.ok(!ids.includes('gs39'), 'HPK Maret 2025 (12 bln) kedaluwarsa');
    const h5 = res.body.data.find((h) => h.id === 'h5');
    assert.equal(h5.jabatan.find((j) => j.nama === JABATAN.nama).sisa, 1);
  });

  it('kelompok C is forbidden (403)', async () => {
    const res = await get(createClient(), '/pengesahan-rptka/hpk',
      { role: 'pemerintah' });
    assert.equal(res.status, 403);
  });
});

describe('simpan Draf (RP-02, RP-03, RP-11)', () => {
  it('jenis harus enum; HPK wajib untuk jenis ber-HPK', async () => {
    const api = createClient();
    const jenis = await send(api, 'POST', '/pengesahan-rptka',
      { ...DRAFT, jenis: 'Lain' });
    assert.equal(jenis.body.error.field, 'jenis');
    const none = await send(api, 'POST', '/pengesahan-rptka', { jenis: 'KEK' });
    assert.equal(none.body.error.field, 'hpkId');
  });

  it('creates a Draf with a unique id', async () => {
    const api = createClient();
    const res = await send(api, 'POST', '/pengesahan-rptka', DRAFT);
    assert.equal(res.status, 201);
    assert.equal(res.body.data.status, 'Draf');
    const ids = (await get(api, '/pengesahan-rptka')).body.data
      .map((r) => r.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it('HPK tidak aktif -> 422; tidak dikenal -> 404', async () => {
    const api = createClient();
    const old = await send(api, 'POST', '/pengesahan-rptka',
      { jenis: 'KEK', hpkId: 'gs39' });
    assert.equal(old.status, 422);
    const none = await send(api, 'POST', '/pengesahan-rptka',
      { jenis: 'KEK', hpkId: 'zz' });
    assert.equal(none.status, 404);
  });

  it('jenis ber-layanan HPK hanya memakai HPK berlayanan sama', async () => {
    const res = await send(createClient(), 'POST', '/pengesahan-rptka',
      { ...DRAFT, jenis: 'Sementara (1–6 bulan)',
        jabatan: [{ ...JABATAN, jangkaWaktuBulan: 3 }] });
    assert.equal(res.status, 400);
    assert.ok(field(res, 'hpkId'));
  });

  it('jenis hanya untuk role tertentu (422)', async () => {
    const api = createClient();
    const lembagaOnly = await send(api, 'POST', '/pengesahan-rptka',
      { jenis: 'Non DKPTKA', hpkId: 'h5' });
    assert.equal(lembagaOnly.status, 422);
    const noHpk = await send(api, 'POST', '/pengesahan-rptka',
      { jenis: 'Non DKPTKA Non HPK' });
    assert.equal(noHpk.status, 422, 'swasta tidak memakai jenis Non-HPK');
  });

  it('jenis Non-HPK tanpa HPK untuk kelompok C', async () => {
    const res = await send(createClient(), 'POST', '/pengesahan-rptka',
      { jenis: 'Non DKPTKA Non HPK', jabatan: [{ nama: 'Penasihat',
        jumlahTka: 1, jangkaWaktuBulan: 8 }] }, { role: 'pemerintah' });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.hpkId, null);
  });

  it('jumlah TKA <= sisa kuota; jabatan harus ada di HPK', async () => {
    const api = createClient();
    const over = await send(api, 'POST', '/pengesahan-rptka',
      { ...DRAFT, jabatan: [{ ...JABATAN, jumlahTka: 2 }] });
    assert.ok(field(over, 'jabatan.0.jumlahTka'));
    const alien = await send(api, 'POST', '/pengesahan-rptka',
      { ...DRAFT, jabatan: [{ ...JABATAN, nama: 'Astronaut' }] });
    assert.ok(field(alien, 'jabatan.0.nama'));
  });

  it('jangka waktu mengikuti pilihan jenis (RP-04)', async () => {
    const api = createClient();
    const lebih = await send(api, 'POST', '/pengesahan-rptka',
      { ...DRAFT, jabatan: [{ ...JABATAN, jangkaWaktuBulan: 6 }] });
    assert.ok(field(lebih, 'jabatan.0.jangkaWaktuBulan'), '7–12 atau 24');
    const dup = await send(api, 'POST', '/pengesahan-rptka',
      { ...DRAFT, jabatan: [JABATAN, JABATAN] });
    assert.ok(field(dup, 'jabatan.1.nama'));
    const bebas = await send(api, 'POST', '/pengesahan-rptka', { hpkId: 'h5',
      jenis: 'KEK', jabatan: [{ ...JABATAN, jangkaWaktuBulan: 25 }] });
    assert.ok(field(bebas, 'jabatan.0.jangkaWaktuBulan'), 'maks. 24 bulan');
  });

  it('dokumen: format & ukuran dibatasi (paspor JPG maks. 250 KB)',
    async () => {
      const tka = (namaBerkas, ukuranKb) => [{ jabatan: JABATAN.nama, urut: 1,
        data: {}, dokumen: { paspor: { namaBerkas, ukuranKb } } }];
      const api = createClient();
      const pdf = await send(api, 'POST', '/pengesahan-rptka',
        { ...DRAFT, tka: tka('paspor.pdf', 100) });
      assert.ok(field(pdf, 'tka.0.dokumen.paspor'));
      const big = await send(api, 'POST', '/pengesahan-rptka',
        { ...DRAFT, tka: tka('paspor.jpg', 300) });
      assert.ok(field(big, 'tka.0.dokumen.paspor'));
    });

  it('data isian: format kode pos, e-mail, tanggal, urutan paspor',
    async () => {
      const data = { kodePos: '12', email: 'x', tanggalLahir: '21-01-1985',
        tanggalTerbitPaspor: '2024-01-01', tanggalBerakhirPaspor: '2023-01-01' };
      const res = await send(createClient(), 'POST', '/pengesahan-rptka',
        { ...DRAFT, tka: [{ jabatan: JABATAN.nama, urut: 1, data }] });
      for (const k of ['kodePos', 'email', 'tanggalLahir',
        'tanggalBerakhirPaspor']) {
        assert.ok(field(res, `tka.0.data.${k}`), k);
      }
    });

  it('jenis & HPK terkunci setelah Draf disimpan; bukan Draf -> 409',
    async () => {
      const api = createClient();
      const swap = await send(api, 'PUT', '/pengesahan-rptka/rp1',
        { ...DRAFT, hpkId: 'h1' });
      assert.equal(swap.status, 422);
      const jenis = await send(api, 'PUT', '/pengesahan-rptka/rp1',
        { ...DRAFT, jenis: 'KEK' });
      assert.equal(jenis.status, 422);
      await send(api, 'POST', '/pengesahan-rptka/rp3/submit', {});
      const locked = await send(api, 'PUT', '/pengesahan-rptka/rp3',
        { ...DRAFT, hpkId: 'h1' });
      assert.equal(locked.status, 409);
    });
});

describe('dokumen per jenis (RP-05, RP-12)', () => {
  const kunciTka = (res, i = 0) => Object.keys(res.body.error.fields)
    .filter((k) => k.startsWith(`tka.${i}.dokumen.`))
    .map((k) => k.split('.').pop());
  const submitKosong = async (jenis, hpkId, extra = {}, jangka = 12) => {
    const api = createClient();
    const saved = await send(api, 'POST', '/pengesahan-rptka', { jenis, hpkId,
      jabatan: [{ ...JABATAN, jangkaWaktuBulan: jangka }],
      tka: [{ jabatan: JABATAN.nama, urut: 1, data: {}, dokumen: {} }],
      ...extra });
    assert.equal(saved.status, 201, JSON.stringify(saved.body));
    return send(api, 'POST', `/pengesahan-rptka/${saved.body.data.id}/submit`,
      {});
  };

  it('lebih dari 6 bulan: polis negara asal, bukan polis sementara',
    async () => {
      const keys = kunciTka(await submitKosong(LEBIH, 'h5'));
      assert.ok(keys.includes('polis-asal') && keys.includes('perjanjian'));
      assert.ok(!keys.includes('polis-sementara'));
    });

  it('Alih Status menambah ITK; Rangkap Jabatan: pemberi kerja pertama + ' +
    'ITAS tanpa perjanjian kerja', async () => {
    const alih = kunciTka(await submitKosong('Alih Status', 'h5'));
    assert.ok(alih.includes('itk'));
    const rangkap = kunciTka(await submitKosong('Rangkap Jabatan', 'h5'));
    for (const k of ['rptka-pertama', 'persetujuan-pertama', 'itas']) {
      assert.ok(rangkap.includes(k), k);
    }
    assert.ok(!rangkap.includes('perjanjian'));
  });

  it('Non DKPTKA: kegiatan wajib; surat KEK/IKN mengikuti kegiatan',
    async () => {
      const api = createClient();
      const lembaga = { role: 'lembaga' };
      const base = { jenis: 'Non DKPTKA', hpkId: 'h1',
        jabatan: [{ nama: 'Pengajar Bahasa Inggris', jumlahTka: 1,
          jangkaWaktuBulan: 12 }],
        tka: [{ jabatan: 'Pengajar Bahasa Inggris', urut: 1, data: {},
          dokumen: {} }] };
      const none = await send(api, 'POST', '/pengesahan-rptka', base, lembaga);
      const noKegiatan = await send(api, 'POST',
        `/pengesahan-rptka/${none.body.data.id}/submit`, {}, lembaga);
      assert.ok(field(noKegiatan, 'kegiatan'));
      const kek = await send(api, 'POST', '/pengesahan-rptka',
        { ...base, kegiatan: 'KEK' }, lembaga);
      const res = await send(api, 'POST',
        `/pengesahan-rptka/${kek.body.data.id}/submit`, {}, lembaga);
      const keys = kunciTka(res);
      assert.ok(!keys.includes('otorita-ikn'));
      assert.ok(field(res, 'dokumenJabatan.Pengajar Bahasa Inggris.' +
        'pendamping'));
    });

  it('kurang dari 6 bulan: polis sementara, tanpa pendamping', async () => {
    const api = createClient();
    const saved = await send(api, 'POST', '/pengesahan-rptka', {
      jenis: 'Sementara (1–6 bulan)', hpkId: 'gs17',
      jabatan: [{ nama: 'Plant Manager', jumlahTka: 1, jangkaWaktuBulan: 3 }],
      tka: [{ jabatan: 'Plant Manager', urut: 1, data: {}, dokumen: {} }] });
    assert.equal(saved.status, 201, JSON.stringify(saved.body));
    const res = await send(api, 'POST',
      `/pengesahan-rptka/${saved.body.data.id}/submit`, {});
    const keys = kunciTka(res);
    assert.ok(keys.includes('polis-sementara'));
    assert.ok(!keys.includes('polis-asal'));
    assert.equal(field(res, 'dokumenJabatan.Plant Manager.pendamping'),
      undefined);
    const enam = await send(api, 'POST', '/pengesahan-rptka', {
      jenis: 'Sementara (1–6 bulan)', hpkId: 'gs17',
      jabatan: [{ nama: 'Plant Manager', jumlahTka: 1, jangkaWaktuBulan: 7 }] });
    assert.ok(field(enam, 'jabatan.0.jangkaWaktuBulan'), 'maks. 6 bulan');
  });
});

describe('submit (RP-06..RP-10)', () => {
  it('Draf tidak lengkap ditolak dengan daftar field (400)', async () => {
    const res = await send(createClient(), 'POST',
      '/pengesahan-rptka/rp1/submit', {});
    assert.equal(res.status, 400);
    assert.ok(field(res, 'tka.0.data.statusPerkawinan'));
    assert.ok(field(res, 'tka.0.dokumen.ijazah'));
  });

  it('Draf lengkap -> Menunggu Verifikasi + efek samping', async () => {
    const api = createClient();
    const res = await send(api, 'POST', '/pengesahan-rptka/rp3/submit', {});
    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, 'Menunggu Verifikasi');
    const peng = await get(api, '/pengesahan', { ...query, hpk: 'h1' });
    const row = peng.body.data.find((p) => p.rptkaId === 'rp3');
    assert.ok(row && row.status === 'Menunggu Verifikasi');
    assert.equal(row.identitas?.tempatLahir, 'Kochi',
      'identitas TKA lengkap (uploads/Pengesahan RPTKA.txt) harus ' +
      'tertaut ke baris pemberi kerja untuk SK Pengesahan');
    assert.equal(row.identitas.email, 'arjun.nair@example.com');
    const hpk = await get(api, '/hpk/h1');
    const wi = hpk.body.data.jabatan.find((j) => j.nama === 'Welding Inspector');
    assert.equal(wi.terisi, 1);
    const again = await send(api, 'POST', '/pengesahan-rptka/rp3/submit', {});
    assert.equal(again.status, 409);
  });

  it('pendamping tidak wajib untuk jabatan direksi/komisaris', async () => {
    const api = createClient();
    const res = await send(api, 'POST', '/pengesahan-rptka', { hpkId: 'gs12',
      jenis: 'KEK', jabatan: [{ nama: 'Direktur Utama', jumlahTka: 1,
        jangkaWaktuBulan: 12 }] });
    assert.equal(res.status, 201);
    const submit = await send(api, 'POST',
      `/pengesahan-rptka/${res.body.data.id}/submit`, {});
    assert.equal(submit.status, 400);
    assert.equal(field(submit, 'dokumenJabatan.Direktur Utama.pendamping'),
      undefined);
  });

  it('kelompok C: submit tanpa HPK tidak memakai kuota', async () => {
    const api = createClient();
    const rows = await get(api, '/pengesahan-rptka', { role: 'pemerintah' });
    assert.equal(rows.body.data[0].hpkId, null);
    const res = await send(api, 'POST', '/pengesahan-rptka/rp1/submit', {},
      { role: 'pemerintah' });
    assert.equal(res.status, 400, 'seed pemerintah belum lengkap');
  });
});

describe('jenis Perpanjangan (RP-16)', () => {
  const LP = 'Perpanjangan Lintas Provinsi';
  const LK = 'Perpanjangan Lintas Kab/Kota dalam 1 Provinsi';
  const TKA = { jabatan: JABATAN.nama, urut: 1, data: { nama: 'Arjun Nair',
    jaminanSosial: '0001234567', npwpTka: '12345' }, dokumen: {} };

  it('swasta dan lembaga boleh; kelompok C 422', async () => {
    const api = createClient();
    for (const jenis of [LP, LK]) {
      const ok = await send(api, 'POST', '/pengesahan-rptka',
        { jenis, hpkId: 'h5', jabatan: [JABATAN] });
      assert.equal(ok.status, 201, jenis);
    }
    const c = await send(api, 'POST', '/pengesahan-rptka',
      { jenis: LP, jabatan: [JABATAN] }, { role: 'pemerintah' });
    assert.equal(c.status, 422);
  });

  it('NPWP TKA harus 15–16 digit (kolom khusus Perpanjangan)', async () => {
    const res = await send(createClient(), 'POST', '/pengesahan-rptka',
      { jenis: LP, hpkId: 'h5', jabatan: [JABATAN], tka: [TKA] });
    assert.equal(res.status, 400);
    assert.ok(field(res, 'tka.0.data.npwpTka'));
  });

  it('jenis lain tidak mengenal kolom khusus; daftar memuat diajukan/nomorRptka',
    async () => {
      const api = createClient();
      await send(api, 'POST', '/pengesahan-rptka',
        { jenis: LP, hpkId: 'h5', jabatan: [JABATAN] });
      const rows = (await get(api, '/pengesahan-rptka', { ...query,
        jenis: LP })).body.data;
      assert.equal(rows.length, 1);
      assert.equal(rows[0].jenis, LP);
      assert.equal(rows[0].diajukan, null);
      assert.equal(rows[0].nomorRptka, rows[0].noAjuan);
    });
});

describe('alur Perpanjangan Lintas Provinsi (RP-17)', () => {
  const LP = 'Perpanjangan Lintas Provinsi';
  const berkas = (nama, ukuranKb = 100) => ({ namaBerkas: nama, ukuranKb });
  const DATA = { nama: 'Arjun Nair', tempatLahir: 'Chennai',
    tanggalLahir: '1988-04-12', jenisKelamin: 'Laki-laki',
    pendidikan: 'S2', statusPerkawinan: 'Kawin', kebangsaan: 'India',
    nomorPaspor: 'K1234567', tanggalTerbitPaspor: '2024-01-10',
    tanggalBerakhirPaspor: '2034-01-09', tempatTerbitPaspor: 'Chennai',
    alamatTinggal: 'Jl. Industri 5', kodePos: '17530',
    email: 'arjun@example.com', telepon: '081234567890',
    jaminanSosial: '0001234567', npwpTka: '123456789012345',
    lokasiKerja: 'KAB. BEKASI' };
  const full = (extra = {}) => ({ jenis: LP, hpkId: 'h5',
    jabatan: [JABATAN],
    tka: [{ jabatan: JABATAN.nama, urut: 1, data: DATA, ocr: {}, dokumen: {
      'p-perjanjian': berkas('pk.pdf'), 'p-izin-tinggal': berkas('itas.pdf'),
      'p-paspor': berkas('paspor.jpg'), 'p-pas-foto': berkas('foto.png') } }],
    dokumenJabatan: {},
    dokumenPermohonan: Object.fromEntries(['p-permohonan', 'p-tugas',
      'p-domisili', 'p-wajib-lapor', 'p-diklat', 'p-pendampingan', 'p-tki']
      .map((k) => [k, berkas(`${k}.pdf`, 500)])), ...extra });

  async function submitted(api, extra) {
    const created = await send(api, 'POST', '/pengesahan-rptka', full(extra));
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const id = created.body.data.id;
    const done = await send(api, 'POST', `/pengesahan-rptka/${id}/submit`, {});
    assert.equal(done.status, 200, JSON.stringify(done.body));
    return id;
  }

  it('tidak lagi punya field Kegiatan (dihapus, revisi akun pemberi ' +
    'kerja poin 5)', async () => {
    const api = createClient();
    // Tanpa kegiatan sama sekali -> submit lolos (tidak wajib lagi).
    const created = await send(api, 'POST', '/pengesahan-rptka', full());
    const submit = await send(api, 'POST',
      `/pengesahan-rptka/${created.body.data.id}/submit`, {});
    assert.equal(submit.status, 200, JSON.stringify(submit.body));
    // Mengirim kegiatan tetap ditolak (field sudah tidak berlaku lagi).
    const bad = await send(createClient(), 'POST', '/pengesahan-rptka',
      full({ kegiatan: 'Pekerjaan lebih dari 6 bulan' }));
    assert.equal(bad.status, 400);
    assert.equal(bad.body.error.field, 'kegiatan');
  });

  it('dokumen permohonan wajib saat submit', async () => {
    const api = createClient();
    const created = await send(api, 'POST', '/pengesahan-rptka',
      full({ dokumenPermohonan: {} }));
    const res = await send(api, 'POST',
      `/pengesahan-rptka/${created.body.data.id}/submit`, {});
    assert.equal(res.status, 400);
    assert.ok(field(res, 'dokumenPermohonan.p-permohonan'));
  });

  it('ukuran: PDF <= 2 MB, gambar <= 150 KB; format PDF/JPEG/PNG/JPG', async () => {
    const api = createClient();
    const res = await send(api, 'POST', '/pengesahan-rptka', full({
      dokumenPermohonan: { 'p-permohonan': berkas('a.pdf', 3000),
        'p-tugas': berkas('b.png', 200), 'p-domisili': berkas('c.gif'),
        'p-wajib-lapor': berkas('d.png', 150) } }));
    assert.equal(res.status, 400);
    assert.ok(field(res, 'dokumenPermohonan.p-permohonan'));
    assert.ok(field(res, 'dokumenPermohonan.p-tugas'));
    assert.ok(field(res, 'dokumenPermohonan.p-domisili'));
    assert.equal(field(res, 'dokumenPermohonan.p-wajib-lapor'), undefined);
  });

  it('Verifikator kembalikan -> revisi -> kirim ulang -> Verifikator', async () => {
    const api = createClient();
    const id = await submitted(api);
    const q = `q-${id}-swasta`;
    const rej = await api('POST', `/pengesahan-verifikasi/${q}/reject`,
      { body: { tahap: 'verifikasi', alasan: 'Domisili tidak terbaca jelas.' } });
    assert.equal(rej.status, 200);
    const back = (await get(api, `/pengesahan-rptka/${id}`)).body.data;
    assert.equal(back.perluRevisi, 'verifikasi');
    assert.match(back.catatanRevisi, /Domisili/);
    const revised = full({ dokumenPermohonan: { ...full().dokumenPermohonan,
      'p-domisili': berkas('domisili-baru.pdf') } });
    const saved = await send(api, 'PUT', `/pengesahan-rptka/${id}`, revised);
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const again = await send(api, 'POST', `/pengesahan-rptka/${id}/resubmit`,
      {});
    assert.equal(again.status, 200, JSON.stringify(again.body));
    assert.equal(again.body.data.perluRevisi, null);
    const row = (await api('GET', `/pengesahan-verifikasi/${q}`)).body.data;
    assert.ok(row.dokumen.some((d) => d.fileName === 'domisili-baru.pdf'));
    const twice = await send(api, 'POST', `/pengesahan-rptka/${id}/resubmit`,
      {});
    assert.equal(twice.status, 409);
  });

  it('tanpa Kegiatan, Perpanjangan tidak lagi punya jalur bebas DKPTKA ' +
    'via kegiatan (dihapus bersama field Kegiatan)', async () => {
    const biasa = await send(createClient(), 'POST', '/pengesahan-rptka',
      full());
    assert.equal(biasa.status, 201);
    const c = await send(createClient(), 'POST', '/pengesahan-rptka',
      { jenis: 'Perpanjangan Lintas Provinsi Non HPK', jabatan: [JABATAN] },
      { role: 'pemerintah' });
    assert.equal(c.status, 201, JSON.stringify(c.body));
  });

  it('kegiatanOpsi selalu [] untuk Perpanjangan, apa pun role', async () => {
    const m = await import('../../js/contracts/pengesahan-rptka.js');
    for (const role of ['swasta', 'lembaga', 'pemerintah']) {
      assert.deepEqual(m.kegiatanOpsi(LP, role), []);
    }
    // kegiatan selalu null di baris Perpanjangan sungguhan (validasi
    // menolaknya lebih dulu, lihat tes di atas), jadi bebasDkptka tetap
    // false pada jalur yang sebenarnya bisa terjadi.
    assert.equal(m.bebasDkptka(LP, undefined), false);
    assert.equal(m.bebasDkptka(LP, null), false);
  });
});

describe('Perpanjangan: Validator verifikasi -> billing otomatis ke pemberi kerja', () => {
  const LP = 'Perpanjangan Lintas Provinsi';
  const berkas = (nama, ukuranKb = 100) => ({ namaBerkas: nama, ukuranKb });
  const DATA = { nama: 'Arjun Nair', tempatLahir: 'Chennai',
    tanggalLahir: '1988-04-12', jenisKelamin: 'Laki-laki',
    pendidikan: 'S2', statusPerkawinan: 'Kawin', kebangsaan: 'India',
    nomorPaspor: 'K1234567', tanggalTerbitPaspor: '2024-01-10',
    tanggalBerakhirPaspor: '2034-01-09', tempatTerbitPaspor: 'Chennai',
    alamatTinggal: 'Jl. Industri 5', kodePos: '17530',
    email: 'arjun@example.com', telepon: '081234567890',
    jaminanSosial: '0001234567', npwpTka: '123456789012345',
    lokasiKerja: 'KAB. BEKASI' };
  const body = { jenis: LP, hpkId: 'h5', jabatan: [JABATAN],
    tka: [{ jabatan: JABATAN.nama, urut: 1, data: DATA, ocr: {}, dokumen: {
      'p-perjanjian': berkas('pk.pdf'), 'p-izin-tinggal': berkas('itas.pdf'),
      'p-paspor': berkas('paspor.jpg'), 'p-pas-foto': berkas('foto.png') } }],
    dokumenJabatan: {},
    dokumenPermohonan: Object.fromEntries(['p-permohonan', 'p-tugas',
      'p-domisili', 'p-wajib-lapor', 'p-diklat', 'p-pendampingan', 'p-tki']
      .map((k) => [k, berkas(`${k}.pdf`, 500)])) };

  it('tagihan terbit di item pengajuan, Pembayaran DKPTKA, dan notifikasi',
    async () => {
      const api = createClient();
      const created = await send(api, 'POST', '/pengesahan-rptka', body);
      const id = created.body.data.id;
      await send(api, 'POST', `/pengesahan-rptka/${id}/submit`, {});
      const q = `q-${id}-swasta`;
      await api('POST', `/pengesahan-verifikasi/${q}/verify`,
        { body: { tahap: 'verifikasi' } });
      const res = await api('POST', `/pengesahan-validasi/${q}/verify`);
      assert.equal(res.status, 200, JSON.stringify(res.body));
      const kode = res.body.data.billing.kode;
      const item = (await get(api, `/pengesahan-rptka/${id}`)).body.data;
      assert.equal(item.status, 'Menunggu pembayaran DKPTKA');
      const bills = (await get(api, '/billing')).body.data;
      assert.ok(bills.some((b) => b.kode === kode &&
        b.status === 'Belum dibayar'));
      const notif = (await get(api, '/notifikasi')).body.data;
      assert.ok(notif.some((n) => n.judul.includes('Kode billing DKPTKA')));
    });
});
