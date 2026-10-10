/**
 * @fileoverview Akun Disnaker setempat (usulan, lembar kebutuhan "Tabel Daftar
 * Pemberi Kerja" — SKRD, DN-01..DN-03): tabel Perpanjangan RPTKA Lintas
 * Kab/Kota dalam 1 Provinsi yang sudah berhasil divalidasi Validator, fitur
 * Detail, dan Terbitkan SKRD (Surat Ketetapan Retribusi Daerah) — SKRD
 * terkirim dan diterima pemberi kerja sebagai tagihan di Pembayaran DKPTKA.
 * Baris = antrian Pengesahan yang sama dengan akun Verifikator/Validator
 * (routes/pengesahan-verifikasi.js), tanpa data ganda.
 */

import { SKRD_STATUS, isLintasKabKota, validateSkrdTerbitkan } from
  '../../contracts/skrd.js';
import { fail, invalid, list, notFound, ok, route } from '../router.js';
import { terbitkanSkrd } from './billing-dkptka.js';
import {
  detailOf, find as findRow, isSkrd, pengRows,
} from './pengesahan-verifikasi.js';

const TAG = 'Disnaker SKRD';
const ACTOR = ['Rudi Hartono', 'Petugas Dinas Ketenagakerjaan Kab/Kota',
  '10.12.6.11'];
const NOT_FOUND = 'Perpanjangan RPTKA lintas kab/kota yang sudah divalidasi';
const TONE = { [SKRD_STATUS.MENUNGGU]: 'amber', [SKRD_STATUS.TERBIT]: 'blue',
  [SKRD_STATUS.LUNAS]: 'green' };

export const SKRD_DISNAKER_ROUTES = [
  route('GET', '/skrd-disnaker', ({ store }) =>
    list(inScope(store).map(view)), {
    tag: TAG,
    summary: 'Tabel Perpanjangan RPTKA Lintas Kab/Kota dalam 1 Provinsi yang ' +
      'sudah divalidasi Validator: No HPK, tanggal pengajuan, nomor RPTKA, ' +
      'jenis RPTKA, `status` (Menunggu SKRD, SKRD terbit, Lunas), `aksi`.',
  }),
  route('GET', '/skrd-disnaker/:id', ({ params, store }) => {
    const row = find(store, params.id);
    return row ? ok(view(row)) : notFound(NOT_FOUND);
  }, {
    tag: TAG, example: { params: { id: 'qkk1' } },
    summary: 'Detail isian + dokumen + perhitungan retribusi (`dkptka`) dan ' +
      '`skrd` (nomor, nominal, masa berlaku, status bayar; null sebelum terbit).',
    responses: { 404: 'Belum divalidasi / bukan Lintas Kab/Kota.' },
  }),
  route('POST', '/skrd-disnaker/:id/terbitkan', terbitkan, {
    tag: TAG, request: 'SkrdTerbitkanRequest',
    example: { params: { id: 'qkk1' }, body: { konfirmasi: true } },
    summary: 'Terbitkan SKRD: nomor SKRD dan nominal retribusi dibuat ' +
      'otomatis (masa berlaku 5 hari kerja), SKRD terkirim ke pemberi kerja ' +
      '(tagihan di Pembayaran DKPTKA + notifikasi). Hanya dari Menunggu SKRD.',
    responses: { 400: 'Pernyataan konfirmasi belum true.',
      409: 'Status bukan Menunggu SKRD (INVALID_STATE).' },
  }),
];

/** Status tabel Disnaker; null bila baris belum/ bukan wewenang Disnaker. */
function statusOf(row) {
  if (!isLintasKabKota(row.layanan)) {
    return null;
  }
  if (row.billingState === 'skrd') {
    return SKRD_STATUS.MENUNGGU;
  }
  if (isSkrd(row)) {
    return row.billingState === 'lunas' ? SKRD_STATUS.LUNAS
      : SKRD_STATUS.TERBIT;
  }
  return null;
}

const inScope = (store) => pengRows(store).filter((row) => statusOf(row));

function find(store, id) {
  const row = findRow(store, id);
  return row && statusOf(row) ? row : null;
}

/** Detail as seen by Disnaker: status/tone of the SKRD table + `skrd`. */
function view(row) {
  const status = statusOf(row);
  const detail = detailOf(row);
  const { billing } = detail;
  return { ...detail, status, tone: TONE[status],
    skrd: billing && isSkrd(row) ? {
      nomor: billing.kode, jumlah: billing.jumlah, terbit: billing.terbit,
      berlakuSampai: billing.berlakuSampai, statusBayar: billing.status,
      // Bukti pembayaran dari bank daerah yang diunggah pemberi kerja saat
      // Konfirmasi Sudah Bayar (routes/portal.js `confirmBayarEmployer`) —
      // null sebelum Lunas.
      buktiBayar: billing.buktiBayar ?? null,
      penerima: row.pemohon, diterimaPemberiKerja: true } : null,
    aksi: { terbitkan: status === SKRD_STATUS.MENUNGGU } };
}

function terbitkan({ params, body, store }) {
  const result = validateSkrdTerbitkan(body);
  if (!result.valid) {
    return invalid(result);
  }
  const row = find(store, params.id);
  if (!row) {
    return notFound(NOT_FOUND);
  }
  if (statusOf(row) !== SKRD_STATUS.MENUNGGU) {
    return fail(409, 'INVALID_STATE', `Status "${statusOf(row)}" tidak ` +
      'dapat diproses; SKRD hanya dapat diterbitkan dari Menunggu SKRD.');
  }
  terbitkanSkrd(store, row, ACTOR);
  return ok(view(row));
}
