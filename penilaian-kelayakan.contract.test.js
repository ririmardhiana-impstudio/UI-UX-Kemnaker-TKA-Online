/**
 * @fileoverview Contract tests — Hasil Penilaian dan Kelayakan (HPK) di
 * portal pemberi kerja (PK-01..PK-10): tabel, formulir per jenis, Draft,
 * submit, ekspose otomatis, BAP, HPK terbit.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  PK_JENIS, PK_STATUS_LIST, dokumenDefs, fieldDefs,
} from '../../js/contracts/penilaian-kelayakan.js';
import { createClient } from './client.js';

const ROLE = { role: 'swasta' };
const BASE = '/penilaian-kelayakan';
const LEBIH6 = PK_JENIS[1];
const DIREKSI = PK_JENIS[6];
const DOK = (nama) => ({ namaBerkas: nama, ukuranKb: 200 });
const ISIAN = { alasanPenggunaan: 'Alih teknologi lini baja lembaran baru.',
  jabatanTka: [{ nama: 'Production Planner', jumlahTka: 2 }],
  tanggalMulai: '2026-11-01',
  tanggalSelesai: '2027-11-01', lokasiKerja: 'Kab. Bekasi',
  pendampingNama: 'Dimas Prasetyo', pendampingJabatan: 'Senior Planner',
  rencanaPenyerapanTki: '2027: 5 orang; 2028: 8 orang.' };
/** Semua dokumen upload yang wajib untuk satu jenis. */
const dokumenLengkap = (jenis) => Object.fromEntries(dokumenDefs(jenis)
  .filter((d) => d.sumber === 'upload' && d.wajib)
  .map((d) => [d.kunci, DOK(`${d.kunci}.pdf`)]));
const DOKUMEN = dokumenLengkap(LEBIH6);
const DRAFT = { jenis: LEBIH6, isian: ISIAN, dokumen: DOKUMEN };
const BAP = { namaPenyetuju: 'Rina Wulandari', jabatanPenyetuju: 'HRD Manager' };

const get = (api, path, query = ROLE) => api('GET', path, { query });
const post = (api, path, body = {}, query = ROLE) =>
  api('POST', path, { query, body });
const move = (api, id, status, catatan) =>
  post(api, `${BASE}/${id}/transition`, { status, catatan });

async function createDraft(api, body = DRAFT) {
  const res = await post(api, BASE, body);
  assert.equal(res.status, 201);
  return res.body.data;
}

/** Create + submit + verifikator up to Terjadwal (non-Direksi). */
async function toTerjadwal(api) {
  const { id } = await createDraft(api);
  assert.equal((await post(api, `${BASE}/${id}/submit`)).status, 200);
  for (const s of ['Dalam Verifikasi', 'Terverifikasi',
    'Menunggu Jadwal Ekspose', 'Terjadwal']) {
    assert.equal((await move(api, id, s)).status, 200, s);
  }
  return id;
}

describe('GET /penilaian-kelayakan (tabel)', () => {
  it('requires ?role= (400)', async () => {
    const res = await get(createClient(), BASE, {});
    assert.equal(res.status, 400);
  });

  it('covers all 11 statuses with the table columns', async () => {
    const res = await get(createClient(), BASE);
    assert.equal(res.status, 200);
    const statuses = new Set(res.body.data.map((r) => r.status));
    assert.deepEqual([...statuses].sort(), [...PK_STATUS_LIST].sort());
    for (const key of ['id', 'noHpk', 'tanggal', 'jenis', 'status', 'tone']) {
      assert.ok(key in res.body.data[0], key);
    }
    assert.ok(res.body.meta.total > 10);
  });

  it('403 for kelompok C (pemerintah) without HPK (PK-01)', async () => {
    const res = await get(createClient(), BASE, { role: 'pemerintah' });
    assert.equal(res.status, 403);
  });

  it('is role-scoped', async () => {
    const api = createClient();
    const a = await get(api, BASE, { role: 'swasta' });
    const b = await get(api, BASE, { role: 'lembaga' });
    assert.notEqual(a.body.meta.total, b.body.meta.total);
  });
});

describe('GET /penilaian-kelayakan/formulir', () => {
  it('rejects an unknown jenis (400)', async () => {
    const res = await get(createClient(), `${BASE}/formulir`,
      { ...ROLE, jenis: 'HPK lain' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.field, 'jenis');
  });

  it('serves 7 jenis; OSS fields prefilled, upload docs open', async () => {
    const api = createClient();
    for (const jenis of PK_JENIS) {
      const res = await get(api, `${BASE}/formulir`, { ...ROLE, jenis });
      assert.equal(res.status, 200, jenis);
      const oss = res.body.data.fields.filter((f) => f.sumber === 'oss');
      assert.ok(oss.length && oss.every((f) => f.nilai), jenis);
      const uploads = res.body.data.dokumen
        .filter((d) => d.sumber === 'upload');
      assert.ok(uploads.every((d) => d.status === 'Belum diunggah'));
      assert.ok(res.body.data.dokumen.some((d) => d.sumber === 'oss-berkas'));
    }
  });

  it('Direksi/Komisaris has no ekspose (PK-08)', async () => {
    const res = await get(createClient(), `${BASE}/formulir`,
      { ...ROLE, jenis: DIREKSI });
    assert.equal(res.body.data.adaEkspose, false);
  });
});

const keys = (jenis) => fieldDefs(jenis).map((f) => f.kunci);
const docKeys = (jenis) => dokumenDefs(jenis).map((d) => d.kunci);
const SELESAI_HINGGA = (jenis, tanggalSelesai, lokasiKerja = 'Kab. Bekasi') =>
  validate(jenis, { ...ISIAN, tanggalSelesai, lokasiKerja });
const validate = (jenis, isian) => createClient()('POST', BASE,
  { query: ROLE, body: { jenis, isian } });

describe('ketentuan form per jenis HPK (Jenis HPK.txt)', () => {
  it('isian: pendamping, penyerapan TKI, bentuk kerjasama per jenis', () => {
    const [sementara, lebih6, nonDk, kek, ikn, kerjasama, direksi] = PK_JENIS;
    for (const j of [sementara, direksi]) {
      assert.ok(!keys(j).includes('pendampingNama'), j);
    }
    assert.ok(!keys(nonDk).includes('rencanaPenyerapanTki'));
    for (const j of [lebih6, kek, ikn, kerjasama]) {
      assert.ok(keys(j).includes('pendampingNama') &&
        keys(j).includes('rencanaPenyerapanTki'), j);
    }
    assert.ok(nonDk && keys(nonDk).includes('pendampingNama'));
    assert.ok(keys(kerjasama).includes('bentukKerjasama'));
    assert.ok(!keys(direksi).includes('alasanPenggunaan'));
    assert.ok(keys(sementara).includes('alasanPenggunaan'));
  });

  it('dokumen: khusus per jenis + kontrak opsional', () => {
    const [sementara, lebih6, nonDk, kek, ikn, kerjasama, direksi] = PK_JENIS;
    assert.equal(docKeys(direksi).length, 7);
    assert.ok(!docKeys(sementara).includes('strukturOrganisasi'));
    for (const j of [lebih6, nonDk, kek, ikn, kerjasama]) {
      assert.ok(['strukturOrganisasi', 'alihTeknologi', 'suratPernyataan']
        .every((k) => docKeys(j).includes(k)), j);
    }
    assert.ok(docKeys(nonDk).includes('suratPembebasan'));
    assert.ok(docKeys(kek).includes('suratDewanKek'));
    assert.ok(docKeys(ikn).includes('suratOtorita'));
    assert.ok(docKeys(kerjasama).includes('rekomendasiNegaraAsing'));
    const kontrak = dokumenDefs(kek).find((d) => d.kunci === 'kontrak');
    assert.equal(kontrak.wajib, false);
  });

  it('jangka waktu: <6 bln, >6 bln, KEK maks 5 th, IKN maks 10 th', async () => {
    const [sementara, lebih6, , kek, ikn] = PK_JENIS;
    const bad = async (jenis, selesai, lokasi) => (await SELESAI_HINGGA(jenis,
      selesai, lokasi)).body.error?.fields?.['isian.tanggalSelesai'];
    assert.ok(await bad(sementara, '2027-05-01', 'Kab. A, Kab. B'));
    assert.ok(!(await bad(sementara, '2027-03-01', 'Kab. A, Kab. B')));
    assert.ok(await bad(lebih6, '2027-03-01'));
    assert.ok(!(await bad(lebih6, '2027-11-01')));
    assert.ok(await bad(kek, '2031-12-01'));
    assert.ok(!(await bad(kek, '2031-10-01')));
    assert.ok(await bad(ikn, '2036-12-01'));
    assert.ok(!(await bad(ikn, '2036-10-01')));
    assert.ok(await bad(lebih6, '2026-10-01'));
  });

  it('HPK < 6 bulan: lokasi lebih dari satu Kabupaten/Kota', async () => {
    const res = await SELESAI_HINGGA(PK_JENIS[0], '2027-03-01', 'Kab. Bekasi');
    assert.ok(res.body.error.fields['isian.lokasiKerja']);
  });
});

describe('POST /penilaian-kelayakan + PUT (Draft)', () => {
  it('creates a Draft with partial data (201)', async () => {
    const data = await createDraft(createClient(), { jenis: LEBIH6 });
    assert.equal(data.status, 'Draft');
    assert.match(data.noHpk, /^HPK-\d{4}-\d{4}$/);
    assert.equal(data.bisaDiubah, true);
  });

  it('validates field formats with isian./dokumen. keys (400)', async () => {
    const res = await post(createClient(), BASE, { jenis: LEBIH6,
      isian: { jabatanTka: [{ nama: 'Planner', jumlahTka: 0 }],
        tanggalMulai: '2026-11-01',
        tanggalSelesai: '2026-10-01' },
      dokumen: { suratPermohonan: DOK('x.exe') } });
    assert.equal(res.status, 400);
    assert.ok(res.body.error.fields['isian.jabatanTka.0.jumlahTka']);
    assert.ok(res.body.error.fields['isian.tanggalSelesai']);
    assert.ok(res.body.error.fields['dokumen.suratPermohonan']);
  });

  it('PUT replaces isian of a Draft and may change jenis', async () => {
    const api = createClient();
    const { id } = await createDraft(api);
    const res = await api('PUT', `${BASE}/${id}`, { query: ROLE,
      body: { jenis: PK_JENIS[0], isian: { ...ISIAN,
        tanggalSelesai: '2027-03-01', lokasiKerja: 'Kab. Bekasi, Kab. Karawang' } } });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.jenis, PK_JENIS[0]);
  });

  it('PUT is 409 on a submitted pengajuan (PK-03)', async () => {
    const res = await createClient()('PUT', `${BASE}/pk12`, { query: ROLE,
      body: { jenis: PK_JENIS[0] } });
    assert.equal(res.status, 409);
  });

  it('jenis is locked after perbaikan (422)', async () => {
    const res = await createClient()('PUT', `${BASE}/pk10`, { query: ROLE,
      body: { jenis: LEBIH6 } });
    assert.equal(res.status, 422);
    assert.equal(res.body.error.field, 'jenis');
  });
});

describe('POST /penilaian-kelayakan/:id/submit', () => {
  it('400 with per-field errors when incomplete (PK-04)', async () => {
    const api = createClient();
    const { id } = await createDraft(api, { jenis: LEBIH6 });
    const res = await post(api, `${BASE}/${id}/submit`);
    assert.equal(res.status, 400);
    assert.equal(res.body.error.fields['isian.jabatanTka'], 'Wajib diisi.');
    assert.equal(res.body.error.fields['dokumen.suratPermohonan'],
      'Wajib diunggah.');
  });

  it('complete Draft -> Menunggu Verifikasi', async () => {
    const api = createClient();
    const { id } = await createDraft(api);
    const res = await post(api, `${BASE}/${id}/submit`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, 'Menunggu Verifikasi');
    assert.equal(res.body.data.bisaDiubah, false);
  });

  it('409 when already submitted; Perlu Perbaikan can resubmit', async () => {
    const api = createClient();
    assert.equal((await post(api, `${BASE}/pk12/submit`)).status, 409);
    const res = await post(api, `${BASE}/pk10/submit`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, 'Menunggu Verifikasi');
    assert.equal(res.body.data.catatan, null);
  });
});

describe('transition (verifikator / sistem) + ekspose', () => {
  it('rejects invalid transitions (409) and unknown ids (404)', async () => {
    const api = createClient();
    assert.equal((await move(api, 'pk12', 'Terjadwal')).status, 409);
    assert.equal((await move(api, 'pk999', 'Dalam Verifikasi')).status, 404);
  });

  it('Perlu Perbaikan needs a catatan (400)', async () => {
    const res = await move(createClient(), 'pk11', 'Ditolak/Perlu Perbaikan');
    assert.equal(res.status, 400);
    assert.ok(res.body.error.fields.catatan);
  });

  it('Perlu Perbaikan stores the catatan', async () => {
    const res = await move(createClient(), 'pk11', 'Ditolak/Perlu Perbaikan',
      'Lengkapi surat permohonan dengan tanda tangan basah.');
    assert.equal(res.status, 200);
    assert.match(res.body.data.catatan, /tanda tangan/);
    assert.equal(res.body.data.bisaDiubah, true);
  });

  it('Terjadwal gets antrian, 15-minute slot and link (PK-06)', async () => {
    const api = createClient();
    const id = await toTerjadwal(api);
    const { ekspose } = (await get(api, `${BASE}/${id}`)).body.data;
    assert.match(ekspose.noAntrian, /^A-\d{3}$/);
    assert.match(ekspose.link, /^https:\/\//);
    const [h1, m1] = ekspose.jam.split(':').map(Number);
    const [h2, m2] = ekspose.jamSelesai.split(':').map(Number);
    assert.equal(h2 * 60 + m2 - (h1 * 60 + m1), 15);
    const weekday = new Date(`${ekspose.tanggal}T00:00:00Z`).getUTCDay();
    assert.ok(![0, 6].includes(weekday));
  });

  it('slots are unique across pengajuan', async () => {
    const api = createClient();
    const a = await toTerjadwal(api);
    const b = await toTerjadwal(api);
    const ea = (await get(api, `${BASE}/${a}`)).body.data.ekspose;
    const eb = (await get(api, `${BASE}/${b}`)).body.data.ekspose;
    assert.notEqual(ea.noAntrian, eb.noAntrian);
    assert.notDeepEqual([ea.tanggal, ea.jam], [eb.tanggal, eb.jam]);
  });

  it('Reschedule regenerates the slot and keeps history (PK-07)', async () => {
    const api = createClient();
    const id = await toTerjadwal(api);
    const before = (await get(api, `${BASE}/${id}`)).body.data.ekspose;
    const res = await move(api, id, 'Terjadwal');
    assert.equal(res.status, 200);
    const after = res.body.data.ekspose;
    assert.notEqual(after.noAntrian, before.noAntrian);
    assert.equal(after.hasil, 'Reschedule');
    assert.equal(after.riwayatJadwal.at(-1).noAntrian, before.noAntrian);
    assert.equal(res.body.data.status, 'Terjadwal');
  });

  it('Direksi/Komisaris skips ekspose: Terverifikasi -> BAP (PK-08)', async () => {
    const api = createClient();
    const { id } = await createDraft(api, { jenis: DIREKSI,
      isian: { jabatanTka: [{ nama: 'Direktur', jumlahTka: 1 }],
        tanggalMulai: '2026-11-01',
        tanggalSelesai: '2027-11-01', lokasiKerja: 'Kab. Bekasi' },
      dokumen: dokumenLengkap(DIREKSI) });
    await post(api, `${BASE}/${id}/submit`);
    await move(api, id, 'Dalam Verifikasi');
    const res = await move(api, id, 'Terverifikasi');
    assert.equal(res.body.data.bisaSetujuiBap, true);
    assert.equal(res.body.data.ekspose, null);
    assert.equal((await move(api, id, 'Menunggu Jadwal Ekspose')).status, 409);
  });
});

describe('BAP + HPK terbit', () => {
  it('409 while BAP is not available (PK-09)', async () => {
    const res = await post(createClient(), `${BASE}/pk11/bap-approval`, BAP);
    assert.equal(res.status, 409);
  });

  it('requires nama + jabatan penyetuju (400)', async () => {
    const res = await post(createClient(), `${BASE}/pk6/bap-approval`, {});
    assert.equal(res.status, 400);
    assert.ok(res.body.error.fields.namaPenyetuju);
    assert.ok(res.body.error.fields.jabatanPenyetuju);
  });

  it('Layak -> approve BAP -> validasi -> HPK Terbit (PK-10)', async () => {
    const api = createClient();
    const id = await toTerjadwal(api);
    const layak = await move(api, id, 'Selesai Ekspose');
    assert.equal(layak.body.data.ekspose.hasil, 'Ekspose Selesai dan Layak');
    assert.equal(layak.body.data.bisaSetujuiBap, true);
    const bap = await post(api, `${BASE}/${id}/bap-approval`, BAP);
    assert.equal(bap.body.data.status, 'Menunggu Divalidasi');
    assert.equal(bap.body.data.bap.penyetuju.jabatan, 'HRD Manager');
    assert.equal((await post(api, `${BASE}/${id}/bap-approval`, BAP)).status,
      409);
    await move(api, id, 'Tervalidasi');
    const terbit = await move(api, id, 'HPK Terbit');
    assert.equal(terbit.body.data.status, 'HPK Terbit');
    assert.match(terbit.body.data.surat.nomor, /^HPK\//);
  });

  it('notifies the employer on status changes', async () => {
    const api = createClient();
    await toTerjadwal(api);
    const res = await get(api, '/notifikasi', { ...ROLE, status: 'unread' });
    assert.ok(res.body.data.some((n) => /ekspose HPK/i.test(n.judul)));
  });
});

describe('daftar jabatan TKA (lebih dari satu jabatan)', () => {
  const two = [{ nama: 'Production Planner', jumlahTka: 2 },
    { nama: 'Welding Inspector', jumlahTka: 3 }];

  it('menyimpan beberapa jabatan; jabatan & jumlahTka diturunkan', async () => {
    const api = createClient();
    const { id } = await createDraft(api, { jenis: LEBIH6,
      isian: { ...ISIAN, jabatanTka: two } });
    const item = (await api('GET', `${BASE}/${id}`, { query: ROLE })).body.data;
    const f = item.formulir.fields.find((x) => x.kunci === 'jabatanTka');
    assert.deepEqual(f.nilai, two);
    assert.equal(f.tipe, 'daftar-jabatan');
    assert.equal(item.formulir.fields.some((x) => x.kunci === 'jumlahTka'), false);
  });

  it('jabatan unik, jumlah 1–99, nama wajib (path per baris)', async () => {
    const res = await post(createClient(), BASE, { jenis: LEBIH6, isian: {
      jabatanTka: [{ nama: 'Welder', jumlahTka: 1 },
        { nama: 'welder', jumlahTka: 100 }, { nama: ' ', jumlahTka: 1 }] } });
    assert.equal(res.status, 400);
    const e = res.body.error.fields;
    assert.ok(e['isian.jabatanTka.1.nama']);
    assert.ok(e['isian.jabatanTka.1.jumlahTka']);
    assert.ok(e['isian.jabatanTka.2.nama']);
  });
});
