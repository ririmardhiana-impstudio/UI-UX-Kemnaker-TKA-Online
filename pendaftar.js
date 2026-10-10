/**
 * @fileoverview Pendaftar (verifikasi akun pemberi kerja) routes: aktivasi
 * / permintaan perbaikan / unggah ulang dokumen. Split out of
 * routes/back-office.js to keep that file under the size guideline.
 *
 * AK-15: berkas pendaftar masuk Verifikator terlebih dahulu ("Menunggu
 * verifikasi"); tautan aktivasi baru dikirim setelah disetujui ("Aktif").
 * "Perlu perbaikan" mengembalikan berkas ke pemohon untuk unggah ulang
 * dokumen (`resubmit`), sesuai alur diagram "Registrasi Operator
 * TKA-Online" (usulan KAK Modul 1).
 */

import {
  validatePendaftarFix, validatePendaftarResubmit,
} from '../../contracts/back-office.js';
import {
  DETAIL_DEFAULT, PENDAFTAR_DETAIL,
} from '../fixtures/verifikasi-akun.js';
import { fail, invalid, list, notFound, ok, route } from '../router.js';
import { appendAudit } from './security.js';

const AKUN_ACTOR = ['Andika Pratama', 'Verifikator Akun', '10.12.4.12'];

const PENDAFTAR_STATUS = {
  WAITING: 'Menunggu verifikasi',
  FIX: 'Perlu perbaikan',
  ACTIVE: 'Aktif',
};

export const PENDAFTAR_ROUTES = [
  route('GET', '/pendaftar', ({ store }) =>
    list(store.pendaftar.map(toDetail)), {
    tag: 'Back Office',
    summary: 'Daftar pemberi kerja pendaftar (akun Verifikator): data ' +
      'perusahaan, email admin, operator, dokumen, status, riwayat email.',
  }),
  route('GET', '/pendaftar/:id', getPendaftar, {
    tag: 'Back Office',
    summary: 'Detail pendaftar: nama pemberi kerja, email admin, data ' +
      'operator, dokumen. `id` = NPWP 15-16 digit, atau slug nama bila ' +
      'pendaftar Non-OSS tanpa NPWP.',
    example: { params: { id: '0761220441801000' } },
    responses: { 404: 'Pendaftar tidak ditemukan.' },
  }),
  route('POST', '/pendaftar/:npwp/activate', activate, {
    tag: 'Back Office',
    summary: 'Setujui pendaftar yang sedang menunggu verifikasi (AK-15, ' +
      'AK-20); sistem mengirim email aktivasi ke email admin dan ke ' +
      'setiap email operator (`emailTerkirim`).',
    example: { params: { npwp: '0761220441801000' } },
    responses: { 409: 'Status pendaftar tidak dapat diaktifkan.' },
  }),
  route('POST', '/pendaftar/:npwp/request-fix', requestFix, {
    tag: 'Back Office', summary: 'Minta perbaikan data pendaftar.',
    request: 'PendaftarFixRequest',
    example: { params: { npwp: '0823551907217000' },
      body: { catatan: 'Dokumen NIB tidak terbaca; unggah ulang PDF.' } },
    responses: { 409: 'Akun sudah aktif.' },
  }),
  route('POST', '/pendaftar/:npwp/resubmit', resubmit, {
    tag: 'Back Office',
    summary: 'Pemohon mengunggah ulang dokumen setelah diminta perbaikan ' +
      '(AK-15); status kembali "Menunggu verifikasi".',
    request: 'PendaftarResubmitRequest',
    example: { params: { npwp: '0911003488304000' }, body: { documents: [
      { jenis: 'NPWP', fileName: 'npwp-revisi.pdf', fileSize: 398211,
        mimeType: 'application/pdf' },
    ] } },
    responses: { 409: 'Status pendaftar bukan "Perlu perbaikan".' },
  }),
];

const digitsOf = (value) => String(value ?? '').replace(/\D/g, '');

const slugOf = (nama) => String(nama).toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Id pendaftar: digit NPWP, atau slug nama bila tanpa NPWP (Non-OSS). */
export function pendaftarId(row) {
  return digitsOf(row.npwp) || slugOf(row.nama);
}

function findPendaftar(store, key) {
  const wanted = String(key);
  return store.pendaftar.find((p) => pendaftarId(p) === wanted ||
    (digitsOf(p.npwp) && digitsOf(p.npwp) === digitsOf(wanted)));
}

/** Row + detail fixture (+ riwayat email untuk seed yang sudah Aktif). */
function toDetail(row) {
  const id = pendaftarId(row);
  const detail = { ...DETAIL_DEFAULT, ...PENDAFTAR_DETAIL[id] };
  const merged = { ...detail, ...row, id };
  if (!row.operators?.length) {
    merged.operators = detail.operators;
  }
  if (!merged.emailTerkirim && row.status === PENDAFTAR_STATUS.ACTIVE) {
    merged.emailTerkirim = emailLog(merged, `${row.tgl} 09.00`);
  }
  merged.emailTerkirim ??= [];
  return merged;
}

/** Satu email aktivasi per alamat unik: admin + tiap operator. */
function emailLog(row, waktu) {
  const byAddress = new Map();
  const add = (email, peran) => {
    const key = String(email ?? '').trim().toLowerCase();
    if (!key) {
      return;
    }
    const prev = byAddress.get(key);
    byAddress.set(key, prev
      ? { ...prev, peran: `${prev.peran} & ${peran}` }
      : { ke: email.trim(), peran });
  };
  add(row.emailAdmin, 'Admin Pemberi Kerja');
  for (const operator of row.operators ?? []) {
    add(operator.email, 'Operator');
  }
  return [...byAddress.values()].map((entry) => ({
    ...entry, jenis: 'Aktivasi akun TKA Online',
    subjek: `Aktivasi akun TKA Online — ${row.nama}`, waktu,
  }));
}

function getPendaftar({ params, store }) {
  const row = findPendaftar(store, params.id);
  return row ? ok(toDetail(row)) : notFound('Pendaftar');
}

function auditAkun(store, aksi, objek, perubahan) {
  const [pengguna, peran, ip] = AKUN_ACTOR;
  appendAudit(store, {
    pengguna, peran, aksi, modul: 'Akun', objek, perubahan, ip,
  });
}

function activate({ params, store }) {
  const row = findPendaftar(store, params.npwp);
  if (!row) {
    return notFound('Pendaftar');
  }
  if (row.status !== PENDAFTAR_STATUS.WAITING) {
    return fail(409, 'INVALID_STATE',
      `Pendaftar berstatus "${row.status}"; tidak dapat diaktifkan.`);
  }
  const before = row.status;
  const clock = new Date();
  const waktu = `${store.today.replace('September', 'Sep')} ` +
    `${String(clock.getHours()).padStart(2, '0')}.` +
    String(clock.getMinutes()).padStart(2, '0');
  const emailTerkirim = emailLog(toDetail(row), waktu);
  Object.assign(row, {
    status: PENDAFTAR_STATUS.ACTIVE, tone: 'green', email: true,
    emailTerkirim,
  });
  auditAkun(store, 'Aktivasi', `Pendaftar ${row.nama}`,
    [{ field: 'status', sebelum: before, sesudah: row.status },
      { field: 'emailTerkirim', sebelum: '—',
        sesudah: `${emailTerkirim.length} email` }]);
  return ok(toDetail(row));
}

function requestFix({ params, body, store }) {
  const result = validatePendaftarFix(body);
  if (!result.valid) {
    return invalid(result);
  }
  const row = findPendaftar(store, params.npwp);
  if (!row) {
    return notFound('Pendaftar');
  }
  if (row.status === PENDAFTAR_STATUS.ACTIVE) {
    return fail(409, 'INVALID_STATE', 'Akun sudah aktif.');
  }
  const before = row.status;
  Object.assign(row, {
    status: PENDAFTAR_STATUS.FIX, tone: 'red', catatan: body.catatan.trim(),
  });
  auditAkun(store, 'Kembalikan', `Pendaftar ${row.nama}`,
    [{ field: 'status', sebelum: before, sesudah: row.status }]);
  return ok(toDetail(row));
}

/**
 * AK-15 loop-back: pemohon (bukan aktor internal, tanpa entri audit log —
 * pola sama dengan submit awal di routes/auth.js `register`) mengunggah
 * ulang dokumen setelah diminta perbaikan — berkas kembali ke antrean
 * Verifikator ("Menunggu verifikasi"); catatan kekurangan dibersihkan.
 */
function resubmit({ params, body, store }) {
  const result = validatePendaftarResubmit(body);
  if (!result.valid) {
    return invalid(result);
  }
  const row = findPendaftar(store, params.npwp);
  if (!row) {
    return notFound('Pendaftar');
  }
  if (row.status !== PENDAFTAR_STATUS.FIX) {
    return fail(409, 'INVALID_STATE',
      `Pendaftar berstatus "${row.status}"; tidak sedang diminta perbaikan.`);
  }
  Object.assign(row, { status: PENDAFTAR_STATUS.WAITING, tone: 'amber' });
  delete row.catatan;
  return ok(row);
}
