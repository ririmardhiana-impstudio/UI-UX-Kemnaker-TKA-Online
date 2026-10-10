/**
 * @fileoverview Perubahan Pengesahan RPTKA routes (§7.2):
 * Draf (1) -> Diajukan (2) -> Pemeriksaan Petugas (3) -> Terbit (6);
 * Draf -> Dibatalkan (9). Tombol Proses butuh dokumen lengkap + pengurus.
 */

import {
  JABATAN_TANPA_PENDAMPING,
  JENIS_PENDAMPING,
  PERUBAHAN_STATUS,
  validateCancelPerubahan,
  validateCreatePerubahan,
  validatePerubahanDocument,
  validateSubmitPerubahan,
} from '../../contracts/perubahan.js';
import {
  checkRole, created, fail, invalid, list, notFound, ok, route,
} from '../router.js';
import { VERIF } from './pengajuan-verifikasi.js';
import { pad, today } from './siklus-shared.js';

const ROLE_QUERY = { role: 'swasta | lembaga | pemerintah (wajib)' };
const STATUS_VIEW = {
  [PERUBAHAN_STATUS.DRAF]: { status: 'Draf', tone: 'gray' },
  [PERUBAHAN_STATUS.DIAJUKAN]: { status: 'Diajukan', tone: 'blue' },
  [PERUBAHAN_STATUS.DIBATALKAN]: { status: 'Dibatalkan', tone: 'red' },
};

export const PERUBAHAN_ROUTES = [
  route('GET', '/perubahan', listPerubahan, {
    tag: 'Perubahan', summary: 'Daftar permohonan perubahan per role.',
    query: ROLE_QUERY, example: { query: { role: 'swasta' } },
  }),
  route('GET', '/perubahan/:id', getPerubahan, {
    tag: 'Perubahan', summary: 'Detail permohonan perubahan.',
    query: ROLE_QUERY,
    example: { params: { id: 'c1' }, query: { role: 'swasta' } },
  }),
  route('POST', '/perubahan', createPerubahan, {
    tag: 'Perubahan', summary: 'Buat draf perubahan (SK harus milik role).',
    request: 'CreatePerubahanRequest',
    example: { body: { role: 'swasta', skBarcode: '25103377',
      jenis: 'Data Tenaga Kerja Asing', detail: 'Data Paspor',
      semula: 'EH4471028', menjadi: 'EK0923316',
      surat: '045/NBP-HRD/IX/2026', suratTgl: '28 September 2026' } },
    responses: { 404: 'SK Pengesahan tidak ditemukan untuk role ini.',
      422: 'Nama TKI Pendamping untuk jabatan direksi/komisaris.' },
  }),
  route('POST', '/perubahan/:id/documents', uploadDocument, {
    tag: 'Perubahan', summary: 'Tandai dokumen perubahan terunggah.',
    request: 'PerubahanDocumentRequest',
    example: { params: { id: 'c1' }, body: { role: 'swasta',
      nama: 'Paspor baru (berwarna)', fileName: 'paspor.jpg' } },
    responses: { 409: 'Hanya draf yang dapat diubah.' },
  }),
  route('POST', '/perubahan/:id/submit', submitPerubahan, {
    tag: 'Perubahan', summary: 'Proses draf (Draf -> Diajukan).',
    request: 'SubmitPerubahanRequest',
    example: {
      params: { id: 'c1' }, body: { role: 'swasta', agree: true },
      before: [{ method: 'POST', path: '/perubahan/c1/documents',
        body: { role: 'swasta', nama: 'Paspor baru (berwarna)',
          fileName: 'paspor.jpg' } }],
    },
    responses: {
      409: 'Bukan draf.',
      422: 'Dokumen belum lengkap / data pengurus belum diisi.',
    },
  }),
  route('POST', '/perubahan/:id/cancel', cancelPerubahan, {
    tag: 'Perubahan', summary: 'Batalkan draf dengan alasan (maks. 1000).',
    request: 'CancelPerubahanRequest',
    example: { params: { id: 'c1' }, body: { role: 'swasta',
      alasan: 'Tidak jadi diubah.' } },
    responses: { 409: 'Bukan draf.' },
  }),
];

function listPerubahan({ query, store }) {
  const roleError = checkRole(query.role);
  return roleError ?? list(store.perubahan[query.role]);
}

function getPerubahan({ params, query, store }) {
  const roleError = checkRole(query.role);
  if (roleError) {
    return roleError;
  }
  const found = findPerubahan(store, query.role, params.id);
  return found ? ok(found) : notFound('Permohonan perubahan');
}

function createPerubahan({ body, store }) {
  const result = validateCreatePerubahan(body);
  if (!result.valid) {
    return invalid(result);
  }
  const sk = store.tka[body.role].find((t) => t.barcode === body.skBarcode);
  if (!sk) {
    return notFound('SK Pengesahan');
  }
  if (body.jenis === JENIS_PENDAMPING &&
      JABATAN_TANPA_PENDAMPING.test(sk.jabatan)) {
    return fail(422, 'PRECONDITION_FAILED', `Jabatan ${sk.jabatan} tidak ` +
      'wajib menunjuk Tenaga Kerja Pendamping.', { field: 'jenis' });
  }
  const rows = store.perubahan[body.role];
  const { role, skBarcode, ...fields } = body;
  const draft = {
    id: `c${rows.length + 1}-${Date.now().toString(36)}`,
    barcode: '—', skBarcode, skNo: sk.skNo, skTgl: sk.skTgl,
    nama: sk.nama, paspor: sk.paspor, jabatan: sk.jabatan,
    ...fields, dok: false, pengurus: true,
    statusId: PERUBAHAN_STATUS.DRAF,
    ...STATUS_VIEW[PERUBAHAN_STATUS.DRAF],
  };
  rows.unshift(draft);
  return created(draft);
}

function uploadDocument({ params, body, store }) {
  const result = validatePerubahanDocument(body);
  if (!result.valid) {
    return invalid(result);
  }
  return withDraft(store, body.role, params.id, (item) => {
    item.dok = true;
    (item.dokumenList ??= []).push({ jenis: body.nama,
      fileName: body.fileName, fileSize: 150000, mimeType: 'application/pdf' });
    return ok(item);
  });
}

function submitPerubahan({ params, body, store }) {
  const result = validateSubmitPerubahan(body);
  if (!result.valid) {
    return invalid(result);
  }
  return withDraft(store, body.role, params.id, (item) => {
    if (!item.dok || !item.pengurus) {
      return fail(422, 'PRECONDITION_FAILED',
        'Dokumen belum lengkap atau data pengurus belum diisi.',
        { field: item.dok ? 'pengurus' : 'dok' });
    }
    // AK-24: pengajuan masuk antrean Verifikator.
    store.perubahanSeq = (store.perubahanSeq ?? 0) + 1;
    Object.assign(item, { verif: VERIF.WAITING,
      noPermohonan: `C-2610-${pad(store.perubahanSeq, 4)}`,
      tglAjuan: today(store) });
    return setStatus(item, PERUBAHAN_STATUS.DIAJUKAN);
  });
}

function cancelPerubahan({ params, body, store }) {
  const result = validateCancelPerubahan(body);
  if (!result.valid) {
    return invalid(result);
  }
  return withDraft(store, body.role, params.id, (item) => {
    item.alasanBatal = body.alasan.trim();
    return setStatus(item, PERUBAHAN_STATUS.DIBATALKAN);
  });
}

function findPerubahan(store, role, id) {
  return store.perubahan[role].find((c) => c.id === id) ?? null;
}

/** Run `action` only when the item exists and is still a draft. */
function withDraft(store, role, id, action) {
  const item = findPerubahan(store, role, id);
  if (!item) {
    return notFound('Permohonan perubahan');
  }
  if (item.statusId !== PERUBAHAN_STATUS.DRAF) {
    return fail(409, 'INVALID_STATE',
      `Permohonan berstatus ${item.status}; hanya draf yang dapat diubah.`);
  }
  return action(item);
}

function setStatus(item, statusId) {
  Object.assign(item, { statusId, ...STATUS_VIEW[statusId] });
  return ok(item);
}
