/**
 * @fileoverview Contract tests — sinkronisasi status "Daftar Pengesahan
 * RPTKA" di akun pemberi kerja (store.pengesahan[role]) seiring antrian
 * back office berjalan lewat Verifikator -> Validator -> billing otomatis -> TTE.
 * Memakai Draf Form RPTKA seed `rp3` (role swasta, lengkap, siap submit —
 * lihat pengesahan-rptka.contract.test.js "Draf lengkap -> Menunggu
 * Verifikasi") supaya antrian & baris pemberi kerja tertaut lewat
 * `rptkaId`, bukan pencocokan nama yang rapuh.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createClient } from './client.js';

const ROLE = { role: 'swasta' };
const Q_ID = 'q-rp3-swasta';

async function submitRp3(api) {
  const res = await api('POST', '/pengesahan-rptka/rp3/submit',
    { query: ROLE, body: {} });
  assert.equal(res.status, 200, JSON.stringify(res.body));
}

async function pengRows(api) {
  return (await api('GET', '/pengesahan', { query: ROLE })).body.data
    .filter((p) => p.rptkaId === 'rp3');
}

describe('sinkronisasi Daftar Pengesahan RPTKA (pemberi kerja)', () => {
  it('submit: baris pemberi kerja mulai di Menunggu Verifikasi (stepIdx 1)',
    async () => {
      const api = createClient();
      await submitRp3(api);
      const rows = await pengRows(api);
      assert.ok(rows.length > 0);
      for (const p of rows) {
        assert.equal(p.stepIdx, 1);
        assert.equal(p.status, 'Menunggu Verifikasi');
      }
    });

  it('Verifikator verifikasi -> Pemeriksaan Subkoordinator (stepIdx 2)',
    async () => {
      const api = createClient();
      await submitRp3(api);
      const res = await api('POST',
        `/pengesahan-verifikasi/${Q_ID}/verify`,
        { body: { tahap: 'verifikasi' } });
      assert.equal(res.status, 200, JSON.stringify(res.body));
      for (const p of await pengRows(api)) {
        assert.equal(p.stepIdx, 2);
        assert.equal(p.status, 'Pemeriksaan Subkoordinator');
        assert.equal(p.tone, 'blue');
      }
    });

  it('Verifikator tolak -> Perbaikan (merah, stepIdx tetap 1); submit ' +
    'ulang -> amber lagi', async () => {
    const api = createClient();
    await submitRp3(api);
    await api('POST', `/pengesahan-verifikasi/${Q_ID}/reject`,
      { body: { tahap: 'verifikasi', alasan: 'Paspor tidak terbaca; ' +
        'unggah ulang pindaian berwarna.' } });
    for (const p of await pengRows(api)) {
      assert.equal(p.stepIdx, 1);
      assert.equal(p.tone, 'red');
      assert.match(p.status, /tidak disetujui/);
    }
    await api('POST', `/pengesahan-verifikasi/${Q_ID}/resubmit`,
      { body: { tahap: 'verifikasi' } });
    for (const p of await pengRows(api)) {
      assert.equal(p.stepIdx, 1);
      assert.equal(p.tone, 'amber');
      assert.equal(p.status, 'Verifikasi Data dan Upload');
    }
  });

  it('Validator verifikasi -> billing terbit otomatis (stepIdx 5, ' +
    'Menunggu pembayaran DKPTKA, p.billing tertaut)', async () => {
    const api = createClient();
    await submitRp3(api);
    await api('POST', `/pengesahan-verifikasi/${Q_ID}/verify`,
      { body: { tahap: 'verifikasi' } });
    const res = await api('POST', `/pengesahan-validasi/${Q_ID}/verify`);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.status, 'Billing terbit');
    for (const p of await pengRows(api)) {
      assert.equal(p.stepIdx, 5);
      assert.equal(p.status, 'Menunggu pembayaran DKPTKA');
      assert.equal(p.tone, 'amber');
      assert.ok(p.billing, 'p.billing harus tertaut ke baris billing baru');
      const bill = (await api('GET', '/billing', { query: ROLE })).body.data
        .find((b) => b.id === p.billing);
      assert.equal(bill.kode, res.body.data.billing.kode);
    }
  });

  it('Validator tolak -> Perbaikan (stepIdx 2, merah); submit ulang -> ' +
    'Pemeriksaan Subkoordinator lagi', async () => {
    const api = createClient();
    await submitRp3(api);
    await api('POST', `/pengesahan-verifikasi/${Q_ID}/verify`,
      { body: { tahap: 'verifikasi' } });
    await api('POST', `/pengesahan-validasi/${Q_ID}/reject`,
      { body: { alasan: 'Data pengurus belum lengkap; lengkapi lalu ' +
        'submit ulang.' } });
    for (const p of await pengRows(api)) {
      assert.equal(p.stepIdx, 2);
      assert.equal(p.tone, 'red');
      assert.match(p.status, /tidak disetujui/);
    }
    await api('POST', `/pengesahan-verifikasi/${Q_ID}/resubmit`,
      { body: { tahap: 'billing' } });
    for (const p of await pengRows(api)) {
      assert.equal(p.stepIdx, 2);
      assert.equal(p.tone, 'blue');
      assert.equal(p.status, 'Pemeriksaan Subkoordinator');
    }
  });

  it('pemberi kerja konfirmasi bayar -> Disetujui Direktur menunggu TTE ' +
    '(stepIdx 5); setelah TTE Direktur -> terbit (stepIdx 6)', async () => {
    const api = createClient();
    await submitRp3(api);
    await api('POST', `/pengesahan-verifikasi/${Q_ID}/verify`,
      { body: { tahap: 'verifikasi' } });
    await api('POST', `/pengesahan-validasi/${Q_ID}/verify`);
    const [first] = await pengRows(api);
    const res = await api('POST', `/billing/${first.billing}/confirm-bayar`,
      { query: ROLE, body: { konfirmasi: true } });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    for (const p of await pengRows(api)) {
      assert.equal(p.stepIdx, 5);
      assert.equal(p.status, 'Disetujui Direktur — menunggu TTE');
      assert.equal(p.pengesahan, undefined);
    }
    const tte = await api('POST', `/pengesahan-direktur/${Q_ID}/tte`,
      { body: {} });
    assert.equal(tte.status, 200, JSON.stringify(tte.body));
    for (const p of await pengRows(api)) {
      assert.equal(p.stepIdx, 6);
      assert.equal(p.status, 'Pengesahan terbit — sudah di-TTE Direktur');
      assert.equal(p.tone, 'green');
      assert.deepEqual(p.pengesahan, tte.body.data.pengesahan);
      assert.match(p.pengesahan.qr, /^TKA-ONLINE\/VERIFIKASI\//);
    }
  });

  it('baris seed lama tanpa rptkaId tetap tertaut lewat nama (q3 -> ' +
    'Tomás Herrera, role pemerintah)', async () => {
    const api = createClient();
    const res = await api('POST', '/pengesahan-verifikasi/q3/reject',
      { body: { tahap: 'verifikasi',
        alasan: 'Paspor tidak terbaca; unggah ulang.' } });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const rows = (await api('GET', '/pengesahan',
      { query: { role: 'pemerintah' } })).body.data
      .filter((p) => p.nama === 'Tomás Herrera');
    assert.ok(rows.length > 0);
    for (const p of rows) {
      assert.equal(p.stepIdx, 1);
      assert.equal(p.tone, 'red');
    }
  });

  it('baris tanpa tautan sama sekali (q20, nama tanpa pasangan) aman: ' +
    'tidak melempar error dan tidak mengubah baris pemberi kerja lain',
    async () => {
      const api = createClient();
      const before = (await api('GET', '/pengesahan', { query: ROLE }))
        .body.data.length;
      const res = await api('POST', '/pengesahan-validasi/q20/verify');
      assert.equal(res.status, 200, JSON.stringify(res.body));
      const after = (await api('GET', '/pengesahan', { query: ROLE }))
        .body.data.length;
      assert.equal(after, before);
    });
});

async function rp3(api) {
  return (await api('GET', '/pengesahan-rptka/rp3', { query: ROLE }))
    .body.data;
}

describe('sinkronisasi pengajuan Form RPTKA (GET /pengesahan-rptka/{id})',
  () => {
    it('frozen sebelumnya: submit saja tetap Menunggu Verifikasi',
      async () => {
        const api = createClient();
        await submitRp3(api);
        const item = await rp3(api);
        assert.equal(item.status, 'Menunggu Verifikasi');
        assert.equal(item.billing, undefined);
      });

    it('ikut maju seiring Verifikator -> Validator -> bayar -> TTE, dan ' +
      'menautkan billing begitu terbit', async () => {
      const api = createClient();
      await submitRp3(api);
      await api('POST', `/pengesahan-verifikasi/${Q_ID}/verify`,
        { body: { tahap: 'verifikasi' } });
      assert.equal((await rp3(api)).status, 'Pemeriksaan Subkoordinator');

      const issued = (await api('POST', `/pengesahan-validasi/${Q_ID}/verify`))
        .body.data;
      const afterIssue = await rp3(api);
      assert.equal(afterIssue.status, 'Menunggu pembayaran DKPTKA');
      assert.equal(afterIssue.tone, 'amber');
      assert.ok(Array.isArray(afterIssue.billing) && afterIssue.billing.length,
        'item.billing harus berisi id billing yang baru terbit');
      const bill = (await api('GET', '/billing', { query: ROLE })).body.data
        .find((b) => b.id === afterIssue.billing[0]);
      assert.equal(bill.kode, issued.billing.kode);

      await api('POST', `/billing/${bill.id}/confirm-bayar`,
        { query: ROLE, body: { konfirmasi: true } });
      assert.equal((await rp3(api)).status,
        'Disetujui Direktur — menunggu TTE');

      await api('POST', `/pengesahan-direktur/${Q_ID}/tte`, { body: {} });
      const afterTte = await rp3(api);
      assert.equal(afterTte.status,
        'Pengesahan terbit — sudah di-TTE Direktur');
      assert.equal(afterTte.tone, 'green');
    });
  });
