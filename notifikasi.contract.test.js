/**
 * @fileoverview Contract tests — Notifikasi (KAK Modul 7, NT-01..07).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createClient } from './client.js';

const SETTING = {
  aktif: true,
  kanal: { email: true, sms: false, push: false },
  template: 'Permohonan {nomor} telah diterima dan masuk tahap verifikasi.',
};

describe('GET /notifikasi', () => {
  it('requires role', async () => {
    const res = await createClient()('GET', '/notifikasi');
    assert.equal(res.status, 400);
    assert.equal(res.body.error.field, 'role');
  });

  it('lists 12 items per role, newest first, with meta.unread', async () => {
    const res = await createClient()('GET', '/notifikasi',
      { query: { role: 'swasta' } });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 12);
    const unread = res.body.data.filter((x) => !x.dibaca).length;
    assert.equal(res.body.meta.unread, unread);
    assert.ok(res.body.data.every((x) => x.tautan?.page));
    const times = res.body.data.map((x) => Date.parse(x.waktu));
    assert.deepEqual(times, [...times].sort((a, b) => b - a));
  });

  it('status=unread filters to unread items', async () => {
    const res = await createClient()('GET', '/notifikasi',
      { query: { role: 'swasta', status: 'unread' } });
    assert.ok(res.body.data.length > 0);
    assert.ok(res.body.data.every((x) => !x.dibaca));
  });

  it('rejects an unknown status filter', async () => {
    const res = await createClient()('GET', '/notifikasi',
      { query: { role: 'swasta', status: 'baru' } });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.field, 'status');
  });
});

describe('mark notifications read', () => {
  it('POST /notifikasi/:id/read decrements unread', async () => {
    const api = createClient();
    const before = await api('GET', '/notifikasi',
      { query: { role: 'swasta' } });
    const res = await api('POST', '/notifikasi/NT-SW-01/read',
      { query: { role: 'swasta' } });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.dibaca, true);
    const after = await api('GET', '/notifikasi',
      { query: { role: 'swasta' } });
    assert.equal(after.body.meta.unread, before.body.meta.unread - 1);
  });

  it('another role cannot read the item (404)', async () => {
    const res = await createClient()('POST', '/notifikasi/NT-SW-01/read',
      { query: { role: 'lembaga' } });
    assert.equal(res.status, 404);
  });

  it('read-all marks everything and reports the count', async () => {
    const api = createClient();
    const res = await api('POST', '/notifikasi/read-all',
      { query: { role: 'swasta' } });
    assert.equal(res.status, 200);
    assert.ok(res.body.data.updated > 0);
    const after = await api('GET', '/notifikasi',
      { query: { role: 'swasta' } });
    assert.equal(after.body.meta.unread, 0);
    const again = await api('POST', '/notifikasi/read-all',
      { query: { role: 'swasta' } });
    assert.equal(again.body.data.updated, 0);
  });
});

describe('notification settings (admin)', () => {
  it('lists 8 events', async () => {
    const res = await createClient()('GET', '/notification-settings');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 8);
  });

  it('updates an event', async () => {
    const res = await createClient()('PUT',
      '/notification-settings/permohonan-diajukan',
      { body: { ...SETTING, kanal: { email: true, sms: true, push: false } } });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.kanal.sms, true);
  });

  it('active event without any channel -> 400 kanal', async () => {
    const res = await createClient()('PUT',
      '/notification-settings/permohonan-diajukan',
      { body: { ...SETTING, kanal: { email: false, sms: false,
        push: false } } });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.field, 'kanal');
  });

  it('inactive event may have no channel', async () => {
    const res = await createClient()('PUT',
      '/notification-settings/permohonan-diajukan',
      { body: { ...SETTING, aktif: false, kanal: { email: false,
        sms: false, push: false } } });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.aktif, false);
  });

  it('push is not available yet -> 400', async () => {
    const res = await createClient()('PUT',
      '/notification-settings/permohonan-diajukan',
      { body: { ...SETTING, kanal: { email: true, sms: false,
        push: true } } });
    assert.equal(res.status, 400);
    assert.match(res.body.error.message, /aplikasi mobile/);
  });

  it('template shorter than 20 characters -> 400', async () => {
    const res = await createClient()('PUT',
      '/notification-settings/permohonan-diajukan',
      { body: { ...SETTING, template: 'Terlalu pendek' } });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.field, 'template');
  });

  it('reminder events require pengingatHari 1–30', async () => {
    const api = createClient();
    const missing = await api('PUT',
      '/notification-settings/tenggat-perbaikan', { body: SETTING });
    assert.equal(missing.status, 400);
    assert.equal(missing.body.error.field, 'pengingatHari');
    const tooFar = await api('PUT',
      '/notification-settings/tenggat-perbaikan',
      { body: { ...SETTING, pengingatHari: 31 } });
    assert.equal(tooFar.status, 400);
    const okRes = await api('PUT',
      '/notification-settings/tenggat-perbaikan',
      { body: { ...SETTING, pengingatHari: 5 } });
    assert.equal(okRes.status, 200);
    assert.equal(okRes.body.data.pengingatHari, 5);
  });

  it('non-reminder events reject pengingatHari', async () => {
    const res = await createClient()('PUT',
      '/notification-settings/permohonan-diajukan',
      { body: { ...SETTING, pengingatHari: 3 } });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.field, 'pengingatHari');
  });

  it('each event lists its allowed and key template variables', async () => {
    const res = await createClient()('GET', '/notification-settings');
    for (const row of res.body.data) {
      assert.ok(Array.isArray(row.variabel) && row.variabel.length > 0);
      assert.ok(row.variabelWajib.every((v) => row.variabel.includes(v)));
    }
  });

  it('template with an unregistered {variabel} -> 400 template', async () => {
    const res = await createClient()('PUT',
      '/notification-settings/permohonan-diajukan',
      { body: { ...SETTING, template: 'Permohonan {nomor} untuk {rahasia} ' +
        'telah diterima.' } });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.field, 'template');
    assert.match(res.body.error.message, /\{rahasia\}/);
  });

  it('unknown event -> 404', async () => {
    const res = await createClient()('PUT',
      '/notification-settings/tidak-ada', { body: SETTING });
    assert.equal(res.status, 404);
  });
});
