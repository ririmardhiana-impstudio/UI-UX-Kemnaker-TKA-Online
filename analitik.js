/**
 * @fileoverview Analitik & OCR routes (KAK Modul 6): dimensions, seeded
 * TKA usage aggregates with multi-dimension filter, export jobs, and OCR
 * extraction. Rules AN-01..AN-07 (docs/shared/business-rules.md).
 */

import {
  OCR_AMBANG_KEYAKINAN, validateAnalitikExport, validateAnalitikQuery,
  validateOcrRequest,
} from '../../contracts/analitik.js';
import {
  DEFAULT_DARI, DKPTKA_PER_BULAN, JABATAN, KAB_SHARES, PERIODE,
  PERIODE_AKHIR, PERIODE_AWAL, PERUSAHAAN_PER_PENGESAHAN, PORSI_BERBAYAR,
  PROVINSI, SEKTOR, TKA_PER_PENGESAHAN, analitikCube, cubeIndex,
} from '../fixtures/analitik.js';
import { OCR_FIXTURES, OCR_UNREADABLE_MARKER } from '../fixtures/ocr.js';
import {
  accepted, fail, invalid, notFound, ok, route,
} from '../router.js';

const RANGE_MESSAGE = 'Data tersedia Oktober 2024 – September 2026.';
const EXPORT_EXAMPLE = { format: 'xlsx',
  filter: { dari: '2025-10', sampai: '2026-09' } };

export const ANALITIK_ROUTES = [
  route('GET', '/analitik/dimensi', getDimensi, {
    tag: 'Analitik',
    summary: 'Pilihan filter: provinsi, kabupaten per provinsi, sektor ' +
      'KBLI, jabatan, dan rentang periode yang tersedia.',
  }),
  route('GET', '/analitik/penggunaan-tka', getPenggunaan, {
    tag: 'Analitik',
    summary: 'Agregat penggunaan TKA (ringkasan, per periode, provinsi, ' +
      'kabupaten bila provinsi difilter, sektor, jabatan).',
    query: {
      provinsi: 'Nama provinsi (opsional)',
      kabupaten: 'Nama kab/kota, hanya bersama provinsi (opsional)',
      sektor: 'Kode kategori KBLI (opsional)',
      jabatan: 'Nama jabatan (opsional)',
      dari: 'YYYY-MM (opsional, default 12 bulan terakhir)',
      sampai: 'YYYY-MM (opsional), rentang maks. 24 bulan',
    },
    example: { query: { provinsi: 'Jawa Barat', dari: '2025-10',
      sampai: '2026-09' } },
  }),
  route('POST', '/analitik/exports', createExport, {
    tag: 'Analitik',
    summary: 'Minta ekspor data analitik (xlsx | pdf); diproses asinkron.',
    request: 'AnalitikExportRequest',
    example: { body: EXPORT_EXAMPLE },
  }),
  route('GET', '/analitik/exports/:id', getExport, {
    tag: 'Analitik',
    summary: 'Status + baris data ekspor (prototipe: langsung Selesai).',
    example: { params: { id: 'EXP-0001' },
      before: [{ method: 'POST', path: '/analitik/exports',
        body: EXPORT_EXAMPLE }] },
  }),
  route('POST', '/ocr/extractions', extractOcr, {
    tag: 'OCR',
    summary: 'Ekstraksi teks dokumen (Paspor, NPWP, NIB, Akta) dengan ' +
      'tingkat keyakinan per field.',
    request: 'OcrRequest',
    responses: { 422: 'Dokumen tidak terbaca (OCR_UNREADABLE).' },
  }),
];

function getDimensi() {
  return ok({
    provinsi: PROVINSI.map((p) => p.nama),
    kabupaten: Object.fromEntries(PROVINSI.map((p) => [p.nama, p.kab])),
    sektor: SEKTOR.map(({ kode, nama }) => ({ kode, nama })),
    jabatan: JABATAN.map((j) => j.nama),
    periode: { dari: PERIODE_AWAL, sampai: PERIODE_AKHIR,
      defaultDari: DEFAULT_DARI },
  });
}

/**
 * Validate + resolve a filter into cube indexes.
 * @return {{error: ?Object, filter: ?Object}}
 */
function resolveFilter(raw) {
  const query = { ...raw };
  query.dari ||= DEFAULT_DARI;
  query.sampai ||= PERIODE_AKHIR;
  const result = validateAnalitikQuery(query);
  if (!result.valid) {
    return { error: invalid(result) };
  }
  if (query.dari < PERIODE_AWAL || query.dari > PERIODE_AKHIR) {
    return { error: fieldError('dari', RANGE_MESSAGE) };
  }
  if (query.sampai > PERIODE_AKHIR) {
    return { error: fieldError('sampai', RANGE_MESSAGE) };
  }
  const p = query.provinsi
    ? PROVINSI.findIndex((x) => x.nama === query.provinsi) : -1;
  if (query.provinsi && p < 0) {
    return { error: fieldError('provinsi', 'Provinsi tidak dikenal.') };
  }
  const k = query.kabupaten ? PROVINSI[p].kab.indexOf(query.kabupaten) : -1;
  if (query.kabupaten && k < 0) {
    return { error: fieldError('kabupaten',
      'Kabupaten/kota tidak berada di provinsi terpilih.') };
  }
  const s = query.sektor ? SEKTOR.findIndex((x) => x.kode === query.sektor)
    : -1;
  if (query.sektor && s < 0) {
    return { error: fieldError('sektor', 'Sektor tidak dikenal.') };
  }
  const j = query.jabatan
    ? JABATAN.findIndex((x) => x.nama === query.jabatan) : -1;
  if (query.jabatan && j < 0) {
    return { error: fieldError('jabatan', 'Jabatan tidak dikenal.') };
  }
  const t0 = PERIODE.findIndex((x) => x.kode === query.dari);
  const t1 = PERIODE.findIndex((x) => x.kode === query.sampai);
  return { error: null, filter: { query, p, k, s, j, t0, t1 } };
}

function fieldError(field, message) {
  return fail(400, 'VALIDATION_ERROR', message,
    { field, fields: { [field]: message } });
}

/**
 * Sum the cube over the filter, grouped by a key function.
 * @return {!Object<string, number>} key -> TKA (integer).
 */
function sumBy(filter, keyOf) {
  const cube = analitikCube();
  const out = {};
  const share = filter.k >= 0 ? KAB_SHARES[filter.k] : 1;
  for (let t = filter.t0; t <= filter.t1; t++) {
    for (let p = 0; p < PROVINSI.length; p++) {
      if (filter.p >= 0 && p !== filter.p) {
        continue;
      }
      for (let s = 0; s < SEKTOR.length; s++) {
        if (filter.s >= 0 && s !== filter.s) {
          continue;
        }
        for (let j = 0; j < JABATAN.length; j++) {
          if (filter.j >= 0 && j !== filter.j) {
            continue;
          }
          const key = keyOf(t, p, s, j);
          out[key] = (out[key] ?? 0) + cube[cubeIndex(t, p, s, j)];
        }
      }
    }
  }
  if (share !== 1) {
    for (const key of Object.keys(out)) {
      out[key] = Math.round(out[key] * share);
    }
  }
  return out;
}

const byTkaDesc = (a, b) => b.tka - a.tka;

/** Aggregate payload for a resolved filter (shared with exports). */
function aggregate(filter) {
  const perT = sumBy(filter, (t) => t);
  const perPeriode = PERIODE.slice(filter.t0, filter.t1 + 1).map((per, i) => {
    const tka = perT[filter.t0 + i] ?? 0;
    return { periode: per.kode, label: per.label, tka,
      pengesahan: Math.round(tka / TKA_PER_PENGESAHAN) };
  });
  const perS = sumBy(filter, (t, p, s) => s);
  const totalTka = perPeriode.reduce((sum, x) => sum + x.tka, 0);
  const totalPengesahan = perPeriode.reduce((sum, x) => sum + x.pengesahan,
    0);
  const pnbp = SEKTOR.reduce((sum, sek, s) => sum +
    (perS[s] ?? 0) * sek.bulan * DKPTKA_PER_BULAN * PORSI_BERBAYAR, 0);
  const perP = sumBy(filter, (t, p) => p);
  const perJ = sumBy(filter, (t, p, s, j) => j);
  const prov = filter.p >= 0 ? PROVINSI[filter.p] : null;
  return {
    filter: filter.query,
    ringkasan: {
      totalTka,
      totalPengesahan,
      pnbpRupiah: Math.round(pnbp / 1000) * 1000,
      perusahaan: Math.round(totalPengesahan * PERUSAHAAN_PER_PENGESAHAN),
    },
    perPeriode,
    perProvinsi: Object.entries(perP)
      .map(([p, tka]) => ({ nama: PROVINSI[p].nama, tka })).sort(byTkaDesc),
    perKabupaten: prov ? prov.kab
      .map((nama, k) => ({ nama, tka: Math.round(totalTka /
        (filter.k >= 0 ? KAB_SHARES[filter.k] : 1) * KAB_SHARES[k]) }))
      .filter((_, k) => filter.k < 0 || k === filter.k) : null,
    perSektor: Object.entries(perS).map(([s, tka]) => ({
      kode: SEKTOR[s].kode, nama: SEKTOR[s].nama, tka })).sort(byTkaDesc),
    perJabatan: Object.entries(perJ)
      .map(([j, tka]) => ({ nama: JABATAN[j].nama, tka })).sort(byTkaDesc),
  };
}

function getPenggunaan({ query }) {
  const { error, filter } = resolveFilter(query);
  return error ?? ok(aggregate(filter));
}

function createExport({ body, store }) {
  const result = validateAnalitikExport(body);
  if (!result.valid) {
    return invalid(result);
  }
  const { error, filter } = resolveFilter(body.filter);
  if (error) {
    return error;
  }
  store.analitikExports ??= {};
  store.analitikExportSeq = (store.analitikExportSeq ?? 0) + 1;
  const exportId = `EXP-${String(store.analitikExportSeq).padStart(4, '0')}`;
  store.analitikExports[exportId] = { exportId, format: body.format,
    filter: filter.query, status: 'Diproses' };
  return accepted({ exportId, status: 'Diproses', format: body.format });
}

function getExport({ params, store }) {
  const job = store.analitikExports?.[params.id];
  if (!job) {
    return notFound('Ekspor');
  }
  const { filter } = resolveFilter(job.filter);
  job.status = 'Selesai';
  const range = `${filter.query.dari}_${filter.query.sampai}`;
  return ok({
    ...job,
    fileName: `analitik-penggunaan-tka-${range}.${job.format}`,
    columns: ['periode', 'wilayah', 'sektor', 'jabatan', 'tka',
      'pengesahan'],
    rows: exportRows(filter),
  });
}

/** Rows per periode × provinsi (or × kab/kota when provinsi filtered). */
function exportRows(filter) {
  const sektor = filter.s >= 0 ? SEKTOR[filter.s].nama : 'Semua sektor';
  const jabatan = filter.j >= 0 ? JABATAN[filter.j].nama : 'Semua jabatan';
  const cells = sumBy(filter, (t, p) => `${t}|${p}`);
  const rows = [];
  for (const [key, tka] of Object.entries(cells)) {
    const [t, p] = key.split('|').map(Number);
    const wilayahs = filter.p >= 0
      ? PROVINSI[p].kab.map((nama, k) => ({ nama, share: KAB_SHARES[k], k }))
        .filter((x) => filter.k < 0 || x.k === filter.k)
      : [{ nama: PROVINSI[p].nama, share: 1 }];
    for (const w of wilayahs) {
      const value = filter.k >= 0 ? tka
        : Math.round(tka * w.share);
      rows.push({ periode: PERIODE[t].kode, wilayah: w.nama, sektor,
        jabatan, tka: value,
        pengesahan: Math.round(value / TKA_PER_PENGESAHAN) });
    }
  }
  return rows.filter((r) => r.tka > 0);
}

function extractOcr({ body }) {
  const result = validateOcrRequest(body);
  if (!result.valid) {
    return invalid(result);
  }
  if (OCR_UNREADABLE_MARKER.test(body.fileName)) {
    return fail(422, 'OCR_UNREADABLE',
      'Dokumen tidak terbaca, unggah ulang yang lebih jelas.',
      { field: 'fileName' });
  }
  const fields = structuredClone(OCR_FIXTURES[body.jenisDokumen]);
  return ok({
    jenisDokumen: body.jenisDokumen,
    fileName: body.fileName,
    ambangKeyakinan: OCR_AMBANG_KEYAKINAN,
    perluPeriksa: fields.some((f) => f.keyakinan < OCR_AMBANG_KEYAKINAN),
    fields,
  });
}
