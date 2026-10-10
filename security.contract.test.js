/** @fileoverview Contract tests — audit log, RBAC, peringatan keamanan. */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createClient } from './client.js';

const HEX64 = /^[0-9a-f]{64}$/;

describe('GET /audit-logs', () => {
  it('returns newest first with hash chain fields and page meta', async () => {
    const res = await createClient()('GET', '/audit-logs');
    assert.equal(res.status, 200);
    assert.equal(res.body.meta.page, 1);
    assert.ok(res.body.meta.total >= 50);
    assert.equal(res.body.data.length, res.body.meta.pageSize);
    const [first, second] = res.body.data;
    assert.ok(first.seq > second.seq);
    assert.equal(first.prevHash, second.hash);
    assert.match(first.hash, HEX64);
    for (const key of ['waktu', 'pengguna', 'aksi', 'modul', 'ip']) {
      assert.ok(first[key], key);
    }
    assert.ok(Array.isArray(first.perubahan));
  });

  it('filters by modul, aksi and pengguna', async () => {
    const res = await createClient()('GET', '/audit-logs',
      { query: { modul: 'Back Office', aksi: 'Setujui', pengguna: 'nur' } });
    assert.equal(res.status, 200);
    assert.ok(res.body.data.length > 0);
    for (const e of res.body.data) {
      assert.equal(e.modul, 'Back Office');
      assert.equal(e.aksi, 'Setujui');
      assert.match(e.pengguna, /nur/i);
    }
  });

  it('filters by date range', async () => {
    const res = await createClient()('GET', '/audit-logs',
      { query: { dari: '2026-09-10', sampai: '2026-09-12' } });
    assert.ok(res.body.data.length > 0);
    for (const e of res.body.data) {
      const day = e.waktu.slice(0, 10);
      assert.ok(day >= '2026-09-10' && day <= '2026-09-12', day);
    }
  });

  it('paginates (page 2 continues page 1)', async () => {
    const api = createClient();
    const p1 = await api('GET', '/audit-logs', { query: { page: '1' } });
    const p2 = await api('GET', '/audit-logs', { query: { page: '2' } });
    assert.equal(p2.body.meta.page, 2);
    assert.equal(p2.body.data[0].hash, p1.body.data.at(-1).prevHash);
  });

  it('dari after sampai is rejected (400)', async () => {
    const res = await createClient()('GET', '/audit-logs',
      { query: { dari: '2026-09-20', sampai: '2026-09-01' } });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.field, 'sampai');
  });

  it('invalid modul / date format is rejected (400)', async () => {
    const res = await createClient()('GET', '/audit-logs',
      { query: { modul: 'Lainnya', dari: '01-09-2026' } });
    assert.equal(res.status, 400);
    assert.ok(res.body.error.fields.modul);
    assert.ok(res.body.error.fields.dari);
  });
});

describe('GET /audit-logs/integrity', () => {
  it('reports an intact chain', async () => {
    const res = await createClient()('GET', '/audit-logs/integrity');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.valid, true);
    assert.ok(res.body.data.checkedEntries >= 50);
    assert.match(res.body.data.lastHash, HEX64);
  });

  it('a state change appends a new chained entry', async () => {
    const api = createClient();
    const before = await api('GET', '/audit-logs/integrity');
    await api('PATCH', '/internal-users/u-verif',
      { body: { peran: 'Validator (Kasi/Subkoordinator)' } });
    const after = await api('GET', '/audit-logs/integrity');
    assert.equal(after.body.data.checkedEntries,
      before.body.data.checkedEntries + 1);
    assert.equal(after.body.data.valid, true);
    const latest = await api('GET', '/audit-logs');
    const [entry] = latest.body.data;
    assert.equal(entry.modul, 'Pengguna Internal');
    assert.equal(entry.prevHash, before.body.data.lastHash);
    assert.deepEqual(entry.perubahan[0], { field: 'peran',
      sebelum: 'Verifikator Permohonan',
      sesudah: 'Validator (Kasi/Subkoordinator)' });
  });
});

describe('GET /access-roles', () => {
  it('returns permissions and the role matrix', async () => {
    const res = await createClient()('GET', '/access-roles');
    assert.equal(res.status, 200);
    const { permissions, roles } = res.body.data;
    assert.ok(permissions.length > 5);
    const admin = roles.find((r) => r.peran === 'Admin Pusat');
    assert.ok(admin.izin.includes('audit.lihat'));
    const keys = new Set(permissions.map((p) => p.key));
    for (const role of roles) {
      for (const key of role.izin) {
        assert.ok(keys.has(key), `${role.peran}: ${key}`);
      }
    }
  });
});

describe('PATCH /internal-users/{id}', () => {
  const update = (api, id, body) =>
    api('PATCH', `/internal-users/${id}`, { body });

  it('changes role and active flag', async () => {
    const api = createClient();
    const res = await update(api, 'u-verif2', { aktif: true,
      peran: 'Petugas Ekspos' });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.aktif, true);
    assert.equal(res.body.data.peran, 'Petugas Ekspos');
  });

  it('protects the last active Admin Pusat (409)', async () => {
    const api = createClient();
    const first = await update(api, 'u-admin2', { aktif: false });
    assert.equal(first.status, 200);
    const res = await update(api, 'u-admin', { aktif: false });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'LAST_SUPER_ADMIN');
    const demote = await update(api, 'u-admin', { peran: 'Direktur PPTKA' });
    assert.equal(demote.status, 409);
  });

  it('rejects an unknown role (400) and empty body (400)', async () => {
    const api = createClient();
    assert.equal((await update(api, 'u-verif', { peran: 'Root' })).status,
      400);
    assert.equal((await update(api, 'u-verif', {})).status, 400);
  });

  it('unknown user returns 404', async () => {
    const res = await update(createClient(), 'u-x', { aktif: true });
    assert.equal(res.status, 404);
  });
});

describe('security alerts', () => {
  it('lists alerts with the open count', async () => {
    const res = await createClient()('GET', '/security-alerts');
    assert.equal(res.status, 200);
    assert.ok(res.body.data.length >= 3);
    assert.equal(res.body.meta.baru,
      res.body.data.filter((a) => a.status === 'Baru').length);
    const types = new Set(res.body.data.map((a) => a.jenis));
    for (const jenis of ['Login gagal beruntun', 'IP baru',
      'Akses di luar jam kerja']) {
      assert.ok(types.has(jenis), jenis);
    }
  });

  it('acknowledge requires catatan (400)', async () => {
    const res = await createClient()('POST',
      '/security-alerts/SA-0930/acknowledge', { body: { catatan: '' } });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.field, 'catatan');
  });

  it('acknowledges once, then 409', async () => {
    const api = createClient();
    const body = { catatan: 'Sudah dikonfirmasi ke pengguna; sandi direset.' };
    const res = await api('POST', '/security-alerts/SA-0930/acknowledge',
      { body });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, 'Ditindaklanjuti');
    const again = await api('POST', '/security-alerts/SA-0930/acknowledge',
      { body });
    assert.equal(again.status, 409);
    const open = await api('GET', '/security-alerts',
      { query: { status: 'Baru' } });
    assert.ok(open.body.data.every((a) => a.id !== 'SA-0930'));
  });

  it('unknown alert returns 404', async () => {
    const res = await createClient()('POST',
      '/security-alerts/SA-0000/acknowledge',
      { body: { catatan: 'Catatan tindak lanjut cukup.' } });
    assert.equal(res.status, 404);
  });
});
