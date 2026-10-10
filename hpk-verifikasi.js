/**
 * @fileoverview Verifikasi HPK oleh akun Verifikator (usulan KAK Modul 5,
 * AK-21): daftar pemberi kerja yang mengajukan/submit HPK, detail isian +
 * dokumen, `verify` (sistem generate jadwal ekspos) dan `reject` (alasan
 * wajib; status "Perbaikan data", pemberi kerja memperbaiki lalu
 * `resubmit`). Baris = antrian HPK yang sama dengan Back Office; tahap
 * "Verifikasi Data dan Upload" -> "Jadwal Ekspos".
 */

import { validateHpkReject } from '../../contracts/back-office.js';
import {
  HPK_DOKUMEN, HPK_ISIAN, HPK_ISIAN_DEFAULT,
} from '../fixtures/hpk-verifikasi.js';
import { fail, invalid, list, notFound, ok, route } from '../router.js';
import { antrianOf } from './back-office.js';
import { addEksposSession } from './reference.js';
import { appendAudit } from './security.js';

const VERIF_STAGE = 'Verifikasi Data dan Upload';
const EKSPOS_STAGE = 'Jadwal Ekspos';
const RETURNED = 'Dikembalikan';
const ACTOR = ['Andika Pratama', 'Verifikator Akun', '10.12.4.12'];

export const HPK_STATUS = {
  WAITING: 'Menunggu verifikasi',
  FIX: 'Perbaikan data',
  VERIFIED: 'Terverifikasi',
};
const TONE = {
  [HPK_STATUS.WAITING]: 'amber', [HPK_STATUS.FIX]: 'red',
  [HPK_STATUS.VERIFIED]: 'green',
};

export const HPK_VERIFIKASI_ROUTES = [
  route('GET', '/hpk-verifikasi', ({ store }) =>
    list(hpkRows(store).map(summary)), {
    tag: 'Back Office',
    summary: 'Daftar pemberi kerja yang mengajukan HPK (akun Verifikator): ' +
      'status `Menunggu verifikasi` | `Perbaikan data` | `Terverifikasi`.',
  }),
  route('GET', '/hpk-verifikasi/:id', getDetail, {
    tag: 'Back Office',
    summary: 'Detail HPK: isian formulir dan dokumen yang diunggah.',
    example: { params: { id: 'q2' } },
    responses: { 404: 'Permohonan HPK tidak ditemukan.' },
  }),
  route('POST', '/hpk-verifikasi/:id/verify', verify, {
    tag: 'Back Office',
    summary: 'Verifikasi HPK (AK-21): tahap menjadi Jadwal Ekspos dan ' +
      'sistem menempatkan sesi ekspos di slot kalender kosong pertama ' +
      '(`ekspos`).',
    example: { params: { id: 'q2' } },
    responses: {
      409: 'Permohonan tidak sedang menunggu verifikasi (INVALID_STATE) / ' +
        'kalender ekspos penuh (SCHEDULE_FULL).',
    },
  }),
  route('POST', '/hpk-verifikasi/:id/reject', reject, {
    tag: 'Back Office',
    summary: 'Tolak HPK dengan alasan (AK-21): status `Perbaikan data`; ' +
      'pemberi kerja dapat memperbaiki dan submit ulang.',
    request: 'HpkRejectRequest',
    example: { params: { id: 'q4' }, body: {
      alasan: 'Uraian jabatan kurang dari 350 karakter; lengkapi ulang.' } },
    responses: { 409: 'Permohonan tidak sedang menunggu verifikasi.' },
  }),
  route('POST', '/hpk-verifikasi/:id/resubmit', resubmit, {
    tag: 'Back Office',
    summary: 'Pemberi kerja submit ulang HPK setelah perbaikan data; ' +
      'status kembali `Menunggu verifikasi`, alasan dibersihkan (tanpa ' +
      'audit log — pemohon bukan aktor internal).',
    example: { params: { id: 'q1' } },
    responses: { 409: 'Status bukan "Perbaikan data".' },
  }),
];

function hpkRows(store) {
  return antrianOf(store).filter((q) => q.jenis === 'HPK');
}

function statusOf(row) {
  if (row.tahap !== VERIF_STAGE) {
    return HPK_STATUS.VERIFIED;
  }
  return row.sla === RETURNED ? HPK_STATUS.FIX : HPK_STATUS.WAITING;
}

function summary(row) {
  const status = statusOf(row);
  return {
    id: row.id, noPermohonan: row.no, pemohon: row.pemohon,
    kategori: row.kategori, layanan: row.layanan, tka: row.tka,
    masuk: row.masuk, status, tone: TONE[status],
    alasan: status === HPK_STATUS.FIX ? row.catatan ?? '' : '',
    jadwalEkspos: status === HPK_STATUS.VERIFIED ? row.sla : '',
  };
}

/** "Rohaniwan ×1, Geologist ×2" -> [{nama, jumlah}]. */
function jabatanOf(tka) {
  return String(tka).split(',').map((part) => {
    const [nama, jumlah] = part.trim().split(' ×');
    return { nama: nama.trim(), jumlah: Number(jumlah) || 1 };
  });
}

function detailOf(row, store) {
  const isian = { ...HPK_ISIAN_DEFAULT, ...HPK_ISIAN[row.id] };
  const session = row.eksposId
    ? store.eksposSessions?.find((s) => s.id === row.eksposId) ?? null : null;
  return {
    ...summary(row),
    isian: { jabatan: jabatanOf(row.tka), lokasi: isian.lokasi,
      negara: isian.negara, bulan: isian.bulan },
    dokumen: HPK_DOKUMEN.map((d) => ({ ...d, mimeType: 'application/pdf' })),
    ekspos: session
      ? { id: session.id, hari: session.hari, jam: session.jam,
        mode: session.mode }
      : null,
  };
}

function find(store, id) {
  return hpkRows(store).find((q) => q.id === id) ?? null;
}

function audit(store, aksi, row, perubahan) {
  const [pengguna, peran, ip] = ACTOR;
  appendAudit(store, {
    pengguna, peran, aksi, modul: 'Permohonan', objek: `HPK ${row.no}`,
    perubahan, ip,
  });
}

function getDetail({ params, store }) {
  const row = find(store, params.id);
  return row ? ok(detailOf(row, store)) : notFound('Permohonan HPK');
}

function notWaiting(row) {
  return fail(409, 'INVALID_STATE',
    `Permohonan berstatus "${statusOf(row)}"; bukan menunggu verifikasi.`);
}

function verify({ params, store }) {
  const row = find(store, params.id);
  if (!row) {
    return notFound('Permohonan HPK');
  }
  if (statusOf(row) !== HPK_STATUS.WAITING) {
    return notWaiting(row);
  }
  const session = addEksposSession(store, row.pemohon, row.layanan);
  if (!session) {
    return fail(409, 'SCHEDULE_FULL',
      'Kalender ekspos minggu ini penuh; jadwalkan manual di Back Office.');
  }
  Object.assign(row, {
    tahap: EKSPOS_STAGE, tone: 'blue',
    sla: `Ekspos ${session.hari.split(', ')[1]}`, eksposId: session.id,
  });
  delete row.catatan;
  audit(store, 'Setujui', row, [
    { field: 'tahap', sebelum: VERIF_STAGE, sesudah: EKSPOS_STAGE },
    { field: 'jadwalEkspos', sebelum: '—',
      sesudah: `${session.hari} ${session.jam}` }]);
  return ok(detailOf(row, store));
}

function reject({ params, body, store }) {
  const result = validateHpkReject(body);
  if (!result.valid) {
    return invalid(result);
  }
  const row = find(store, params.id);
  if (!row) {
    return notFound('Permohonan HPK');
  }
  if (statusOf(row) !== HPK_STATUS.WAITING) {
    return notWaiting(row);
  }
  Object.assign(row, {
    sla: RETURNED, tone: 'red', catatan: body.alasan.trim(),
  });
  audit(store, 'Kembalikan', row, [
    { field: 'status', sebelum: HPK_STATUS.WAITING, sesudah: HPK_STATUS.FIX },
    { field: 'alasan', sebelum: '', sesudah: row.catatan }]);
  return ok(detailOf(row, store));
}

function resubmit({ params, store }) {
  const row = find(store, params.id);
  if (!row) {
    return notFound('Permohonan HPK');
  }
  if (statusOf(row) !== HPK_STATUS.FIX) {
    return fail(409, 'INVALID_STATE',
      `Permohonan berstatus "${statusOf(row)}"; tidak sedang perbaikan data.`);
  }
  Object.assign(row, { sla: '1 hari', tone: 'blue' });
  delete row.catatan;
  return ok(detailOf(row, store));
}
