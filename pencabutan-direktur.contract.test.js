/**
 * @fileoverview Contract tests — menu Pencabutan RPTKA akun Direktur
 * (PD-01..PD-05): pengajuan pemberi kerja yang sudah lolos Verifikator dan
 * Validator, Detail, dan TTE otomatis semua (tanpa TTE per baris).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  PENCABUTAN_JENIS, pencabutanDokumenContoh,
} from '../../js/contracts/pengajuan-verifikasi.js';
import { createClient } from './client.js';

const BASE = '/pencabutan-direktur';
const get = (api, path) => api('GET', path);
const tteSemua = (api) => api('POST', `${BASE}/tte-semua`, { body: {} });
const ROLE = { role: 'swasta' };

/** Pemberi kerja ajukan pencabutan TKA `barcode`; return the new id. */
async function submit(api, barcode = '25103377') {
  const res = await api('POST', '/pencabutan', { body: { role: 'swasta',
    barcode, jenis: PENCABUTAN_JENIS[0],
    alasan: 'TKA telah meninggalkan Indonesia.',
    dokumen: pencabutanDokumenContoh(PENCABUTAN_JENIS[0]) } });
  return res;
}

describe('GET /pencabutan-direktur (tabel)', () => {
  it('lists Tervalidasi rows: Menunggu TTE first, then Sudah di TTE',
    async () => {
      const res = await get(createClient(), BASE);
      assert.equal(res.status, 200);
      const rows = res.body.data;
      const by = Object.fromEntries(rows.map((r) => [r.id, r]));
      assert.equal(by.pc901.status, 'Menunggu TTE');
      assert.equal(by.pc901.sk, null);
      assert.equal(by.pc902.status, 'Sudah di TTE');
      assert.match(by.pc902.sk.nomor, /^PCB\//);
      assert.equal(by.pc902.sk.tte.barcode, `TTE-${by.pc902.sk.nomor}`);
      assert.ok(rows.findIndex((r) => r.id === 'pc901') <
        rows.findIndex((r) => r.id === 'pc902'), 'Menunggu TTE di atas');
    });

  it('has no per-row action and no per-row TTE endpoint', async () => {
    const api = createClient();
    const rows = (await get(api, BASE)).body.data;
    assert.ok(rows.every((r) => r.aksi === undefined));
    const res = await api('POST', `${BASE}/pc901/tte`, { body: {} });
    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'ROUTE_NOT_FOUND');
  });
});

describe('GET /pencabutan-direktur/{id} (detail)', () => {
  it('returns isian, dokumen and the sk', async () => {
    const res = await get(createClient(), `${BASE}/pc902`);
    assert.equal(res.status, 200);
    const d = res.body.data;
    assert.ok(d.isian.length >= 8 && d.dokumen.length > 0);
    assert.ok(d.isian.some((i) => i.label === 'Alasan pencabutan'));
    assert.ok(d.sk.qr.includes(d.sk.nomor));
  });

  it('404 for unknown id', async () => {
    assert.equal((await get(createClient(), `${BASE}/pc999`)).status, 404);
  });
});

describe('POST /pencabutan-direktur/tte-semua (TTE keseluruhan)', () => {
  it('signs every Menunggu TTE row at once; employer status Terbit',
    async () => {
      const api = createClient();
      const res = await tteSemua(api);
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.deepEqual(res.body.data.ids, ['pc901']);
      for (const r of res.body.data.rows) {
        assert.equal(r.status, 'Sudah di TTE');
        assert.equal(r.tone, 'green');
        assert.match(r.sk.nomor, /^PCB\//);
        assert.equal(r.sk.tte.oleh, 'Direktur PPTKA');
      }
      const after = (await get(api, BASE)).body.data;
      assert.ok(after.every((r) => r.status === 'Sudah di TTE'));
      const portal = await api('GET', '/pencabutan', { query: ROLE });
      const row = (portal.body.data ?? []).find((r) => r.id === 'pc901');
      assert.equal(row?.status, 'Terbit');
    });

  it('409 when nothing waits for TTE', async () => {
    const api = createClient();
    await tteSemua(api);
    const res = await tteSemua(api);
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'INVALID_STATE');
  });

  it('notifies the employer and audits per pencabutan by the Direktur',
    async () => {
      const api = createClient();
      await get(api, BASE);
      const signed = async () => (await api('GET', '/audit-logs',
        { query: { modul: 'Permohonan' } })).body.data
        .filter((e) => e.aksi === 'Tanda tangan' &&
          e.pengguna === 'Direktur PPTKA' && e.objek.startsWith('Pencabutan'))
        .length;
      const sebelum = await signed();
      const { jumlah } = (await tteSemua(api)).body.data;
      assert.equal(await signed() - sebelum, jumlah);
      const notif = await api('GET', '/notifikasi', { query: ROLE });
      assert.ok(notif.body.data.some((n) => /SK Pencabutan terbit/
        .test(n.judul)));
    });
});

describe('end to end: pemberi kerja -> Verifikator -> Validator -> Direktur',
  () => {
    it('appears only after both verifications, then TTE keseluruhan',
      async () => {
        const api = createClient();
        const made = await submit(api);
        assert.equal(made.status, 201, JSON.stringify(made.body));
        const id = made.body.data.id;
        const ids = async () => (await get(api, BASE)).body.data
          .map((r) => r.id);
        assert.ok(!(await ids()).includes(id), 'baru diajukan');
        assert.equal((await api('POST', `/pencabutan-verifikasi/${id}/verify`))
          .status, 200);
        assert.ok(!(await ids()).includes(id), 'menunggu validasi');
        assert.equal((await api('POST', `/pencabutan-validasi/${id}/validate`))
          .status, 200);
        const ready = (await get(api, `${BASE}/${id}`)).body.data;
        assert.equal(ready.status, 'Menunggu TTE');
        const res = await tteSemua(api);
        assert.ok(res.body.data.ids.includes(id));
        const done = (await get(api, `${BASE}/${id}`)).body.data;
        assert.equal(done.status, 'Sudah di TTE');
        const valid = (await api('GET', `/pencabutan-validasi/${id}`)).body
          .data;
        assert.equal(valid.status, 'Tervalidasi', 'tabel Validator tetap');
      });
  });
