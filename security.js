/**
 * @fileoverview KAK Modul 8 routes: append-only audit log with a hash
 * chain (prevHash -> hash), integrity check, RBAC matrix, internal users
 * and anomaly alerts. The hash is a deterministic stand-in for SHA-256
 * (64 hex chars, FNV-1a based) — the backend uses a real SHA-256 over the
 * same canonical fields.
 *
 * Rules (docs/shared/business-rules.md §SC):
 *   SC-01 append-only chained audit log (appendAudit; no update/delete)
 *   SC-02 filter pengguna/modul/aksi/dari-sampai, page size 20
 *   SC-03 integrity endpoint recomputes the chain
 *   SC-05 last active Admin Pusat protected (409 LAST_SUPER_ADMIN)
 *   SC-06 alert acknowledgement needs catatan; once only (409)
 */

import {
  ALERT_STATUS, SUPER_ROLE, validateAcknowledgeAlert, validateAuditQuery,
  validateUpdateInternalUser,
} from '../../contracts/security.js';
import {
  ACCESS_MATRIX, ACCESS_PERMISSIONS, INTERNAL_USERS, SECURITY_ALERTS,
  auditSeed,
} from '../fixtures/security.js';
import { fail, invalid, list, notFound, ok, route } from '../router.js';

/** Audit page size. */
export const AUDIT_PAGE_SIZE = 20;
/** prevHash of the first entry. */
export const GENESIS_HASH = '0'.repeat(64);
const ADMIN_ACTOR = { pengguna: 'Admin Sistem', peran: SUPER_ROLE,
  ip: '10.10.1.15' };

export const SECURITY_ROUTES = [
  route('GET', '/audit-logs', listAuditLogs, {
    tag: 'Keamanan',
    summary: 'Audit log (terbaru dulu), berantai hash; 20 per halaman.',
    query: { pengguna: 'Sebagian nama pengguna.', modul: 'Modul (enum).',
      aksi: 'Aksi (enum).', dari: 'YYYY-MM-DD.', sampai: 'YYYY-MM-DD.',
      page: 'Halaman, mulai 1.' },
    example: { query: { modul: 'Back Office', page: '1' } },
    responses: { 400: 'Filter tidak valid / dari > sampai ' +
      '(VALIDATION_ERROR).' },
  }),
  route('GET', '/audit-logs/integrity', checkIntegrity, {
    tag: 'Keamanan', summary: 'Verifikasi rantai hash audit log.',
  }),
  route('GET', '/access-roles', ({ store }) => ok(accessRoles(store)), {
    tag: 'Keamanan', summary: 'Matriks peran internal × izin (RBAC).',
  }),
  route('GET', '/internal-users', ({ store }) => list(usersOf(store)), {
    tag: 'Keamanan', summary: 'Pengguna internal back office.',
  }),
  route('PATCH', '/internal-users/:id', updateInternalUser, {
    tag: 'Keamanan', summary: 'Ubah peran / status aktif pengguna internal.',
    request: 'UpdateInternalUserRequest',
    example: { params: { id: 'u-verif' },
      body: { peran: 'Validator (Kasi/Subkoordinator)' } },
    responses: { 409: 'Admin Pusat aktif terakhir dilindungi ' +
      '(LAST_SUPER_ADMIN).' },
  }),
  route('GET', '/security-alerts', listAlerts, {
    tag: 'Keamanan',
    summary: 'Peringatan anomali akses (login gagal beruntun, IP baru, ' +
      'di luar jam kerja); meta.baru = belum ditindaklanjuti.',
    query: { status: 'Baru | Ditindaklanjuti (opsional).' },
  }),
  route('POST', '/security-alerts/:id/acknowledge', acknowledgeAlert, {
    tag: 'Keamanan', summary: 'Tindak lanjuti peringatan (catatan wajib).',
    request: 'AcknowledgeAlertRequest',
    example: { params: { id: 'SA-0930' } },
    responses: { 409: 'Peringatan sudah ditindaklanjuti ' +
      '(ALREADY_ACKNOWLEDGED).' },
  }),
];

/**
 * Deterministic 64-hex digest (FNV-1a, 8 lanes). Stand-in for SHA-256.
 * @param {string} text
 * @return {string}
 */
export function fakeHash(text) {
  let out = '';
  for (let lane = 0; lane < 8; lane++) {
    let h = (0x811c9dc5 ^ Math.imul(lane + 1, 0x9e3779b1)) >>> 0;
    for (let i = 0; i < text.length; i++) {
      h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
    }
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
    out += h.toString(16).padStart(8, '0');
  }
  return out;
}

/** Canonical payload hashed for an entry (excludes the hash itself). */
function hashInput(entry) {
  const { hash, ...rest } = entry;
  return JSON.stringify([rest.seq, rest.waktu, rest.pengguna, rest.peran,
    rest.aksi, rest.modul, rest.objek, rest.ip, rest.perubahan,
    rest.prevHash]);
}

function chain(log, raw) {
  const seq = log.length + 1;
  const entry = {
    id: `AU-${String(seq).padStart(6, '0')}`, seq, ...raw,
    perubahan: raw.perubahan ?? [],
    prevHash: log.length ? log[log.length - 1].hash : GENESIS_HASH,
  };
  entry.hash = fakeHash(hashInput(entry));
  log.push(entry);
  return entry;
}

function auditOf(store) {
  if (!store.auditLogs) {
    store.auditLogs = [];
    for (const raw of auditSeed()) {
      chain(store.auditLogs, raw);
    }
  }
  return store.auditLogs;
}

/** Current time as "YYYY-MM-DDTHH:MM:00+07:00" (WIB). */
function nowWib() {
  const wib = new Date(Date.now() + 7 * 3600000).toISOString();
  return `${wib.slice(0, 16)}:00+07:00`;
}

/**
 * Append a chained audit entry. Called by other mock routes after a state
 * change (antrian decision, TTE, pemda decision, aktivasi, operator, ...).
 * @param {!Object} store Mock store.
 * @param {{pengguna: string, peran: string, aksi: string, modul: string,
 *     objek: string, perubahan: (!Array<{field: string, sebelum: *,
 *     sesudah: *}>|undefined), ip: (string|undefined)}} event
 * @return {!Object} The stored entry.
 */
export function appendAudit(store, event) {
  const { pengguna, peran, aksi, modul, objek } = event;
  return chain(auditOf(store), {
    waktu: nowWib(), pengguna, peran, aksi, modul, objek,
    ip: event.ip ?? ADMIN_ACTOR.ip,
    perubahan: structuredClone(event.perubahan ?? []),
  });
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu',
  'Sep', 'Okt', 'Nov', 'Des'];

/** "2026-10-01T10:23:00+07:00" -> "1 Okt 2026 10.23". */
function displayWib(iso) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y} ${iso.slice(11, 16).replace(':', '.')}`;
}

function matchesFilter(entry, query) {
  const day = entry.waktu.slice(0, 10);
  const who = String(query.pengguna ?? '').trim().toLowerCase();
  return (!who || entry.pengguna.toLowerCase().includes(who)) &&
    (!query.modul || entry.modul === query.modul) &&
    (!query.aksi || entry.aksi === query.aksi) &&
    (!query.dari || day >= query.dari) &&
    (!query.sampai || day <= query.sampai);
}

function listAuditLogs({ query, store }) {
  const result = validateAuditQuery(query);
  if (!result.valid) {
    return invalid(result);
  }
  const rows = auditOf(store).filter((e) => matchesFilter(e, query))
    .reverse();
  const pages = Math.max(1, Math.ceil(rows.length / AUDIT_PAGE_SIZE));
  const page = Number(query.page ?? 1);
  const start = (page - 1) * AUDIT_PAGE_SIZE;
  return ok(rows.slice(start, start + AUDIT_PAGE_SIZE),
    { page, pageSize: AUDIT_PAGE_SIZE, total: rows.length, pages });
}

function checkIntegrity({ store }) {
  const log = auditOf(store);
  let brokenAt = null;
  let prev = GENESIS_HASH;
  for (const entry of log) {
    if (entry.prevHash !== prev || entry.hash !== fakeHash(hashInput(entry))) {
      brokenAt = entry.id;
      break;
    }
    prev = entry.hash;
  }
  return ok({
    valid: brokenAt === null, checkedEntries: log.length, brokenAt,
    lastHash: log.length ? log[log.length - 1].hash : GENESIS_HASH,
    checkedAt: new Date().toISOString(),
  });
}

function usersOf(store) {
  store.internalUsers ??= structuredClone(INTERNAL_USERS);
  return store.internalUsers;
}

function accessRoles(store) {
  const users = usersOf(store);
  return {
    permissions: ACCESS_PERMISSIONS,
    roles: Object.entries(ACCESS_MATRIX).map(([peran, izin]) => ({
      peran, izin,
      jumlahPengguna: users.filter((u) => u.peran === peran && u.aktif)
        .length,
    })),
  };
}

function isActiveSuper(user) {
  return user.peran === SUPER_ROLE && user.aktif;
}

function updateInternalUser({ params, body, store }) {
  const result = validateUpdateInternalUser(body);
  if (!result.valid) {
    return invalid(result);
  }
  const users = usersOf(store);
  const target = users.find((u) => u.id === params.id);
  if (!target) {
    return notFound('Pengguna internal');
  }
  const leavesSuper = body.aktif === false ||
    (body.peran !== undefined && body.peran !== SUPER_ROLE);
  if (isActiveSuper(target) && leavesSuper &&
      users.filter(isActiveSuper).length === 1) {
    return fail(409, 'LAST_SUPER_ADMIN',
      'Minimal satu Admin Pusat harus tetap aktif.');
  }
  const perubahan = [];
  if (body.peran !== undefined && body.peran !== target.peran) {
    perubahan.push({ field: 'peran', sebelum: target.peran,
      sesudah: body.peran });
    target.peran = body.peran;
  }
  if (body.aktif !== undefined && body.aktif !== target.aktif) {
    perubahan.push({ field: 'aktif', sebelum: target.aktif ? 'Ya' : 'Tidak',
      sesudah: body.aktif ? 'Ya' : 'Tidak' });
    target.aktif = body.aktif;
  }
  appendAudit(store, { ...ADMIN_ACTOR,
    aksi: body.aktif === false ? 'Nonaktifkan' : 'Ubah',
    modul: 'Pengguna Internal', objek: `Pengguna ${target.nama}`, perubahan });
  return ok(target);
}

function alertsOf(store) {
  store.securityAlerts ??= structuredClone(SECURITY_ALERTS);
  return store.securityAlerts;
}

function listAlerts({ query, store }) {
  const all = alertsOf(store);
  const rows = query.status ? all.filter((a) => a.status === query.status)
    : all;
  return ok(rows, { total: rows.length,
    baru: all.filter((a) => a.status === ALERT_STATUS.OPEN).length });
}

function acknowledgeAlert({ params, body, store }) {
  const result = validateAcknowledgeAlert(body);
  if (!result.valid) {
    return invalid(result);
  }
  const alert = alertsOf(store).find((a) => a.id === params.id);
  if (!alert) {
    return notFound('Peringatan');
  }
  if (alert.status === ALERT_STATUS.DONE) {
    return fail(409, 'ALREADY_ACKNOWLEDGED',
      'Peringatan ini sudah ditindaklanjuti.');
  }
  Object.assign(alert, {
    status: ALERT_STATUS.DONE, catatan: body.catatan.trim(),
    ditindaklanjutiOleh: ADMIN_ACTOR.pengguna,
    ditindaklanjutiPada: displayWib(nowWib()),
  });
  appendAudit(store, { ...ADMIN_ACTOR, aksi: 'Tindak lanjut',
    modul: 'Keamanan', objek: `Peringatan ${alert.id}`,
    perubahan: [{ field: 'status', sebelum: ALERT_STATUS.OPEN,
      sesudah: ALERT_STATUS.DONE }] });
  return ok(alert);
}
