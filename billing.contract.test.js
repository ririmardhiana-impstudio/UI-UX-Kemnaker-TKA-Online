/**
 * @fileoverview Contract tests — billing DKPTKA otomatis + konfirmasi bayar
 * pemberi kerja (`POST /billing/{id}/confirm-bayar`). Billing terbit otomatis
 * saat Validator memverifikasi; konfirmasi bayar menjadikan tagihan Lunas dan
 * memicu persetujuan otomatis SK Pengesahan (menunggu TTE Direktur).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createClient } from './client.js';

const ROLE = { role: 'swasta' };
const Q_ID = 'q-rp3-swasta';
const confirmBayar = (api, id, body = { konfirmasi: true }) =>
  api('POST', `/billing/${id}/confirm-bayar`, { query: ROLE, body });
const billingOf = (api) =>
  api('GET', '/billing', { query: ROLE }).then((res) => res.body.data);

/** Submit rp3 -> Verifikator -> Validator; returns the Validator response. */
async function validated(api) {
  await api('POST', '/pengesahan-rptka/rp3/submit', { query: ROLE, body: {} });
  await api('POST', `/pengesahan-verifikasi/${Q_ID}/verify`,
    { body: { tahap: 'verifikasi' } });
  return api('POST', `/pengesahan-validasi/${Q_ID}/verify`);
}

describe('POST /billing/{id}/confirm-bayar', () => {
  it('400 without the confirmation statement', async () => {
    const res = await confirmBayar(createClient(), 'b1', { konfirmasi: false });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.field, 'konfirmasi');
  });

  it('404 for unknown id', async () => {
    assert.equal((await confirmBayar(createClient(), 'zz')).status, 404);
  });

  it('409 unless Belum dibayar (Kedaluwarsa)', async () => {
    const res = await confirmBayar(createClient(), 'b2'); // seed: Kedaluwarsa
    assert.equal(res.status, 409);
  });

  it('marks a seed bill Lunas (no queue row involved)', async () => {
    const api = createClient();
    const before = (await billingOf(api)).find((b) => b.id === 'b1');
    assert.equal(before.status, 'Belum dibayar');
    const res = await confirmBayar(api, 'b1');
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.status, 'Lunas');
    assert.equal(res.body.data.tone, 'green');
    assert.ok(res.body.data.bayar);
  });

  it('409 when confirmed twice', async () => {
    const api = createClient();
    await confirmBayar(api, 'b1');
    assert.equal((await confirmBayar(api, 'b1')).status, 409);
  });
});

describe('billing terbit otomatis saat Validator memverifikasi', () => {
  it('issues the code with a 5 working-day validity and copies it to the ' +
    'employer', async () => {
    const api = createClient();
    const res = await validated(api);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const d = res.body.data;
    assert.equal(d.status, 'Billing terbit');
    assert.match(d.billing.kode, /^82\d{13}$/);
    assert.equal(d.billing.jumlah, d.dkptka.rupiah);
    assert.equal(d.billing.status, 'Belum dibayar');
    assert.ok(d.billing.berlakuSampai > d.billing.terbit);
    const day = new Date(`${d.billing.berlakuSampai}T00:00:00Z`).getUTCDay();
    assert.ok(![0, 6].includes(day), 'berakhir di hari kerja');
    const bill = (await billingOf(api)).find((b) => b.kode === d.billing.kode);
    assert.equal(bill.status, 'Belum dibayar');
    assert.equal(bill.tka, 'Arjun Nair');
    const inbox = (await api('GET', '/notifikasi', { query: ROLE })).body.data;
    assert.ok(inbox.some((n) => n.kategori === 'Pembayaran' &&
      n.judul.includes('Kode billing DKPTKA terbit')));
  });

  it('exempt employers get no billing and go straight to Menunggu TTE',
    async () => {
      const api = createClient();
      const res = await api('POST', '/pengesahan-validasi/q19/verify');
      assert.equal(res.body.data.status, 'Bebas DKPTKA');
      assert.equal(res.body.data.billing, null);
      const row = (await api('GET', '/pengesahan-direktur/q19')).body.data;
      assert.equal(row.status, 'Menunggu TTE');
    });
});

describe('konfirmasi bayar pemberi kerja -> SK disetujui otomatis', () => {
  async function paid(api) {
    const { billing } = (await validated(api)).body.data;
    const bill = (await billingOf(api)).find((b) => b.kode === billing.kode);
    const res = await confirmBayar(api, bill.id);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    return bill;
  }

  it('bill Lunas, employer rows say Disetujui Direktur — menunggu TTE, ' +
    'surat belum terbit', async () => {
    const api = createClient();
    const bill = await paid(api);
    const after = (await billingOf(api)).find((b) => b.id === bill.id);
    assert.equal(after.status, 'Lunas');
    const rows = (await api('GET', '/pengesahan', { query: ROLE })).body.data
      .filter((p) => p.rptkaId === 'rp3');
    assert.ok(rows.length > 0);
    for (const p of rows) {
      assert.equal(p.stepIdx, 5);
      assert.equal(p.status, 'Disetujui Direktur — menunggu TTE');
      assert.equal(p.pengesahan, undefined, 'belum ada surat sebelum TTE');
    }
    const item = (await api('GET', '/pengesahan-rptka/rp3', { query: ROLE }))
      .body.data;
    assert.equal(item.status, 'Disetujui Direktur — menunggu TTE');
  });

  it('the paid RPTKA lands in the Direktur table as Menunggu TTE',
    async () => {
      const api = createClient();
      await paid(api);
      const rows = (await api('GET', '/pengesahan-direktur')).body.data;
      const row = rows.find((r) => r.id === Q_ID);
      assert.equal(row.status, 'Menunggu TTE');
      assert.equal(row.statusDkptka, 'Lunas');
      assert.equal(row.pengesahan, null);
      assert.deepEqual(row.aksi, { tte: true });
    });
});
