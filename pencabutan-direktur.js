/**
 * @fileoverview Pencabutan RPTKA di akun Direktur (usulan, lembar kebutuhan
 * "Tabel Daftar Pemberi Kerja" Pencabutan, PD-01..PD-05): tabel pengajuan
 * pencabutan pemberi kerja yang sudah lolos Verifikator dan Validator
 * (Tervalidasi), fitur Detail (isian + dokumen), dan TTE otomatis semua —
 * Direktur menandatangani keseluruhan sekaligus (bukan satu per satu); sistem
 * membuat dokumen Pencabutan RPTKA berisi nomor, TTE, dan QR Code, status
 * pemberi kerja menjadi Terbit. Aksi Direktur hanya melihat Detail dan TTE
 * semua. Baris = pengajuan yang sama dengan akun Verifikator/Validator
 * (routes/pengajuan-verifikasi.js), tanpa data ganda.
 */

import {
  PENCABUTAN_JENIS, pencabutanDokumenContoh,
} from '../../contracts/pengajuan-verifikasi.js';
import { fail, list, notFound, ok, route } from '../router.js';
import {
  EMPLOYER_TEXT, VERIF, audit, detailOf, entries, find as findEntry, notify,
} from './pengajuan-verifikasi.js';
import { today } from './siklus-shared.js';

const KIND = 'pencabutan';
const TAG = 'Direktur Pencabutan';
const DIREKTUR = ['Direktur PPTKA', 'Direktur PPTKA', '10.12.4.40'];
const NOT_FOUND = 'Pengajuan pencabutan RPTKA yang sudah tervalidasi';
const ST = { MENUNGGU: 'Menunggu TTE', SUDAH: 'Sudah di TTE' };
const isoDate = (date) => date.toISOString().slice(0, 10);

export const PENCABUTAN_DIREKTUR_ROUTES = [
  route('GET', '/pencabutan-direktur', ({ store }) =>
    list(inScope(store).map((e) => view(store, e))), {
    tag: TAG,
    summary: 'Tabel pengajuan pencabutan RPTKA yang sudah lolos Verifikator ' +
      'dan Validator (real time): nomor, tanggal, TKA, pemberi kerja, jenis ' +
      'pencabutan, `status` (Menunggu TTE | Sudah di TTE), `sk` (null ' +
      'sebelum TTE). Menunggu TTE di atas.',
  }),
  route('GET', '/pencabutan-direktur/:id', ({ params, store }) => {
    const entry = find(store, params.id);
    return entry ? ok(view(store, entry)) : notFound(NOT_FOUND);
  }, {
    tag: TAG, example: { params: { id: 'pc901' } },
    summary: 'Detail pencabutan: isian, dokumen yang diupload, dan dokumen ' +
      'Pencabutan (`sk`: nomor, TTE, QR Code; null sebelum TTE).',
    responses: { 404: 'Pengajuan pencabutan tidak ditemukan / belum ' +
      'tervalidasi.' },
  }),
  route('POST', '/pencabutan-direktur/tte-semua', tteSemua, {
    tag: TAG, example: { body: {} },
    summary: 'TTE otomatis semua: Direktur menandatangani semua pencabutan ' +
      'berstatus Menunggu TTE sekaligus. Dokumen Pencabutan (nomor, TTE, ' +
      'QR) dibuat, status pemberi kerja Terbit + notifikasi. Tidak ada TTE ' +
      'per baris. Respons `{jumlah, ids, rows}`.',
    responses: { 409: 'Tidak ada pencabutan yang menunggu TTE ' +
      '(INVALID_STATE).' },
  }),
];

/** Demo seed (sekali per store): satu Menunggu TTE, satu Sudah di TTE. */
function seedDemo(store) {
  if (store.pencabutanDirekturSeeded) {
    return;
  }
  store.pencabutanDirekturSeeded = true;
  store.pencabutan ??= [];
  const pool = store.tka.swasta ?? [];
  [[3, 'pc901', 'PC-2610-0901', false], [4, 'pc902', 'PC-2610-0902', true]]
    .forEach(([index, id, noPermohonan, signed], i) => {
      const tka = pool[index];
      if (!tka || store.pencabutan.some((p) => p.id === id)) {
        return;
      }
      const jenis = PENCABUTAN_JENIS[i % PENCABUTAN_JENIS.length];
      const [text, tone] = EMPLOYER_TEXT[VERIF.VALIDATED];
      const row = { id, role: 'swasta', noPermohonan, nama: tka.nama,
        barcode: tka.barcode, skNo: tka.skNo, paspor: tka.paspor,
        jabatan: tka.jabatan, noHpk: null, jenis, alasan: jenis,
        alasanDetail: 'Pencabutan atas permintaan pemberi kerja.',
        dokumenList: pencabutanDokumenContoh(jenis), verif: VERIF.VALIDATED,
        status: text, tone, tglAjuan: today(store),
        tgl: `Diajukan ${today(store)}` };
      store.pencabutan.push(row);
      if (signed) {
        signSk(store, { item: row, role: row.role }, false);
      }
    });
}

/** Entries through Validator (Tervalidasi), seed included. */
function inScope(store) {
  seedDemo(store);
  const rows = entries(KIND, store).filter((e) => e.item.verif ===
    VERIF.VALIDATED);
  return [...rows.filter((e) => !e.item.sk), ...rows.filter((e) => e.item.sk)];
}

function find(store, id) {
  const scope = inScope(store);
  const entry = findEntry(KIND, store, id);
  return entry && scope.some((e) => e.item.id === entry.item.id)
    ? entry : null;
}

/** Detail as seen by the Direktur: status Menunggu TTE | Sudah di TTE. */
function view(store, entry) {
  const done = Boolean(entry.item.sk);
  return { ...detailOf(KIND, store, entry),
    status: done ? ST.SUDAH : ST.MENUNGGU, tone: done ? 'green' : 'amber',
    alasan: '', sk: entry.item.sk ?? null };
}

/** Dokumen Pencabutan RPTKA: nomor, TTE (barcode) dan QR Code verifikasi. */
function dokumenPencabutan(item) {
  const digits = item.noPermohonan.replace(/\D/g, '').slice(-6)
    .padStart(6, '0');
  const nomor = `PCB/${digits}/X/2026`;
  const tanggal = isoDate(new Date());
  return { nomor, tanggal,
    tte: { barcode: `TTE-${nomor}`, oleh: 'Direktur PPTKA', tgl: tanggal },
    qr: `TKA-ONLINE/VERIFIKASI/${nomor}` };
}

/**
 * TTE one pencabutan: SK Pencabutan terbit (status pemberi kerja "Terbit").
 * @param {boolean=} notifyEmployer false untuk seed demo.
 */
function signSk(store, entry, notifyEmployer = true) {
  const { item } = entry;
  item.sk = dokumenPencabutan(item);
  Object.assign(item, { status: 'Terbit', tone: 'green',
    tgl: `SK Pencabutan ${today(store)}` });
  if (!notifyEmployer) {
    return;
  }
  audit(KIND, store, 'Tanda tangan', entry, [{ field: 'sk.nomor',
    sebelum: '—', sesudah: item.sk.nomor }], DIREKTUR);
  notify(KIND, store, entry, `SK Pencabutan terbit (${item.noPermohonan})`,
    `SK Pencabutan RPTKA nomor ${item.sk.nomor} sudah ditandatangani ` +
    'Direktur (TTE) dan diterbitkan.');
}

function tteSemua({ store }) {
  const pending = inScope(store).filter((e) => !e.item.sk);
  if (!pending.length) {
    return fail(409, 'INVALID_STATE', 'Tidak ada pengajuan pencabutan yang ' +
      'menunggu TTE.');
  }
  pending.forEach((entry) => signSk(store, entry));
  return ok({ jumlah: pending.length, ids: pending.map((e) => e.item.id),
    rows: pending.map((e) => view(store, e)) });
}
