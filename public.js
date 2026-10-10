/**
 * @fileoverview Public reference routes (no login):
 * GET /status-permohonan — cek status RPTKA / HPK / billing DKPTKA /
 *   pendaftaran pemberi kerja from the Landing hero. Response never
 *   carries personal data (nama TKA, paspor, pemohon) because the
 *   endpoint is unauthenticated; pendaftaran dikecualikan — status
 *   akun pemberi kerja (NPWP) bukan data pribadi perorangan — supaya
 *   pemohon bisa cek status registrasi berkala tanpa login (AK-17).
 * GET /wilayah — region drill-down for the registration address.
 */

import {
  WILAYAH_LEVELS, validateStatusQuery,
} from '../../contracts/reference.js';
import { fail, invalid, notFound, ok, route } from '../router.js';

const EXPIRING_DAYS = 30;

export const PUBLIC_ROUTES = [
  route('GET', '/status-permohonan', getStatus, {
    tag: 'Publik',
    summary: 'Cek status permohonan tanpa login (tanpa data pribadi).',
    query: {
      jenis: 'wajib: rptka | hpk | billing | pendaftaran',
      nomor: 'wajib: barcode RPTKA (<=8 digit) / no. permohonan HPK ' +
        '(12 digit) / kode billing (15 digit) / NPWP pendaftaran ' +
        '(15-16 digit).',
    },
    example: { query: { jenis: 'hpk', nomor: '260900012345' } },
    responses: { 404: 'Nomor tidak ditemukan (NOT_FOUND).' },
  }),
  route('GET', '/wilayah', listWilayah, {
    tag: 'Referensi',
    summary: 'Wilayah turunan: tanpa query = provinsi; ?provinsi= -> ' +
      'kabupaten/kota; + ?kabupaten= -> kecamatan; + ?kecamatan= -> ' +
      'kelurahan/desa.',
    query: {
      provinsi: 'Nama provinsi induk.',
      kabupaten: 'Nama kabupaten/kota induk (butuh provinsi).',
      kecamatan: 'Nama kecamatan induk (butuh kabupaten).',
    },
    example: { query: { provinsi: 'JAWA BARAT' } },
    responses: { 404: 'Wilayah induk tidak dikenal (NOT_FOUND).' },
  }),
];

const LOOKUP = {
  hpk: findHpk,
  rptka: findRptka,
  billing: findBilling,
  pendaftaran: findPendaftaran,
};

function getStatus({ query, store }) {
  const result = validateStatusQuery(query);
  if (!result.valid) {
    return invalid(result);
  }
  const nomor = String(query.nomor).replace(/\s/g, '');
  const found = LOOKUP[query.jenis](store, nomor);
  if (!found) {
    return fail(404, 'NOT_FOUND',
      'Nomor tidak ditemukan. Periksa kembali jenis dan nomor.',
      { field: 'nomor' });
  }
  return ok({ jenis: query.jenis, nomor, ...found });
}

function allRows(byRole) {
  return Object.values(byRole).flat();
}

function findHpk(store, nomor) {
  const row = allRows(store.hpk).find((h) => h.noPermohonan === nomor);
  if (!row) {
    return null;
  }
  return {
    layanan: `HPK ${row.layanan}`, tanggal: row.tgl,
    tahap: store.HPK_STEPS[row.stepIdx], status: row.status, tone: row.tone,
  };
}

function findRptka(store, nomor) {
  const sk = allRows(store.tka).find((t) => t.barcode === nomor);
  if (sk) {
    const expiring = sk.sisa <= EXPIRING_DAYS;
    return {
      layanan: 'Pengesahan RPTKA', tanggal: sk.skTgl, tahap: 'Terbit',
      status: `Berlaku s.d. ${sk.akhir}`, tone: expiring ? 'amber' : 'green',
    };
  }
  const change = allRows(store.perubahan).find((c) => c.barcode === nomor);
  if (!change) {
    return null;
  }
  return {
    layanan: `Perubahan Pengesahan RPTKA · ${change.jenis}`,
    tanggal: change.suratTgl, tahap: change.status, status: change.status,
    tone: change.tone,
  };
}

function findBilling(store, nomor) {
  const bill = allRows(store.billing).find((b) => b.kode === nomor);
  if (!bill) {
    return null;
  }
  return {
    layanan: 'Billing DKPTKA', tanggal: bill.terbit, tahap: bill.status,
    status: bill.status, tone: bill.tone, batas: bill.batas, rupiah: bill.rupiah,
  };
}

/**
 * AK-17 (usulan [I]): cek status registrasi pemberi kerja by NPWP, tanpa
 * login — supaya pemohon bisa memeriksa "Menunggu verifikasi" / "Perlu
 * perbaikan" / "Aktif" secara berkala tanpa harus login dulu.
 */
function findPendaftaran(store, nomor) {
  const row = store.pendaftar.find((p) => p.npwp.replace(/\D/g, '') === nomor);
  if (!row) {
    return null;
  }
  return {
    layanan: `Registrasi Pemberi Kerja · ${row.nama}`, tanggal: row.tgl,
    tahap: row.status, status: row.status, tone: row.tone,
    ...(row.catatan ? { catatan: row.catatan } : {}),
  };
}

function listWilayah({ query, store }) {
  const parents = WILAYAH_LEVELS.slice(0, -1);
  const gap = parents.findIndex((level, i) =>
    i > 0 && query[level] && !query[parents[i - 1]]);
  if (gap > 0) {
    return fail(400, 'VALIDATION_ERROR',
      `Parameter ${parents[gap - 1]} wajib bila ${parents[gap]} diisi.`,
      { field: parents[gap - 1] });
  }
  let node = store.wilayah;
  let depth = 0;
  for (const level of parents) {
    const parent = query[level];
    if (!parent) {
      break;
    }
    node = Array.isArray(node) ? null : node?.[parent];
    if (!node) {
      return notFound(`Wilayah ${parent}`);
    }
    depth += 1;
  }
  const names = Array.isArray(node) ? node : Object.keys(node);
  return ok(names.map((nama) => ({ nama })),
    { total: names.length, level: WILAYAH_LEVELS[depth] });
}
