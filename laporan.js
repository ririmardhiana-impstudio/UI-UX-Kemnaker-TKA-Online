/**
 * @fileoverview Annual TKA report routes (§6.1 "wajib lapor tiap 1 tahun",
 * §6.4 upload .xlsx maks. 1 MB, §7.3 Draft -> Terkirim).
 */

import {
  validateLaporanUpload,
  validateSubmitLaporan,
} from '../../contracts/laporan.js';
import {
  checkRole, fail, invalid, list, ok, route,
} from '../router.js';

const STATUS_SENT = 'Terkirim';
/** Legacy preview: row index 4 has a passport that mismatches its SK. */
const INVALID_ROW_INDEX = 4;

export const LAPORAN_ROUTES = [
  route('GET', '/laporan-def', ({ store }) => list(store.laporanDef), {
    tag: 'Pelaporan', summary: 'Definisi 4 laporan (L1–L4).',
  }),
  route('GET', '/laporan', getLaporan, {
    tag: 'Pelaporan', summary: 'Status laporan periode berjalan per role.',
    query: { role: 'swasta | lembaga | pemerintah (wajib)' },
    example: { query: { role: 'swasta' } },
  }),
  route('GET', '/laporan-penggunaan', ({ store }) =>
    list(store.laporanPenggunaan), {
    tag: 'Pelaporan', summary: 'Baris Laporan Pelaksanaan Penggunaan TKA.',
  }),
  route('POST', '/laporan', submitLaporan, {
    tag: 'Pelaporan', summary: 'Kirim laporan periode (Draft -> Terkirim).',
    request: 'SubmitLaporanRequest',
    example: { body: { role: 'swasta', periode: 2025, agree: true } },
    responses: { 409: 'Laporan periode ini sudah Terkirim.' },
  }),
  route('POST', '/laporan/uploads', uploadLaporan, {
    tag: 'Pelaporan',
    summary: 'Unggah Excel laporan; kembalikan pratinjau validasi baris.',
    request: 'LaporanUploadRequest',
    example: { body: { role: 'swasta', kode: 'L1',
      fileName: 'laporan-penggunaan-tka-2025.xlsx', fileSize: 49152 } },
    responses: { 409: 'Laporan sudah Terkirim, tidak dapat diubah.' },
  }),
];

function getLaporan({ query, store }) {
  const roleError = checkRole(query.role);
  return roleError ?? ok(store.laporan[query.role]);
}

function submitLaporan({ body, store }) {
  const result = validateSubmitLaporan(body);
  if (!result.valid) {
    return invalid(result);
  }
  const laporan = store.laporan[body.role];
  if (laporan.periode !== body.periode) {
    return fail(400, 'VALIDATION_ERROR',
      `Periode aktif adalah ${laporan.periode}.`, { field: 'periode' });
  }
  if (laporan.status === STATUS_SENT) {
    return fail(409, 'INVALID_STATE',
      'Laporan periode ini sudah Terkirim dan tidak dapat diubah.');
  }
  laporan.status = STATUS_SENT;
  return ok(laporan);
}

function uploadLaporan({ body, store }) {
  const result = validateLaporanUpload(body);
  if (!result.valid) {
    return invalid(result);
  }
  const roleError = checkRole(body.role);
  if (roleError) {
    return roleError;
  }
  if (store.laporan[body.role].status === STATUS_SENT) {
    return fail(409, 'INVALID_STATE',
      'Laporan sudah Terkirim, unggahan tidak dapat diproses.');
  }
  const rows = store.laporanPenggunaan.map(previewRow);
  const validRows = rows.filter((r) => r.valid).length;
  return ok({
    kode: body.kode,
    fileName: body.fileName,
    validRows,
    invalidRows: rows.length - validRows,
    rows,
  });
}

function previewRow(x, k) {
  const isInvalid = k === INVALID_ROW_INDEX;
  return {
    no: k + 1,
    nama: x.nama,
    paspor: isInvalid ? 'EG1180343' : x.paspor,
    valid: !isInvalid,
    message: isInvalid ? `No. paspor tidak cocok dengan SK ${x.sk}` : 'Valid',
  };
}
