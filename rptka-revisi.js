/**
 * @fileoverview Revisi pengajuan Form RPTKA yang dikembalikan Verifikator
 * atau Validator (flow "Permohonan Perpanjangan Pengesahan RPTKA"): banner
 * catatan pemeriksa dan aksi "Kirim ulang" (POST /pengesahan-rptka/{id}/
 * resubmit) — kembali ke tahap pemeriksa yang mengembalikan (RP-17).
 */

import { ApiError } from '../../api/http.js';
import { resubmitRptka, updateRptka } from '../../api/pengesahan-rptka.js';
import { html } from '../../components/dom.js';
import { validateRptkaSubmit } from '../../contracts/pengesahan-rptka.js';
import { reloadCollection } from './data.js';
import { confirmDialog } from './rptka-confirm.js';
import { MODAL, invalidate, listTarget, payload } from './rptka-data.js';
import { go, state } from './state.js';
import { CALLOUT_WARN, closeDialog, toast } from './ui.js';

const TAHAP = { verifikasi: 'Verifikator', billing: 'Validator' };

/** Banner catatan pemeriksa (kosong bila pengajuan tidak dikembalikan). */
export function revisiBanner(S) {
  if (!S.w.perluRevisi) {
    return '';
  }
  return html`<div role="alert" class="${CALLOUT_WARN} grid gap-1"
      data-testid="rptka-revisi">
    <p class="font-bold">Dikembalikan ${TAHAP[S.w.perluRevisi]} — revisi
      dokumen permohonan</p>
    <p class="text-[13px]">${S.w.catatanRevisi || 'Periksa dokumen dan ' +
      'Data TKA, lalu kirim ulang.'}</p>
    <p class="text-xs text-base-content/70">Dokumen dan Data TKA dapat
      diperbaiki; jenis, kegiatan, HPK, dan jabatan terkunci. Setelah dikirim
      ulang, pengajuan kembali ke ${TAHAP[S.w.perluRevisi]}.</p></div>`;
}

/**
 * Aksi halaman: validasi lengkap lalu konfirmasi; kirim ulang.
 * @param {{session: function(): !Object, paint: function(), showError:
 *     function(string)}} ctx
 */
export function revisiActions({ session, paint, showError }) {
  return {
    'rptka-resubmit'() {
      const S = session();
      const { errors } = validateRptkaSubmit(payload(S.w), null);
      S.errors = errors;
      if (Object.keys(errors).length) {
        paint();
        toast('Pengajuan belum lengkap. Lengkapi bagian yang ditandai.',
          'warning');
        return;
      }
      confirmDialog({ judul: `Kirim ulang ke ${TAHAP[S.w.perluRevisi]}?`,
        isi: 'Dokumen dan Data TKA hasil revisi dikirim kembali untuk ' +
          'diperiksa.', ok: 'Ya, Kirim Ulang',
        action: 'rptka-resubmit-ok', testid: 'rptka-btn-resubmit-ok' });
    },
    async 'rptka-resubmit-ok'(button) {
      const S = session();
      button.disabled = true;
      try {
        await updateRptka(state.role, S.w.id, payload(S.w));
        const done = await resubmitRptka(state.role, S.w.id);
        closeDialog(MODAL);
        invalidate();
        await reloadCollection('pengesahan');
        toast(`Form RPTKA ${done.noAjuan} dikirim ulang.`);
        go(...listTarget(S.w.jenis));
      } catch (error) {
        button.disabled = false;
        closeDialog(MODAL);
        S.errors = error instanceof ApiError ? error.fields : {};
        paint();
        showError(`Gagal mengirim ulang: ${error.message}. Coba lagi.`);
      }
    },
  };
}
