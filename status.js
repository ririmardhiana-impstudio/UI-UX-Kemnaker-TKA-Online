/**
 * @fileoverview Status pendaftaran ("Pendaftaran terkirim") screen: tracker
 * 3 tahap (terkirim / menunggu verifikasi petugas / akun aktif) dan loop-
 * back "Perlu perbaikan" (AK-15) — pemohon mengunggah ulang dokumen lewat
 * langkah Dokumen wizard yang sama (lihat register.js `enterFixMode`),
 * dikirim via POST /pendaftar/{npwp}/resubmit.
 *
 * Demo [I] (bukan business rule — lihat devlog, JANGAN dibakukan ke
 * business-rules.md/BE): klik manual "Cek status terbaru" saat status
 * masih "Menunggu verifikasi" langsung memanggil POST
 * /pendaftar/{npwp}/activate, supaya alur aktivasi (+ contoh email di
 * `#activation-email-modal`) bisa diperagakan tanpa perlu ke
 * back-office.html. Di produksi, aktivasi tetap aksi Verifikator.
 */

import { activatePendaftar, listPendaftar } from '../../api/pendaftar.js';
import { qs, setVisible } from '../../components/dom.js';
import { showToast } from '../../components/form-ui.js';

const STATUS = {
  WAITING: 'Menunggu verifikasi', FIX: 'Perlu perbaikan', ACTIVE: 'Aktif',
};

/**
 * @param {{onFixDocuments: function(string)}} deps onFixDocuments(npwp)
 *     opens the wizard at the Dokumen step in "perbaiki" mode.
 * @return {{enter: function(?{npwp: string, nama: string, sentAt: string})}}
 */
export function initStatusScreen({ onFixDocuments }) {
  const refreshButton = qs('#done-refresh');
  const fixButton = qs('#done-fix-upload');
  const viewEmailButton = qs('#done-view-email');
  const emailModal = qs('#activation-email-modal');
  /** @type {?{npwp: string, nama: string, sentAt: string}} */
  let current = null;
  /** Status pada pengecekan terakhir, untuk deteksi transisi (beri aksi
   * tegas saat klik "Cek status terbaru" ternyata sudah diputuskan
   * Verifikator — bukan cuma repaint kartu tahap senyap). */
  let lastStatus = null;

  refreshButton.addEventListener('click', () => refresh({ silent: false }));
  fixButton.addEventListener('click', () => {
    if (current) {
      onFixDocuments(current.npwp);
    }
  });
  viewEmailButton.addEventListener('click', () => {
    if (!current) {
      return;
    }
    qs('#activation-email-to').textContent = current.email ?? '—';
    qs('#activation-email-perusahaan').textContent = current.nama;
    emailModal.showModal();
  });
  qs('#activation-email-close').addEventListener('click', () =>
    emailModal.close());

  return {
    enter(registration) {
      if (registration) {
        current = registration;
        lastStatus = null;
        qs('#done-nama').textContent = registration.nama;
        qs('#done-sent-at').textContent = registration.sentAt;
        qs('#done-npwp').textContent = registration.npwp;
      }
      refresh({ silent: true });
    },
  };

  async function refresh({ silent }) {
    if (!current) {
      return;
    }
    refreshButton.disabled = true;
    refreshButton.setAttribute('aria-busy', 'true');
    try {
      const rows = await listPendaftar();
      let row = rows.find((p) => digits(p.npwp) === digits(current.npwp));
      if (row && !silent && row.status === STATUS.WAITING) {
        row = await activatePendaftar(current.npwp);
      }
      if (row) {
        notifyIfChanged(row, silent);
        lastStatus = row.status;
        paint(row);
      }
    } catch (error) {
      if (!silent) {
        showToast('Status terbaru gagal dimuat. Coba lagi.', 'error');
      }
    } finally {
      refreshButton.disabled = false;
      refreshButton.setAttribute('aria-busy', 'false');
    }
  }

  function notifyIfChanged(row, silent) {
    if (silent || lastStatus === null || lastStatus === row.status) {
      return;
    }
    if (row.status === STATUS.ACTIVE) {
      showToast('Pendaftaran diterima oleh Verifikator — akun aktif.',
          'success');
    } else if (row.status === STATUS.FIX) {
      showToast('Verifikator meminta perbaikan dokumen.', 'warning');
    }
  }

  function paint(row) {
    const isActive = row.status === STATUS.ACTIVE;
    const isFix = row.status === STATUS.FIX;
    const emailText = current?.email ? ` (${current.email})` : '';
    // "verifikasi": done once Verifikator approves (-> Aktif); otherwise
    // it is the current step, whether waiting or sent back for perbaikan.
    paintTrack('verifikasi', {
      done: isActive, current: !isActive,
      label: isActive ? 'Diverifikasi petugas PPTKA'
        : isFix ? 'Verifikator meminta perbaikan dokumen'
          : 'Menunggu verifikasi petugas PPTKA',
    });
    paintTrack('aktif', {
      done: isActive, current: false,
      label: isActive
        ? `Akun aktif — operator${emailText} mendapat akses TKA Online`
        : `Akun aktif — operator${emailText} mendapat akses TKA Online`,
    });
    setVisible(qs('#done-fix'), isFix);
    if (isFix) {
      qs('#done-fix-catatan').textContent =
        row.catatan ?? 'Lengkapi dan unggah ulang dokumen yang diminta.';
    }
    setVisible(qs('#done-active-cta'), isActive);
    setVisible(viewEmailButton, isActive);
    refreshButton.textContent = isActive ? 'Cek ulang' : 'Cek status terbaru';
  }

  function paintTrack(key, { done, current: isCurrent, label }) {
    const item = qs(`[data-track="${key}"]`);
    const mark = qs('[data-role="mark"]', item);
    qs('[data-role="label"]', item).textContent = label;
    item.classList.toggle('text-base-content/60', !done && !isCurrent);
    mark.textContent = done ? '✓' : isCurrent ? '●' : '○';
    mark.classList.toggle('text-success', done);
    mark.classList.toggle('text-secondary', isCurrent);
    item.toggleAttribute('aria-current', isCurrent);
  }
}

function digits(value) {
  return String(value ?? '').replace(/\D/g, '');
}
