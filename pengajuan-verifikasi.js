/**
 * @fileoverview Perubahan & Pencabutan RPTKA yang diajukan pemberi kerja
 * dan diverifikasi akun Verifikator (AK-24). Data dinamis: baris muncul
 * setelah pemberi kerja menekan Proses (Perubahan, routes/perubahan.js)
 * atau Ajukan (Pencabutan, `POST /pencabutan`) dan hanya baris itu — seed
 * lama tanpa `verif` tidak ikut. Verifikasi -> diteruskan ke Validator;
 * Tolak (alasan) -> Perbaikan; pemberi kerja submit ulang -> kembali
 * Menunggu verifikasi. Status di sisi pemberi kerja ikut diperbarui.
 */

import {
  PENCABUTAN_JENIS, pencabutanDokumenContoh, validatePengajuanReject,
} from '../../contracts/pengajuan-verifikasi.js';
import { ROLE_KEYS } from '../../contracts/schema.js';
import {
  fail, invalid, list, notFound, ok, route,
} from '../router.js';
import { pushNotifikasi } from './notifikasi.js';
import { appendAudit } from './security.js';

export const VERIF = {
  WAITING: 'Menunggu verifikasi', FIX: 'Perbaikan',
  FORWARDED: 'Diteruskan ke Validator', VALIDATED: 'Tervalidasi',
};
const TONE = { [VERIF.WAITING]: 'amber', [VERIF.FIX]: 'red',
  [VERIF.FORWARDED]: 'blue', [VERIF.VALIDATED]: 'green' };
const ACTOR = ['Andika Pratama', 'Verifikator Akun', '10.12.4.12'];
const PDF = 'application/pdf';

/** Per-kind accessors: where the rows live and how they are shown. */
export const KINDS = {
  perubahan: {
    label: 'Perubahan', tag: 'Perubahan RPTKA',
    rows: (store) => ROLE_KEYS.flatMap((role) => (store.perubahan[role] ?? [])
      .map((item) => ({ item, role }))),
    view: (store, { item, role }) => ({
      id: `${role}.${item.noPermohonan}`, nomor: item.noPermohonan,
      tanggal: item.tglAjuan, jenis: item.jenis,
      pemohon: store.companies[role].nama, nama: item.nama,
      isian: [['Pemberi Kerja', store.companies[role].nama],
        ['Nomor Permohonan', item.noPermohonan],
        ['Jenis perubahan', item.jenis], ['Rincian', item.detail],
        ['Nama TKA', item.nama], ['Paspor', item.paspor],
        ['Jabatan', item.jabatan], ['SK Pengesahan', item.skNo],
        ['Semula', item.semula], ['Menjadi', item.menjadi],
        ['Nomor surat', item.surat], ['Tanggal surat', item.suratTgl]],
      dokumen: item.dokumenList?.length ? item.dokumenList
        : [{ jenis: 'Dokumen perubahan', fileName: 'dokumen-perubahan.pdf',
          fileSize: 184320, mimeType: PDF }],
    }),
    sync: (item, text, tone) => Object.assign(item, { status: text, tone }),
    link: { page: 'perubahan' },
  },
  pencabutan: {
    label: 'Pencabutan', tag: 'Pencabutan RPTKA',
    rows: (store) => (store.pencabutan ?? [])
      .filter((r) => r.verif).map((item) => ({ item, role: item.role })),
    view: (store, { item, role }) => ({
      id: item.id, nomor: item.noPermohonan, tanggal: item.tglAjuan,
      jenis: item.alasan, pemohon: store.companies[role].nama,
      nama: item.nama,
      isian: [['Pemberi Kerja', store.companies[role].nama],
        ['Nomor Permohonan', item.noPermohonan],
        ['Barcode / Nomor RPTKA', `${item.barcode} · ${item.skNo}`],
        ['Nomor HPK', item.noHpk ?? '—'],
        ['Nama TKA', item.nama], ['Paspor', item.paspor],
        ['Jabatan', item.jabatan], ['Jenis pencabutan', item.alasan],
        ['Alasan pencabutan', item.alasanDetail ?? item.alasan]],
      dokumen: item.dokumenList,
    }),
    sync: (item, text, tone) => Object.assign(item, { status: text, tone }),
    link: { page: 'pencabutan' },
  },
};

export const EMPLOYER_TEXT = {
  [VERIF.WAITING]: ['Menunggu verifikasi Verifikator', 'amber'],
  [VERIF.FIX]: ['Perlu perbaikan — ajukan kembali', 'red'],
  [VERIF.FORWARDED]: ['Diteruskan ke Validator', 'blue'],
  [VERIF.VALIDATED]: ['Divalidasi Validator — menunggu SK Pencabutan',
    'green'],
};

function summaryOf(kind, store, entry) {
  const cfg = KINDS[kind];
  const v = cfg.view(store, entry);
  const { item } = entry;
  return {
    id: v.id, nomor: v.nomor, tanggal: v.tanggal, jenis: v.jenis,
    pemohon: v.pemohon, nama: v.nama, status: item.verif,
    tone: TONE[item.verif], alasan: item.verif === VERIF.FIX
      ? item.verifAlasan ?? '' : '',
  };
}

export function detailOf(kind, store, entry) {
  const v = KINDS[kind].view(store, entry);
  return { ...summaryOf(kind, store, entry), isian: v.isian.map(
    ([label, value]) => ({ label, value: value ?? '' })), dokumen: v.dokumen };
}

export function entries(kind, store) {
  return KINDS[kind].rows(store).filter(({ item }) => item.verif);
}

export function find(kind, store, id) {
  return entries(kind, store).find((e) => KINDS[kind].view(store, e).id === id)
    ?? null;
}

export function setVerif(kind, store, entry, verif) {
  const { item, role } = entry;
  item.verif = verif;
  const [text, tone] = EMPLOYER_TEXT[verif];
  KINDS[kind].sync(item, text, tone);
  return role;
}

export function audit(kind, store, aksi, entry, perubahan, actor = ACTOR) {
  const [pengguna, peran, ip] = actor;
  appendAudit(store, { pengguna, peran, aksi, modul: 'Permohonan',
    objek: `${KINDS[kind].label} ${entry.item.noPermohonan}`, perubahan, ip });
}

export function notify(kind, store, entry, judul, isi) {
  if (entry.role) {
    pushNotifikasi(store, entry.role, { judul, isi, kategori: 'Pengesahan',
      tautan: KINDS[kind].link });
  }
}

const notWaiting = (entry, action) => fail(409, 'INVALID_STATE',
  `Status "${entry.item.verif}" tidak dapat ${action}.`);

function makeHandlers(kind) {
  const label = KINDS[kind].label;
  return {
    list: ({ store }) => list(entries(kind, store)
      .map((e) => summaryOf(kind, store, e))),
    get: ({ params, store }) => {
      const entry = find(kind, store, params.id);
      return entry ? ok(detailOf(kind, store, entry))
        : notFound(`Pengajuan ${label}`);
    },
    verify: ({ params, store }) => {
      const entry = find(kind, store, params.id);
      if (!entry) {
        return notFound(`Pengajuan ${label}`);
      }
      if (entry.item.verif !== VERIF.WAITING) {
        return notWaiting(entry, 'diverifikasi');
      }
      setVerif(kind, store, entry, VERIF.FORWARDED);
      audit(kind, store, 'Setujui', entry, [{ field: 'status',
        sebelum: VERIF.WAITING, sesudah: VERIF.FORWARDED }]);
      notify(kind, store, entry, `${label} ${entry.item.noPermohonan} ` +
        'diverifikasi', 'Diteruskan ke Validator.');
      return ok(detailOf(kind, store, entry));
    },
    reject: ({ params, body, store }) => {
      const result = validatePengajuanReject(body);
      if (!result.valid) {
        return invalid(result);
      }
      const entry = find(kind, store, params.id);
      if (!entry) {
        return notFound(`Pengajuan ${label}`);
      }
      if (entry.item.verif !== VERIF.WAITING) {
        return notWaiting(entry, 'ditolak');
      }
      entry.item.verifAlasan = body.alasan.trim();
      entry.item.verifOleh = 'verifikator';
      setVerif(kind, store, entry, VERIF.FIX);
      audit(kind, store, 'Kembalikan', entry, [
        { field: 'status', sebelum: VERIF.WAITING, sesudah: VERIF.FIX },
        { field: 'alasan', sebelum: '', sesudah: entry.item.verifAlasan }]);
      notify(kind, store, entry, `${label} ${entry.item.noPermohonan} ` +
        'perlu perbaikan', entry.item.verifAlasan);
      return ok(detailOf(kind, store, entry));
    },
    resubmit: ({ params, store }) => {
      const entry = find(kind, store, params.id);
      if (!entry) {
        return notFound(`Pengajuan ${label}`);
      }
      if (entry.item.verif !== VERIF.FIX) {
        return notWaiting(entry, 'diajukan ulang');
      }
      // Ditolak Validator -> submit ulang langsung ke Validator (tanpa
      // Verifikator); ditolak Verifikator -> kembali ke Verifikator.
      const direct = entry.item.verifOleh === 'validator';
      delete entry.item.verifAlasan;
      delete entry.item.verifOleh;
      setVerif(kind, store, entry, direct ? VERIF.FORWARDED : VERIF.WAITING);
      return ok(detailOf(kind, store, entry));
    },
  };
}

/** Example setup: one submitted pengajuan of `kind` (id in EXAMPLE_ID). */
const EXAMPLE_ID = { perubahan: 'swasta.C-2610-0001', pencabutan: 'pc1' };
const EXAMPLE_BEFORE = {
  perubahan: [
    { method: 'POST', path: '/perubahan/c1/documents', body: { role: 'swasta',
      nama: 'Paspor baru (berwarna)', fileName: 'paspor.jpg' } },
    { method: 'POST', path: '/perubahan/c1/submit',
      body: { role: 'swasta', agree: true } }],
  pencabutan: [{ method: 'POST', path: '/pencabutan', body: {
    role: 'swasta', barcode: '25103377', jenis: PENCABUTAN_JENIS[0],
    alasan: 'TKA telah meninggalkan Indonesia dengan EPO.',
    dokumen: pencabutanDokumenContoh(PENCABUTAN_JENIS[0]) } }],
};

function kindRoutes(kind) {
  const h = makeHandlers(kind);
  const { label, tag } = KINDS[kind];
  const base = `/${kind}-verifikasi`;
  const eg = (extra = {}, before = EXAMPLE_BEFORE[kind]) => ({ example: {
    params: { id: EXAMPLE_ID[kind] }, before, ...extra } });
  return [
    route('GET', base, h.list, { tag: 'Back Office', ...eg({ params: {} }),
      summary: `Daftar pengajuan ${label} dari pemberi kerja (akun ` +
        'Verifikator): nomor, tanggal, jenis, pemberi kerja, status.' }),
    route('GET', `${base}/:id`, h.get, { tag: 'Back Office',
      ...eg(),
      summary: `Detail pengajuan ${label}: isian dan dokumen diunggah.`,
      responses: { 404: `Pengajuan ${label} tidak ditemukan.` } }),
    route('POST', `${base}/:id/verify`, h.verify, { tag: 'Back Office',
      ...eg(),
      summary: `Verifikasi ${tag} -> diteruskan ke Validator.`,
      responses: { 409: 'Status bukan Menunggu verifikasi.' } }),
    route('POST', `${base}/:id/reject`, h.reject, { tag: 'Back Office',
      request: 'PengajuanRejectRequest',
      ...eg({ body: { alasan: 'Dokumen pendukung tidak terbaca.' } }),
      summary: `Tolak ${tag} dengan alasan -> status Perbaikan.`,
      responses: { 409: 'Status bukan Menunggu verifikasi.' } }),
    route('POST', `${base}/:id/resubmit`, h.resubmit, { tag: 'Back Office',
      ...eg({}, [...EXAMPLE_BEFORE[kind], { method: 'POST',
        path: `${base}/${EXAMPLE_ID[kind]}/reject`,
        body: { alasan: 'Dokumen pendukung tidak terbaca.' } }]),
      summary: `Pemberi kerja mengajukan ulang ${tag} setelah Perbaikan.`,
      responses: { 409: 'Status bukan Perbaikan.' } }),
  ];
}

export const PENGAJUAN_VERIFIKASI_ROUTES = [
  ...kindRoutes('perubahan'),
  ...kindRoutes('pencabutan'),
];

