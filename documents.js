/**
 * @fileoverview Printable document previews (legacy modals): Surat
 * Pemberitahuan Pembayaran DKPTKA, Hasil Penilaian Kelayakan, SK
 * Pengesahan RPTKA, SK Perubahan.
 */

import { html, qs } from '../../components/dom.js';
import { LOGO_SRC } from '../../components/brand.js';
import { rupiah } from './format.js';
import { skPengBody } from './sk-pengesahan-doc.js';
import { state } from './state.js';
import { PAPER as PAPER_RESMI } from './surat-resmi.js';
import { cetakAttrs } from './cetak.js';
import { BTN, BTN_OUTLINE, dialogClose, openDialog } from './ui.js';

const MODAL = 'portal-modal';
const LOGO_ALT = 'Logo Kementerian Ketenagakerjaan';
const PAPER = 'px-6 py-8 text-[13px] leading-relaxed text-base-content/80 ' +
  'md:px-10';
const SIGNATORY = html`a.n. Direktur Jenderal<br>Direktur Pengendalian
  Penggunaan TKA`;
/** Pseudo QR/stamp (stripes drawn with theme colors, no hex). */
const STAMP_V = 'bg-[repeating-linear-gradient(90deg,var(--color-base-content)_0_4px,var(--color-base-100)_4px_7px)]';
const STAMP_H = 'bg-[repeating-linear-gradient(0deg,var(--color-base-content)_0_4px,var(--color-base-100)_4px_7px)]';
const STAMP_S = 'bg-[repeating-linear-gradient(90deg,var(--color-base-content)_0_3px,var(--color-base-100)_3px_6px)]';

function header(title, buttons) {
  return html`<div class="flex flex-wrap items-center justify-between gap-2
      border-b border-base-300 px-6 py-4.5 print:hidden"><h2 class="font-bold">${title}
    </h2><div class="flex items-center gap-2">${buttons}${dialogClose()}
    </div></div>`;
}

function printBtn(label, primary = false) {
  return html`<button type="button" class="${primary ? BTN : BTN_OUTLINE}
    btn-sm" ${cetakAttrs()}>${label}</button>`;
}

function centeredLogo(lines) {
  return html`<div class="mb-4.5 text-center"><img src="${LOGO_SRC}"
      alt="${LOGO_ALT}" class="mx-auto h-12.5 w-13 object-contain">
    <p class="mt-2 font-extrabold">${lines}</p></div>`;
}

function billingDoc(b) {
  const co = state.data.company;
  const paid = b.status === 'Lunas';
  return html`${header('Surat Pemberitahuan Pembayaran DKPTKA',
    printBtn('Cetak'))}
  <div class="${PAPER}">
    <div class="mb-4.5 flex items-center gap-3.5 border-b-[3px] border-double
        border-base-content pb-4"><img src="${LOGO_SRC}" alt="${LOGO_ALT}"
        class="h-12 w-12 object-contain">
      <div><b class="block text-sm">KEMENTERIAN KETENAGAKERJAAN REPUBLIK
        INDONESIA</b><span class="text-xs">Direktorat Jenderal Binapentasker
        dan PKK · Direktorat Pengendalian Penggunaan TKA</span></div></div>
    <dl class="mb-3.5 grid grid-cols-[130px_1fr] gap-x-2.5 gap-y-0.5">
      <dt>Kepada</dt><dd class="font-bold">${co.nama}</dd><dt>Perihal</dt>
      <dd>Pembayaran Dana Kompensasi Penggunaan TKA (${b.jenis})</dd></dl>
    <p class="mb-3">Sehubungan dengan permohonan Pengesahan RPTKA yang telah
      disetujui, Saudara diminta membayar DKPTKA dengan rincian:</p>
    <div class="mb-3.5 overflow-x-auto rounded-field border
        border-base-content/20"><table class="table table-sm min-w-[560px]">
      <thead><tr class="bg-base-200 text-xs font-bold text-base-content">
        <th>Nama TKA</th><th>Paspor</th><th>Jabatan</th><th>Jangka</th>
        <th class="text-right">Jumlah</th></tr></thead>
      <tbody><tr><td class="font-bold">${b.tka}</td><td>${b.paspor}</td>
        <td>${b.jabatan}</td><td>${b.bulan} bulan</td>
        <td class="text-right font-bold">${rupiah(b.rupiah)}</td></tr></tbody>
    </table></div>
    <div class="mb-3.5 grid gap-2.5 md:grid-cols-2">
      <div class="rounded-field bg-primary p-3.5 text-primary-content">
        <p class="text-[11px] font-bold text-info-bright">KODE BILLING</p>
        <p class="font-mono text-xl font-extrabold tracking-wider">${b.kode}
        </p></div>
      <div class="rounded-field border border-base-300 bg-base-200/50 p-3.5">
        <p class="text-[11px] font-bold text-base-content/60">BATAS
          PEMBAYARAN</p>
        <p class="text-lg font-extrabold text-base-content">${b.batas}</p>
        <p class="text-[11px] text-base-content/60">5 hari kerja sejak
          ${b.terbit}</p></div></div>
    ${paid ? html`<p class="mb-3 rounded-field bg-success/10 px-3.5 py-3
      font-bold text-success">LUNAS · ${b.bayar} · ${b.bank}</p>` : ''}
    <p class="mb-4.5">Pembayaran melalui bank persepsi (BNI, Mandiri, BRI)
      dengan menunjukkan kode billing. Apabila data TKA tidak sesuai, lakukan
      koreksi melalui TKA Hotline sebelum membayar.</p>
    <div class="flex justify-end"><div class="text-center text-xs">
      ${SIGNATORY}<div class="mx-auto my-2.5 size-18 border-4
        border-base-100 opacity-85 outline outline-base-content ${STAMP_S}"
        aria-hidden="true"></div>Ditandatangani secara elektronik</div></div>
  </div>`;
}

function hpkDoc(h) {
  const co = state.data.company;
  return html`${header(`Hasil Penilaian Kelayakan · ${h.barcode}`,
    html`${printBtn('Cetak Berita Acara')}${printBtn('Cetak HPK', true)}`)}
  <div class="${PAPER}">
    ${centeredLogo('HASIL PENILAIAN KELAYAKAN PENGGUNAAN TENAGA KERJA ASING')}
    <p class="-mt-4 mb-4.5 text-center">Nomor:
      B.3/${h.barcode}/PK.04.00/VIII/2026</p>
    <dl class="mb-3.5 grid grid-cols-[160px_1fr] gap-x-2.5 gap-y-0.5">
      <dt>Pemberi kerja</dt><dd class="font-bold">${co.nama}</dd>
      <dt>Jenis</dt><dd>${h.layanan}</dd><dt>Lokasi kerja</dt>
      <dd>${h.lokasi}</dd><dt>Tanggal terbit</dt><dd>${h.terbit}</dd></dl>
    <div class="mb-3.5 overflow-hidden rounded-field border
        border-base-content/20"><table class="table table-sm">
      <thead><tr class="bg-base-200 text-xs font-bold text-base-content">
        <th>Jabatan</th><th class="w-[100px]">Jumlah</th>
        <th class="w-[110px]">Jangka waktu</th></tr></thead>
      <tbody>${h.jabatan.map((j) => html`<tr><td>${j.nama}</td>
        <td>${j.kuota} orang</td><td>${j.bulan} bulan</td></tr>`)}</tbody>
    </table></div>
    <p>Pemberi kerja wajib menyampaikan laporan penggunaan TKA setiap 1 (satu)
      tahun. HPK ini menjadi dasar pengajuan Pengesahan RPTKA per TKA.</p>
  </div>`;
}

function signature(stampClass) {
  return html`<div class="flex items-end justify-between">
    <div class="size-21 border-[5px] border-base-100 outline
      outline-base-content ${stampClass}" aria-hidden="true"></div>
    <div class="text-center text-xs">${SIGNATORY}<br><br>Ditandatangani
      secara elektronik</div></div>`;
}

function skPengDoc(p) {
  const kode = p.pengesahan?.nomor ?? p.barcode ?? '—';
  return html`${header(`SK Pengesahan RPTKA · ${kode}`,
    printBtn('Cetak', true))}
  <div class="${PAPER_RESMI} px-6 py-8 md:px-10">${skPengBody(p)}</div>`;
}

/**
 * Pratinjau ringkasan data terstruktur (revisi akun pemberi kerja, poin 6)
 * untuk Perpanjangan/Perubahan/Pencabutan RPTKA — BELUM ada contoh dokumen
 * resmi (PDF asli) untuk ketiganya seperti `Pengesahan RPTKA Baru.pdf`,
 * jadi "Preview Dokumen" di sini menampilkan ringkasan field yang sudah
 * diisi, ditandai jelas BUKAN dokumen sah, bukan mengarang format surat
 * resmi yang mungkin salah. Bisa disempurnakan jadi surat resmi
 * sungguhan nanti kalau ada contoh PDF asli (pola `skPengDoc` di atas).
 * @param {string} title
 * @param {!Array<[string, *]>} rows pasangan [label, nilai]
 */
export function openRingkasanDoc(title, rows) {
  openDialog(MODAL, html`${header(`Pratinjau Data · ${title}`, '')}
    <div class="${PAPER}">
      <p class="mb-4.5 rounded-field border border-warning/30 bg-warning/10
        px-3.5 py-3 text-[13px] font-semibold text-base-content/80">Ini
        ringkasan data isian, BUKAN dokumen resmi/Surat Keputusan — belum
        ada contoh format surat resmi untuk alur ini di prototipe.</p>
      <dl class="grid gap-x-5 gap-y-2 text-sm md:grid-cols-2">
        ${rows.map(([label, value]) => html`<div><dt
          class="text-base-content/60">${label}</dt>
          <dd class="font-bold">${value ?? '—'}</dd></div>`)}
      </dl>
    </div>`, 'max-w-2xl');
}

function skChgDoc(c) {
  const co = state.data.company;
  return html`${header(`SK Perubahan · ${c.sk ?? '—'}`,
    printBtn('Cetak', true))}
  <div class="${PAPER}">
    ${centeredLogo(html`KEPUTUSAN DIREKTUR JENDERAL BINAPENTASKER DAN PKK<br>
      TENTANG PERUBAHAN PENGESAHAN RENCANA PENGGUNAAN TENAGA KERJA ASING`)}
    <p class="-mt-4 mb-4.5 text-center">Nomor: ${c.sk} · ${c.skTerbit}</p>
    <p class="mb-3">Mengubah Keputusan Nomor ${c.skNo} tanggal ${c.skTgl} atas
      nama TKA <b>${c.nama}</b> (${c.paspor}), pada bagian <b>${c.jenis}</b>:
    </p>
    <div class="mb-4 grid gap-2.5 md:grid-cols-2">
      <div class="rounded-field border border-base-content/20 p-3"><b
        class="block text-[11px] text-base-content/60">SEMULA TERTULIS</b>
        ${c.semula}</div>
      <div class="rounded-field border border-base-content p-3"><b
        class="block text-[11px]">MENJADI</b>${c.menjadi}</div></div>
    ${signature(STAMP_V)}
    <p class="mt-4 text-[11px] text-base-content/70">Tembusan: Direktur
      Jenderal Imigrasi; Kepala Dinas Ketenagakerjaan ${co.prov}.</p></div>`;
}

const PRINT_DELAY_MS = 150;

function printOpenDialog() {
  qs('#portal-modal [data-action="cetak-surat"]')?.click();
}

export const actions = {
  'open-billing'(el) {
    const bill = state.data.billing.find((b) => b.id === el.dataset.id);
    if (bill) {
      openDialog(MODAL, billingDoc(bill), 'max-w-3xl');
    }
  },
  'open-doc'(el) {
    const { doc, id } = el.dataset;
    const sources = {
      hpkDoc: [state.data.hpk, hpkDoc],
      skPeng: [state.data.pengesahan, skPengDoc],
      skChg: [state.data.perubahan, skChgDoc],
    };
    const [list, renderDoc] = sources[doc] ?? [[], null];
    const item = list.find((x) => x.id === id);
    if (item && renderDoc) {
      openDialog(MODAL, renderDoc(item), 'max-w-3xl');
    }
  },
  /** "Unduh": buka dokumennya lalu langsung dialog cetak / Simpan PDF. */
  'unduh-billing'(el) {
    actions['open-billing'](el);
    setTimeout(printOpenDialog, PRINT_DELAY_MS);
  },
  'unduh-doc'(el) {
    actions['open-doc'](el);
    setTimeout(printOpenDialog, PRINT_DELAY_MS);
  },
};
