/**
 * @fileoverview Aksi tab Jabatan TKA: simpan (tambah/ubah) dengan validasi
 * kuota HPK + pilihan jangka waktu menurut jenis, dan konfirmasi hapus.
 */

import { qs } from '../../components/dom.js';
import { validateRptkaJabatan } from '../../contracts/pengesahan-rptka.js';
import { confirmDialog } from './rptka-confirm.js';
import { hpkOf, session, syncTka } from './rptka-data.js';
import { showErrors, toast } from './ui.js';

const IDS = { nama: 'rp-jab-nama', jangkaWaktuBulan: 'rp-jab-bulan' };

/**
 * @param {function(string)} paint re-render + fokus ke id.
 * `jumlahTka` dikunci ke 1 — satu pengajuan = satu jabatan = satu TKA,
 * tanpa input terpisah (lihat `JABATAN_SATU_TKA_PESAN`).
 */
export function saveJabatan(paint) {
  const S = session();
  const entry = { nama: qs('#rp-jab-nama').value.trim(), jumlahTka: 1,
    jangkaWaktuBulan: Number(qs('#rp-jab-bulan').value) };
  const at = S.editJab >= 0 ? S.editJab : S.w.jabatan.length;
  const next = [...S.w.jabatan];
  next[at] = entry;
  const errors = validateRptkaJabatan(next, hpkOf(S), S.w.jenis,
    Boolean(S.w.rptkaAsalId));
  const own = Object.fromEntries(Object.entries(errors)
    .filter(([path]) => path.startsWith(`jabatan.${at}.`))
    .map(([path, msg]) => [IDS[path.split('.')[2]], msg]));
  if (showErrors(qs('#rp-panel'), own)) {
    return;
  }
  S.w.jabatan = next;
  syncTka(S.w);
  Object.assign(S, { editJab: -1, errors: {} });
  toast('Jabatan disimpan.');
  paint('rp-jab-nama');
}

export function confirmDeleteJabatan(idx) {
  confirmDialog({ judul: `Hapus jabatan ${session().w.jabatan[idx].nama}?`,
    isi: 'Data TKA dan dokumen yang sudah diisi untuk jabatan ini ikut ' +
      'terhapus.', ok: 'Hapus', action: 'rptka-jab-del-ok',
    data: { idx }, danger: true });
}
