/**
 * @fileoverview Alur billing DKPTKA → Pengesahan RPTKA yang berjalan
 * otomatis di TKA Online (Simponi di luar lingkup aplikasi ini; tidak ada
 * akun Simponi):
 *   1. Validator Verifikasi  -> `onValidatorVerified`: kode billing terbit
 *      otomatis (nominal DK-05, masa berlaku 5 hari kerja) dan disalin ke
 *      akun pemberi kerja; bebas DKPTKA -> langsung ke langkah 3.
 *      Perpanjangan Lintas Kab/Kota dalam 1 Provinsi (retribusi daerah) TIDAK
 *      menerbitkan billing PNBP: Validasi meneruskannya ke akun Disnaker
 *      setempat (`billingState: 'skrd'`), yang menerbitkan SKRD
 *      (`terbitkanSkrd`) — tagihan SKRD masuk ke akun pemberi kerja.
 *   2. Pemberi kerja konfirmasi sudah bayar -> `lunasiBilling`.
 *   3. `setujuiOtomatis`: SK Pengesahan otomatis disetujui Direktur (sistem),
 *      status "Menunggu TTE"; surat BELUM turun ke pemberi kerja.
 *   4. Direktur menekan TTE -> `jalankanTte`: dokumen Pengesahan (nomor,
 *      TTE, QR) terbit, status "Sudah di TTE", diterbitkan ke pemberi kerja,
 *      dan data Visa + ITAS langsung diterima (`terimaVisaOtomatis`) sehingga
 *      tampil di akun pemberi kerja.
 */

import { jenisDef } from '../../contracts/pengesahan-rptka.js';
import { isLintasKabKota } from '../../contracts/skrd.js';
import { terimaVisaOtomatis } from './imigrasi.js';
import { pushNotifikasi } from './notifikasi.js';
import {
  audit, detailOf, linkedPengesahanRows, roleOfPemohon,
  syncEmployerPengesahan,
} from './pengesahan-verifikasi.js';

/** Masa berlaku kode billing DKPTKA: 5 hari kerja sejak terbit (DK-03). */
export const BILLING_MASA_BERLAKU_HARI = 5;

const SISTEM = ['Sistem TKA Online', 'Direktur PPTKA (persetujuan otomatis)',
  '10.12.4.40'];
const DIREKTUR = ['Direktur PPTKA', 'Direktur PPTKA', '10.12.4.40'];
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli',
  'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const isoDate = (date) => date.toISOString().slice(0, 10);

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

/** Date -> "30 September 2026", gaya sama dengan seed store.billing[role]. */
export function tanggalPanjang(date) {
  return `${date.getUTCDate()} ${BULAN[date.getUTCMonth()]} ` +
    date.getUTCFullYear();
}

/** Kode billing 15 digit awalan 82 + tanggal + 5 digit nomor (dummy). */
function kodeBilling(row, now) {
  return `82${isoDate(now).replaceAll('-', '')}` +
    row.no.replace(/\D/g, '').slice(-5).padStart(5, '0');
}

/** Nomor SKRD: SKRD/<5 digit nomor>/<tanggal terbit> (dummy). */
function nomorSkrd(row, now) {
  return `SKRD/${row.no.replace(/\D/g, '').slice(-5).padStart(5, '0')}/` +
    isoDate(now).replaceAll('-', '');
}

/**
 * Permohonan seed/demo (mis. Perpanjangan `qpl*`) tidak lahir dari Form RPTKA
 * pemberi kerja, jadi belum punya baris di "Daftar Pengesahan RPTKA"-nya.
 * Buat satu baris per TKA supaya tagihan yang terbit langsung tampil di
 * akun pemberi kerja (panel billing + status mengikuti antrian).
 */
function pastikanBarisPemberiKerja(store, row, role, isian) {
  if (linkedPengesahanRows(store, row).length) {
    return;
  }
  store.pengesahan[role].unshift(...isian.tka.map((t, i) => ({
    id: `${row.id}-t${i + 1}`, hpk: null, layanan: row.layanan,
    nama: t.nama, negara: t.negara, paspor: t.paspor, jabatan: t.jabatan,
    jenis: row.layanan, bulan: t.bulan, tgl: row.masuk, stepIdx: 5,
    status: 'Menunggu pembayaran DKPTKA', tone: 'amber', imigrasi: false,
  })));
}

/**
 * Terbitkan kode billing (atau, bila `skrd`, nomor SKRD) dan salin satu
 * baris per TKA ke akun pemberi kerja.
 */
function terbitkanBilling(store, row, actor, { skrd = false } = {}) {
  const { dkptka, isian } = detailOf(row);
  const now = new Date();
  const kode = skrd ? nomorSkrd(row, now) : kodeBilling(row, now);
  const berlaku = addWorkdays(now, BILLING_MASA_BERLAKU_HARI);
  row.billingState = 'terbit';
  row.billing = { kode, tka: row.tka, jumlah: dkptka.rupiah,
    status: 'Belum dibayar', tujuan: skrd ? 'Kas Daerah' : 'Simponi',
    jenis: skrd ? 'SKRD' : 'PNBP', terbit: isoDate(now),
    berlakuSampai: isoDate(berlaku) };
  audit(store, 'Setujui', row, [{ field: 'billing', sebelum: '—',
    sesudah: kode }], actor);
  const role = roleOfPemohon(row.pemohon);
  pastikanBarisPemberiKerja(store, row, role, isian);
  store.billing[role].unshift(...isian.tka.map((t, i) => ({
    id: `b-${row.id}-${i}`, kode, ntpn: '—', tka: t.nama, paspor: t.paspor,
    jabatan: t.jabatan, bulan: t.bulan, rupiah: dkptka.tarif * t.bulan,
    terbit: tanggalPanjang(now), batas: tanggalPanjang(berlaku),
    status: 'Belum dibayar', tone: 'amber', jenis: skrd ? 'SKRD' : 'PNBP',
  })));
  syncEmployerPengesahan(store, row,
    new Map(isian.tka.map((t, i) => [t.nama, `b-${row.id}-${i}`])));
  pushNotifikasi(store, role, skrd ? {
    judul: `SKRD diterima (${row.no})`,
    isi: `Dinas Ketenagakerjaan menerbitkan SKRD ${kode} sebesar ` +
      `Rp${dkptka.rupiah.toLocaleString('id-ID')}, berlaku sampai ` +
      `${row.billing.berlakuSampai} (5 hari kerja). Bayar retribusi ke Kas ` +
      'Daerah, lalu klik Konfirmasi Sudah Bayar di menu Pembayaran DKPTKA.',
    kategori: 'Pembayaran', tautan: { page: 'pembayaran' } } : {
    judul: `Kode billing DKPTKA terbit (${row.no})`,
    isi: `Kode billing ${kode} berlaku sampai ${row.billing.berlakuSampai} ` +
      '(5 hari kerja). Bayar di bank persepsi, lalu klik Konfirmasi Sudah ' +
      'Bayar di menu Pembayaran DKPTKA.',
    kategori: 'Pembayaran', tautan: { page: 'pembayaran' } });
}

/** Disnaker menerbitkan SKRD; tagihannya diterima pemberi kerja. */
export function terbitkanSkrd(store, row, actor) {
  terbitkanBilling(store, row, actor, { skrd: true });
  return detailOf(row);
}

/**
 * Validasi Perpanjangan Lintas Kab/Kota dalam 1 Provinsi: retribusi daerah,
 * jadi tidak ada billing PNBP — berkas menunggu SKRD dari Disnaker.
 */
function teruskanKeDisnaker(store, row, actor) {
  row.billingState = 'skrd';
  row.billing = null;
  audit(store, 'Validasi', row, [{ field: 'billing', sebelum: '—',
    sesudah: 'Menunggu SKRD Dinas Ketenagakerjaan' }], actor);
  syncEmployerPengesahan(store, row);
  pushNotifikasi(store, roleOfPemohon(row.pemohon), {
    judul: `Validasi selesai, menunggu SKRD (${row.no})`,
    isi: 'Perpanjangan RPTKA lintas kab/kota dalam 1 provinsi sudah ' +
      'divalidasi. Dinas Ketenagakerjaan setempat akan menerbitkan Surat ' +
      'Ketetapan Retribusi Daerah (SKRD); Anda akan menerimanya di menu ' +
      'Pembayaran DKPTKA.',
    kategori: 'Status permohonan', tautan: { page: 'hpk' } });
}

/**
 * Validator memverifikasi (routes/pengesahan-validasi.js): kode billing
 * terbit otomatis, atau — bila dibebaskan DKPTKA (DK-05) — langsung
 * disetujui otomatis tanpa billing.
 */
export function onValidatorVerified(store, row, actor) {
  const { dkptka } = detailOf(row);
  if (!dkptka.bebas) {
    if (isLintasKabKota(row.layanan)) {
      teruskanKeDisnaker(store, row, actor);
    } else {
      terbitkanBilling(store, row, actor);
    }
    return detailOf(row);
  }
  row.billingState = 'bebas';
  row.billing = null;
  audit(store, 'Setujui', row, [{ field: 'billing', sebelum: '—',
    sesudah: 'Bebas DKPTKA' }], actor);
  syncEmployerPengesahan(store, row);
  setujuiOtomatis(store, row);
  return detailOf(row);
}

/**
 * Pemberi kerja mengonfirmasi sudah membayar kode billing baris antrian
 * `row`: status Lunas, lalu SK disetujui otomatis (menunggu TTE).
 * @param {string} bayarTgl Tanggal bayar ("9 Oktober 2026").
 * @param {{bank: (string|undefined), buktiBayar: (?Object|undefined)}=} extra
 *     `bank` ("Bank Pembangunan Daerah (Kas Daerah)" untuk SKRD); `buktiBayar`
 *     ({namaBerkas, ukuranKb, berkasId}) — WAJIB untuk SKRD, diteruskan ke
 *     Disnaker setempat lewat `row.billing.buktiBayar` (dibaca
 *     `routes/skrd-disnaker.js` `view`).
 */
export function lunasiBilling(store, row, bayarTgl, extra = {}) {
  row.billingState = 'lunas';
  Object.assign(row.billing, { status: 'Lunas', bayar: bayarTgl,
    bank: extra.bank ?? 'Bank persepsi', ntpn: '—',
    ...(extra.buktiBayar ? { buktiBayar: extra.buktiBayar } : {}) });
  audit(store, 'Validasi', row, [{ field: 'billing.status',
    sebelum: 'Belum dibayar', sesudah: 'Lunas' }],
  [row.pemohon, 'Pemberi Kerja (konfirmasi pembayaran)', '10.12.5.20']);
  syncEmployerPengesahan(store, row);
  setujuiOtomatis(store, row);
}

/**
 * SK Pengesahan otomatis disetujui Direktur begitu DKPTKA lunas / bebas.
 * Surat belum turun ke pemberi kerja: menunggu TTE Direktur
 * (`jalankanTte`). Idempoten.
 */
export function setujuiOtomatis(store, row) {
  if (row.persetujuan) {
    return row.persetujuan;
  }
  row.persetujuan = { tanggal: isoDate(new Date()), otomatis: true };
  audit(store, 'Setujui', row, [{ field: 'persetujuan', sebelum: '—',
    sesudah: 'Disetujui otomatis — menunggu TTE' }], SISTEM);
  syncEmployerPengesahan(store, row);
  pushNotifikasi(store, roleOfPemohon(row.pemohon), {
    judul: `Pengesahan RPTKA disetujui (${row.no})`,
    isi: 'Pengesahan RPTKA disetujui Direktur setelah DKPTKA terpenuhi. ' +
      'Surat diterbitkan setelah Direktur menandatangani TTE.',
    kategori: 'Status permohonan', tautan: { page: 'hpk' } });
  return row.persetujuan;
}

/** Dokumen Pengesahan RPTKA: nomor, TTE (barcode) dan QR Code verifikasi. */
function dokumenPengesahan(row) {
  const digits = row.no.replace(/\D/g, '').slice(-6).padStart(6, '0');
  const nomor = `PENG/${digits}/X/2026`;
  const tanggal = isoDate(new Date());
  return { nomor, tanggal,
    tte: { barcode: `TTE-${nomor}`, oleh: 'Direktur PPTKA', tgl: tanggal },
    qr: `TKA-ONLINE/VERIFIKASI/${nomor}` };
}

/**
 * Direktur menjalankan TTE (tombol TTE): dokumen Pengesahan terbit, status
 * "Sudah di TTE", dan diterbitkan ke pemberi kerja (Cetak SK + notifikasi).
 * Visa/ITAS TIDAK ikut diterbitkan otomatis untuk Perpanjangan RPTKA
 * (permintaan user) — TKA pada Perpanjangan sudah PUNYA Visa/ITAS dari
 * Pengesahan RPTKA sebelumnya (yang diperpanjang), jadi tidak perlu
 * diterbitkan ulang; hanya Pengesahan RPTKA baru yang memicu Visa/ITAS.
 */
export function jalankanTte(store, row) {
  row.pengesahan = dokumenPengesahan(row);
  audit(store, 'Tanda tangan', row, [{ field: 'pengesahan.nomor',
    sebelum: '—', sesudah: row.pengesahan.nomor }], DIREKTUR);
  const rows = syncEmployerPengesahan(store, row);
  if (jenisDef(row.layanan)?.menu !== 'perpanjangan') {
    rows.forEach((p) => terimaVisaOtomatis(store, p));
  }
  pushNotifikasi(store, roleOfPemohon(row.pemohon), {
    judul: `Pengesahan RPTKA terbit (${row.no})`,
    isi: `SK Pengesahan RPTKA nomor ${row.pengesahan.nomor} sudah ` +
      'ditandatangani Direktur (TTE) dan diterbitkan; cetak SK dari Daftar ' +
      'Pengesahan RPTKA.',
    kategori: 'Pengesahan', tautan: { page: 'hpk' } });
  return row.pengesahan;
}
