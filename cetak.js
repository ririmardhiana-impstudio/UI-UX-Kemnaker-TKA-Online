/**
 * @fileoverview Cetak / simpan PDF untuk dokumen di dialog portal (surat
 * HPK, SK Pengesahan, SK Perubahan, surat pembayaran): memakai dialog cetak
 * browser ("Simpan sebagai PDF"). CSS cetak (css/base.css, kelas
 * `print-surat`) menyembunyikan seluruh halaman kecuali dialog; judul tab
 * sementara diganti agar nama berkas PDF bermakna.
 */

import { html, qs } from '../../components/dom.js';

/**
 * Attributes of a print button.
 * @param {string=} judul Nama berkas; default = judul dialog.
 */
export function cetakAttrs(judul = '') {
  return html`data-action="cetak-surat" data-judul="${judul}"`;
}

/** @param {string} judul */
function printDialog(judul) {
  const root = document.documentElement;
  const previous = document.title;
  const restore = () => {
    root.classList.remove('print-surat');
    document.title = previous;
    window.removeEventListener('afterprint', restore);
  };
  root.classList.add('print-surat');
  document.title = judul;
  window.addEventListener('afterprint', restore);
  window.print();
}

export const actions = {
  'cetak-surat'(el) {
    const judul = el.dataset.judul ||
      qs('#portal-modal h2')?.textContent.trim() || 'Dokumen TKA Online';
    printDialog(judul.replace(/[\\/:*?"<>|]+/g, '-'));
  },
};
