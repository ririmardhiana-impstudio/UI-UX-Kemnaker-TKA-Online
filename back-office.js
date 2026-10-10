/**
 * @fileoverview Back-office action routes (usulan desain):
 * keputusan antrian per tahap, tanda tangan elektronik massal direktur,
 * aktivasi / permintaan perbaikan akun pendaftar.
 *
 * Stage flow per jenis (setujui -> next, kembalikan -> previous; from the
 * first stage "kembalikan" returns the file to the applicant). Rantai
 * "Gabungan" KAK Modul 5 [I]: HPK & Pengesahan end at the Direktur
 * Jenderal; Perubahan does not go through the Dirjen.
 *   HPK:        Verifikasi Data dan Upload -> Jadwal Ekspos ->
 *               Pemeriksaan Kasi -> Pemeriksaan Kasubdit ->
 *               Pemeriksaan dan Penandatanganan Direktur ->
 *               Persetujuan Direktur Jenderal -> Penomoran
 *   Pengesahan: Verifikasi Data dan Upload -> Pemeriksaan Subkoordinator ->
 *               Pemeriksaan Koordinator -> Persetujuan Direktur ->
 *               Persetujuan Direktur Jenderal -> Pembayaran DKPTKA
 *   Perubahan:  Pemeriksaan Petugas -> Pemeriksaan Subkoordinator ->
 *               Pemeriksaan Koordinator -> Persetujuan Direktur -> Terbit
 *
 * Director TTE moves HPK/Pengesahan to the Dirjen stage; the Simponi
 * billing code (DKPTKA) is issued when the Dirjen approves a Pengesahan.
 * Document annotations (pins) live per application and may only be added
 * or removed by the stage currently holding the file.
 */

import {
  validateAnnotation,
  validateAntrianDecision,
  validateSignature,
} from '../../contracts/back-office.js';
import {
  ANNOTATIONS, DIRJEN_QUEUE, DIRJEN_STAGE,
} from '../fixtures/back-office.js';
import {
  PERPANJANGAN_KABKOTA_QUEUE, PERPANJANGAN_LINTAS_QUEUE,
} from '../fixtures/pengesahan-verifikasi.js';
import {
  created, fail, invalid, list, notFound, ok, route,
} from '../router.js';
import { appendAudit } from './security.js';

export const STAGE_FLOW = {
  HPK: ['Verifikasi Data dan Upload', 'Jadwal Ekspos', 'Pemeriksaan Kasi',
    'Pemeriksaan Kasubdit', 'Pemeriksaan dan Penandatanganan Direktur',
    DIRJEN_STAGE, 'Penomoran'],
  Pengesahan: ['Verifikasi Data dan Upload', 'Pemeriksaan Subkoordinator',
    'Pemeriksaan Koordinator', 'Persetujuan Direktur', DIRJEN_STAGE,
    'Pembayaran DKPTKA'],
  Perubahan: ['Pemeriksaan Petugas', 'Pemeriksaan Subkoordinator',
    'Pemeriksaan Koordinator', 'Persetujuan Direktur', 'Terbit'],
};

const DIRECTOR_STAGES = ['Pemeriksaan dan Penandatanganan Direktur',
  'Persetujuan Direktur'];
/**
 * Demo actor per stage for the audit log (prototype; BE takes the actor
 * from the session). Names follow the back-office demo roles.
 */
const STAGE_ACTOR = [
  [/Verifikasi Data|Pemeriksaan Petugas/,
    ['Nur Aisyah', 'Verifikator Permohonan', '10.12.4.21']],
  [/Ekspos/, ['Bayu Kurniawan', 'Petugas Ekspos', '10.12.4.30']],
  [/Kasi|Subkoordinator/,
    ['Hendro Wibowo', 'Validator (Kasi/Subkoordinator)', '10.12.4.37']],
  [/Kasubdit|Koordinator/,
    ['Ratna Sari Dewi', 'Kasubdit / Koordinator', '10.12.4.44']],
  [/Direktur Jenderal/, ['Direktur Jenderal Binapenta dan PKK',
    'Direktur Jenderal', '10.12.1.2']],
  [/Direktur/, ['Direktur PPTKA', 'Direktur PPTKA', '10.12.2.5']],
];
function auditBackOffice(store, actor, aksi, modul, objek, perubahan) {
  const [pengguna, peran, ip] = actor;
  appendAudit(store, { pengguna, peran, aksi, modul, objek, perubahan, ip });
}

function stageActor(tahap) {
  return STAGE_ACTOR.find(([pattern]) => pattern.test(tahap))?.[1] ??
    STAGE_ACTOR[0][1];
}

export const BACK_OFFICE_ROUTES = [
  route('POST', '/antrian/:id/decision', decide, {
    tag: 'Back Office',
    summary: 'Setujui (ke tahap berikut) / kembalikan (wajib catatan). ' +
      'Persetujuan Dirjen atas Pengesahan -> `billing` kode Simponi.',
    request: 'AntrianDecisionRequest',
    example: { params: { id: 'q2' }, body: { decision: 'setujui',
      tahap: 'Verifikasi Data dan Upload', catatan: '' } },
    responses: {
      409: 'Tahap sudah berubah / permohonan sudah final (INVALID_STATE).',
    },
  }),
  route('POST', '/antrian/signatures', sign, {
    tag: 'Back Office',
    summary: 'TTE massal direktur; HPK & Pengesahan diteruskan ke tahap ' +
      'Persetujuan Direktur Jenderal (Perubahan langsung Terbit).',
    request: 'SignatureRequest',
    example: { body: { ids: ['q7', 'q10'], passphrase: 'rahasia-tte' } },
    responses: {
      409: 'Ada dokumen yang tidak di tahap direktur (INVALID_STATE).',
    },
  }),
  route('GET', '/antrian/:id/annotations', listAnnotations, {
    tag: 'Back Office', summary: 'Anotasi dokumen (pin bernomor) permohonan.',
    example: { params: { id: 'q1' } },
  }),
  route('POST', '/antrian/:id/annotations', addAnnotation, {
    tag: 'Back Office',
    summary: 'Tambah anotasi; hanya tahap yang sedang memegang berkas.',
    request: 'AnnotationRequest',
    example: { params: { id: 'q1' } },
    responses: {
      409: 'Tahap sudah berubah / permohonan final (INVALID_STATE).',
    },
  }),
  route('DELETE', '/antrian/:id/annotations/:annotationId', deleteAnnotation, {
    tag: 'Back Office',
    summary: 'Hapus anotasi tahap berjalan (?tahap= wajib, optimistic lock).',
    query: { tahap: 'Tahap berkas saat ini (wajib).' },
    example: { params: { id: 'q1', annotationId: 'an-q1-1' },
      query: { tahap: 'Verifikasi Data dan Upload' } },
    responses: {
      409: 'Tahap berubah, berkas final, atau anotasi milik tahap ' +
        'sebelumnya (INVALID_STATE).',
    },
  }),
];

/**
 * Antrian with the Dirjen-stage fixture merged in (once per store).
 * @param {!Object} store
 * @return {!Array<!Object>}
 */
export function antrianOf(store) {
  if (!store.dirjenQueueSeeded) {
    store.antrian.push(...structuredClone(DIRJEN_QUEUE),
      ...structuredClone(PERPANJANGAN_LINTAS_QUEUE));
    store.dirjenQueueSeeded = true;
  }
  if (!store.kabkotaQueueSeeded) {
    store.antrian.push(...structuredClone(PERPANJANGAN_KABKOTA_QUEUE));
    store.kabkotaQueueSeeded = true;
  }
  return store.antrian;
}

function findAntrian(store, id) {
  return antrianOf(store).find((q) => q.id === id) ?? null;
}

function isFinal(row) {
  const flow = STAGE_FLOW[row.jenis] ?? [];
  const index = flow.indexOf(row.tahap);
  return index < 0 || index === flow.length - 1;
}

/** Move a row one stage; reaching the last stage marks it done. */
function moveTo(row, tahap, isReturn) {
  const flow = STAGE_FLOW[row.jenis];
  const isDone = tahap === flow[flow.length - 1];
  row.tahap = tahap;
  row.sla = isReturn ? 'Dikembalikan' : (isDone ? 'Selesai' : '3 hari');
  row.tone = isReturn ? 'red' : (isDone ? 'green' : 'blue');
}

/** Kode billing Simponi (15 digit, prefix 82 + yyyymmdd) — dummy. */
function simponiBilling(row) {
  const digits = row.no.replace(/\D/g, '').slice(-5).padStart(5, '0');
  return { kode: `8220261001${digits}`, tka: row.tka,
    status: 'Belum dibayar', tujuan: 'Simponi' };
}

function decide({ params, body, store }) {
  const result = validateAntrianDecision(body);
  if (!result.valid) {
    return invalid(result);
  }
  const row = findAntrian(store, params.id);
  if (!row) {
    return notFound('Permohonan');
  }
  if (isFinal(row)) {
    return fail(409, 'INVALID_STATE', 'Permohonan sudah final.');
  }
  if (row.tahap !== body.tahap) {
    return fail(409, 'INVALID_STATE',
      `Permohonan sudah berada di tahap ${row.tahap}.`);
  }
  const flow = STAGE_FLOW[row.jenis];
  const index = flow.indexOf(row.tahap);
  const isApprove = body.decision === 'setujui';
  const returnedToApplicant = !isApprove && index === 0;
  const isDirjenApproval = isApprove && row.tahap === DIRJEN_STAGE;
  const before = row.tahap;
  moveTo(row, isApprove ? flow[index + 1] : flow[Math.max(0, index - 1)],
    !isApprove);
  row.catatan = String(body.catatan ?? '').trim();
  row.checklist = body.checklist ?? [];
  const billing = isDirjenApproval && row.jenis === 'Pengesahan'
    ? simponiBilling(row) : null;
  auditBackOffice(store, stageActor(before),
    isApprove ? 'Setujui' : 'Kembalikan', 'Back Office',
    `${row.jenis} ${row.no ?? row.id}`, [
      { field: 'tahap', sebelum: before, sesudah: row.tahap },
      ...(row.catatan ? [{ field: 'catatan', sebelum: '',
        sesudah: row.catatan }] : []),
    ]);
  return ok({ ...row, returnedToApplicant, billing });
}

function sign({ body, store }) {
  const result = validateSignature(body);
  if (!result.valid) {
    return invalid(result);
  }
  const ids = [...new Set(body.ids)];
  const rows = ids.map((id) => findAntrian(store, id));
  const blocked = ids.filter((id, i) =>
    !rows[i] || !DIRECTOR_STAGES.includes(rows[i].tahap));
  if (blocked.length) {
    return fail(409, 'INVALID_STATE',
      'Sebagian dokumen tidak berada di tahap penandatanganan direktur.',
      { ids: blocked });
  }
  for (const row of rows) {
    const flow = STAGE_FLOW[row.jenis];
    const before = row.tahap;
    moveTo(row, flow[flow.indexOf(row.tahap) + 1], false);
    auditBackOffice(store, stageActor(before), 'Tanda tangan', 'Back Office',
      `${row.jenis} ${row.no ?? row.id}`,
      [{ field: 'tahap', sebelum: before, sesudah: row.tahap }]);
  }
  const forwarded = rows.filter((r) => r.tahap === DIRJEN_STAGE).length;
  return ok({ signed: rows.length, ids, forwardedToDirjen: forwarded,
    rows: structuredClone(rows) });
}

function annotationsOf(store, id) {
  store.annotations ??= structuredClone(ANNOTATIONS);
  store.annotations[id] ??= [];
  return store.annotations[id];
}

/** 409 unless the file is open and still at `tahap` (optimistic lock). */
function stageConflict(row, tahap) {
  if (isFinal(row)) {
    return fail(409, 'INVALID_STATE',
      'Permohonan sudah final; anotasi tidak dapat diubah.');
  }
  if (row.tahap !== tahap) {
    return fail(409, 'INVALID_STATE',
      `Permohonan sudah berada di tahap ${row.tahap}.`);
  }
  return null;
}

function listAnnotations({ params, store }) {
  const row = findAntrian(store, params.id);
  return row ? list(annotationsOf(store, row.id)) : notFound('Permohonan');
}

function addAnnotation({ params, body, store }) {
  const result = validateAnnotation(body);
  if (!result.valid) {
    return invalid(result);
  }
  const row = findAntrian(store, params.id);
  if (!row) {
    return notFound('Permohonan');
  }
  const conflict = stageConflict(row, body.tahap);
  if (conflict) {
    return conflict;
  }
  const items = annotationsOf(store, row.id);
  const nomor = items.reduce((max, a) => Math.max(max, a.nomor), 0) + 1;
  const item = {
    id: `an-${row.id}-${nomor}`, nomor, dokumen: body.dokumen.trim(),
    halaman: body.halaman, x: body.x, y: body.y,
    catatan: body.catatan.trim(), tahap: row.tahap,
    penulis: String(body.penulis ?? '').trim() || 'Petugas',
    dibuat: new Date().toISOString(),
  };
  items.push(item);
  return created(item);
}

function deleteAnnotation({ params, query, store }) {
  if (!String(query.tahap ?? '').trim()) {
    return invalid({ errors: { tahap: 'Wajib diisi.' } });
  }
  const row = findAntrian(store, params.id);
  if (!row) {
    return notFound('Permohonan');
  }
  const items = annotationsOf(store, row.id);
  const index = items.findIndex((a) => a.id === params.annotationId);
  if (index < 0) {
    return notFound('Anotasi');
  }
  const conflict = stageConflict(row, query.tahap);
  if (conflict) {
    return conflict;
  }
  if (items[index].tahap !== row.tahap) {
    return fail(409, 'INVALID_STATE',
      'Anotasi dari tahap sebelumnya tidak dapat dihapus.');
  }
  items.splice(index, 1);
  return ok({ id: params.annotationId });
}

