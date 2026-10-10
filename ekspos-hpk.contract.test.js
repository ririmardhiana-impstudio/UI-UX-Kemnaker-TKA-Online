/**
 * @fileoverview Contract tests — akun Petugas Ekspos (EP-01..EP-05): tabel
 * jadwal ekspose, detail + link, Perbaiki Data dan Dokumen, Reschedule,
 * Buat BAP (status menunggu disetujui), akun demo.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createClient } from './client.js';

const BASE = '/ekspos-hpk';
const get = (api, path) => api('GET', path);
const post = (api, path, body = {}) => api('POST', path, { body });

describe('GET /ekspos-hpk (tabel jadwal)', () => {
  it('lists only the ekspose phase, ordered by schedule then antrian',
    async () => {
      const res = await get(createClient(), BASE);
      assert.equal(res.status, 200);
      const rows = res.body.data;
      assert.ok(rows.length >= 5);
      const phase = new Set(['Menunggu Jadwal Ekspose', 'Terjadwal',
        'Selesai Ekspose', 'Ditolak/Perlu Perbaikan']);
      assert.ok(rows.every((r) => phase.has(r.status)));
      const scheduled = rows.filter((r) => r.ekspose);
      const keys = scheduled.map((r) =>
        `${r.ekspose.tanggal} ${r.ekspose.jam} ${r.ekspose.noAntrian}`);
      assert.deepEqual(keys, [...keys].sort());
      assert.equal(rows.at(-1).ekspose, null, 'belum terjadwal paling akhir');
    });

  it('spans both employers (swasta + lembaga)', async () => {
    const roles = new Set((await get(createClient(), BASE))
      .body.data.map((r) => r.role));
    assert.deepEqual([...roles].sort(), ['lembaga', 'swasta']);
  });
});

describe('GET /ekspos-hpk/{id} (detail jadwal + link)', () => {
  it('returns antrian, schedule, link and available actions', async () => {
    const res = await get(createClient(), `${BASE}/pk7`);
    assert.equal(res.status, 200);
    const d = res.body.data;
    assert.match(d.ekspose.noAntrian, /^A-\d{3}$/);
    assert.match(d.ekspose.link, /^https:\/\//);
    assert.deepEqual(d.aksi, { reschedule: true, perbaikan: true, bap: true });
  });

  it('404 for unknown id and for HPK outside the ekspose phase', async () => {
    const api = createClient();
    assert.equal((await get(api, `${BASE}/pk999`)).status, 404);
    assert.equal((await get(api, `${BASE}/pk3`)).status, 404);
  });
});

describe('POST /ekspos-hpk/{id}/reschedule', () => {
  it('creates a new slot and keeps the old one in riwayatJadwal',
    async () => {
      const api = createClient();
      const before = (await get(api, `${BASE}/pk16`)).body.data;
      const res = await post(api, `${BASE}/pk16/reschedule`);
      assert.equal(res.status, 200);
      const d = res.body.data;
      assert.equal(d.status, 'Terjadwal');
      assert.notEqual(d.ekspose.noAntrian, before.ekspose.noAntrian);
      assert.equal(d.ekspose.riwayatJadwal.at(-1).noAntrian,
        before.ekspose.noAntrian);
    });

  it('409 unless Terjadwal', async () => {
    const res = await post(createClient(), `${BASE}/pk6/reschedule`);
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'INVALID_STATE');
  });
});

describe('POST /ekspos-hpk/{id}/perbaikan', () => {
  it('400 when catatan is shorter than 10 characters', async () => {
    const res = await post(createClient(), `${BASE}/pk7/perbaikan`,
      { catatan: 'kurang' });
    assert.equal(res.status, 400);
    assert.ok(res.body.error.fields.catatan);
  });

  it('moves to Perlu Perbaikan, keeps the note, notifies the employer',
    async () => {
      const api = createClient();
      const catatan = 'Uraian jabatan belum sesuai hasil ekspose.';
      const res = await post(api, `${BASE}/pk7/perbaikan`, { catatan });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.status, 'Ditolak/Perlu Perbaikan');
      assert.equal(res.body.data.catatan, catatan);
      assert.equal(res.body.data.hasilStatus, 'Perbaikan data/dokumen');
      assert.deepEqual(res.body.data.aksi,
        { reschedule: false, perbaikan: false, bap: false });
      const notif = await api('GET', '/notifikasi',
        { query: { role: 'swasta' } });
      assert.ok(notif.body.data.some((n) => /perlu diperbaiki/i.test(n.judul)));
    });
});

describe('POST /ekspos-hpk/{id}/bap', () => {
  it('issues a BAP waiting for approval (Selesai Ekspose)', async () => {
    const api = createClient();
    const res = await post(api, `${BASE}/pk7/bap`);
    assert.equal(res.status, 200);
    const d = res.body.data;
    assert.equal(d.status, 'Selesai Ekspose');
    assert.equal(d.hasilStatus, 'BAP menunggu disetujui');
    assert.equal(d.bap.disetujui, false);
    assert.match(d.bap.nomor, /^BAP\/HPK\//);
    assert.equal((await post(api, `${BASE}/pk7/bap`)).status, 409);
  });

  it('the employer can then approve the BAP (portal route)', async () => {
    const api = createClient();
    await post(api, `${BASE}/pk7/bap`);
    const res = await api('POST', '/penilaian-kelayakan/pk7/bap-approval', {
      query: { role: 'swasta' },
      body: { namaPenyetuju: 'Rina Wulandari',
        jabatanPenyetuju: 'HRD Manager' } });
    assert.equal(res.status, 200);
    assert.equal((await get(api, `${BASE}/pk7`)).status, 404,
      'keluar dari fase ekspose setelah BAP disetujui');
  });

  it('records the actions in the audit log as Petugas Ekspos', async () => {
    const api = createClient();
    await post(api, `${BASE}/pk7/bap`);
    const res = await api('GET', '/audit-logs',
      { query: { pengguna: 'Bayu' } });
    assert.ok(res.body.data.some((e) => e.aksi === 'Buat' &&
      e.peran === 'Petugas Ekspos' && e.objek.includes('HPK-2609-0007')));
  });
});

describe('akun demo Petugas Ekspos', () => {
  it('petugas.ekspos logs in with kind petugas-ekspos', async () => {
    const res = await post(createClient(), '/auth/login',
      { username: 'petugas.ekspos', password: 'ekspos2026' });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.kind, 'petugas-ekspos');
  });
});
