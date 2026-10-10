/**
 * @fileoverview Contract tests — akun Simponi (SM-01..SM-07): permintaan
 * billing DKPTKA dari TKA Online, perhitungan nominal, masa berlaku billing,
 * penerbitan kode, sinkronisasi ke akun pemberi kerja, dan konfirmasi
 * pembayaran (NTPN, status Lunas).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createClient } from './client.js';

const BASE = '/simponi-billing';
const get = (api, path) => api('GET', path);
const issue = (api, id, body = { konfirmasi: true }) =>
  api('POST', `${BASE}/${id}/issue`, { body });
const confirm = (api, id, body = { konfirmasi: true, bank: 'BNI' }) =>
  api('POST', `${BASE}/${id}/confirm-payment`, { body });
const validate = (api, id) => api('POST', `/pengesahan-validasi/${id}/verify`);
const billingOf = (api, role) =>
  api('GET', '/billing', { query: { role } }).then((res) => res.body.data);

describe('GET /simponi-billing (SM-01)', () => {
  it('lists the requests forwarded by the Validator', async () => {
    const api = createClient();
    const seeded = (await get(api, BASE)).body.data;
    assert.ok(seeded.some((r) => r.id === 'qd3' &&
      r.status === 'Menunggu diterbitkan' && r.kode === ''));
    assert.equal((await get(api, `${BASE}/q20`)).status, 404, 'belum diverifikasi');
    await validate(api, 'q20');
    const rows = (await get(api, BASE)).body.data;
    const row = rows.find((r) => r.id === 'q20');
    assert.deepEqual([row.jumlahTka, row.bulan, row.rupiah], [1, 12, 18000000]);
    assert.ok(row.tanggalDiterima);
  });

  it('exempt employers never reach Simponi', async () => {
    const api = createClient();
    await validate(api, 'q19');
    assert.equal((await get(api, `${BASE}/q19`)).status, 404);
  });
});

describe('GET /simponi-billing/{id} (SM-02, SM-03)', () => {
  it('returns the DKPTKA calculation, integration and validity', async () => {
    const res = await get(createClient(), `${BASE}/qd3`);
    assert.equal(res.status, 200);
    const d = res.body.data;
    assert.equal(d.dkptka.rupiah, d.dkptka.jumlahTka * d.dkptka.bulan * 1500000);
    assert.equal(d.integrasi.tujuan, 'Simponi');
    assert.equal(d.masaBerlaku.hari, 5);
    assert.equal(d.masaBerlaku.final, false);
    assert.deepEqual(d.aksi, { terbitkan: true, konfirmasi: false });
  });

  it('404 for unknown id', async () => {
    assert.equal((await get(createClient(), `${BASE}/q999`)).status, 404);
  });
});

describe('POST /simponi-billing/{id}/issue (SM-04, SM-05)', () => {
  it('400 without the confirmation statement', async () => {
    const res = await issue(createClient(), 'qd3', { konfirmasi: false });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.field, 'konfirmasi');
  });

  it('issues the code with a 5 working-day validity, only once', async () => {
    const api = createClient();
    const res = await issue(api, 'qd3');
    assert.equal(res.status, 200);
    const d = res.body.data;
    assert.equal(d.status, 'Billing terbit');
    assert.match(d.billing.kode, /^82\d{13}$/);
    assert.equal(d.billing.jumlah, d.dkptka.rupiah);
    assert.equal(d.billing.tujuan, 'Simponi');
    assert.ok(d.billing.berlakuSampai > d.billing.terbit);
    assert.equal(d.masaBerlaku.final, true);
    const day = new Date(`${d.billing.berlakuSampai}T00:00:00Z`).getUTCDay();
    assert.ok(![0, 6].includes(day), 'berakhir di hari kerja');
    assert.equal((await issue(api, 'qd3')).status, 409);
  });

  it('shows the issued code to the Validator and notifies the employer',
    async () => {
      const api = createClient();
      await issue(api, 'qd3');
      const row = (await get(api, '/pengesahan-validasi/qd3')).body.data;
      assert.equal(row.status, 'Billing terbit');
      assert.equal(row.billing.kode.length, 15);
      const inbox = (await api('GET', '/notifikasi',
        { query: { role: 'swasta' } })).body.data;
      assert.ok(inbox.some((n) => n.kategori === 'Pembayaran' &&
        n.judul.includes('P-26091502')));
    });

  it('records the issue in the audit log as Simponi', async () => {
    const api = createClient();
    await issue(api, 'qd3');
    const res = await api('GET', '/audit-logs', {
      query: { pengguna: 'Simponi' } });
    assert.ok(res.body.data.some((e) => e.aksi === 'Setujui' &&
      e.objek.startsWith('Pengesahan')));
  });

  it('syncs one billing row per TKA to the employer account (SM-06)',
    async () => {
      const api = createClient();
      await validate(api, 'q20'); // pemohon: PT Nusantara Baja Presisi
      // `GET /billing` returns a live reference into the store, so the
      // count must be snapshotted into a plain number right away —
      // otherwise `before` and `after` end up aliasing the same
      // (by-then-mutated) array.
      const beforeCount = (await billingOf(api, 'swasta')).length;
      const issued = (await issue(api, 'q20')).body.data;
      const after = await billingOf(api, 'swasta');
      assert.equal(after.length, beforeCount + 1);
      const row = after.find((b) => b.kode === issued.billing.kode);
      assert.ok(row, 'baris billing baru tidak ditemukan di akun pemberi kerja');
      assert.equal(row.status, 'Belum dibayar');
      assert.equal(row.ntpn, '—');
      assert.equal(row.rupiah, issued.dkptka.tarif * row.bulan);
    });

  it('falls back to swasta when pemohon has no portal account (SM-06)',
    async () => {
      const api = createClient();
      const beforeCount = (await billingOf(api, 'swasta')).length;
      await issue(api, 'qd3'); // pemohon: PT Batam Shipyard Nusantara
      const after = await billingOf(api, 'swasta');
      assert.equal(after.length, beforeCount + 1);
    });

  it('also links the matching Pengesahan RPTKA row (SM-06)', async () => {
    const api = createClient();
    await validate(api, 'q20'); // tka: Park Ji-won, pemohon swasta
    const issued = (await issue(api, 'q20')).body.data;
    const rows = (await api('GET', '/pengesahan',
      { query: { role: 'swasta' } })).body.data;
    const row = rows.find((p) => p.nama === 'Park Ji-won');
    assert.equal(row.billing, 'b-q20-0');
    const billing = (await billingOf(api, 'swasta'))
      .find((b) => b.id === row.billing);
    assert.equal(billing.kode, issued.billing.kode);
  });

  it('leaves unmatched Pengesahan RPTKA rows untouched (SM-06)', async () => {
    const api = createClient();
    const before = (await api('GET', '/pengesahan',
      { query: { role: 'swasta' } })).body.data
      .filter((p) => Boolean(p.billing)).length;
    await issue(api, 'qd3'); // pemohon: PT Batam Shipyard Nusantara
    const after = (await api('GET', '/pengesahan',
      { query: { role: 'swasta' } })).body.data
      .filter((p) => Boolean(p.billing)).length;
    assert.equal(after, before);
  });
});

describe('POST /simponi-billing/{id}/confirm-payment (SM-07)', () => {
  it('409 before the billing code is issued', async () => {
    const res = await confirm(createClient(), 'qd3');
    assert.equal(res.status, 409);
  });

  it('400 without the confirmation statement', async () => {
    const api = createClient();
    await issue(api, 'qd3');
    const res = await confirm(api, 'qd3', { konfirmasi: false, bank: 'BNI' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.field, 'konfirmasi');
  });

  it('issues an NTPN, marks Lunas, and updates the employer billing row too',
    async () => {
      const api = createClient();
      await validate(api, 'q20');
      const issued = (await issue(api, 'q20')).body.data;
      const confirmed = (await confirm(api, 'q20',
        { konfirmasi: true, bank: 'Bank Mandiri' })).body.data;
      assert.equal(confirmed.status, 'Lunas');
      assert.equal(confirmed.billing.status, 'Lunas');
      assert.equal(confirmed.billing.bank, 'Bank Mandiri');
      assert.match(confirmed.billing.ntpn, /^[A-Z0-9]{8,16}$/);
      assert.deepEqual(confirmed.aksi, { terbitkan: false, konfirmasi: false });

      const rows = await billingOf(api, 'swasta');
      const row = rows.find((b) => b.kode === issued.billing.kode);
      assert.equal(row.status, 'Lunas');
      assert.equal(row.ntpn, confirmed.billing.ntpn);
      assert.equal(row.bank, 'Bank Mandiri');
    });

  it('409 when confirming twice', async () => {
    const api = createClient();
    await issue(api, 'qd3');
    await confirm(api, 'qd3');
    assert.equal((await confirm(api, 'qd3')).status, 409);
  });

  it('notifies the employer when payment is confirmed', async () => {
    const api = createClient();
    await issue(api, 'qd3');
    await confirm(api, 'qd3');
    const inbox = (await api('GET', '/notifikasi',
      { query: { role: 'swasta' } })).body.data;
    assert.ok(inbox.some((n) => n.kategori === 'Pembayaran' &&
      n.judul.includes('terkonfirmasi')));
  });
});
