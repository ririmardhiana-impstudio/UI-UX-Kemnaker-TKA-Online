/**
 * @fileoverview Pemetaan path error validator Form RPTKA (mis.
 * `tka.0.data.nama`) ke slot error di DOM + penerapannya ke panel aktif.
 */

import { qs } from '../../components/dom.js';
import { jenisDef } from '../../contracts/pengesahan-rptka.js';
import { docId } from './rptka-docs-view.js';
import { showErrors } from './ui.js';

/**
 * DOM id (of the field whose "-error" slot shows) for a validator path.
 * `hpkId` maps to the "Nomor RPTKA" picker for Perpanjangan (revisi akun
 * pemberi kerja, poin 5) — Nomor HPK sendiri sudah tidak ditampilkan
 * untuk jenis itu.
 */
export function errorId(S, path) {
  const [head, a, b, c] = path.split('.');
  const perpanjangan = jenisDef(S.w.jenis)?.menu === 'perpanjangan';
  const byHead = {
    jenis: 'rp-jenis', kegiatan: 'rp-kegiatan',
    hpkId: perpanjangan ? 'rp-rptka-asal' : 'rp-hpk', jabatan: 'rp-jabatan',
    tka: a === undefined ? 'rp-jabatan'
      : b === 'data' ? `rp-f-${a}-${c}` : docId(`t${a}`, c),
  };
  if (head === 'dokumenPermohonan') {
    return docId('p', a);
  }
  if (head === 'dokumenJabatan') {
    const nama = path.slice(head.length + 1, path.lastIndexOf('.'));
    return docId(`j${S.w.jabatan.findIndex((j) => j.nama === nama)}`,
      path.slice(path.lastIndexOf('.') + 1));
  }
  return byHead[head];
}

export function applyErrors(S) {
  const panel = qs('#rptka-dyn');
  if (!panel) {
    return;
  }
  const mapped = {};
  for (const [path, message] of Object.entries(S.errors)) {
    const id = errorId(S, path);
    if (id && qs(`#${id}-error`, panel)) {
      mapped[id] = message;
    }
  }
  if (Object.keys(mapped).length) {
    showErrors(panel, mapped);
  }
}
