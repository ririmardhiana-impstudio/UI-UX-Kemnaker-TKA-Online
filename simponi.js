/**
 * @fileoverview Akun Simponi (usulan, lembar kebutuhan "Penerbitan Kode
 * Billing DKPTKA": integrasi Simponi dan TKA Online, perhitungan nominal
 * DKPTKA, masa berlaku billing). Permintaan billing masuk saat Validator
 * memverifikasi Pengesahan RPTKA (routes/pengesahan-validasi.js); Simponi
 * menerbitkan kode billing dengan nominal DK-05 dan masa berlaku 5 hari
 * kerja (DK-03). Baris = antrian Pengesahan yang sama (tanpa data ganda).
 */

import {
  SIMPONI_MASA_BERLAKU_HARI, SIMPONI_STATUS as S, validateSimponiConfirm,
  validateSimponiIssue,
} from '../../contracts/simponi.js';
import { fail, invalid, list, notFound, ok, route } from '../router.js';
import { pushNotifikasi } from './notifikasi.js';
import {
  audit, detailOf, find as findRow, pengRows, roleOfPemohon,
  autoApprovePengesahan, syncEmployerPengesahan,
} from './pengesahan-verifikasi.js';

const TAG = 'Simponi';
const ACTOR = ['Petugas Simponi', 'Petugas Simponi', '10.12.4.50'];
const NOT_FOUND = 'Permintaan billing DKPTKA';
const EXAMPLE_ID = { params: { id: 'qd3' } };
const TONE = { [S.WAITING]: 'amber', [S.ISSUED]: 'green', [S.PAID]: 'green' };
const SIMPONI_STATES = ['simponi', 'terbit', 'lunas'];
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli',
  'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export const SIMPONI_ROUTES = [
  route('GET', '/simponi-billing', ({ store }) =>
    list(inScope(store).map((row) => summary(row))), {
    tag: TAG,
    summary: 'Tabel permintaan billing DKPTKA dari TKA Online (diteruskan ' +
      'Validator): nomor RPTKA, pemberi kerja, nominal, `status` ' +
      '(Menunggu diterbitkan | Billing terbit), kode + masa berlaku.',
  }),
  route('GET', '/simponi-billing/:id', ({ params, store }) => {
    const row = find(store, params.id);
    return row ? ok(detail(row)) : notFound(NOT_FOUND);
  }, {
    tag: TAG, example: EXAMPLE_ID,
    summary: 'Detail permintaan: integrasi TKA Online → Simponi, perhitungan ' +
      'nominal DKPTKA (`dkptka`), masa berlaku (`masaBerlaku`), `billing`, ' +
      '`aksi.terbitkan`.',
    responses: { 404: 'Permintaan billing tidak ditemukan.' },
  }),
  route('POST', '/simponi-billing/:id/issue', issue, {
    tag: TAG, request: 'SimponiIssueRequest',
    example: { params: EXAMPLE_ID.params, body: { konfirmasi: true } },
    summary: 'Terbitkan kode billing DKPTKA (15 digit, awalan 82): status ' +
      'Billing terbit, masa berlaku 5 hari kerja. Hanya dari Menunggu ' +
      'diterbitkan. Menyalin baris billing ke akun pemberi kerja ' +
      '(GET /billing) dan mengirim notifikasi (SM-06).',
    responses: { 400: 'Pernyataan konfirmasi belum true.',
      409: 'Status bukan Menunggu diterbitkan (INVALID_STATE).' },
  }),
  route('POST', '/simponi-billing/:id/confirm-payment', confirmPayment, {
    tag: TAG, request: 'SimponiConfirmRequest',
    example: { params: EXAMPLE_ID.params,
      body: { konfirmasi: true, bank: 'BNI' },
      before: [{ method: 'POST', path: '/simponi-billing/qd3/issue',
        body: { konfirmasi: true } }] },
    summary: 'Konfirmasi pembayaran DKPTKA yang diterima Simponi (di luar ' +
      'TKA Online): terbitkan NTPN, status menjadi Lunas, ikut ' +
      'memperbarui baris billing pemberi kerja (SM-07).',
    responses: { 400: 'Pernyataan konfirmasi belum true, atau bank tidak ' +
      'valid.', 409: 'Status bukan Billing terbit (INVALID_STATE).' },
  }),
];

const inScope = (store) => pengRows(store)
  .filter((row) => SIMPONI_STATES.includes(row.billingState));

function find(store, id) {
  const row = findRow(store, id);
  return row && SIMPONI_STATES.includes(row.billingState) ? row : null;
}

const statusOf = (row) => ({ terbit: S.ISSUED, lunas: S.PAID }[
  row.billingState] ?? S.WAITING);

const isoDate = (date) => date.toISOString().slice(0, 10);

/** Date -> "30 September 2026", gaya sama dengan seed store.billing[role]. */
function tanggalPanjang(date) {
  return `${date.getUTCDate()} ${BULAN[date.getUTCMonth()]} ` +
    date.getUTCFullYear();
}

/** NTPN dummy (16 karakter alfanumerik), gaya sama dengan seed data. */
function generateNtpn() {
  return (Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 10)).toUpperCase().slice(0, 16);
}

/** Tambah `days` hari kerja (Sen–Jum) dari `from`. */
export function addWorkdays(from, days) {
  const date = new Date(from);
  let left = days;
  while (left > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    if (![0, 6].includes(date.getUTCDay())) {
      left -= 1;
    }
  }
  return date;
}

function summary(row) {
  const { dkptka, billing, noHpk } = detailOf(row);
  const status = statusOf(row);
  return {
    id: row.id, nomorRptka: row.no, noHpk, pemohon: row.pemohon,
    kategori: row.kategori, jenisRptka: row.layanan,
    tanggalDiterima: row.simponiDiterima?.slice(0, 10) ?? '',
    jumlahTka: dkptka.jumlahTka, bulan: dkptka.bulan, rupiah: dkptka.rupiah,
    status, tone: TONE[status],
    kode: billing?.kode ?? '', berlakuSampai: billing?.berlakuSampai ?? '',
  };
}

function detail(row) {
  const base = detailOf(row);
  const sum = summary(row);
  const diterbitkan = sum.status !== S.WAITING;
  const mulai = diterbitkan ? base.billing.terbit : isoDate(new Date());
  return {
    ...sum,
    isian: base.isian,
    dkptka: base.dkptka,
    billing: base.billing,
    integrasi: { sumber: 'TKA Online (verifikasi Validator)',
      tujuan: 'Simponi', status: 'Terkirim', diterimaPada: row.simponiDiterima },
    masaBerlaku: {
      hari: SIMPONI_MASA_BERLAKU_HARI, satuan: 'hari kerja', mulai,
      sampai: diterbitkan ? base.billing.berlakuSampai
        : isoDate(addWorkdays(mulai, SIMPONI_MASA_BERLAKU_HARI)),
      final: diterbitkan,
    },
    aksi: { terbitkan: sum.status === S.WAITING,
      konfirmasi: sum.status === S.ISSUED },
  };
}

function issue({ params, body, store }) {
  const result = validateSimponiIssue(body);
  if (!result.valid) {
    return invalid(result);
  }
  const row = find(store, params.id);
  if (!row) {
    return notFound(NOT_FOUND);
  }
  if (statusOf(row) !== S.WAITING) {
    return fail(409, 'INVALID_STATE', `Status "${statusOf(row)}" tidak ` +
      'dapat diproses; hanya permintaan Menunggu diterbitkan.');
  }
  const { dkptka, isian } = detailOf(row);
  const now = new Date();
  const kode = `82${isoDate(now).replaceAll('-', '')}` +
    row.no.replace(/\D/g, '').slice(-5).padStart(5, '0');
  row.billingState = 'terbit';
  row.billing = { kode, tka: row.tka, jumlah: dkptka.rupiah,
    status: 'Belum dibayar', tujuan: 'Simponi', terbit: isoDate(now),
    berlakuSampai: isoDate(addWorkdays(now, SIMPONI_MASA_BERLAKU_HARI)) };
  audit(store, 'Setujui', row, [{ field: 'billing', sebelum: 'Menunggu ' +
    'diterbitkan', sesudah: kode }], ACTOR);

  // SM-06: salin satu baris billing per TKA ke akun pemberi kerja
  // (GET /billing) — sebelumnya hanya tersimpan di baris antrian Simponi
  // sendiri, tidak pernah muncul di halaman Pembayaran DKPTKA pemohon.
  const role = roleOfPemohon(row.pemohon);
  const terbitTgl = tanggalPanjang(now);
  const batasTgl = tanggalPanjang(addWorkdays(now, SIMPONI_MASA_BERLAKU_HARI));
  store.billing[role].unshift(...isian.tka.map((t, i) => ({
    id: `b-${row.id}-${i}`, kode, ntpn: '—', tka: t.nama, paspor: t.paspor,
    jabatan: t.jabatan, bulan: t.bulan, rupiah: dkptka.tarif * t.bulan,
    terbit: terbitTgl, batas: batasTgl, status: 'Belum dibayar',
    tone: 'amber', jenis: 'PNBP',
  })));

  // SM-06: tautkan + majukan baris "Daftar Pengesahan RPTKA" (menu portal
  // pemberi kerja) yang terkait TKA ini — lewat `rptkaId` (Form RPTKA baru)
  // atau nama (baris seed/demo yang memang dirancang berpasangan, lihat
  // data.js); baris tak tertaut tetap bisa dicek lewat menu Pembayaran
  // DKPTKA.
  syncEmployerPengesahan(store, row,
    new Map(isian.tka.map((t, i) => [t.nama, `b-${row.id}-${i}`])));

  pushNotifikasi(store, role, {
    judul: `Kode billing DKPTKA terbit (${row.no})`,
    isi: `Kode billing ${kode} berlaku sampai ${row.billing.berlakuSampai} ` +
      '(5 hari kerja). Segera lakukan pembayaran di bank persepsi, lalu ' +
      'unduh surat tagihan di menu Pembayaran DKPTKA.',
    kategori: 'Pembayaran', tautan: { page: 'pembayaran' } });
  return ok(detail(row));
}

/**
 * SM-07: konfirmasi pembayaran yang diterima Simponi (pembayaran sendiri
 * terjadi di luar TKA Online, lewat bank persepsi) — terbitkan NTPN dan
 * tandai Lunas, baik di baris antrian maupun di akun pemberi kerja.
 */
function confirmPayment({ params, body, store }) {
  const result = validateSimponiConfirm(body);
  if (!result.valid) {
    return invalid(result);
  }
  const row = find(store, params.id);
  if (!row) {
    return notFound(NOT_FOUND);
  }
  if (statusOf(row) !== S.ISSUED) {
    return fail(409, 'INVALID_STATE', `Status "${statusOf(row)}" tidak ` +
      'dapat dikonfirmasi; hanya permintaan Billing terbit.');
  }
  const now = new Date();
  const ntpn = generateNtpn();
  const bayarTgl = tanggalPanjang(now);
  row.billingState = 'lunas';
  Object.assign(row.billing, { status: 'Lunas', bayar: bayarTgl,
    bank: body.bank, ntpn });
  const role = roleOfPemohon(row.pemohon);
  for (const bill of store.billing[role]) {
    if (bill.kode === row.billing.kode) {
      Object.assign(bill, { status: 'Lunas', tone: 'green',
        bayar: bayarTgl, bank: body.bank, ntpn });
    }
  }
  audit(store, 'Validasi', row, [{ field: 'billing.status',
    sebelum: 'Belum dibayar', sesudah: 'Lunas' }], ACTOR);
  syncEmployerPengesahan(store, row);
  autoApprovePengesahan(store, row);
  pushNotifikasi(store, role, {
    judul: `Pembayaran DKPTKA ${row.no} terkonfirmasi`,
    isi: `NTPN ${ntpn} · dibayar ${bayarTgl} via ${body.bank}. Bukti ` +
      'pembayaran dapat diunduh di menu Pembayaran DKPTKA.',
    kategori: 'Pembayaran', tautan: { page: 'pembayaran' } });
  return ok(detail(row));
}
