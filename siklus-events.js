/**
 * @fileoverview Side effects of the RPTKA life-cycle routes (siklus.js):
 * audit log entries (SC-01) for back-office decisions and portal
 * notifications (SK-07) for the employer. Kept apart so siklus.js stays
 * within the 400-line limit. Actors are demo names (prototype only; the
 * backend takes the actor from the session, cf. AK-12).
 */

import { pushNotifikasi } from './notifikasi.js';
import { appendAudit } from './security.js';

const DIREKTUR = { pengguna: 'Direktur PPTKA', peran: 'Direktur PPTKA',
  ip: '10.12.2.5' };
const DIRJEN = { pengguna: 'Direktur Jenderal Binapenta dan PKK',
  peran: 'Direktur Jenderal', ip: '10.12.1.2' };

/**
 * Direktur proposed a pencabutan (status "Menunggu persetujuan Dirjen").
 * @param {!Object} store
 * @param {!Object} item Keputusan pencabutan row.
 */
export function onKeputusanCreated(store, item) {
  appendAudit(store, { ...DIREKTUR, aksi: 'Buat', modul: 'Back Office',
    objek: `Usulan pencabutan ${item.noUsulan} (${item.barcode})`,
    perubahan: [{ field: 'status', sebelum: null, sesudah: item.status }] });
}

/**
 * Dirjen decided on a pencabutan; the employer is told when it is revoked.
 * @param {!Object} store
 * @param {!Object} item Keputusan pencabutan row (after the decision).
 * @param {string} before Status before the decision.
 * @param {boolean} isApprove
 */
export function onKeputusanDecided(store, item, before, isApprove) {
  appendAudit(store, { ...DIRJEN,
    aksi: isApprove ? 'Setujui' : 'Kembalikan', modul: 'Back Office',
    objek: `Usulan pencabutan ${item.noUsulan} (${item.barcode})`,
    perubahan: [{ field: 'status', sebelum: before, sesudah: item.status }] });
  if (isApprove) {
    pushNotifikasi(store, item.role, {
      kategori: 'Pengesahan',
      judul: `Pengesahan RPTKA ${item.barcode} dicabut`,
      isi: `${item.nama} — ${item.dasar}. SK ${item.noSk}.`,
      tautan: { page: 'pencabutan' },
    });
  }
}

/**
 * Surat keterangan reached a final status (Terbit / Ditolak).
 * @param {!Object} store
 * @param {string} role
 * @param {!Object} item Surat keterangan row (after the transition).
 */
export function onSuratFinal(store, role, item) {
  const isIssued = item.status === 'Terbit';
  if (!isIssued && item.status !== 'Ditolak') {
    return;
  }
  pushNotifikasi(store, role, {
    kategori: 'Status permohonan',
    judul: `Surat keterangan ${item.noPermohonan} ` +
      (isIssued ? 'terbit' : 'ditolak'),
    isi: isIssued ? `${item.jenis} · nomor ${item.nomorSurat}.`
      : item.catatan ?? 'Permohonan ditolak.',
    tautan: { page: 'suratKeterangan', params: { id: item.id } },
  });
}

/**
 * Perpanjangan submitted: confirm receipt to the employer.
 * @param {!Object} store
 * @param {string} role
 * @param {!Object} item Perpanjangan row.
 */
export function onPerpanjanganCreated(store, role, item) {
  pushNotifikasi(store, role, {
    kategori: 'Status permohonan',
    judul: `Permohonan perpanjangan ${item.noPermohonan} diterima`,
    isi: `Diproses oleh ${item.diprosesOleh}.`,
    tautan: { page: 'perpanjangan' },
  });
}
