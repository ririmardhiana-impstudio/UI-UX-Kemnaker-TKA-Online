/**
 * @fileoverview Keputusan pencabutan oleh Direktur (KAK Modul 4, usulan):
 * target lookup, proposal (menunggu persetujuan Dirjen) and the Dirjen
 * decision. Split from siklus.js; rules in docs/shared/business-rules.md.
 * The actor names are fixed demo values; the backend takes the actor from
 * the session.
 */

import { ROLE_KEYS } from '../../contracts/schema.js';
import {
  KEPUTUSAN_STATUS, validatePencabutanDecision, validatePencabutanDirektur,
} from '../../contracts/siklus.js';
import {
  created, fail, invalid, list, notFound, ok, route,
} from '../router.js';
import * as events from './siklus-events.js';
import { pad, seed, today } from './siklus-shared.js';

const TAG_KP = 'Keputusan Pencabutan';
const BARCODE_RE = /^\d{8}$/;
const KP_TONE = { [KEPUTUSAN_STATUS.MENUNGGU]: 'amber',
  [KEPUTUSAN_STATUS.DICABUT]: 'red', [KEPUTUSAN_STATUS.DIKEMBALIKAN]: 'gray' };
/** Employer-initiated pencabutan statuses that block a new one. */
const EMPLOYER_PENCABUTAN_ACTIVE = ['Draf', 'Verifikasi',
  'Menunggu verifikasi Verifikator', 'Perlu perbaikan — ajukan kembali',
  'Diteruskan ke Validator'];

export const KEPUTUSAN_PENCABUTAN_ROUTES = [
  route('GET', '/keputusan-pencabutan', listKeputusan, {
    tag: TAG_KP, summary: 'Daftar usulan pencabutan oleh Direktur.',
    query: { status: 'Filter status (opsional)' },
  }),
  route('GET', '/keputusan-pencabutan/target', lookupTarget, {
    tag: TAG_KP, summary: 'Cek target pencabutan sebelum mengusulkan: ' +
      'identitas TKA + pemberi kerja dan hambatan (sudah dicabut / ' +
      'proses berjalan).',
    query: { barcode: 'Barcode Pengesahan RPTKA, 8 digit (wajib)' },
    example: { query: { barcode: '25118840' } },
    responses: { 400: 'Barcode bukan 8 digit.',
      404: 'Barcode tidak ditemukan.' },
  }),
  route('POST', '/keputusan-pencabutan', createKeputusan, {
    tag: TAG_KP, request: 'PencabutanDirekturRequest',
    summary: 'Direktur mengusulkan pencabutan (menunggu persetujuan Dirjen).',
    example: { body: { barcode: '25118840', dasar: 'Hasil pengawasan',
      uraian: 'Hasil pengawasan: TKA bekerja di luar jabatan yang disahkan.',
      lampiranNama: 'bap-pengawasan.pdf' } },
    responses: { 404: 'Barcode tidak ditemukan.',
      409: 'Sudah dicabut atau masih ada proses pencabutan.' },
  }),
  route('POST', '/keputusan-pencabutan/:id/decision', decideKeputusan, {
    tag: TAG_KP, request: 'PencabutanDecisionRequest',
    summary: 'Keputusan Dirjen: setujui -> Dicabut, kembalikan -> ' +
      'Dikembalikan ke Direktur.',
    example: { params: { id: 'kp3' }, body: { decision: 'setujui',
      catatan: 'Disetujui sesuai hasil pengawasan.' } },
    responses: { 404: 'Usulan tidak ditemukan.', 409: 'Sudah final.' },
  }),
];

function findTkaAnyRole(store, barcode) {
  const role = ROLE_KEYS.find((r) =>
    store.tka[r].some((t) => t.barcode === barcode));
  return role
    ? { role, tka: store.tka[role].find((t) => t.barcode === barcode) } : null;
}

function listKeputusan({ query, store }) {
  const rows = seed(store).keputusanPencabutan;
  return list(query.status ? rows.filter((r) => r.status === query.status)
    : rows);
}

/**
 * Why a new pencabutan cannot be proposed for this barcode (null = none).
 * Also used by surat keterangan (siklus.js).
 * @param {!Object} store
 * @param {?string} barcode
 * @return {?string}
 */
export function pencabutanBlocker(store, barcode) {
  const usulan = seed(store).keputusanPencabutan.find((k) =>
    k.barcode === barcode && k.status !== KEPUTUSAN_STATUS.DIKEMBALIKAN);
  if (usulan?.status === KEPUTUSAN_STATUS.DICABUT) {
    return 'Pengesahan sudah dicabut.';
  }
  if (usulan) {
    return `Usulan ${usulan.noUsulan} masih menunggu persetujuan Dirjen.`;
  }
  const employer = (store.pencabutan ?? []).find((p) => p.barcode === barcode);
  if (employer?.status === 'Terbit') {
    return 'Pengesahan sudah dicabut atas permohonan pemberi kerja.';
  }
  if (employer && EMPLOYER_PENCABUTAN_ACTIVE.includes(employer.status)) {
    return 'Ada permohonan pencabutan dari pemberi kerja yang sedang ' +
      'diproses.';
  }
  return null;
}

function lookupTarget({ query, store }) {
  const barcode = String(query.barcode ?? '').trim();
  if (!BARCODE_RE.test(barcode)) {
    return fail(400, 'VALIDATION_ERROR', 'Barcode harus 8 digit angka.',
      { field: 'barcode' });
  }
  const found = findTkaAnyRole(store, barcode);
  if (!found) {
    return notFound('Pengesahan RPTKA dengan barcode ini');
  }
  const { tka, role } = found;
  return ok({ barcode, nama: tka.nama, jabatan: tka.jabatan,
    negara: tka.negara ?? null, pemberiKerja: store.companies[role].nama,
    mulai: tka.mulai ?? null, akhir: tka.akhir ?? null,
    blocker: pencabutanBlocker(store, barcode) });
}

function createKeputusan({ body, store }) {
  const result = validatePencabutanDirektur(body);
  if (!result.valid) {
    return invalid(result);
  }
  seed(store);
  const found = findTkaAnyRole(store, body.barcode);
  if (!found) {
    return notFound('Pengesahan RPTKA dengan barcode ini');
  }
  const blocker = pencabutanBlocker(store, body.barcode);
  if (blocker) {
    return fail(409, 'CONFLICT', blocker, { field: 'barcode' });
  }
  store.siklusSeq.kp += 1;
  const n = store.siklusSeq.kp;
  const status = KEPUTUSAN_STATUS.MENUNGGU;
  const item = {
    id: `kp${n}`, noUsulan: `KP-2610-${pad(n)}`, barcode: body.barcode,
    role: found.role, nama: found.tka.nama, jabatan: found.tka.jabatan,
    pemberiKerja: store.companies[found.role].nama,
    dasar: body.dasar, uraian: body.uraian.trim(),
    lampiranNama: body.lampiranNama.trim(),
    status, tone: KP_TONE[status], diajukan: today(store), noSk: null,
    catatanDirjen: null,
    riwayat: [{ status, tgl: today(store), oleh: 'Direktur PPTKA',
      catatan: body.dasar }],
  };
  store.keputusanPencabutan.unshift(item);
  events.onKeputusanCreated(store, item);
  return created(item);
}

function decideKeputusan({ params, body, store }) {
  const result = validatePencabutanDecision(body);
  if (!result.valid) {
    return invalid(result);
  }
  const item = seed(store).keputusanPencabutan.find((k) => k.id === params.id);
  if (!item) {
    return notFound('Usulan pencabutan');
  }
  if (item.status !== KEPUTUSAN_STATUS.MENUNGGU) {
    return fail(409, 'INVALID_STATE',
      `Usulan berstatus "${item.status}"; keputusan sudah final.`);
  }
  const isApprove = body.decision === 'setujui';
  const status = isApprove ? KEPUTUSAN_STATUS.DICABUT
    : KEPUTUSAN_STATUS.DIKEMBALIKAN;
  const catatan = body.catatan?.trim() || null;
  Object.assign(item, { status, tone: KP_TONE[status],
    catatanDirjen: catatan });
  if (isApprove) {
    store.siklusSeq.kep += 1;
    item.noSk = `KEP.PC/${pad(store.siklusSeq.kep)}/X/2026`;
    const tka = store.tka[item.role].find((t) => t.barcode === item.barcode);
    Object.assign(tka ?? {}, { dicabut: true });
  }
  item.riwayat.push({ status, tgl: today(store),
    oleh: 'Direktur Jenderal Binapenta dan PKK', catatan });
  events.onKeputusanDecided(store, item, KEPUTUSAN_STATUS.MENUNGGU, isApprove);
  return ok(item);
}
