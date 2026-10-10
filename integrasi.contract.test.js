/**
 * @fileoverview Contract tests — cross-module side effects: back-office and
 * life-cycle decisions append audit log entries (SC-01) and notify the
 * employer (SK-07, NT-03).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createClient } from './client.js';

const KP = { barcode: '25118840', dasar: 'Hasil pengawasan',
  uraian: 'Hasil pengawasan: TKA bekerja di luar jabatan yang disahkan.',
  lampiranNama: 'bap-pengawasan.pdf' };

async function latestAudit(api, query) {
  const res = await api('GET', '/audit-logs', { query });
  assert.equal(res.status, 200);
  return res.body.data[0];
}

describe('Audit log integration (SC-01)', () => {
  it('an antrian decision is logged with the stage change', async () => {
    const api = createClient();
    const res = await api('POST', '/antrian/q2/decision', { body: {
      decision: 'setujui', tahap: 'Verifikasi Data dan Upload', catatan: '',
    } });
    assert.equal(res.status, 200);
    const entry = await latestAudit(api, { modul: 'Back Office',
      aksi: 'Setujui' });
    assert.equal(entry.perubahan[0].field, 'tahap');
    assert.equal(entry.perubahan[0].sebelum, 'Verifikasi Data dan Upload');
    assert.equal(entry.perubahan[0].sesudah, res.body.data.tahap);
    const integrity = await api('GET', '/audit-logs/integrity');
    assert.equal(integrity.body.data.valid, true);
  });

  it('a pemda payment validation is logged', async () => {
    const api = createClient();
    const res = await api('POST', '/pemda-validations/d1/decision',
      { body: { decision: 'Ditolak' } });
    assert.equal(res.status, 200);
    const entry = await latestAudit(api, { modul: 'Pembayaran',
      aksi: 'Tolak' });
    assert.equal(entry.perubahan[0].sesudah, 'Ditolak');
  });
});

describe('Pencabutan & surat keterangan side effects (SK-07)', () => {
  it('Dirjen approval is audited and notifies the employer', async () => {
    const api = createClient();
    const usulan = await api('POST', '/keputusan-pencabutan', { body: KP });
    assert.equal(usulan.status, 201);
    const { id, role } = usulan.body.data;
    const before = await api('GET', '/notifikasi', { query: { role } });
    const res = await api('POST', `/keputusan-pencabutan/${id}/decision`,
      { body: { decision: 'setujui' } });
    assert.equal(res.status, 200);
    const entry = await latestAudit(api, { aksi: 'Setujui',
      pengguna: 'Direktur Jenderal' });
    assert.match(entry.objek, new RegExp(KP.barcode));
    const after = await api('GET', '/notifikasi', { query: { role } });
    assert.equal(after.body.meta.unread, before.body.meta.unread + 1);
    assert.equal(after.body.data[0].tautan.page, 'pencabutan');
  });

  it('an issued surat keterangan notifies the employer', async () => {
    const api = createClient();
    const query = { role: 'swasta' };
    const created = await api('POST', '/surat-keterangan', { query, body: {
      jenis: 'Keterangan Status Pengesahan RPTKA',
      keperluan: 'Persyaratan perpanjangan izin tinggal di Imigrasi.',
      barcode: '24871365' } });
    assert.equal(created.status, 201);
    const { id } = created.body.data;
    for (const status of ['Diproses', 'Terbit']) {
      const res = await api('POST', `/surat-keterangan/${id}/transition`,
        { query, body: { status } });
      assert.equal(res.status, 200);
    }
    const inbox = await api('GET', '/notifikasi', { query });
    assert.deepEqual(inbox.body.data[0].tautan,
      { page: 'suratKeterangan', params: { id } });
  });
});
