/**
 * @fileoverview Contract tests — menu Pengesahan RPTKA akun Direktur
 * (DP-01..DP-07): RPTKA yang lolos DKPTKA (lunas / bebas) otomatis disetujui
 * dan masuk tabel "Menunggu TTE"; tombol TTE -> "Sudah di TTE" dan surat
 * diterbitkan ke pemberi kerja.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createClient } from './client.js';

const BASE = '/pengesahan-direktur';
const get = (api, path) => api('GET', path);
const tte = (api, id) => api('POST', `${BASE}/${id}/tte`, { body: {} });
const ROLE = { role: 'swasta' };
const Q_ID = 'q-rp3-swasta';

/** rp3 paid by the employer (lunas) and waiting for the Direktur's TTE. */
async function paid(api) {
  await api('POST', '/pengesahan-rptka/rp3/submit', { query: ROLE, body: {} });
  await api('POST', `/pengesahan-verifikasi/${Q_ID}/verify`,
    { body: { tahap: 'verifikasi' } });
  const { billing } = (await api('POST', `/pengesahan-validasi/${Q_ID}/verify`))
    .body.data;
  const bill = (await api('GET', '/billing', { query: ROLE })).body.data
    .find((b) => b.kode === billing.kode);
  await api('POST', `/billing/${bill.id}/confirm-bayar`,
    { query: ROLE, body: { konfirmasi: true } });
}

describe('GET /pengesahan-direktur (tabel)', () => {
  it('lists RPTKA through DKPTKA: Menunggu TTE first, then Sudah di TTE',
    async () => {
      const res = await get(createClient(), BASE);
      assert.equal(res.status, 200);
      const rows = res.body.data;
      const by = Object.fromEntries(rows.map((r) => [r.id, r]));
      assert.ok(by.qd4 && by.qd5);
      assert.ok(!by.qd3, 'qd3 belum lolos DKPTKA');
      assert.equal(by.qd5.status, 'Menunggu TTE');
      assert.equal(by.qd5.statusDkptka, 'Lunas');
      assert.equal(by.qd5.pengesahan, null);
      assert.deepEqual(by.qd5.aksi, { tte: true });
      assert.equal(by.qd4.status, 'Sudah di TTE');
      assert.equal(by.qd4.statusDkptka, 'Bebas DKPTKA');
      assert.match(by.qd4.pengesahan.nomor, /^PENG\//);
      assert.deepEqual(by.qd4.aksi, { tte: false });
      assert.ok(rows.findIndex((r) => r.id === 'qd5') <
        rows.findIndex((r) => r.id === 'qd4'), 'Menunggu TTE di atas');
    });
});

describe('GET /pengesahan-direktur/{id} (detail)', () => {
  it('returns isian, dokumen, DKPTKA and the approval', async () => {
    const d = (await get(createClient(), `${BASE}/qd5`)).body.data;
    assert.ok(d.isian.tka.length > 0 && d.dokumen.length > 0);
    assert.equal(d.dkptka.jumlahTka, 1);
    assert.equal(d.persetujuan.otomatis, true);
    assert.equal(d.pengesahan, null);
  });

  it('404 for unknown id and for rows not yet through DKPTKA', async () => {
    const api = createClient();
    assert.equal((await get(api, `${BASE}/q999`)).status, 404);
    assert.equal((await get(api, `${BASE}/qd3`)).status, 404);
    assert.equal((await tte(api, 'qd3')).status, 404);
  });
});

describe('POST /pengesahan-direktur/{id}/tte', () => {
  it('Menunggu TTE -> Sudah di TTE with nomor, TTE and QR; only once',
    async () => {
      const api = createClient();
      const res = await tte(api, 'qd5');
      assert.equal(res.status, 200, JSON.stringify(res.body));
      const d = res.body.data;
      assert.equal(d.status, 'Sudah di TTE');
      assert.equal(d.tone, 'green');
      assert.match(d.pengesahan.nomor, /^PENG\//);
      assert.equal(d.pengesahan.tte.barcode, `TTE-${d.pengesahan.nomor}`);
      assert.equal(d.pengesahan.tte.oleh, 'Direktur PPTKA');
      assert.ok(d.pengesahan.qr.includes(d.pengesahan.nomor));
      assert.deepEqual(d.aksi, { tte: false });
      const again = await tte(api, 'qd5');
      assert.equal(again.status, 409);
      assert.equal(again.body.error.code, 'INVALID_STATE');
    });

  it('TTE publishes the SK to the employer (stepIdx 6, same document, ' +
    'notification)', async () => {
    const api = createClient();
    await paid(api);
    const before = (await api('GET', '/pengesahan', { query: ROLE }))
      .body.data.filter((p) => p.rptkaId === 'rp3');
    assert.ok(before.every((p) => p.stepIdx === 5 && !p.pengesahan));

    const res = await tte(api, Q_ID);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const rows = (await api('GET', '/pengesahan', { query: ROLE }))
      .body.data.filter((p) => p.rptkaId === 'rp3');
    assert.ok(rows.length > 0);
    for (const p of rows) {
      assert.equal(p.stepIdx, 6);
      assert.equal(p.tone, 'green');
      assert.equal(p.status, 'Pengesahan terbit — sudah di-TTE Direktur');
      assert.deepEqual(p.pengesahan, res.body.data.pengesahan);
    }
    const item = (await api('GET', '/pengesahan-rptka/rp3', { query: ROLE }))
      .body.data;
    assert.equal(item.status, 'Pengesahan terbit — sudah di-TTE Direktur');
    const inbox = (await api('GET', '/notifikasi', { query: ROLE })).body.data;
    assert.ok(inbox.some((n) => /Pengesahan RPTKA terbit/.test(n.judul)));
  });

  it('bebas DKPTKA: Validator verify -> Menunggu TTE -> TTE', async () => {
    const api = createClient();
    await api('POST', '/pengesahan-validasi/q19/verify');
    assert.equal((await get(api, `${BASE}/q19`)).body.data.status,
      'Menunggu TTE');
    assert.equal((await tte(api, 'q19')).body.data.status, 'Sudah di TTE');
  });

  it('records approval (system) and TTE (Direktur) in the audit log',
    async () => {
      const api = createClient();
      await paid(api);
      await tte(api, Q_ID);
      const logs = (await api('GET', '/audit-logs',
        { query: { modul: 'Permohonan' } })).body.data;
      assert.ok(logs.some((e) => e.aksi === 'Setujui' &&
        e.peran.includes('persetujuan otomatis')));
      assert.ok(logs.some((e) => e.aksi === 'Tanda tangan' &&
        e.pengguna === 'Direktur PPTKA'));
    });
});

describe('POST /pengesahan-direktur/tte-semua (TTE otomatis semua)', () => {
  const tteSemua = (api) => api('POST', `${BASE}/tte-semua`, { body: {} });
  const rowsOf = async (api) => (await get(api, BASE)).body.data;

  it('signs every Menunggu TTE row in one call', async () => {
    const api = createClient();
    await paid(api);
    const before = (await rowsOf(api)).filter((r) => r.aksi.tte);
    assert.ok(before.length >= 2, 'qd5 + rp3 menunggu TTE');
    const res = await tteSemua(api);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.jumlah, before.length);
    assert.deepEqual([...res.body.data.ids].sort(),
      before.map((r) => r.id).sort());
    for (const r of res.body.data.rows) {
      assert.equal(r.status, 'Sudah di TTE');
      assert.equal(r.pengesahan.tte.barcode, `TTE-${r.pengesahan.nomor}`);
      assert.deepEqual(r.aksi, { tte: false });
    }
    assert.ok((await rowsOf(api)).every((r) => r.status === 'Sudah di TTE'));
  });

  it('publishes each SK to the employer like the single TTE', async () => {
    const api = createClient();
    await paid(api);
    await tteSemua(api);
    const rows = (await api('GET', '/pengesahan', { query: ROLE }))
      .body.data.filter((p) => p.rptkaId === 'rp3');
    assert.ok(rows.length > 0);
    for (const p of rows) {
      assert.equal(p.stepIdx, 6);
      assert.equal(p.tone, 'green');
    }
  });

  it('409 when nothing waits for TTE; single TTE afterwards is 409',
    async () => {
      const api = createClient();
      await tteSemua(api);
      const res = await tteSemua(api);
      assert.equal(res.status, 409);
      assert.equal(res.body.error.code, 'INVALID_STATE');
      assert.equal((await tte(api, 'qd5')).status, 409);
    });

  it('audits one Tanda tangan per RPTKA by the Direktur', async () => {
    const api = createClient();
    const signed = async () => (await api('GET', '/audit-logs',
      { query: { modul: 'Permohonan' } })).body.data
      .filter((e) => e.aksi === 'Tanda tangan' &&
        e.pengguna === 'Direktur PPTKA' && e.objek.startsWith('Pengesahan'))
      .length;
    const sebelum = await signed();
    const { jumlah } = (await tteSemua(api)).body.data;
    assert.equal(await signed() - sebelum, jumlah);
  });
});

describe('menu Perpanjangan RPTKA (field menu, TTE otomatis semua per menu)',
  () => {
    const tteSemua = (api, body = {}) => api('POST', `${BASE}/tte-semua`,
      { body });
    const rowsOf = async (api) => (await get(api, BASE)).body.data;

    it('tags rows by menu: Perpanjangan seeds qd6 (Menunggu) + qd7 (Sudah)',
      async () => {
        const rows = await rowsOf(createClient());
        const by = Object.fromEntries(rows.map((r) => [r.id, r]));
        assert.equal(by.qd6.menu, 'perpanjangan');
        assert.equal(by.qd6.status, 'Menunggu TTE');
        assert.equal(by.qd7.menu, 'perpanjangan');
        assert.equal(by.qd7.status, 'Sudah di TTE');
        assert.equal(by.qd5.menu, 'pengesahan');
        assert.ok(rows.filter((r) => /^Perpanjangan/.test(r.jenisRptka) &&
          !/Lintas Kab\/Kota/.test(r.jenisRptka))
          .every((r) => r.menu === 'perpanjangan'));
        assert.ok(rows.filter((r) => /Lintas Kab\/Kota/.test(r.jenisRptka))
          .every((r) => r.menu === 'kabkota'));
      });

    it('tte-semua {menu: perpanjangan} signs only Perpanjangan rows',
      async () => {
        const api = createClient();
        const res = await tteSemua(api, { menu: 'perpanjangan' });
        assert.equal(res.status, 200, JSON.stringify(res.body));
        assert.deepEqual(res.body.data.ids, ['qd6']);
        const rows = await rowsOf(api);
        assert.equal(rows.find((r) => r.id === 'qd6').status, 'Sudah di TTE');
        assert.equal(rows.find((r) => r.id === 'qd5').status, 'Menunggu TTE',
          'Pengesahan tidak ikut');
      });

    it('tte-semua {menu: pengesahan} leaves Perpanjangan waiting; then 409 ' +
      'for that menu', async () => {
      const api = createClient();
      const res = await tteSemua(api, { menu: 'pengesahan' });
      assert.equal(res.status, 200);
      assert.ok(res.body.data.ids.includes('qd5') &&
        !res.body.data.ids.includes('qd6'));
      assert.equal((await tteSemua(api, { menu: 'pengesahan' })).status, 409);
      assert.equal((await tteSemua(api, { menu: 'perpanjangan' })).status,
        200);
    });

    it('400 for an unknown menu', async () => {
      const res = await tteSemua(createClient(), { menu: 'lain' });
      assert.equal(res.status, 400);
      assert.ok(res.body.error.fields.menu);
    });

    it('perpanjangan TTE publishes to the employer and syncs live to ' +
      'the Validator view', async () => {
      const api = createClient();
      await api('POST', `${BASE}/qd6/tte`, { body: {} });
      const pengesahan = (await get(api, `${BASE}/qd6`)).body.data;
      assert.equal(pengesahan.menu, 'perpanjangan');
      assert.match(pengesahan.pengesahan.nomor, /^PENG\//);
      const validator = (await api('GET', '/pengesahan-validasi')).body.data
        .find((r) => r.id === 'qd6');
      assert.equal(validator.status, 'Billing terbit');
    });
  });

describe('TTE Direktur -> Visa dan ITAS otomatis di akun pemberi kerja', () => {
  const rp3Rows = async (api) => (await api('GET', '/pengesahan',
    { query: ROLE })).body.data.filter((p) => p.rptkaId === 'rp3');
  const imigrasiIds = async (api) => (await api('GET', '/imigrasi/tka'))
    .body.data.map((r) => r.id);

  it('no Visa/ITAS before TTE; after TTE (single) the employer sees it',
    async () => {
      const api = createClient();
      await paid(api);
      for (const p of await rp3Rows(api)) {
        assert.ok(!p.keimigrasian || p.keimigrasian.visa.status !== 'Visa dan ITAS terbit');
      }
      assert.equal((await tte(api, Q_ID)).status, 200);
      const rows = await rp3Rows(api);
      assert.ok(rows.length > 0);
      for (const p of rows) {
        const { visa, pengesahan } = p.keimigrasian;
        assert.equal(visa.status, 'Visa dan ITAS terbit');
        assert.match(visa.nomorVisa, /^VITAS/);
        assert.match(visa.nomorItas, /^ITAS/);
        assert.ok(visa.berlakuSampai <= visa.maksBerlaku);
        assert.equal(pengesahan.status, 'Diterima Imigrasi');
        assert.equal(p.imigrasi, true);
      }
      const ids = await imigrasiIds(api);
      assert.ok(rows.every((p) => ids.includes(`swasta-${p.id}`)));
    });

  it('notifies the employer and audits the automatic Visa/ITAS',
    async () => {
      const api = createClient();
      await paid(api);
      await tte(api, Q_ID);
      const notif = await api('GET', '/notifikasi', { query: ROLE });
      assert.ok(notif.body.data.some((n) => /Visa dan ITAS terbit/
        .test(n.judul)));
      const logs = (await api('GET', '/audit-logs',
        { query: { modul: 'Permohonan' } })).body.data;
      assert.ok(logs.some((e) => e.pengguna === 'Sistem Imigrasi' &&
        e.aksi === 'Setujui'));
    });

  it('TTE otomatis semua also issues Visa/ITAS; Imigrasi API then 409',
    async () => {
      const api = createClient();
      await paid(api);
      await api('POST', `${BASE}/tte-semua`, { body: {} });
      const [first] = await rp3Rows(api);
      assert.equal(first.keimigrasian.visa.status, 'Visa dan ITAS terbit');
      const again = await api('POST', `/imigrasi/tka/swasta-${first.id}` +
        '/visa-itas', { body: { nomorVisa: 'VITAS26100001',
        nomorItas: 'ITAS26100001A', berlakuSampai: first.keimigrasian.visa
          .maksBerlaku } });
      assert.equal(again.status, 409);
    });
});

describe('menu Perpanjangan Lintas Kab/Kota 1 Provinsi (TTE keseluruhan)', () => {
  const tteSemua = (api, body = {}) => api('POST', `${BASE}/tte-semua`,
    { body });
  const rowsOf = async (api) => (await get(api, BASE)).body.data
    .filter((r) => r.menu === 'kabkota');

  it('lists only Lintas Kab/Kota rows that are through SKRD and paid',
    async () => {
      const rows = await rowsOf(createClient());
      const by = Object.fromEntries(rows.map((r) => [r.id, r]));
      assert.ok(by.qd8 && by.qd9);
      assert.ok(!by.qkk1, 'qkk1 masih Menunggu SKRD Disnaker');
      assert.equal(by.qd8.status, 'Menunggu TTE');
      assert.equal(by.qd8.statusDkptka, 'Lunas');
      assert.equal(by.qd9.status, 'Sudah di TTE');
      assert.ok(rows.every((r) => /Lintas Kab\/Kota/.test(r.jenisRptka)));
    });

  it('TTE keseluruhan: tte-semua {menu: kabkota} signs all of them at once',
    async () => {
      const api = createClient();
      const res = await tteSemua(api, { menu: 'kabkota' });
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.deepEqual(res.body.data.ids, ['qd8']);
      for (const r of res.body.data.rows) {
        assert.equal(r.status, 'Sudah di TTE');
        assert.match(r.pengesahan.nomor, /^PENG\//);
        assert.equal(r.pengesahan.tte.barcode, `TTE-${r.pengesahan.nomor}`);
      }
      const all = (await get(api, BASE)).body.data;
      assert.equal(all.find((r) => r.id === 'qd5').status, 'Menunggu TTE',
        'menu lain tidak ikut');
      assert.equal(all.find((r) => r.id === 'qd6').status, 'Menunggu TTE');
      assert.equal((await tteSemua(api, { menu: 'kabkota' })).status, 409);
    });

  it('end to end: Validator -> Disnaker SKRD -> bayar -> Direktur TTE ->' +
    ' SK terbit ke pemberi kerja', async () => {
    const api = createClient();
    assert.equal((await get(api, `${BASE}/qkk1`)).status, 404,
      'belum SKRD/lunas');
    const skrd = await api('POST', '/skrd-disnaker/qkk1/terbitkan',
      { body: { konfirmasi: true } });
    assert.equal(skrd.status, 200, JSON.stringify(skrd.body));
    const kode = skrd.body.data.skrd.nomor;
    assert.equal((await get(api, `${BASE}/qkk1`)).status, 404,
      'SKRD terbit tetapi belum dibayar');
    const bill = (await api('GET', '/billing', { query: ROLE })).body.data
      .find((b) => b.kode === kode);
    assert.ok(bill, 'tagihan SKRD diterima pemberi kerja');
    await api('POST', `/billing/${bill.id}/confirm-bayar`,
      { query: ROLE, body: { konfirmasi: true, buktiBayar:
        { namaBerkas: 'bukti-transfer-bank-daerah.pdf', ukuranKb: 180,
          berkasId: 'bkt-qkk1' } } });
    const ready = (await get(api, `${BASE}/qkk1`)).body.data;
    assert.equal(ready.menu, 'kabkota');
    assert.equal(ready.status, 'Menunggu TTE');
    const res = await tteSemua(api, { menu: 'kabkota' });
    assert.ok(res.body.data.ids.includes('qkk1'));
    const done = (await get(api, `${BASE}/qkk1`)).body.data;
    assert.equal(done.status, 'Sudah di TTE');
    assert.match(done.pengesahan.nomor, /^PENG\//);
  });
});
