/** @fileoverview Contract tests — TKA Hotline ticket state machine. */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createClient } from './client.js';

const NEW_TIKET = {
  kategori: 'Jabatan tidak tersedia',
  judul: 'Jabatan "Welding Inspector" tidak muncul di pilihan',
  nomorTerkait: '26004518',
  rincian: 'Jabatan Welding Inspector (kuota 1) tidak tersedia.',
  perusahaan: 'PT Nusantara Baja Presisi',
};
const BARU = 'HT-2609-0431';
const DIPROSES_FAJAR = 'HT-2609-0418';
const SELESAI = 'HT-2609-0377';

const act = (api, no, action, agen) =>
  api('POST', `/tiket/${no}/${action}`, { body: { agen } });
const reply = (api, no, sender, author, text = 'Mohon dibantu.') =>
  api('POST', `/tiket/${no}/messages`, { body: { sender, author, text } });

describe('POST /tiket', () => {
  it('creates a Baru ticket with the first message', async () => {
    const api = createClient();
    const res = await api('POST', '/tiket', { body: NEW_TIKET });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.status, 'Baru');
    const msgs = await api('GET', `/tiket/${res.body.data.no}/messages`);
    assert.equal(msgs.body.data.length, 1);
  });

  it('rejects unknown kategori', async () => {
    const res = await createClient()('POST', '/tiket',
      { body: { ...NEW_TIKET, kategori: 'Lainnya' } });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.field, 'kategori');
  });

  it('nomorTerkait must be barcode (<=8) or application no. (12)',
    async () => {
      const res = await createClient()('POST', '/tiket',
        { body: { ...NEW_TIKET, nomorTerkait: '123456789' } });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.field, 'nomorTerkait');
    });
});

describe('ticket transitions', () => {
  it('take: Baru -> Diproses locked to the agent', async () => {
    const res = await act(createClient(), BARU, 'take', 'Maya L.');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, 'Diproses');
    assert.equal(res.body.data.lock, 'Maya L.');
  });

  it('take on a ticket locked by another agent -> 409 TIKET_LOCKED',
    async () => {
      const res = await act(createClient(), DIPROSES_FAJAR, 'take', 'Maya L.');
      assert.equal(res.status, 409);
      assert.equal(res.body.error.code, 'TIKET_LOCKED');
    });

  it('only the locking agent may close', async () => {
    const api = createClient();
    const other = await act(api, DIPROSES_FAJAR, 'close', 'Maya L.');
    assert.equal(other.status, 409);
    const owner = await act(api, DIPROSES_FAJAR, 'close', 'Fajar N.');
    assert.equal(owner.body.data.status, 'Selesai');
  });

  it('reply on Selesai -> 409; reopen -> Diproses', async () => {
    const api = createClient();
    const closed = await reply(api, SELESAI, 'pk', 'Rina Wulandari');
    assert.equal(closed.status, 409);
    const reopened = await act(api, SELESAI, 'reopen', 'Fajar N.');
    assert.equal(reopened.body.data.status, 'Diproses');
    const again = await reply(api, SELESAI, 'pk', 'Rina Wulandari');
    assert.equal(again.status, 201);
  });

  it('agent must hold the lock before replying', async () => {
    const api = createClient();
    const res = await reply(api, BARU, 'agen', 'Fajar N.');
    assert.equal(res.status, 409);
    await act(api, BARU, 'take', 'Fajar N.');
    const ok = await reply(api, BARU, 'agen', 'Fajar N.');
    assert.equal(ok.status, 201);
    assert.equal(ok.body.data.from, 'Fajar N. (Agen)');
  });
});

describe('hotline profile', () => {
  const PROFILE = { penanggungJawab: 'Rina Wulandari',
    telepon: '081287654321', email: 'hrd@nusantarabaja.co.id' };

  it('GET returns the profile (lengkap false before first save)', async () => {
    const res = await createClient()('GET', '/hotline-profiles/nbp.hrd');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.lengkap, false);
  });

  it('PUT saves and marks the profile complete', async () => {
    const res = await createClient()('PUT', '/hotline-profiles/nbp.hrd',
      { body: PROFILE });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.lengkap, true);
  });

  it('PUT validates the phone format (400)', async () => {
    const res = await createClient()('PUT', '/hotline-profiles/nbp.hrd',
      { body: { ...PROFILE, telepon: '12345' } });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.field, 'telepon');
  });

  it('unknown account returns 404', async () => {
    const res = await createClient()('GET', '/hotline-profiles/tidak.ada');
    assert.equal(res.status, 404);
  });
});
