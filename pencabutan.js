/**
 * @fileoverview Pencabutan Pengesahan RPTKA per TKA dari akun pemberi kerja:
 * simpan Draf, submit (-> antrean Verifikator, AK-24), ubah draf, detail.
 * Draf tidak punya `verif` sehingga tidak tampil di Verifikator; submit
 * mengisi `verif` = Menunggu verifikasi. Aturan: business-rules.md PC-01..PC-05.
 */

import { validatePencabutanSubmit } from '../../contracts/pengajuan-verifikasi.js';
import {
  created, fail, invalid, notFound, ok, route,
} from '../router.js';
import { pushNotifikasi } from './notifikasi.js';
import { EMPLOYER_TEXT, VERIF } from './pengajuan-verifikasi.js';
import { pad, today } from './siklus-shared.js';

const DRAF = 'Draf';
const BLOCKING = [DRAF, 'Verifikasi', 'Perlu perbaikan — ajukan kembali',
  'Menunggu verifikasi Verifikator', 'Diteruskan ke Validator',
  'Divalidasi Validator — menunggu SK Pencabutan', 'Terbit'];

/** Nomor HPK dasar pengesahan TKA (null untuk kelompok tanpa HPK). */
function noHpkOf(store, role, tka) {
  const peng = (store.pengesahan[role] ?? [])
    .find((p) => p.paspor === tka.paspor);
  return (store.hpk[role] ?? []).find((h) => h.id === peng?.hpk)?.barcode
    ?? null;
}

function applyBody(store, row, body, tka) {
  const draft = body.draft === true;
  Object.assign(row, {
    nama: tka.nama, barcode: tka.barcode, skNo: tka.skNo,
    paspor: tka.paspor, jabatan: tka.jabatan,
    noHpk: noHpkOf(store, row.role, tka),
    jenis: body.jenis ?? null, alasan: body.jenis ?? '—',
    alasanDetail: String(body.alasan ?? '').trim(),
    dokumenList: structuredClone(body.dokumen ?? []),
  });
  if (draft) {
    Object.assign(row, { status: DRAF, tone: 'gray',
      tgl: `Draf — disimpan ${today(store)}` });
    delete row.verif;
    return;
  }
  const [text, tone] = EMPLOYER_TEXT[VERIF.WAITING];
  Object.assign(row, { verif: VERIF.WAITING, status: text, tone,
    tglAjuan: today(store), tgl: `Diajukan ${today(store)}` });
  pushNotifikasi(store, row.role, { judul: `Pencabutan ${row.noPermohonan} ` +
    'terkirim', isi: 'Menunggu verifikasi Verifikator.',
  kategori: 'Pengesahan', tautan: { page: 'pencabutan' } });
}

/** Validasi + TKA + duplikat; mengembalikan {tka} atau respons error. */
function check(store, body, exceptId) {
  const result = validatePencabutanSubmit(body);
  if (!result.valid) {
    return { error: invalid(result) };
  }
  const tka = (store.tka[body.role] ?? [])
    .find((t) => t.barcode === body.barcode);
  if (!tka) {
    return { error: notFound('TKA / Pengesahan RPTKA') };
  }
  const active = (store.pencabutan ?? []).find((p) => p.id !== exceptId &&
    p.barcode === body.barcode && BLOCKING.includes(p.status));
  if (active) {
    return { error: fail(409, 'CONFLICT', 'Sudah ada permohonan pencabutan ' +
      'untuk TKA ini yang sedang diproses atau terbit.',
    { field: 'barcode' }) };
  }
  return { tka };
}

function createPencabutan({ body, store }) {
  const checked = check(store, body);
  if (checked.error) {
    return checked.error;
  }
  const seq = (store.pencabutanSeq = (store.pencabutanSeq ?? 0) + 1);
  const row = { id: `pc${seq}`, role: body.role,
    noPermohonan: `PC-2610-${pad(seq, 4)}` };
  applyBody(store, row, body, checked.tka);
  store.pencabutan.unshift(row);
  return created(row);
}

const findOwn = (store, id, role) => (store.pencabutan ?? [])
  .find((p) => p.id === id && (!role || p.role === role));

function updatePencabutan({ params, body, store }) {
  const row = findOwn(store, params.id, body?.role);
  if (!row) {
    return notFound('Permohonan pencabutan');
  }
  if (row.status !== DRAF) {
    return fail(409, 'INVALID_STATE', `Status "${row.status}" tidak dapat ` +
      'diubah; hanya Draf.');
  }
  const checked = check(store, body, row.id);
  if (checked.error) {
    return checked.error;
  }
  applyBody(store, row, body, checked.tka);
  return ok(row);
}

function getPencabutan({ params, query, store }) {
  const row = findOwn(store, params.id, query?.role);
  return row ? ok(row) : notFound('Permohonan pencabutan');
}

export const PENCABUTAN_ROUTES = [
  route('POST', '/pencabutan', createPencabutan, {
    tag: 'Pemberi Kerja', request: 'PencabutanSubmitRequest',
    summary: 'Pemberi kerja menyimpan draft (draft=true) atau mengajukan ' +
      'pencabutan Pengesahan RPTKA per TKA; submit masuk antrean Verifikator ' +
      '(AK-24).',
    example: { body: { role: 'swasta', barcode: '25103377',
      draft: true } },
    responses: { 404: 'TKA tidak ditemukan.',
      409: 'Sudah ada permohonan pencabutan aktif/terbit.' },
  }),
  route('GET', '/pencabutan/:id', getPencabutan, {
    tag: 'Pemberi Kerja', summary: 'Detail permohonan pencabutan (?role=).',
    example: { params: { id: 'pc1' }, query: { role: 'swasta' },
      before: [{ method: 'POST', path: '/pencabutan', body: {
        role: 'swasta', barcode: '25103377', draft: true } }] },
    responses: { 404: 'Permohonan tidak ditemukan.' },
  }),
  route('PUT', '/pencabutan/:id', updatePencabutan, {
    tag: 'Pemberi Kerja', request: 'PencabutanSubmitRequest',
    summary: 'Ubah draf pencabutan; draft=false = submit ke Verifikator.',
    example: { params: { id: 'pc1' }, body: { role: 'swasta',
      barcode: '25103377', draft: true, jenis: 'EPO' },
    before: [{ method: 'POST', path: '/pencabutan', body: {
      role: 'swasta', barcode: '25103377', draft: true } }] },
    responses: { 404: 'Permohonan tidak ditemukan.',
      409: 'Status bukan Draf.' },
  }),
];
