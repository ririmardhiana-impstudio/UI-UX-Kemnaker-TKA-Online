/**
 * @fileoverview Isi surat "Keputusan Pengesahan RPTKA" (Baru / Perpanjangan)
 * untuk pratinjau Cetak SK, mengikuti format uploads/Pengesahan RPTKA
 * Baru.pdf (contoh ekspor sungguhan dari sistem lama — field identitas TKA
 * yang dicetak persis 7: Nama, Tempat/Tanggal Lahir, Kewarganegaraan,
 * Alamat Tempat Tinggal, Nomor Paspor, Jabatan, Lokasi kerja — BUKAN
 * seluruh 15 kolom isian Form RPTKA di uploads/Pengesahan RPTKA.txt, yang
 * adalah daftar data yang WAJIB DIKUMPULKAN saat pengajuan, bukan daftar
 * yang dicetak di surat keputusan). Judul per jenis mengikuti
 * `jenisDef(p.jenis)` (11 jenis Form RPTKA).
 */

import { html } from '../../components/dom.js';
import { jenisDef } from '../../contracts/pengesahan-rptka.js';
import { tanggal } from './rptka-data.js';
import { state } from './state.js';
import {
  MENGINGAT, PAPER, TEMBUSAN, angka, daftar, judul, klausa, kodeQr, kop,
  tandaTangan,
} from './surat-resmi.js';

const PEJABAT = {
  baru: { jabatan: ['a.n. DIREKTUR JENDERAL',
    'PEMBINAAN PENEMPATAN TENAGA KERJA', 'DAN PERLUASAN KESEMPATAN KERJA',
    'DIREKTUR PENGENDALIAN PENGGUNAAN', 'TENAGA KERJA ASING'],
  nama: 'RENDRA SETIAWAN', nip: '19720120 199903 1 003' },
  perpanjangan: { jabatan: ['a.n. DIREKTUR JENDERAL',
    'Plh. DIREKTUR PENGENDALIAN PENGGUNAAN', 'TENAGA KERJA ASING', 'u.b',
    'KOORDINATOR BIDANG', 'UJI KELAYAKAN DAN PENGESAHAN RPTKA'],
  nama: 'DEVI ANGRAENI, S.SOS, MM.', nip: '19741221 199603 2 001' },
};

const baris = (label, nilai) => html`<dt>${label}</dt><dd>: ${nilai}</dd>`;

/** @param {!Object} p Pengesahan row (state.data.pengesahan). */
export function skPengBody(p) {
  const co = state.data.company;
  const { hpk, tka } = state.data;
  const h = hpk.find((x) => x.id === p.hpk);
  const t = tka.find((x) => x.paspor === p.paspor);
  const perpanjangan = /Perpanjangan/.test(`${p.jenis} ${p.layanan ?? ''}`);
  // TTE Direktur (jalankanTte, p.pengesahan) punya
  // nomor/QR/penandatangan sendiri — harus SAMA dengan yang dilihat akun
  // Direktur, bukan nomor/pejabat statis lama (hanya dipakai baris lama
  // yang tidak lewat alur ini, mis. data seed/demo).
  const pengesahan = p.pengesahan;
  const pejabat = pengesahan
    ? { jabatan: PEJABAT.baru.jabatan, nama: pengesahan.tte.oleh,
      nip: pengesahan.tte.barcode }
    : PEJABAT[perpanjangan ? 'perpanjangan' : 'baru'];
  const kode = pengesahan?.qr ?? p.barcode ?? '—';
  const nomor = pengesahan?.nomor ?? `B.3/${p.barcode ?? '—'}/PK.04.01/IX/2026`;
  // Jenis Form RPTKA (11 jenis, lihat uploads/Pengesahan RPTKA.txt) punya
  // nama resmi sendiri; baris seed/demo lama (jenis 'Baru'/'Pemegang Izin
  // Tinggal'/dsb., tanpa padanan di RPTKA_JENIS_DEFS) tetap pakai dugaan
  // dari layanan HPK seperti sebelumnya.
  const def = jenisDef(p.jenis);
  const jenis = perpanjangan ? 'PERPANJANGAN'
    : def ? p.jenis.toUpperCase()
      : (h?.layanan ?? 'Pekerjaan Lebih dari 6 bulan').toUpperCase();
  const id = p.identitas;
  const berlaku = perpanjangan && t ? `${t.mulai} s.d ${t.akhir}`
    : `${angka(p.bulan)} bulan sejak tanggal tanda masuk.`;
  return html`${kop()}
    <p class="inline-block border border-base-content px-2 py-0.5 text-xs
      font-bold">${perpanjangan ? 'PERPANJANGAN I' : 'BARU'}</p>
    ${judul(nomor, html`PENGESAHAN RENCANA
      PENGGUNAAN TENAGA KERJA ASING<br>${jenis}<br>PADA ${co.nama}`)}
    ${klausa('Menimbang', daftar([
      `bahwa berdasarkan Hasil Penilaian Kelayakan Pengesahan RPTKA Nomor ` +
        `${h?.barcode ?? '—'} tanggal ${h?.terbit ?? '—'};`,
      `bahwa berdasarkan surat permohonan Pemberi Kerja TKA Nomor ` +
        `${h?.noPermohonan ?? '—'} tanggal ${h?.tgl ?? '—'};`,
      'bahwa berdasarkan hasil verifikasi data calon TKA, Pemberi Kerja ' +
        'TKA dinyatakan memenuhi persyaratan untuk mempekerjakan TKA;',
      'bahwa berdasarkan pertimbangan sebagaimana dimaksud pada huruf a, ' +
        'huruf b dan huruf c, perlu ditetapkan Pengesahan RPTKA dengan ' +
        'keputusan Direktur Jenderal Pembinaan Penempatan Tenaga Kerja ' +
        'dan Perluasan Kesempatan Kerja.']))}
    ${klausa('Mengingat', daftar(MENGINGAT, 'decimal'))}
    <p class="my-3 text-center">MEMUTUSKAN</p>
    ${klausa('Menetapkan', 'KEPUTUSAN DIREKTUR JENDERAL PEMBINAAN ' +
      'PENEMPATAN TENAGA KERJA DAN PERLUASAN KESEMPATAN KERJA TENTANG ' +
      'PENGESAHAN RENCANA PENGGUNAAN TENAGA KERJA ASING.')}
    ${klausa('PERTAMA', html`Memberikan persetujuan kepada:
      <dl class="mt-1 grid grid-cols-[170px_1fr]">
        ${baris('Nama Pemberi Kerja TKA', co.nama)}
        ${baris('Alamat', `${co.jalan}, ${co.kab}, ${co.prov}`)}
        ${baris('Jenis Usaha', co.kategori)}</dl>
      <p class="my-2">untuk MEMPEKERJAKAN</p>
      <dl class="grid grid-cols-[170px_1fr]">
        ${baris('Nama TKA', html`<b>${p.nama.toUpperCase()}</b>`)}
        ${baris('Tempat/Tanggal Lahir', id
    ? `${id.tempatLahir}, ${tanggal(id.tanggalLahir)}` : '—')}
        ${baris('Kewarganegaraan', p.negara)}
        ${baris('Alamat Tempat Tinggal', id
    ? `${id.alamatTinggal}, ${id.kodePos}` : '—')}
        ${baris('Nomor Paspor', p.paspor)}
        ${baris('Jabatan', p.jabatan)}
        ${baris('Lokasi kerja', id?.lokasiKerja ?? `${co.kab}, ${co.prov}`)}
      </dl>`)}
    ${klausa('KEDUA', `Berlaku : ${berlaku}`)}
    ${klausa('KETIGA', 'Pengesahan RPTKA ini merupakan satu kesatuan dan ' +
      'bagian yang tidak terpisahkan dari Hasil Penilaian Kelayakan RPTKA ' +
      `Nomor ${h?.barcode ?? '—'} tanggal ${h?.terbit ?? '—'}.`)}
    ${klausa('KEEMPAT', 'Keputusan ini mulai berlaku sejak tanggal ' +
      'ditetapkan.')}
    <div class="mt-6 flex flex-wrap items-start justify-between gap-4">
      ${perpanjangan ? '' : html`<div class="grid h-28 w-20 place-items-center
        border border-dashed border-base-content/40 text-center text-[11px]
        text-base-content/60">Pas foto TKA</div>`}
      ${tandaTangan({ tempat: 'Jakarta', tanggal: p.tgl, ...pejabat })}</div>
    <div class="mt-4 flex flex-wrap items-end justify-between gap-4 text-xs">
      <div><p>Tembusan:</p>${daftar(TEMBUSAN, 'decimal')}</div>
      ${kodeQr(kode, `QR code SK Pengesahan ${kode}`)}</div>`;
}
