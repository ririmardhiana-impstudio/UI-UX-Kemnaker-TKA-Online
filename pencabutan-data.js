/**
 * @fileoverview Sesi kerja form Pencabutan RPTKA per TKA (draft/submit):
 * satu sesi di state.extra.cabut = { key, tab, errors, cari, w }, dibangun
 * ulang tiap navigasi ke halaman (baru / id) dan dibuang saat kembali ke
 * daftar. `w` = isi form: nomor RPTKA terpilih (barcode), jenis, alasan,
 * dokumen per jenis dokumen. Aturan: business-rules.md PC-01..PC-05.
 */

import { getPencabutan } from '../../api/pencabutan.js';
import { pencabutanDokumen } from '../../contracts/pengajuan-verifikasi.js';
import { withRetry } from './data.js';
import { state } from './state.js';

export const DRAF = 'Draf';
export const TABS = [{ key: 'data', label: 'Data Isian' },
  { key: 'dokumen', label: 'Unggah Dokumen' },
  { key: 'preview', label: 'Preview' }];

/** Status yang menghalangi pencabutan baru atas TKA yang sama. */
const AKTIF = [DRAF, 'Verifikasi', 'Perlu perbaikan — ajukan kembali',
  'Menunggu verifikasi Verifikator', 'Diteruskan ke Validator', 'Terbit'];

export const cabut = () => state.extra.cabut;
export const resetCabut = () => {
  delete state.extra.cabut;
};
/** Bisa diubah: form baru atau Draf. */
export const editable = (S) => !S.w.id || S.w.status === DRAF;
export const tkaOf = (barcode) => state.data.tka
  .find((t) => t.barcode === barcode) ?? null;

/** Riwayat pencabutan milik role ini (seed lama tanpa role ikut tampil). */
export const riwayat = () => state.data.pencabutan
  .filter((x) => !x.role || x.role === state.role);

/** Barcode TKA yang sudah punya pencabutan aktif/terbit (selain `exceptId`). */
export function barcodeTerblokir(exceptId) {
  return new Set(riwayat().filter((x) => x.id !== exceptId &&
    AKTIF.includes(x.status)).map((x) => x.barcode));
}

const kosong = () => ({ id: null, noPermohonan: null, status: null,
  barcode: '', jenis: '', alasan: '', dokumen: {} });

function dariBaris(row) {
  const dokumen = {};
  for (const d of row.dokumenList ?? []) {
    dokumen[d.jenis] = { namaBerkas: d.fileName,
      ukuranKb: Math.max(1, Math.ceil(d.fileSize / 1024)),
      berkasId: d.berkasId ?? null };
  }
  return { id: row.id, noPermohonan: row.noPermohonan, status: row.status,
    barcode: row.barcode ?? '', jenis: row.jenis ?? '',
    alasan: row.alasanDetail ?? '', dokumen, verifAlasan: row.verifAlasan };
}

/** VIEWS.pencabutan.load: sesi form saat ?baru / ?id, bersihkan di daftar. */
export async function load() {
  const { baru, id } = state.p;
  if (!baru && !id) {
    resetCabut();
    return;
  }
  const key = id ?? 'baru';
  if (cabut()?.key === key) {
    return;
  }
  const row = id ? await withRetry(() => getPencabutan(id, state.role))
    : null;
  state.extra.cabut = { key, tab: 'data', errors: {}, cari: '',
    w: row ? dariBaris(row) : kosong() };
}

const mime = (nama) => /\.pdf$/i.test(nama) ? 'application/pdf'
  : /\.png$/i.test(nama) ? 'image/png' : 'image/jpeg';

/** Body POST/PUT /pencabutan dari sesi; submit hanya membawa dokumen wajib. */
export function toBody(S, draft) {
  const { w } = S;
  const perlu = draft ? Object.keys(w.dokumen) : pencabutanDokumen(w.jenis);
  const dokumen = perlu.filter((jenis) => w.dokumen[jenis]).map((jenis) => {
    const d = w.dokumen[jenis];
    return { jenis, fileName: d.namaBerkas, fileSize: d.ukuranKb * 1024,
      mimeType: mime(d.namaBerkas), ...(d.berkasId ? { berkasId: d.berkasId }
        : {}) };
  });
  return { role: state.role, barcode: w.barcode, draft,
    ...(w.jenis ? { jenis: w.jenis } : {}), alasan: w.alasan, dokumen };
}
