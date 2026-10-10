/**
 * @fileoverview RPTKA life-cycle routes (KAK Modul 4 + use case Surat
 * Keterangan): perpanjangan dengan cakupan wilayah and surat keterangan
 * (pencabutan oleh Direktur lives in keputusan-pencabutan.js). Rules
 * SK-01..SK-09 (docs/shared/business-rules.md). Collections are seeded
 * lazily (siklus-shared.js).
 */

import { ROLE_KEYS } from '../../contracts/schema.js';
import {
  DIPROSES_OLEH, PERPANJANGAN_WINDOW_DAYS, SURAT_KETERANGAN_NEXT,
  SURAT_KETERANGAN_STATUS, validatePerpanjangan, validateSuratKeterangan,
  validateSuratKeteranganTransition,
} from '../../contracts/siklus.js';
import {
  checkRole, created, fail, invalid, list, notFound, ok, route,
} from '../router.js';
import { pencabutanBlocker } from './keputusan-pencabutan.js';
import * as events from './siklus-events.js';
import { pad, seed, today } from './siklus-shared.js';

const ROLE_QUERY = { role: 'swasta | lembaga | pemerintah (wajib)' };
const TAG_PRP = 'Perpanjangan';
const TAG_SKET = 'Surat Keterangan';
const SKET_TONE = { Diajukan: 'amber', Diproses: 'blue', Terbit: 'green',
  Ditolak: 'red' };
const ACTIVE_SKET = [SURAT_KETERANGAN_STATUS.DIAJUKAN,
  SURAT_KETERANGAN_STATUS.DIPROSES];

export const SIKLUS_ROUTES = [
  route('POST', '/perpanjangan', scoped(createPerpanjangan), {
    tag: TAG_PRP, request: 'PerpanjanganRequest', query: ROLE_QUERY,
    summary: 'Ajukan perpanjangan dengan cakupan wilayah kerja; ' +
      'menentukan unit pemroses.',
    example: { query: { role: 'swasta' }, body: { basisBarcode: '26004518',
      tkaIds: ['25103377'], cakupanWilayah: 'lintas-provinsi',
      provinsiTujuan: ['BANTEN'] } },
    responses: { 404: 'Dasar perpanjangan / TKA tidak ditemukan.',
      409: 'TKA sudah dalam permohonan perpanjangan berjalan.',
      422: 'TKA di luar jendela 90 hari / RPTKA jangka pendek.' },
  }),
  route('GET', '/surat-keterangan', scoped(listSuratKeterangan), {
    tag: TAG_SKET, summary: 'Daftar permohonan surat keterangan per role.',
    query: ROLE_QUERY, example: { query: { role: 'swasta' } },
  }),
  route('GET', '/surat-keterangan/:id', scoped(getSuratKeterangan), {
    tag: TAG_SKET, summary: 'Detail surat keterangan + riwayat status.',
    query: ROLE_QUERY,
    example: { params: { id: 'sk1' }, query: { role: 'swasta' } },
    responses: { 404: 'Surat keterangan tidak ditemukan.' },
  }),
  route('POST', '/surat-keterangan', scoped(createSuratKeterangan), {
    tag: TAG_SKET, request: 'SuratKeteranganRequest', query: ROLE_QUERY,
    summary: 'Ajukan surat keterangan (status Diajukan).',
    example: { query: { role: 'swasta' }, body: {
      jenis: 'Keterangan Status Pengesahan RPTKA',
      keperluan: 'Persyaratan perpanjangan izin tinggal di Imigrasi.',
      barcode: '24871365' } },
    responses: { 404: 'Barcode bukan milik pemberi kerja.',
      409: 'Permohonan sejenis masih berjalan.',
      422: 'SK sedang dalam proses pencabutan.' },
  }),
  route('POST', '/surat-keterangan/:id/transition',
    scoped(transitionSurat), {
    tag: TAG_SKET, request: 'SuratKeteranganTransitionRequest',
    query: ROLE_QUERY,
    summary: '[I] Petugas memproses: Diajukan -> Diproses -> Terbit/Ditolak.',
    example: { params: { id: 'sk3' }, query: { role: 'swasta' },
      body: { status: 'Terbit' } },
    responses: { 404: 'Surat keterangan tidak ditemukan.',
      409: 'Transisi status tidak diizinkan.' },
  }),
];

/** Wrap a role-scoped handler: 400 unless ?role= is an employer key. */
function scoped(handler) {
  return (req) => checkRole(req.query.role) ?? handler(req);
}

function findBasis(store, role, barcode) {
  if (store.companies[role]?.hpk) {
    return store.hpk[role].find((h) => h.barcode === barcode &&
      h.stepIdx >= 8) ?? null;
  }
  return store.tka[role].find((t) => t.barcode === barcode) ?? null;
}

function checkWilayah(store, body, origin) {
  const provinsi = body.provinsiTujuan ?? [];
  const known = Object.keys(store.wilayah);
  const unknown = provinsi.find((p) => !known.includes(p));
  if (unknown) {
    return { provinsiTujuan: `Provinsi ${unknown} tidak dikenal.` };
  }
  if (body.cakupanWilayah === 'lintas-provinsi' &&
      !provinsi.some((p) => p !== origin)) {
    return { provinsiTujuan: 'Lintas provinsi: minimal satu provinsi ' +
      `tujuan berbeda dari provinsi asal (${origin}).` };
  }
  if (body.cakupanWilayah === 'satu-provinsi') {
    if (provinsi.some((p) => p !== origin)) {
      return { provinsiTujuan: 'Provinsi tujuan berbeda dari asal; ' +
        'gunakan cakupan lintas provinsi.' };
    }
    const kabs = Object.keys(store.wilayah[origin] ?? {});
    const badKab = kabs.length && (body.kabupatenTujuan ?? [])
      .find((k) => !kabs.includes(k));
    if (badKab) {
      return { kabupatenTujuan: `${badKab} tidak berada di ${origin}.` };
    }
  }
  return null;
}

function createPerpanjangan({ query, body, store }) {
  const result = validatePerpanjangan(body);
  if (!result.valid) {
    return invalid(result);
  }
  const role = query.role;
  seed(store);
  const basis = findBasis(store, role, body.basisBarcode);
  if (!basis) {
    return notFound('RPTKA/HPK dasar perpanjangan');
  }
  if (/Sementara/.test(basis.layanan ?? '')) {
    return fail(422, 'NOT_EXTENDABLE', 'RPTKA jangka pendek (Sementara ' +
      '1–6 bulan) tidak dapat diperpanjang.', { field: 'basisBarcode' });
  }
  const ids = [...new Set(body.tkaIds)];
  const tka = ids.map((id) => store.tka[role].find((t) => t.barcode === id));
  if (tka.some((t) => !t)) {
    return notFound('TKA');
  }
  const revoked = tka.filter((t) => t.dicabut);
  if (revoked.length) {
    return fail(422, 'REVOKED', 'Pengesahan TKA sudah dicabut: ' +
      `${revoked.map((t) => t.nama).join(', ')}.`,
    { field: 'tkaIds', ids: revoked.map((t) => t.barcode) });
  }
  const outside = tka.filter((t) => t.sisa > PERPANJANGAN_WINDOW_DAYS);
  if (outside.length) {
    return fail(422, 'OUTSIDE_WINDOW', 'Perpanjangan hanya untuk TKA yang ' +
      `berakhir ≤ ${PERPANJANGAN_WINDOW_DAYS} hari lagi: ` +
      `${outside.map((t) => t.nama).join(', ')}.`,
    { field: 'tkaIds', ids: outside.map((t) => t.barcode) });
  }
  const rows = store.perpanjangan[role];
  const busy = ids.filter((id) => rows.some((r) => r.status === 'Diajukan' &&
    r.tka.some((t) => t.barcode === id)));
  if (busy.length) {
    return fail(409, 'CONFLICT', 'TKA sudah dalam permohonan perpanjangan ' +
      'yang sedang berjalan.', { field: 'tkaIds', ids: busy });
  }
  const origin = store.companies[role].prov;
  const wilayahError = checkWilayah(store, body, origin);
  if (wilayahError) {
    return invalid({ valid: false, errors: wilayahError });
  }
  store.siklusSeq.prp += 1;
  const item = {
    id: `prp${store.siklusSeq.prp}`,
    noPermohonan: `2610${pad(ROLE_KEYS.indexOf(role) + 1, 2)}` +
      pad(store.siklusSeq.prp, 6),
    basisBarcode: body.basisBarcode,
    tka: tka.map((t) => ({ barcode: t.barcode, nama: t.nama,
      jabatan: t.jabatan, sisa: t.sisa })),
    cakupanWilayah: body.cakupanWilayah,
    provinsiAsal: origin,
    kabupatenAsal: store.companies[role].kab,
    provinsiTujuan: body.cakupanWilayah === 'satu-kabupaten' ? []
      : (body.provinsiTujuan?.length ? body.provinsiTujuan : [origin]),
    kabupatenTujuan: body.kabupatenTujuan ?? [],
    diprosesOleh: DIPROSES_OLEH[body.cakupanWilayah],
    status: 'Diajukan', tone: 'blue', diajukan: today(store),
  };
  rows.unshift(item);
  events.onPerpanjanganCreated(store, role, item);
  return created(item);
}

const findSurat = (store, role, id) =>
  seed(store).suratKeterangan[role].find((s) => s.id === id) ?? null;

function listSuratKeterangan({ query, store }) {
  return list(seed(store).suratKeterangan[query.role]);
}

function getSuratKeterangan({ params, query, store }) {
  const item = findSurat(store, query.role, params.id);
  return item ? ok(item) : notFound('Surat keterangan');
}

function createSuratKeterangan({ query, body, store }) {
  const result = validateSuratKeterangan(body);
  if (!result.valid) {
    return invalid(result);
  }
  const role = query.role;
  seed(store);
  const barcode = body.barcode || null;
  const tka = barcode
    ? store.tka[role].find((t) => t.barcode === barcode) : null;
  if (barcode && !tka) {
    return notFound('Pengesahan RPTKA dengan barcode ini');
  }
  const rows = store.suratKeterangan[role];
  const running = rows.find((s) => s.jenis === body.jenis &&
    s.barcode === barcode && ACTIVE_SKET.includes(s.status));
  if (running) {
    return fail(409, 'CONFLICT', `Permohonan sejenis ${running.noPermohonan} ` +
      'masih berjalan.', { field: 'jenis' });
  }
  if (/Pencabutan/.test(body.jenis) && pencabutanBlocker(store, barcode)) {
    return fail(422, 'PRECONDITION_FAILED', 'SK Pengesahan ini sudah ' +
      'dicabut atau sedang dalam proses pencabutan.', { field: 'barcode' });
  }
  store.siklusSeq.sk += 1;
  const n = store.siklusSeq.sk;
  const status = SURAT_KETERANGAN_STATUS.DIAJUKAN;
  const item = {
    id: `sk${n}`, noPermohonan: `SKET-2610-${pad(n)}`, jenis: body.jenis,
    keperluan: body.keperluan.trim(), barcode, namaTka: tka?.nama ?? null,
    status, tone: SKET_TONE[status], diajukan: today(store),
    nomorSurat: null, terbit: null, catatan: null,
    riwayat: [{ status, tgl: today(store),
      oleh: store.companies[role].nama, catatan: null }],
  };
  rows.unshift(item);
  return created(item);
}

function transitionSurat({ params, query, body, store }) {
  const result = validateSuratKeteranganTransition(body);
  if (!result.valid) {
    return invalid(result);
  }
  const item = findSurat(store, query.role, params.id);
  if (!item) {
    return notFound('Surat keterangan');
  }
  if (!SURAT_KETERANGAN_NEXT[item.status].includes(body.status)) {
    return fail(409, 'INVALID_STATE', `Status ${item.status} tidak dapat ` +
      `diubah menjadi ${body.status}.`);
  }
  const catatan = body.catatan?.trim() || null;
  Object.assign(item, { status: body.status, tone: SKET_TONE[body.status] });
  if (body.status === SURAT_KETERANGAN_STATUS.TERBIT) {
    store.siklusSeq.sket += 1;
    item.nomorSurat = `SKET/${pad(store.siklusSeq.sket)}/X/2026`;
    item.terbit = today(store);
  }
  if (body.status === SURAT_KETERANGAN_STATUS.DITOLAK) {
    item.catatan = catatan;
  }
  item.riwayat.push({ status: body.status, tgl: today(store),
    oleh: 'Petugas Subdit Pengesahan', catatan });
  events.onSuratFinal(store, query.role, item);
  return ok(item);
}
