/**
 * @fileoverview Akun Petugas Ekspos (usulan, dari lembar kebutuhan "Fitur
 * Ekspose" + "Fitur Hasil Penilaian"): tabel pemberi kerja berurutan no.
 * antrian + jadwal, detail jadwal + link ekspose, dan hasil penilaian —
 * `perbaikan` (Perbaiki Data dan Dokumen), `reschedule`, `bap` (Buat BAP,
 * status BAP "Menunggu disetujui"). Baris = pengajuan HPK yang sama dengan
 * portal pemberi kerja (routes/penilaian-kelayakan.js), lintas pemberi kerja.
 */

import {
  EKSPOS_HASIL, EKSPOS_HPK_STATUS, validateEksposHpkPerbaikan,
} from '../../contracts/ekspos-hpk.js';
import { PK_STATUS as S } from '../../contracts/penilaian-kelayakan.js';
import { ROLE_KEYS } from '../../contracts/schema.js';
import { fail, invalid, list, notFound, ok, route } from '../router.js';
import { applyTransition, nextOf, seed } from './penilaian-kelayakan.js';
import { appendAudit } from './security.js';

const TAG = 'Petugas Ekspos';
const ACTOR = ['Bayu Kurniawan', 'Petugas Ekspos', '10.12.4.30'];
const EXAMPLE_ID = { params: { id: 'pk7' } };
const NOT_FOUND = 'Pengajuan HPK fase ekspose';

export const EKSPOS_HPK_ROUTES = [
  route('GET', '/ekspos-hpk', ({ store }) =>
    list(entriesOf(store).map((entry) => summary(entry, store))), {
    tag: TAG,
    summary: 'Tabel pemberi kerja fase ekspose (Menunggu Jadwal, Terjadwal, ' +
      'Selesai Ekspose, Perlu Perbaikan), urut tanggal + jam + no. antrian.',
  }),
  route('GET', '/ekspos-hpk/:id', getDetail, {
    tag: TAG, example: EXAMPLE_ID,
    summary: 'Detail jadwal ekspose (no. antrian, jadwal, link), riwayat ' +
      'jadwal, BAP, dan aksi yang tersedia.',
    responses: { 404: 'Pengajuan HPK tidak ditemukan / bukan fase ekspose.' },
  }),
  route('POST', '/ekspos-hpk/:id/reschedule', reschedule, {
    tag: TAG, example: EXAMPLE_ID,
    summary: 'Reschedule Ekspos: jadwal baru dibuat otomatis, jadwal lama ' +
      'masuk riwayatJadwal. Hanya dari Terjadwal.',
    responses: { 409: 'Status bukan Terjadwal (INVALID_STATE).' },
  }),
  route('POST', '/ekspos-hpk/:id/perbaikan', perbaikan, {
    tag: TAG, request: 'EksposHpkPerbaikanRequest',
    example: { params: { id: 'pk7' }, body: {
      catatan: 'Uraian jabatan belum sesuai hasil ekspose; lengkapi ulang.' } },
    summary: 'Perbaiki Data dan Dokumen: status Ditolak/Perlu Perbaikan, ' +
      'catatan dikirim ke pemberi kerja (notifikasi). Hanya dari Terjadwal.',
    responses: { 409: 'Status bukan Terjadwal (INVALID_STATE).' },
  }),
  route('POST', '/ekspos-hpk/:id/bap', createBap, {
    tag: TAG, example: EXAMPLE_ID,
    summary: 'Buat BAP Hasil Penilaian Kelayakan: ekspose selesai (Layak), ' +
      'BAP terbit dengan status "menunggu disetujui" pemberi kerja. ' +
      'Hanya dari Terjadwal.',
    responses: { 409: 'Status bukan Terjadwal (INVALID_STATE).' },
  }),
];

/** Sort key: tanggal + jam + no. antrian; belum terjadwal paling akhir. */
function sortKey({ ekspose, noHpk }) {
  return ekspose ? `${ekspose.tanggal} ${ekspose.jam} ${ekspose.noAntrian}`
    : `9999 ${noHpk}`;
}

/** [{role, item}] of every HPK in the ekspose phase, in schedule order. */
function entriesOf(store) {
  seed(store);
  return ROLE_KEYS.flatMap((role) => (store.penilaianKelayakan[role] ?? [])
    .map((item) => ({ role, item })))
    .filter(({ item }) => EKSPOS_HPK_STATUS.includes(item.status) &&
      (item.ekspose || item.status === S.MENUNGGU_JADWAL))
    .sort((a, b) => sortKey(a.item).localeCompare(sortKey(b.item)));
}

function find(store, id) {
  return entriesOf(store).find(({ item }) => item.id === id) ?? null;
}

function hasilOf(item) {
  if (item.status === S.PERBAIKAN) {
    return [EKSPOS_HASIL.PERBAIKAN, 'red'];
  }
  if (item.status === S.SELESAI) {
    return [EKSPOS_HASIL.BAP_MENUNGGU, 'amber'];
  }
  return item.status === S.TERJADWAL
    ? [EKSPOS_HASIL.MENUNGGU_HASIL, 'blue'] : ['—', 'gray'];
}

function summary({ role, item }, store) {
  const [hasilStatus, hasilTone] = hasilOf(item);
  return {
    id: item.id, noHpk: item.noHpk, role, jenis: item.jenis,
    pemohon: store.companies[role].nama,
    jabatan: item.isian.jabatan ?? '—', tanggalAjuan: item.tanggal,
    status: item.status, tone: item.tone, ekspose: item.ekspose,
    hasilStatus, hasilTone,
    bap: item.bap && { nomor: item.bap.nomor, disetujui: item.bap.disetujui },
  };
}

function detail(entry, store) {
  const { item } = entry;
  const aktif = item.status === S.TERJADWAL && nextOf(item).includes(S.SELESAI);
  return {
    ...summary(entry, store), lokasiKerja: item.isian.lokasiKerja ?? '—',
    jumlahTka: item.isian.jumlahTka ?? 1, catatan: item.catatan,
    riwayat: item.riwayat, bap: item.bap,
    aksi: { reschedule: aktif, perbaikan: aktif, bap: aktif },
  };
}

function getDetail({ params, store }) {
  const entry = find(store, params.id);
  return entry ? ok(detail(entry, store)) : notFound(NOT_FOUND);
}

function audit(store, aksi, item, perubahan) {
  const [pengguna, peran, ip] = ACTOR;
  appendAudit(store, {
    pengguna, peran, aksi, modul: 'Permohonan', objek: `HPK ${item.noHpk}`,
    perubahan, ip,
  });
}

/** Apply a Petugas Ekspos transition to a Terjadwal HPK (409 otherwise). */
function move({ params, store }, body, aksi) {
  const entry = find(store, params.id);
  if (!entry) {
    return notFound(NOT_FOUND);
  }
  const { item, role } = entry;
  const sebelum = item.status;
  if (item.status !== S.TERJADWAL || !nextOf(item).includes(body.status)) {
    return fail(409, 'INVALID_STATE', `Pengajuan berstatus ${item.status}; ` +
      'hanya jadwal ekspose berstatus Terjadwal yang dapat diproses.');
  }
  const jadwalLama = item.ekspose && `${item.ekspose.tanggal} ${item.ekspose.jam}`;
  applyTransition(store, role, item, body, ACTOR[1]);
  audit(store, aksi, item, [
    { field: 'status', sebelum, sesudah: item.status },
    ...(body.status === S.TERJADWAL ? [{ field: 'jadwalEkspose',
      sebelum: jadwalLama,
      sesudah: `${item.ekspose.tanggal} ${item.ekspose.jam}` }] : [])]);
  return ok(detail(entry, store));
}

function reschedule(req) {
  return move(req, { status: S.TERJADWAL }, 'Ubah');
}

function createBap(req) {
  return move(req, { status: S.SELESAI }, 'Buat');
}

function perbaikan(req) {
  const result = validateEksposHpkPerbaikan(req.body);
  if (!result.valid) {
    return invalid(result);
  }
  return move(req, { status: S.PERBAIKAN, catatan: req.body.catatan },
    'Kembalikan');
}
