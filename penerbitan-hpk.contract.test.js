/**
 * @fileoverview Contract tests — akun Direktur (DR-01..DR-06): daftar
 * pemberi kerja Tervalidasi / HPK Terbit, detail, Terbitkan HPK, TTE barcode,
 * akun demo.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createClient } from './client.js';

const BASE = '/penerbitan-hpk';
const get = (api, path) => api('GET', path);
const post = (api, path, body = {}) => api('POST', path, { body });
const terbitkan = (api, id, body = { konfirmasi: true }) =>
  post(api, `${BASE}/${id}/terbitkan`, body);
const tte = (api, id) => post(api, `${BASE}/${id}/tte`);

describe('GET /penerbitan-hpk (tabel daftar pemberi kerja)', () => {
  it('lists only Tervalidasi / HPK Terbit rows with an approved BAP',
    async () => {
      const res = await get(createClient(), BASE);
      assert.equal(res.status, 200);
      const rows = res.body.data;
      assert.ok(rows.length >= 5);
      assert.ok(rows.every((r) => ['Tervalidasi', 'HPK Terbit']
        .includes(r.status) && r.bap.tglSetuju));
      assert.ok(rows.some((r) => r.status === 'Tervalidasi'));
      assert.deepEqual([...new Set(rows.map((r) => r.role))].sort(),
        ['lembaga', 'swasta']);
    });

  it('exposes the TTE state per row (belum / sudah)', async () => {
    const rows = (await get(createClient(), BASE)).body.data;
    const terbit = rows.filter((r) => r.status === 'HPK Terbit');
    assert.ok(terbit.some((r) => r.surat.tte && !r.aksi.tte));
    assert.ok(terbit.some((r) => !r.surat.tte && r.aksi.tte));
    assert.ok(rows.filter((r) => r.status === 'Tervalidasi')
      .every((r) => r.aksi.terbitkan && r.aksi.tte && r.surat === null),
    'Tervalidasi: Terbitkan HPK dan TTE (yang menerbitkan sekaligus)');
  });

  it('excludes HPK still waiting for validation (pk5)', async () => {
    assert.equal((await get(createClient(), `${BASE}/pk5`)).status, 404);
  });
});

describe('GET /penerbitan-hpk/{id} (detail isian + dokumen)', () => {
  it('returns isian, dokumen, BAP and the terbitkan action', async () => {
    const res = await get(createClient(), `${BASE}/pk4`);
    assert.equal(res.status, 200);
    const d = res.body.data;
    assert.ok(d.formulir.fields.length > 4 && d.formulir.dokumen.length > 0);
    assert.equal(d.bap.disetujui, true);
    assert.deepEqual(d.aksi, { terbitkan: true, tte: true });
  });

  it('404 for unknown id', async () => {
    assert.equal((await get(createClient(), `${BASE}/pk999`)).status, 404);
  });
});

describe('POST /penerbitan-hpk/{id}/terbitkan', () => {
  it('400 unless konfirmasi is true', async () => {
    const api = createClient();
    for (const body of [{}, { konfirmasi: false }]) {
      const res = await terbitkan(api, 'pk4', body);
      assert.equal(res.status, 400);
      assert.ok(res.body.error.fields.konfirmasi);
    }
  });

  it('moves to HPK Terbit with a surat number, notifies the employer',
    async () => {
      const api = createClient();
      const res = await terbitkan(api, 'pk4');
      assert.equal(res.status, 200);
      const d = res.body.data;
      assert.equal(d.status, 'HPK Terbit');
      assert.match(d.surat.nomor, /^HPK\//);
      assert.deepEqual(d.aksi, { terbitkan: false, tte: true });
      assert.equal(d.riwayat.at(-1).status, 'HPK Terbit');
      const notif = await api('GET', '/notifikasi',
        { query: { role: 'swasta' } });
      assert.ok(notif.body.data.some((n) => /terbit/i.test(n.judul)));
    });

  it('409 when already terbit', async () => {
    const api = createClient();
    await terbitkan(api, 'pk4');
    const res = await terbitkan(api, 'pk4');
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'INVALID_STATE');
  });

  it('records the penerbitan in the audit log as Direktur', async () => {
    const api = createClient();
    await terbitkan(api, 'pk4');
    const res = await api('GET', '/audit-logs',
      { query: { pengguna: 'Direktur' } });
    assert.ok(res.body.data.some((e) => e.aksi === 'Setujui' &&
      e.objek.includes('HPK-2609-0004')));
  });
});

describe('POST /penerbitan-hpk/{id}/tte (barcode)', () => {
  it('TTE on a Tervalidasi HPK issues it first: HPK Terbit + Sudah di TTE, ' +
    'visible to the employer', async () => {
    const api = createClient();
    const res = await tte(api, 'pk4');
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const d = res.body.data;
    assert.equal(d.status, 'HPK Terbit');
    assert.match(d.surat.nomor, /^HPK\//);
    assert.equal(d.surat.tte.barcode, `TTE-${d.surat.nomor}`);
    assert.deepEqual(d.aksi, { terbitkan: false, tte: false });
    const portal = await api('GET', '/penilaian-kelayakan/pk4',
      { query: { role: 'swasta' } });
    assert.equal(portal.body.data.status, 'HPK Terbit');
    assert.equal(portal.body.data.surat.nomor, d.surat.nomor);
    assert.ok(portal.body.data.surat.tte.barcode);
    const notif = await api('GET', '/notifikasi',
      { query: { role: 'swasta' } });
    assert.ok(notif.body.data.some((n) => /Surat HPK terbit/i.test(n.judul) &&
      n.judul.includes('HPK-2609-0004')));
  });

  it('runs TTE on an issued HPK: barcode, riwayat, audit, notifikasi',
    async () => {
      const api = createClient();
      const res = await tte(api, 'pk3');
      assert.equal(res.status, 200);
      const d = res.body.data;
      assert.equal(d.surat.tte.barcode, `TTE-${d.surat.nomor}`);
      assert.equal(d.surat.tte.oleh, 'Direktur PPTKA');
      assert.deepEqual(d.aksi, { terbitkan: false, tte: false });
      const audit = await api('GET', '/audit-logs',
        { query: { pengguna: 'Direktur' } });
      assert.ok(audit.body.data.some((e) => e.aksi === 'Tanda tangan' &&
        e.objek.includes('HPK-2609-0003')));
    });

  it('409 when TTE already ran (pk1 is seeded with TTE)', async () => {
    const api = createClient();
    assert.equal((await tte(api, 'pk1')).status, 409);
    await tte(api, 'pk3');
    assert.equal((await tte(api, 'pk3')).status, 409);
  });

  it('the issued surat carries the TTE in the employer portal', async () => {
    const api = createClient();
    await tte(api, 'pk3');
    const res = await api('GET', '/penilaian-kelayakan/pk3',
      { query: { role: 'swasta' } });
    assert.ok(res.body.data.surat.tte.barcode);
  });

  it('404 for unknown id', async () => {
    assert.equal((await tte(createClient(), 'pk999')).status, 404);
  });
});

describe('POST /penerbitan-hpk/tte-semua (TTE otomatis semua)', () => {
  const tteSemua = (api) => post(api, `${BASE}/tte-semua`);
  const rowsOf = async (api) => (await get(api, BASE)).body.data;

  it('runs TTE on every HPK without TTE in one call', async () => {
    const api = createClient();
    const before = (await rowsOf(api)).filter((r) => r.aksi.tte);
    assert.ok(before.some((r) => r.status === 'HPK Terbit') &&
      before.some((r) => r.status === 'Tervalidasi'),
    'seed memuat HPK Tervalidasi dan HPK Terbit belum ber-TTE');
    const res = await tteSemua(api);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.jumlah, before.length);
    assert.deepEqual([...res.body.data.ids].sort(),
      before.map((r) => r.id).sort());
    assert.ok(res.body.data.rows.every((r) => r.surat.tte.barcode ===
      `TTE-${r.surat.nomor}` && r.aksi.tte === false));
    const after = await rowsOf(api);
    assert.ok(after.every((r) => r.status === 'HPK Terbit' && r.surat.tte &&
      !r.aksi.tte), 'semua terbit dan Sudah di TTE');
  });

  it('auto-issues Tervalidasi HPK: they appear in each employer account',
    async () => {
      const api = createClient();
      const res = await tteSemua(api);
      assert.ok(res.body.data.ids.includes('pk4'), 'swasta Tervalidasi');
      assert.ok(res.body.data.ids.includes('pk22'), 'lembaga Tervalidasi');
      for (const [role, id] of [['swasta', 'pk4'], ['lembaga', 'pk22']]) {
        const portal = await api('GET', `/penilaian-kelayakan/${id}`,
          { query: { role } });
        assert.equal(portal.body.data.status, 'HPK Terbit', role);
        assert.match(portal.body.data.surat.nomor, /^HPK\//);
        assert.ok(portal.body.data.surat.tte.barcode, role);
      }
    });

  it('409 when nothing is waiting for TTE', async () => {
    const api = createClient();
    await tteSemua(api);
    const res = await tteSemua(api);
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'INVALID_STATE');
  });

  it('single TTE after TTE semua is 409 (no double signing)', async () => {
    const api = createClient();
    await tteSemua(api);
    assert.equal((await tte(api, 'pk3')).status, 409);
  });

  it('audits and notifies per HPK like the single TTE', async () => {
    const api = createClient();
    const signed = async () => (await api('GET', '/audit-logs',
      { query: { pengguna: 'Direktur' } })).body.data
      .filter((e) => e.aksi === 'Tanda tangan').length;
    const sebelum = await signed();
    const { jumlah } = (await tteSemua(api)).body.data;
    assert.equal(await signed() - sebelum, jumlah);
    const notif = await api('GET', '/notifikasi',
      { query: { role: 'swasta' } });
    assert.ok(notif.body.data.some((n) => /bertanda tangan elektronik/i
      .test(n.judul)));
  });
});

describe('akun demo Direktur', () => {
  it('direktur.pptka logs in with kind direktur-hpk', async () => {
    const res = await post(createClient(), '/auth/login',
      { username: 'direktur.pptka', password: 'direktur2026' });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.kind, 'direktur-hpk');
  });
});
