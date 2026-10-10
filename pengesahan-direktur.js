/**
 * @fileoverview Menu Pengesahan RPTKA akun Direktur (usulan, lembar kebutuhan
 * "Tabel Daftar Pemberi Kerja" RPTKA Direktur, DP-01..DP-07): data RPTKA yang
 * lolos DKPTKA (lunas dibayar pemberi kerja / bebas DKPTKA) otomatis
 * disetujui Direktur oleh sistem dan masuk tabel ini berstatus "Menunggu TTE"
 * (surat belum turun ke pemberi kerja). Direktur menekan tombol TTE
 * (`POST /pengesahan-direktur/{id}/tte`): status menjadi "Sudah di TTE" dan
 * surat diterbitkan ke pemberi kerja. Baris = antrian Pengesahan yang sama
 * dengan akun Verifikator/Validator, tanpa data ganda.
 */

import {
  PENGESAHAN_DIREKTUR_MENU, isPerpanjanganJenis,
} from '../../contracts/pengesahan-direktur.js';
import { isLintasKabKota } from '../../contracts/skrd.js';
import { fail, invalid, list, notFound, ok, route } from '../router.js';
import { jalankanTte, setujuiOtomatis } from './billing-dkptka.js';
import {
  detailOf, find as findRow, pengRows,
} from './pengesahan-verifikasi.js';

const TAG = 'Direktur RPTKA';
const NOT_FOUND = 'Permohonan RPTKA yang lolos DKPTKA';
const SCOPE = ['bebas', 'lunas'];
const ST = { MENUNGGU: 'Menunggu TTE', SUDAH: 'Sudah di TTE' };

export const PENGESAHAN_DIREKTUR_ROUTES = [
  route('GET', '/pengesahan-direktur', ({ store }) =>
    list(inScope(store).map(view)), {
    tag: TAG,
    summary: 'Tabel RPTKA yang lolos DKPTKA (`statusDkptka` Lunas | Bebas ' +
      'DKPTKA) dan sudah disetujui otomatis: No HPK, tanggal pengajuan, ' +
      'nomor RPTKA, jenis RPTKA, `status` (Menunggu TTE | Sudah di TTE), ' +
      '`aksi.tte`, `pengesahan` (null sebelum TTE). Menunggu TTE di atas.',
  }),
  route('GET', '/pengesahan-direktur/:id', ({ params, store }) => {
    const row = find(store, params.id);
    return row ? ok(view(row)) : notFound(NOT_FOUND);
  }, {
    tag: TAG, example: { params: { id: 'qd5' } },
    summary: 'Detail isian, dokumen, DKPTKA, `persetujuan` otomatis dan ' +
      'dokumen Pengesahan (`pengesahan`: nomor, TTE, QR; null sebelum TTE).',
    responses: { 404: 'Permohonan RPTKA tidak ditemukan / belum lolos ' +
      'DKPTKA.' },
  }),
  route('POST', '/pengesahan-direktur/tte-semua', tteSemua, {
    tag: TAG, example: { body: {} },
    summary: 'TTE otomatis semua: Direktur menandatangani semua RPTKA ' +
      'berstatus Menunggu TTE sekaligus (aturan sama dengan TTE per baris: ' +
      'dokumen Pengesahan, surat terbit ke pemberi kerja). Body opsional ' +
      '`{menu: pengesahan | perpanjangan | kabkota}` membatasi ke satu menu (default: ' +
      'semua). Respons `{jumlah, ids, rows}`.',
    responses: { 400: 'menu tidak dikenal.',
      409: 'Tidak ada RPTKA yang menunggu TTE (INVALID_STATE).' },
  }),
  route('POST', '/pengesahan-direktur/:id/tte', tte, {
    tag: TAG, example: { params: { id: 'qd5' }, body: {} },
    summary: 'Tombol TTE: Direktur menandatangani Pengesahan RPTKA secara ' +
      'elektronik — status Sudah di TTE, dokumen (nomor, TTE, QR) dibuat dan ' +
      'surat diterbitkan ke pemberi kerja (Cetak SK + notifikasi).',
    responses: { 404: 'Permohonan RPTKA tidak ditemukan / belum lolos ' +
      'DKPTKA.', 409: 'TTE sudah dijalankan (INVALID_STATE).' },
  }),
];

/**
 * Rows through DKPTKA. Rows that reached lunas/bebas without an approval
 * (e.g. snapshot persisted by an older prototype) are approved on first read
 * so the table never shows a half-done row. Menunggu TTE first.
 */
function inScope(store) {
  const rows = pengRows(store).filter((r) => SCOPE.includes(r.billingState));
  rows.forEach((row) => setujuiOtomatis(store, row));
  return [...rows.filter((r) => !r.pengesahan),
    ...rows.filter((r) => r.pengesahan)];
}

function find(store, id) {
  const row = findRow(store, id);
  return row && SCOPE.includes(row.billingState)
    ? inScope(store).find((r) => r.id === row.id) ?? null : null;
}

/** Detail as seen by the Direktur: status Menunggu TTE | Sudah di TTE. */
function view(row) {
  const done = Boolean(row.pengesahan);
  return { ...detailOf(row), menu: menuOf(row),
    status: done ? ST.SUDAH : ST.MENUNGGU,
    tone: done ? 'green' : 'amber',
    statusDkptka: row.billingState === 'bebas' ? 'Bebas DKPTKA' : 'Lunas',
    persetujuan: row.persetujuan, pengesahan: row.pengesahan ?? null,
    aksi: { tte: !done } };
}

/** Menu Direktur: Lintas Kab/Kota (SKRD) | Perpanjangan lain | Pengesahan. */
const menuOf = (row) => {
  if (isLintasKabKota(row.layanan)) {
    return 'kabkota';
  }
  return isPerpanjanganJenis(row.layanan) ? 'perpanjangan' : 'pengesahan';
};

function tteSemua({ body, store }) {
  const menu = body?.menu;
  if (menu !== undefined && !PENGESAHAN_DIREKTUR_MENU.includes(menu)) {
    return invalid({ errors: { menu: 'menu harus pengesahan, ' +
      'perpanjangan, atau kabkota.' } });
  }
  const pending = inScope(store).filter((r) => !r.pengesahan &&
    (!menu || menuOf(r) === menu));
  if (!pending.length) {
    return fail(409, 'INVALID_STATE', 'Tidak ada permohonan RPTKA yang ' +
      'menunggu TTE.');
  }
  pending.forEach((row) => jalankanTte(store, row));
  return ok({ jumlah: pending.length, ids: pending.map((r) => r.id),
    rows: pending.map(view) });
}

function tte({ params, store }) {
  const row = find(store, params.id);
  if (!row) {
    return notFound(NOT_FOUND);
  }
  if (row.pengesahan) {
    return fail(409, 'INVALID_STATE', 'TTE sudah dijalankan untuk ' +
      'permohonan RPTKA ini.');
  }
  jalankanTte(store, row);
  return ok(view(row));
}
