/**
 * @fileoverview Contract tests — back-office decisions, TTE, rantai
 * persetujuan Gabungan (Direktur -> Direktur Jenderal), ekspos daring +
 * BAP, anotasi dokumen, pendaftar.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createClient } from './client.js';

const VERIF = 'Verifikasi Data dan Upload';
const DIRJEN = 'Persetujuan Direktur Jenderal';
const decide = (api, id, body) =>
  api('POST', `/antrian/${id}/decision`, { body });

describe('POST /antrian/{id}/decision', () => {
  it('setujui moves an HPK to Jadwal Ekspos', async () => {
    const res = await decide(createClient(), 'q2',
      { decision: 'setujui', tahap: VERIF });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.tahap, 'Jadwal Ekspos');
  });

  it('kembalikan requires catatan (400)', async () => {
    const res = await decide(createClient(), 'q2',
      { decision: 'kembalikan', tahap: VERIF });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.field, 'catatan');
  });

  it('kembalikan from the first stage returns to the applicant', async () => {
    const res = await decide(createClient(), 'q2', { decision: 'kembalikan',
      tahap: VERIF, catatan: 'Uraian jabatan kurang dari 350 karakter.' });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.returnedToApplicant, true);
    assert.equal(res.body.data.sla, 'Dikembalikan');
  });

  it('kembalikan from a later stage goes one stage back', async () => {
    const res = await decide(createClient(), 'q8', { decision: 'kembalikan',
      tahap: 'Pemeriksaan Kasi', catatan: 'Draft surat perlu diperbaiki.' });
    assert.equal(res.body.data.tahap, 'Jadwal Ekspos');
  });

  it('stale tahap is rejected (409)', async () => {
    const api = createClient();
    await decide(api, 'q2', { decision: 'setujui', tahap: VERIF });
    const res = await decide(api, 'q2', { decision: 'setujui', tahap: VERIF });
    assert.equal(res.status, 409);
  });

  it('unknown id returns 404', async () => {
    const res = await decide(createClient(), 'zz',
      { decision: 'setujui', tahap: VERIF });
    assert.equal(res.status, 404);
  });
});

describe('POST /antrian/signatures', () => {
  it('signs director-stage items and forwards them to the Dirjen', async () => {
    const res = await createClient()('POST', '/antrian/signatures',
      { body: { ids: ['q7', 'q10'], passphrase: 'rahasia-tte' } });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.signed, 2);
    assert.equal(res.body.data.forwardedToDirjen, 2);
    assert.deepEqual(res.body.data.rows.map((r) => r.tahap), [DIRJEN, DIRJEN]);
    assert.equal(res.body.data.billingTka, undefined);
  });

  it('a signed Perubahan is issued directly (no Dirjen stage)', async () => {
    const api = createClient();
    for (const tahap of ['Pemeriksaan Petugas', 'Pemeriksaan Subkoordinator',
      'Pemeriksaan Koordinator']) {
      await decide(api, 'q11', { decision: 'setujui', tahap });
    }
    const res = await api('POST', '/antrian/signatures',
      { body: { ids: ['q11'], passphrase: 'rahasia-tte' } });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.rows[0].tahap, 'Terbit');
    assert.equal(res.body.data.forwardedToDirjen, 0);
  });

  it('passphrase min. 6 characters (400)', async () => {
    const res = await createClient()('POST', '/antrian/signatures',
      { body: { ids: ['q7'], passphrase: '123' } });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.field, 'passphrase');
  });

  it('refuses items outside the director stage (409)', async () => {
    const res = await createClient()('POST', '/antrian/signatures',
      { body: { ids: ['q7', 'q1'], passphrase: 'rahasia-tte' } });
    assert.equal(res.status, 409);
    assert.deepEqual(res.body.error.ids, ['q1']);
  });

  it('requires at least one id (400)', async () => {
    const res = await createClient()('POST', '/antrian/signatures',
      { body: { ids: [], passphrase: 'rahasia-tte' } });
    assert.equal(res.status, 400);
  });
});

describe('rantai Gabungan — Persetujuan Direktur Jenderal', () => {
  it('GET /antrian?tahap= lists seeded Dirjen items', async () => {
    const res = await createClient()('GET', '/antrian',
      { query: { tahap: DIRJEN } });
    assert.equal(res.status, 200);
    assert.ok(res.body.data.length >= 3);
    assert.ok(res.body.data.every((q) => q.tahap === DIRJEN));
  });

  it('director decision on an HPK moves it to the Dirjen', async () => {
    const res = await decide(createClient(), 'q10', { decision: 'setujui',
      tahap: 'Pemeriksaan dan Penandatanganan Direktur' });
    assert.equal(res.body.data.tahap, DIRJEN);
    assert.equal(res.body.data.billing, null);
  });

  it('Dirjen approval of a Pengesahan issues the Simponi billing', async () => {
    const res = await decide(createClient(), 'qd2',
      { decision: 'setujui', tahap: DIRJEN });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.tahap, 'Pembayaran DKPTKA');
    assert.equal(res.body.data.sla, 'Selesai');
    assert.match(res.body.data.billing.kode, /^82\d{13}$/);
    assert.equal(res.body.data.billing.tka, 'Wang Liqiang');
  });

  it('Dirjen approval of an HPK goes to Penomoran without billing', async () => {
    const res = await decide(createClient(), 'qd1',
      { decision: 'setujui', tahap: DIRJEN });
    assert.equal(res.body.data.tahap, 'Penomoran');
    assert.equal(res.body.data.billing, null);
  });

  it('Dirjen return goes back to the director stage', async () => {
    const res = await decide(createClient(), 'qd3', { decision: 'kembalikan',
      tahap: DIRJEN, catatan: 'Lengkapi dasar hukum jabatan komisaris.' });
    assert.equal(res.body.data.tahap, 'Persetujuan Direktur');
    assert.equal(res.body.data.returnedToApplicant, false);
  });

  it('a final application cannot be decided again (409)', async () => {
    const api = createClient();
    await decide(api, 'qd1', { decision: 'setujui', tahap: DIRJEN });
    const res = await decide(api, 'qd1',
      { decision: 'setujui', tahap: 'Penomoran' });
    assert.equal(res.status, 409);
  });
});

describe('ekspos daring — tautan rapat & BAP', () => {
  const meeting = { platform: 'Zoom', mulai: '2026-10-08T13:00:00+07:00' };
  const bap = {
    hasil: 'Layak',
    ringkasan: 'Pemberi kerja memaparkan rencana alih keahlian kepada dua ' +
      'TKI pendamping; jumlah dan jangka waktu sesuai permohonan.',
    peserta: ['Bayu Kurniawan (Petugas Ekspos)', 'Rina Wulandari (HRD)'],
    rekamanUrl: 'https://zoom.us/rec/share/tka-eksp-014',
    durasiMenit: 30,
  };

  it('GET /ekspos-schedule exposes sessions with mode/platform/link', async () => {
    const res = await createClient()('GET', '/ekspos-schedule');
    const { sessions } = res.body.data;
    assert.ok(Array.isArray(sessions) && sessions.length > 0);
    const s14 = sessions.find((s) => s.id === 'eks-14');
    assert.equal(s14.mode, 'Daring');
    assert.equal(s14.platform, 'Zoom');
    assert.match(s14.meetingUrl, /^https:\/\//);
    assert.equal(s14.mulai, '2026-10-07T09:30:00+07:00');
  });

  it('creates a meeting link once (409 on the second call)', async () => {
    const api = createClient();
    const path = '/ekspos-schedule/eks-22/meetings';
    const res = await api('POST', path, { body: meeting });
    assert.equal(res.status, 200);
    assert.match(res.body.data.meetingUrl, /^https:\/\/zoom\.us\//);
    const again = await api('POST', path, { body: meeting });
    assert.equal(again.status, 409);
  });

  it('validates platform enum and ISO start time (400)', async () => {
    const res = await createClient()('POST',
      '/ekspos-schedule/eks-22/meetings',
      { body: { platform: 'Skype', mulai: '8 Okt 13.00' } });
    assert.equal(res.status, 400);
    assert.ok(res.body.error.fields.platform);
    assert.ok(res.body.error.fields.mulai);
  });

  it('a luring session needs no link (409); unknown session 404', async () => {
    const api = createClient();
    const luring = await api('POST', '/ekspos-schedule/eks-03/meetings',
      { body: meeting });
    assert.equal(luring.status, 409);
    const missing = await api('POST', '/ekspos-schedule/eks-99/meetings',
      { body: meeting });
    assert.equal(missing.status, 404);
  });

  it('BAP returns 201 with a BAP number; second BAP 409', async () => {
    const api = createClient();
    const res = await api('POST', '/ekspos-schedule/eks-14/bap',
      { body: bap });
    assert.equal(res.status, 201);
    assert.match(res.body.data.bap.nomor, /^BAP-EKS\//);
    assert.equal(res.body.data.bap.hasil, 'Layak');
    const again = await api('POST', '/ekspos-schedule/eks-14/bap',
      { body: bap });
    assert.equal(again.status, 409);
    assert.equal(again.body.error.code, 'BAP_EXISTS');
  });

  it('daring BAP requires rekamanUrl; luring does not', async () => {
    const api = createClient();
    const { rekamanUrl, ...noRec } = bap;
    const daring = await api('POST', '/ekspos-schedule/eks-14/bap',
      { body: noRec });
    assert.equal(daring.status, 400);
    assert.equal(daring.body.error.field, 'rekamanUrl');
    const luring = await api('POST', '/ekspos-schedule/eks-03/bap',
      { body: noRec });
    assert.equal(luring.status, 201);
  });

  it('BAP validates ringkasan >= 50, peserta >= 1, durasi 5-240', async () => {
    const res = await createClient()('POST', '/ekspos-schedule/eks-14/bap',
      { body: { ...bap, ringkasan: 'Singkat.', peserta: [],
        durasiMenit: 300 } });
    assert.equal(res.status, 400);
    const { fields } = res.body.error;
    assert.ok(fields.ringkasan && fields.peserta && fields.durasiMenit);
  });

  it('daring BAP without a meeting link is refused (409)', async () => {
    const res = await createClient()('POST', '/ekspos-schedule/eks-22/bap',
      { body: bap });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'MEETING_REQUIRED');
  });

  it('portal GET /ekspos carries mode, platform and meetingUrl', async () => {
    const api = createClient();
    await api('POST', '/ekspos-schedule/eks-22/meetings', { body: meeting });
    const res = await api('GET', '/ekspos', { query: { role: 'swasta' } });
    const byNo = Object.fromEntries(res.body.data.map((e) => [e.antrian, e]));
    assert.equal(byNo[14].platform, 'Zoom');
    assert.match(byNo[14].meetingUrl, /^https:\/\//);
    assert.match(byNo[22].meetingUrl, /^https:\/\/zoom\.us\//);
    assert.equal(byNo[7].mode, 'Daring');
    assert.equal(byNo[7].meetingUrl, null);
  });
});

describe('anotasi dokumen', () => {
  const pin = { dokumen: 'Surat permohonan', halaman: 1, x: 40, y: 25,
    catatan: 'Paraf pada halaman ini belum ada.', tahap: VERIF,
    penulis: 'Nur Aisyah' };
  const path = (id) => `/antrian/${id}/annotations`;

  it('lists seeded annotations; unknown application 404', async () => {
    const api = createClient();
    const res = await api('GET', path('q1'));
    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 2);
    const missing = await api('GET', path('zz'));
    assert.equal(missing.status, 404);
  });

  it('adds a numbered pin at the current stage (201)', async () => {
    const api = createClient();
    const res = await api('POST', path('q1'), { body: pin });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.nomor, 3);
    assert.equal(res.body.data.tahap, VERIF);
    const list = await api('GET', path('q1'));
    assert.equal(list.body.data.length, 3);
  });

  it('validates halaman >= 1, x/y 0-100, catatan 5-500 (400)', async () => {
    const res = await createClient()('POST', path('q1'), { body: { ...pin,
      halaman: 0, x: 120, y: -1, catatan: 'ok' } });
    assert.equal(res.status, 400);
    const { fields } = res.body.error;
    assert.ok(fields.halaman && fields.x && fields.y && fields.catatan);
  });

  it('stale tahap or final application is refused (409)', async () => {
    const api = createClient();
    const stale = await api('POST', path('q8'), { body: pin });
    assert.equal(stale.status, 409);
    await decide(api, 'qd1', { decision: 'setujui', tahap: DIRJEN });
    const final = await api('POST', path('qd1'),
      { body: { ...pin, tahap: 'Penomoran' } });
    assert.equal(final.status, 409);
  });

  it('deletes an own-stage annotation; then 404', async () => {
    const api = createClient();
    const del = (id) => api('DELETE', `${path('q1')}/${id}`,
      { query: { tahap: VERIF } });
    const res = await del('an-q1-1');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.id, 'an-q1-1');
    assert.equal((await del('an-q1-1')).status, 404);
  });

  it('delete requires tahap (400) and refuses earlier-stage pins (409)', async () => {
    const api = createClient();
    const noStage = await api('DELETE', `${path('q1')}/an-q1-1`);
    assert.equal(noStage.status, 400);
    const earlier = await api('DELETE', `${path('q8')}/an-q8-1`,
      { query: { tahap: 'Pemeriksaan Kasi' } });
    assert.equal(earlier.status, 409);
  });
});

describe('pendaftar activation (AK-15)', () => {
  it('activates a waiting registration; tautan aktivasi dikirim', async () => {
    const res = await createClient()('POST',
      '/pendaftar/0761220441801000/activate');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, 'Aktif');
    assert.equal(res.body.data.email, true);
  });

  it('activating an already-active registration fails (409)', async () => {
    const api = createClient();
    const npwp = '0712664120093000';
    const first = await api('POST', `/pendaftar/${npwp}/activate`);
    assert.equal(first.status, 200);
    const second = await api('POST', `/pendaftar/${npwp}/activate`);
    assert.equal(second.status, 409);
    assert.equal(second.body.error.code, 'INVALID_STATE');
  });

  it('refuses while waiting for the applicant fix (409)', async () => {
    const res = await createClient()('POST',
      '/pendaftar/0911003488304000/activate');
    assert.equal(res.status, 409);
  });

  it('request-fix requires catatan (400) and sets Perlu perbaikan', async () => {
    const api = createClient();
    const bad = await api('POST', '/pendaftar/0823551907217000/request-fix',
      { body: { catatan: '' } });
    assert.equal(bad.status, 400);
    const res = await api('POST', '/pendaftar/0823551907217000/request-fix',
      { body: { catatan: 'Dokumen NIB tidak terbaca; unggah ulang.' } });
    assert.equal(res.body.data.status, 'Perlu perbaikan');
  });

  it('resubmit after a fix request returns to Menunggu verifikasi',
    async () => {
      const api = createClient();
      const npwp = '0911003488304000';
      const docs = [{ jenis: 'NPWP', fileName: 'npwp-revisi.pdf',
        fileSize: 100, mimeType: 'application/pdf' }];
      const res = await api('POST', `/pendaftar/${npwp}/resubmit`,
        { body: { documents: docs } });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.status, 'Menunggu verifikasi');
      assert.equal(res.body.data.catatan, undefined);
    });

  it('resubmit when not "Perlu perbaikan" fails (409)', async () => {
    const res = await createClient()('POST',
      '/pendaftar/0761220441801000/resubmit',
      { body: { documents: [{ jenis: 'NPWP', fileName: 'a.pdf',
        fileSize: 10, mimeType: 'application/pdf' }] } });
    assert.equal(res.status, 409);
  });
});

const REGISTER_BODY = {
  statusPenanamModal: 'Penanam Modal',
  jenisPemberiKerja: 'Perusahaan dengan modal asing',
  metodePendaftaran: 'OSS', kodeWlkp: '3216.2015.004512',
  nib: '9120301234567', npwp: '0012345678012000',
  namaPemberiKerja: 'PT Pendaftar Baru',
  operatorEmails: [{ email: 'baru@contoh.co.id', nama: 'Operator Baru',
    terdaftar: true }],
  documents: [{ jenis: 'Surat Penunjukan Operator/PIC', fileName: 'surat.pdf',
    fileSize: 1000, mimeType: 'application/pdf' }],
};

describe('akun Verifikator: daftar & detail pemberi kerja (AK-20)', () => {
  it('lists pendaftar with id, email admin, operators, dokumen', async () => {
    const res = await createClient()('GET', '/pendaftar');
    assert.equal(res.status, 200);
    const row = res.body.data.find((p) => p.id === '0761220441801000');
    assert.equal(row.nama, 'PT Cahaya Digital Asia');
    assert.equal(row.emailAdmin, 'andi.pratama@cahayadigital.id');
    assert.equal(row.operators.length, 1);
    assert.equal(row.dokumen.jenis, 'Surat Penunjukan Operator/PIC');
    assert.deepEqual(row.emailTerkirim, []);
  });

  it('GET /pendaftar/{id} returns the detail; unknown id is 404', async () => {
    const api = createClient();
    const ok = await api('GET', '/pendaftar/0823551907217000');
    assert.equal(ok.status, 200);
    assert.equal(ok.body.data.operators.length, 2);
    const missing = await api('GET', '/pendaftar/0000000000000000');
    assert.equal(missing.status, 404);
  });

  it('addresses a Non-OSS pendaftar without NPWP by name slug', async () => {
    const api = createClient();
    const id = 'kedutaan-besar-republik-estonia';
    const res = await api('GET', `/pendaftar/${id}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.metodePendaftaran, 'Non-OSS');
    assert.equal(res.body.data.dokumen.jenis,
      'Surat Permohonan Pengajuan TKA');
    const done = await api('POST', `/pendaftar/${id}/activate`);
    assert.equal(done.status, 200);
  });

  it('activate sends one email each to admin and operators', async () => {
    const api = createClient();
    const res = await api('POST', '/pendaftar/0823551907217000/activate');
    assert.equal(res.status, 200);
    const sent = res.body.data.emailTerkirim;
    assert.deepEqual(sent.map((m) => m.ke).sort(), [
      'bayu.a@borneohijau.co.id', 'siti.rahmawati@borneohijau.co.id']);
    assert.ok(sent.every((m) => m.waktu && m.subjek.includes('Borneo')));
    const again = await api('GET', '/pendaftar/0823551907217000');
    assert.equal(again.body.data.emailTerkirim.length, 2);
  });

  it('one email when admin and operator share an address', async () => {
    const res = await createClient()('POST',
      '/pendaftar/kedutaan-besar-republik-estonia/activate');
    const sent = res.body.data.emailTerkirim;
    assert.equal(sent.length, 2);
    assert.equal(sent[0].peran, 'Admin Pemberi Kerja & Operator');
  });

  it('a new registration shows up with its detail for the Verifikator',
    async () => {
      const api = createClient();
      const reg = await api('POST', '/auth/register', { body: REGISTER_BODY });
      assert.equal(reg.status, 201);
      const res = await api('GET', `/pendaftar/${REGISTER_BODY.npwp}`);
      assert.equal(res.status, 200);
      assert.equal(res.body.data.status, 'Menunggu verifikasi');
      assert.equal(res.body.data.emailAdmin,
        'rina.wulandari@nusantarabaja.co.id');
      assert.equal(res.body.data.operators[0].email, 'baru@contoh.co.id');
      assert.equal(res.body.data.dokumen.fileName, 'surat.pdf');
    });

  it('request-fix on a Non-OSS slug id works', async () => {
    const res = await createClient()('POST',
      '/pendaftar/kedutaan-besar-republik-estonia/request-fix',
      { body: { catatan: 'Surat permohonan belum bertanda tangan.' } });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, 'Perlu perbaikan');
  });
});

describe('akun demo Verifikator (AK-20)', () => {
  it('verif.akun logs in with kind verifikator', async () => {
    const res = await createClient()('POST', '/auth/login',
      { body: { username: 'verif.akun', password: 'verifikator2026' } });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.kind, 'verifikator');
  });
});

describe('akun Verifikator: verifikasi HPK (AK-21)', () => {
  const hpk = (api, id) => api('GET', `/hpk-verifikasi/${id}`);

  it('lists HPK with status derived from the queue stage', async () => {
    const res = await createClient()('GET', '/hpk-verifikasi');
    assert.equal(res.status, 200);
    const byId = Object.fromEntries(res.body.data.map((r) => [r.id, r]));
    assert.equal(byId.q2.status, 'Menunggu verifikasi');
    assert.equal(byId.q1.status, 'Perbaikan data');
    assert.equal(byId.q5.status, 'Terverifikasi');
    assert.ok(res.body.data.every((r) => r.noPermohonan));
  });

  it('detail has isian and uploaded documents; 404 for unknown', async () => {
    const api = createClient();
    const res = await hpk(api, 'q2');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.isian.jabatan[0].nama, 'Rohaniwan');
    assert.ok(res.body.data.dokumen.length >= 5);
    assert.equal((await hpk(api, 'q3')).status, 404);
  });

  it('verify moves to Jadwal Ekspos and generates an ekspos session',
    async () => {
      const api = createClient();
      const before = (await api('GET', '/ekspos-schedule'))
        .body.data.sessions.length;
      const res = await api('POST', '/hpk-verifikasi/q2/verify');
      assert.equal(res.status, 200);
      assert.equal(res.body.data.status, 'Terverifikasi');
      assert.ok(res.body.data.ekspos.hari && res.body.data.ekspos.jam);
      const after = await api('GET', '/ekspos-schedule');
      assert.equal(after.body.data.sessions.length, before + 1);
      const queue = await api('GET', '/antrian', { query: { jenis: 'HPK' } });
      assert.equal(queue.body.data.find((q) => q.id === 'q2').tahap,
        'Jadwal Ekspos');
      const again = await api('POST', '/hpk-verifikasi/q2/verify');
      assert.equal(again.status, 409);
    });

  it('reject requires alasan (400) then becomes Perbaikan data', async () => {
    const api = createClient();
    const bad = await api('POST', '/hpk-verifikasi/q4/reject',
      { body: { alasan: 'pendek' } });
    assert.equal(bad.status, 400);
    assert.equal(bad.body.error.field, 'alasan');
    const res = await api('POST', '/hpk-verifikasi/q4/reject',
      { body: { alasan: 'Uraian jabatan kurang dari 350 karakter.' } });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, 'Perbaikan data');
    assert.match(res.body.data.alasan, /350 karakter/);
    const again = await api('POST', '/hpk-verifikasi/q4/verify');
    assert.equal(again.status, 409);
  });

  it('resubmit after perbaikan returns to Menunggu verifikasi', async () => {
    const api = createClient();
    const res = await api('POST', '/hpk-verifikasi/q1/resubmit');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, 'Menunggu verifikasi');
    assert.equal(res.body.data.alasan, '');
    assert.equal((await api('POST', '/hpk-verifikasi/q1/resubmit')).status,
      409);
  });
});

describe('akun Verifikator: pengesahan RPTKA (AK-22)', () => {
  const act = (api, id, action, body) =>
    api('POST', `/pengesahan-verifikasi/${id}/${action}`, { body });

  it('lists RPTKA with No HPK, tanggal, nomor, jenis, status', async () => {
    const res = await createClient()('GET', '/pengesahan-verifikasi');
    assert.equal(res.status, 200);
    const byId = Object.fromEntries(res.body.data.map((r) => [r.id, r]));
    assert.equal(byId.q3.status, 'Menunggu verifikasi');
    assert.equal(byId.q3.statusBilling, null);
    assert.equal(byId.q3.nomorRptka, 'P-26092114');
    assert.equal(byId.q3.noHpk, '—');
    assert.equal(byId.q14.noHpk, '260600031874');
    assert.equal(byId.q6.status, 'Diteruskan ke Validator');
    assert.equal(byId.q6.statusBilling, 'Menunggu verifikasi');
    assert.ok(res.body.data.every((r) => r.jenisRptka && r.tanggalPengajuan));
  });

  it('detail has isian, dokumen and the DKPTKA calculation', async () => {
    const api = createClient();
    const res = await api('GET', '/pengesahan-verifikasi/q6');
    assert.equal(res.status, 200);
    assert.ok(res.body.data.isian.tka.length >= 1);
    assert.equal(res.body.data.dokumen.length, 6);
    assert.deepEqual(
      [res.body.data.dkptka.bebas, res.body.data.dkptka.rupiah],
      [false, 18000000]);
    assert.equal((await api('GET', '/pengesahan-verifikasi/q1')).status, 404);
  });

  it('verifikasi forwards to the Validator; billing belongs to Validator',
    async () => {
      const api = createClient();
      const billing = await act(api, 'q14', 'verify', { tahap: 'billing' });
      assert.equal(billing.status, 400);
      assert.equal(billing.body.error.field, 'tahap');
      const first = await act(api, 'q14', 'verify', { tahap: 'verifikasi' });
      assert.equal(first.status, 200);
      assert.equal(first.body.data.status, 'Diteruskan ke Validator');
      assert.equal(first.body.data.statusBilling, 'Menunggu verifikasi');
      const queue = await api('GET', '/antrian', { query: { jenis: 'Pengesahan' } });
      assert.equal(queue.body.data.find((q) => q.id === 'q14').tahap,
        'Pemeriksaan Subkoordinator');
      assert.equal((await act(api, 'q14', 'verify', { tahap: 'verifikasi' }))
        .status, 409);
    });

  it('reject needs alasan; Perbaikan; resubmit differs per tabel', async () => {
    const api = createClient();
    const bad = await act(api, 'q15', 'reject',
      { tahap: 'verifikasi', alasan: 'pendek' });
    assert.equal(bad.status, 400);
    assert.equal(bad.body.error.field, 'alasan');
    const res = await act(api, 'q15', 'reject', { tahap: 'verifikasi',
      alasan: 'Paspor tidak terbaca; unggah ulang.' });
    assert.equal(res.body.data.status, 'Perbaikan');
    assert.match(res.body.data.alasan, /Paspor/);
    const back = await act(api, 'q15', 'resubmit', { tahap: 'verifikasi' });
    assert.equal(back.body.data.status, 'Menunggu verifikasi');
    // Tabel billing (ditolak Validator): submit ulang langsung ke Validator.
    await api('POST', '/pengesahan-validasi/gq16/reject', { body: {
      alasan: 'Data pengurus belum lengkap.' } });
    const direct = await act(api, 'gq16', 'resubmit', { tahap: 'billing' });
    assert.equal(direct.status, 200);
    assert.equal(direct.body.data.statusBilling, 'Diteruskan ke Validator');
    assert.equal((await act(api, 'gq16', 'resubmit', { tahap: 'billing' }))
      .status, 409);
  });

  it('validates tahap enum (400)', async () => {
    const res = await act(createClient(), 'q3', 'verify', { tahap: 'x' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.field, 'tahap');
  });
});

describe('akun Verifikator: perpanjangan RPTKA lintas provinsi (AK-23)', () => {
  const LINTAS = 'Perpanjangan Pengesahan RPTKA Lintas Provinsi';
  const act = (api, id, action, body) =>
    api('POST', `/pengesahan-verifikasi/${id}/${action}`, { body });

  it('lists lintas-provinsi extensions with their statuses', async () => {
    const res = await createClient()('GET', '/pengesahan-verifikasi');
    const rows = res.body.data.filter((r) => r.jenisRptka === LINTAS);
    assert.deepEqual(rows.map((r) => [r.id, r.status]), [
      // qd6/qd7: perpanjangan yang sudah lolos DKPTKA (menu Perpanjangan
      // RPTKA akun Direktur) — sudah melewati Verifikator.
      ['qd6', 'Diteruskan ke Validator'], ['qd7', 'Diteruskan ke Validator'],
      ['qpl1', 'Menunggu verifikasi'], ['qpl2', 'Menunggu verifikasi'],
      ['qpl3', 'Perbaikan'], ['qpl4', 'Diteruskan ke Validator'],
      ['qpl5', 'Diteruskan ke Validator'], ['qpl6', 'Diteruskan ke Validator'],
      ['qpl7', 'Diteruskan ke Validator']]);
    assert.match(rows[4].alasan, /Izin tinggal/);
  });

  it('detail carries the Perpanjangan documents (11 uploads)', async () => {
    const res = await createClient()('GET', '/pengesahan-verifikasi/qpl1');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.dokumen.length, 11);
    assert.match(res.body.data.dokumen[0].jenis, /perpanjangan Pengesahan/);
    assert.equal(res.body.data.isian.tka[0].nama, 'Hiroshi Tanaka');
  });

  it('verifikasi forwards to the Validator', async () => {
    const api = createClient();
    const res = await act(api, 'qpl1', 'verify', { tahap: 'verifikasi' });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, 'Diteruskan ke Validator');
    assert.equal((await act(api, 'qpl1', 'verify',
      { tahap: 'verifikasi' })).status, 409);
  });

  it('tolak needs alasan, then Perbaikan, then resubmit', async () => {
    const api = createClient();
    const bad = await act(api, 'qpl2', 'reject',
      { tahap: 'verifikasi', alasan: 'x' });
    assert.equal(bad.status, 400);
    const res = await act(api, 'qpl2', 'reject', { tahap: 'verifikasi',
      alasan: 'Laporan penyerapan TKI belum diunggah.' });
    assert.equal(res.body.data.status, 'Perbaikan');
    const back = await act(api, 'qpl3', 'resubmit', { tahap: 'verifikasi' });
    assert.equal(back.body.data.status, 'Menunggu verifikasi');
  });
});
