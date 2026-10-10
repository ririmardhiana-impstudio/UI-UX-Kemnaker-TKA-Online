/**
 * @fileoverview Read-only reference + back-office routes: system info,
 * workflow steps, SSO session, companies, pengumuman, jabatan master,
 * pendaftar, antrian, pencabutan, legacy (genLegacy), ekspos schedule
 * (+ sesi daring: tautan rapat & BAP, KAK Modul 5 [I]), pemda validations.
 */

import {
  validateEksposBap, validateEksposMeeting, validatePemdaDecision,
} from '../../contracts/back-office.js';
import {
  EKSPOS_SESSION_DETAILS, MEETING_URL_PREFIX,
} from '../fixtures/back-office.js';
import {
  checkRole, created, fail, invalid, list, notFound, ok, route,
} from '../router.js';
import { antrianOf } from './back-office.js';
import { appendAudit } from './security.js';

const PEMDA_PENDING = 'Menunggu validasi';
const MONTHS = { Sep: '09', Okt: '10', Nov: '11' };

export const REFERENCE_ROUTES = [
  route('GET', '/system-info', ({ store }) => ok({ today: store.today }), {
    tag: 'Referensi', summary: 'Tanggal acuan prototipe (today).',
  }),
  route('GET', '/workflow-steps', ({ store }) => ok({
    hpk: store.HPK_STEPS, pengesahan: store.PENG_STEPS,
  }), { tag: 'Referensi', summary: 'Tahapan HPK_STEPS dan PENG_STEPS.' }),
  route('GET', '/sso-sessions/current', ({ store }) => ok(store.sso), {
    tag: 'Akun', summary: 'Sesi SIAPkerja (SSO) aktif.',
  }),
  route('GET', '/companies', ({ store }) =>
    list(Object.values(store.companies)), {
    tag: 'Pemberi Kerja', summary: 'Semua profil pemberi kerja demo.',
  }),
  route('GET', '/companies/:role', getCompany, {
    tag: 'Pemberi Kerja', summary: 'Profil pemberi kerja per role.',
    example: { params: { role: 'swasta' } },
  }),
  route('GET', '/pengumuman', ({ store }) => list(store.pengumuman), {
    tag: 'Referensi', summary: 'Pengumuman wajib baca.',
  }),
  route('GET', '/jabatan-master', ({ store }) => list(store.jabatanMaster), {
    tag: 'Back Office', summary: 'Master jabatan (admin).',
  }),
  route('GET', '/antrian', listAntrian, {
    tag: 'Back Office',
    summary: 'Antrian permohonan; filter ?tahap=a,b dan ?jenis=.',
    query: { tahap: 'Daftar tahap dipisah koma.', jenis: 'HPK|Pengesahan|Perubahan' },
  }),
  route('GET', '/pencabutan', ({ store }) => list(store.pencabutan), {
    tag: 'Pemberi Kerja', summary: 'Riwayat pencabutan pengesahan.',
  }),
  route('GET', '/legacy', listLegacy, {
    tag: 'Pemberi Kerja',
    summary: 'Data layanan rezim lama (fixture + genLegacy(grp, layanan, role)).',
    query: { grp: 'Kelompok menu', layanan: 'Nama layanan', role: 'Role key' },
    example: { query: { grp: 'Sisa Notifikasi', layanan: 'Baru (di atas 7 bulan)', role: 'swasta' } },
  }),
  route('GET', '/ekspos-schedule', getSchedule, {
    tag: 'Back Office',
    summary: 'Kalender ekspos minggu berjalan + `sessions` (mode, ' +
      'platform, meetingUrl, bap).',
  }),
  route('POST', '/ekspos-schedule/:id/meetings', createMeeting, {
    tag: 'Back Office',
    summary: 'Buat tautan rapat daring untuk sesi ekspos.',
    request: 'EksposMeetingRequest',
    example: { params: { id: 'eks-22' } },
    responses: {
      409: 'Tautan sudah ada / sesi luring (INVALID_STATE).',
    },
  }),
  route('POST', '/ekspos-schedule/:id/bap', createBap, {
    tag: 'Back Office',
    summary: 'Isi BAP ekspos (nomor BAP terbit); daring wajib rekaman.',
    request: 'EksposBapRequest',
    example: { params: { id: 'eks-14' } },
    responses: {
      409: 'BAP sudah ada / sesi daring belum punya tautan ' +
        '(BAP_EXISTS, MEETING_REQUIRED).',
    },
  }),
  route('GET', '/pemda-validations', ({ store }) =>
    list(store.pemdaValidations.map(withPemdaStatus)), {
    tag: 'Back Office', summary: 'Pembayaran DKPTKA daerah untuk validasi.',
  }),
  route('POST', '/pemda-validations/:id/decision', decidePemda, {
    tag: 'Back Office',
    summary: 'Validasi/tolak pembayaran (hanya yang masih menunggu).',
    request: 'PemdaDecisionRequest',
    example: { params: { id: 'd1' }, body: { decision: 'Tervalidasi' } },
    responses: { 409: 'Sudah diputuskan sebelumnya.' },
  }),
];

function getCompany({ params, store }) {
  const roleError = checkRole(params.role);
  return roleError ?? ok(store.companies[params.role]);
}

function listAntrian({ query, store }) {
  const stages = query.tahap ? query.tahap.split(',') : null;
  const rows = antrianOf(store)
    .filter((q) => !stages || stages.includes(q.tahap))
    .filter((q) => !query.jenis || q.jenis === query.jenis);
  return list(rows);
}

function listLegacy({ query, store }) {
  const roleError = checkRole(query.role);
  if (roleError) {
    return roleError;
  }
  const layanan = query.layanan ?? '';
  const fixture = store.legacyFixtures[layanan] ?? [];
  return list(fixture.concat(store.genLegacy(query.grp, layanan,
    query.role)));
}

function withPemdaStatus(row) {
  const { done, ...rest } = row;
  return { ...rest, status: done ?? PEMDA_PENDING };
}

function decidePemda({ params, body, store }) {
  const result = validatePemdaDecision(body);
  if (!result.valid) {
    return invalid(result);
  }
  const row = store.pemdaValidations.find((p) => p.id === params.id);
  if (!row) {
    return notFound('Pembayaran');
  }
  if (row.done) {
    return fail(409, 'INVALID_STATE', `Pembayaran sudah ${row.done}.`);
  }
  row.done = body.decision;
  appendAudit(store, {
    pengguna: 'Siti Nurhaliza', peran: 'Pejabat Pemda',
    aksi: body.decision === 'Tervalidasi' ? 'Validasi' : 'Tolak',
    modul: 'Pembayaran', objek: `DKPTKA ${row.pk} · ${row.tka}`,
    perubahan: [{ field: 'status', sebelum: PEMDA_PENDING,
      sesudah: body.decision }],
    ip: '36.68.112.9',
  });
  return ok(withPemdaStatus(row));
}

/**
 * Ekspos sessions derived from the calendar events (once per store),
 * enriched with EKSPOS_SESSION_DETAILS. Id = "eks-<no. antrian>".
 * @param {!Object} store
 * @return {!Array<!Object>}
 */
export function eksposSessionsOf(store) {
  store.eksposSessions ??= buildSessions(store.eksposSchedule);
  return store.eksposSessions;
}

/**
 * Put an application in the first free slot of the ekspos calendar and
 * return its new session (null when the week is full). Used when the
 * Verifikator verifies a HPK ("sistem generate jadwal ekspos").
 * @param {!Object} store
 * @param {string} pemohon
 * @param {string} layanan
 * @return {?Object}
 */
export function addEksposSession(store, pemohon, layanan) {
  const sessions = eksposSessionsOf(store);
  const { days, times, events } = store.eksposSchedule;
  const antrian = Math.max(0, ...sessions.map((s) => s.antrian)) + 1;
  for (let day = 0; day < days.length; day++) {
    for (const jam of times) {
      const slot = `${jam}-${day}`;
      if (!events[slot]) {
        events[slot] = [pemohon, `${layanan} · #${antrian}`];
        const [session] = buildSessions(
          { days, times, events: { [slot]: events[slot] } });
        sessions.push(session);
        sessions.sort((a, b) => a.mulai.localeCompare(b.mulai));
        return session;
      }
    }
  }
  return null;
}

function buildSessions({ days, times, events }) {
  return Object.entries(events).map(([slot, [pemohon, what]]) => {
    const [jam, dayIdx] = slot.split('-');
    const [layanan, num] = what.split(' · #');
    const antrian = Number(num);
    return {
      id: `eks-${num}`, slot, hari: days[dayIdx], jam,
      mulai: isoStart(days[dayIdx], jam), pemohon, layanan, antrian,
      mode: 'Daring', platform: null, meetingUrl: null, lokasi: null,
      bap: null, ...structuredClone(EKSPOS_SESSION_DETAILS[antrian] ?? {}),
      order: Number(dayIdx) * times.length + times.indexOf(jam),
    };
  }).sort((a, b) => a.order - b.order)
    .map(({ order, ...session }) => session);
}

/** 'Rabu, 7 Okt' + '09.30' -> '2026-10-07T09:30:00+07:00'. */
function isoStart(day, jam) {
  const [, date, month] = /(\d+) (\w+)/.exec(day);
  return `2026-${MONTHS[month]}-${date.padStart(2, '0')}` +
    `T${jam.replace('.', ':')}:00+07:00`;
}

function getSchedule({ store }) {
  return ok({ ...store.eksposSchedule, sessions: eksposSessionsOf(store) });
}

function findSession(store, id) {
  return eksposSessionsOf(store).find((s) => s.id === id) ?? null;
}

function createMeeting({ params, body, store }) {
  const result = validateEksposMeeting(body);
  if (!result.valid) {
    return invalid(result);
  }
  const session = findSession(store, params.id);
  if (!session) {
    return notFound('Sesi ekspos');
  }
  if (session.mode !== 'Daring') {
    return fail(409, 'INVALID_STATE',
      'Ekspos luring tidak memerlukan tautan rapat.');
  }
  if (session.meetingUrl) {
    return fail(409, 'MEETING_EXISTS',
      'Tautan rapat untuk sesi ini sudah dibuat.');
  }
  const seq = String(session.antrian).padStart(4, '0');
  Object.assign(session, { platform: body.platform, mulai: body.mulai,
    meetingUrl: `${MEETING_URL_PREFIX[body.platform]}${seq}` });
  return ok(session);
}

function createBap({ params, body, store }) {
  const session = findSession(store, params.id);
  if (!session) {
    return notFound('Sesi ekspos');
  }
  const result = validateEksposBap(body, session.mode);
  if (!result.valid) {
    return invalid(result);
  }
  if (session.bap) {
    return fail(409, 'BAP_EXISTS',
      `BAP ${session.bap.nomor} sudah dibuat untuk sesi ini.`);
  }
  if (session.mode === 'Daring' && !session.meetingUrl) {
    return fail(409, 'MEETING_REQUIRED',
      'Buat tautan rapat daring sebelum mengisi BAP.');
  }
  const seq = String(session.antrian).padStart(4, '0');
  session.bap = {
    nomor: `BAP-EKS/${seq}/X/2026`, hasil: body.hasil,
    ringkasan: body.ringkasan.trim(),
    peserta: body.peserta.map((p) => p.trim()),
    rekamanUrl: String(body.rekamanUrl ?? '').trim() || null,
    durasiMenit: body.durasiMenit, dibuat: new Date().toISOString(),
  };
  return created(session);
}
