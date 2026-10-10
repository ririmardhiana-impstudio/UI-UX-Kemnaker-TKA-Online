/**
 * @fileoverview Building blocks of the official Keputusan Dirjen letters
 * (Hasil Penilaian Kelayakan, Pengesahan RPTKA Baru / Perpanjangan): kop
 * surat, klausa "Menimbang/Mengingat/...", terbilang and the signature
 * block. Format follows uploads/HASIL PENILAIAN KELAYAKAN.pdf,
 * Pengesahan RPTKA Baru.pdf and Pengesahan RPTKA Perpanjangan.pdf.
 */

import { LOGO_SRC } from '../../components/brand.js';
import { html } from '../../components/dom.js';
import { qrCode } from '../../components/qr-code.js';

/** Paper typography shared by every letter. */
export const PAPER = 'font-serif text-[12.5px] leading-relaxed ' +
  'text-base-content';
/** Pseudo stamp drawn with theme colors (no hex). */
const STAMP = 'bg-[repeating-linear-gradient(90deg,var(--color-base-content)_0_3px,var(--color-base-100)_3px_6px)]';
const SATUAN = ['nol', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam',
  'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];

export const MENGINGAT = [
  'Undang-Undang Nomor 6 Tahun 2023 tentang Penetapan Peraturan ' +
    'Pemerintah Pengganti Undang-Undang Nomor 2 Tahun 2022 tentang Cipta ' +
    'Kerja menjadi Undang-Undang;',
  'Peraturan Pemerintah Nomor 34 Tahun 2021 tentang Penggunaan Tenaga ' +
    'Kerja Asing (Lembaran Negara Republik Indonesia Tahun 2021 Nomor 44, ' +
    'Tambahan Lembaran Negara Republik Indonesia Tahun 2021 Nomor 6646);',
  'Peraturan Menteri Ketenagakerjaan Nomor 8 Tahun 2021 tentang ' +
    'Peraturan Pelaksanaan Peraturan Pemerintah Nomor 34 Tahun 2021 ' +
    'tentang Penggunaan Tenaga Kerja Asing (Berita Negara Republik ' +
    'Indonesia Tahun 2021 Nomor 301).',
];

export const DIRJEN = 'DIREKTUR JENDERAL PEMBINAAN PENEMPATAN TENAGA KERJA ' +
  'DAN PERLUASAN KESEMPATAN KERJA';

/** @param {number} n 0-99 @return {string} "satu", "dua belas", ... */
export function terbilang(n) {
  if (n < 12) {
    return SATUAN[n];
  }
  if (n < 20) {
    return `${SATUAN[n - 10]} belas`;
  }
  if (n < 100) {
    const unit = n % 10;
    return `${SATUAN[Math.floor(n / 10)]} puluh${unit ? ` ${SATUAN[unit]}` : ''}`;
  }
  return String(n);
}

/** "12 (dua belas)". */
export const angka = (n) => `${n} (${terbilang(n)})`;

/** Kop surat: logo + instansi. */
export function kop() {
  return html`<div class="mb-5 flex items-center gap-3 border-b-2
      border-primary pb-3"><img src="${LOGO_SRC}"
      alt="Logo Kementerian Ketenagakerjaan"
      class="h-14 w-14 object-contain"><div>
    <p class="text-sm">KEMENTERIAN KETENAGAKERJAAN REPUBLIK INDONESIA</p>
    <p class="text-[13px] font-bold leading-snug text-primary">DIREKTORAT
      JENDERAL PEMBINAAN PENEMPATAN TENAGA KERJA<br>DAN PERLUASAN
      KESEMPATAN KERJA</p></div></div>`;
}

/** Centered "KEPUTUSAN ... NOMOR ... TENTANG ..." title. */
export function judul(nomor, tentang) {
  return html`<div class="my-4 text-center font-bold uppercase">
    <p>KEPUTUSAN DIREKTUR JENDERAL<br>PEMBINAAN PENEMPATAN TENAGA KERJA DAN
      PERLUASAN KESEMPATAN KERJA<br>NOMOR ${nomor}</p><p>TENTANG</p>
    <p>${tentang}</p></div>`;
}

/** "Label : isi" clause row. */
export function klausa(label, isi) {
  return html`<div class="grid grid-cols-[84px_14px_1fr] gap-y-1 py-1">
    <span>${label}</span><span>:</span><div>${isi}</div></div>`;
}

/** Lettered list (a., b., ...) or numbered list. */
export function daftar(items, type = 'lower-alpha') {
  return html`<ol class="grid gap-0.5 ps-5 ${type === 'decimal'
    ? 'list-decimal' : 'list-[lower-alpha]'}">${items.map((i) =>
    html`<li>${i}</li>`)}</ol>`;
}

/**
 * Signature block: tempat/tanggal, jabatan, segel, nama + NIP.
 * @param {{tempat: string, tanggal: string, jabatan: !Array<string>,
 *     nama: string, nip: string}} options
 */
export function tandaTangan({ tempat, tanggal, jabatan, nama, nip }) {
  return html`<div class="ms-auto grid w-fit justify-items-center text-center">
    <p class="justify-self-start">Ditetapkan di ${tempat}<br>pada tanggal
      ${tanggal}</p>
    <p class="mt-2">${jabatan.map((j) => html`${j}<br>`)}</p>
    <div class="my-2 size-16 border-4 border-base-100 opacity-85 outline
      outline-base-content ${STAMP}" aria-hidden="true"></div>
    <p class="font-bold underline">${nama}</p><p>NIP. ${nip}</p></div>`;
}

/** QR + code caption, e.g. "*17777286*". */
export function kodeQr(value, label) {
  return html`<figure class="grid w-fit justify-items-center gap-0.5">
    ${qrCode({ value, label, size: 'size-20' })}
    <figcaption class="text-[11px]">*${value}*</figcaption></figure>`;
}

export const TEMBUSAN = ['Menteri Ketenagakerjaan;',
  'Dirjen Binwasnaker dan K3;',
  'Dinas Ketenagakerjaan Provinsi/Kab/Kota setempat.'];
