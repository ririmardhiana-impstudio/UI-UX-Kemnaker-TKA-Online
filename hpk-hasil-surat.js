/**
 * @fileoverview Pratinjau Surat Hasil Penilaian Kelayakan (HPK Terbit):
 * Keputusan Dirjen + Lampiran, mengikuti format uploads/HASIL PENILAIAN
 * KELAYAKAN.pdf. Data dari detail pengajuan (isian, surat, BAP).
 */

import { html, raw } from '../../components/dom.js';
import { PK_STATUS } from '../../contracts/penilaian-kelayakan.js';
import { tanggal } from './hpk-hasil-data.js';
import { state } from './state.js';
import {
  DIRJEN, MENGINGAT, PAPER, TEMBUSAN, angka, daftar, judul, klausa, kodeQr,
  kop, tandaTangan,
} from './surat-resmi.js';
import { cetakAttrs } from './cetak.js';
import { BTN, dialogClose } from './ui.js';

const JENIS_USAHA = { swasta: 'Industri Besi dan Baja Dasar',
  lembaga: 'Kegiatan Sosial dan Keagamaan' };
const PENANDA = { nama: 'RENDRA SETIAWAN', nip: '19720120 199903 1 003' };
const KOTA = 'Jakarta';
const DIRJEN_TITLE = 'Direktur Jenderal Pembinaan Penempatan Tenaga Kerja ' +
  'dan Perluasan Kesempatan Kerja';

/** Nomor Keputusan resmi dari nomor surat "HPK/0003/IX/2026". */
function nomorKeputusan({ surat }) {
  const [, urut, bulan, tahun] = surat.nomor.split('/');
  return `B.3/${urut.padStart(5, '0')}/PK.04.00/${bulan}/${tahun}`;
}

const tail = (jenis) => jenis.replace(/^HPK /, '').replace(' (enam)', '');

function monthsBetween(from, to) {
  const [y1, m1, d1] = from.split('-').map(Number);
  const [y2, m2, d2] = to.split('-').map(Number);
  return (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
}

function durasi(from, to) {
  const months = monthsBetween(from, to);
  return months % 12 === 0 ? `${angka(months / 12)} tahun`
    : `${angka(months)} bulan`;
}

/** Daftar jabatan TKA (data lama satu jabatan tetap terbaca). */
const daftarJabatan = (v) => v.jabatanTka?.length ? v.jabatanTka
  : [{ nama: v.jabatan, jumlahTka: v.jumlahTka }];
const total = (v) => daftarJabatan(v).reduce((n, j) => n + j.jumlahTka, 0);

/** Field values (isian input + OSS) keyed by kunci. */
const valuesOf = (item) => Object.fromEntries(item.formulir.fields
  .map((f) => [f.kunci, f.nilai]));

function halamanKeputusan(item, v) {
  const co = state.data.company;
  const jenis = tail(item.jenis);
  const diajukan = item.riwayat.find((r) => r.status !== PK_STATUS.DRAFT)
    ?.tgl ?? item.tanggal;
  const pendamping = Boolean(v.pendampingNama);
  return html`${kop()}
    ${judul(nomorKeputusan(item), html`HASIL PENILAIAN KELAYAKAN<br>PENGESAHAN
      RENCANA PENGGUNAAN TENAGA KERJA ASING<br>${jenis}<br>PADA
      ${co.nama}`)}
    ${klausa('Menimbang', daftar([
      `berdasarkan surat ${co.nama} Nomor ${item.noHpk} tanggal ` +
        `${tanggal(diajukan)} perihal permohonan Pengesahan RPTKA ${jenis};`,
      'bahwa dalam rangka melaksanakan pekerjaan sesuai dengan ' +
        'keahliannya/kompetensinya, Pemberi Kerja TKA mengajukan ' +
        `permohonan Pengesahan RPTKA ${jenis};`,
      'bahwa setelah dilakukan pemeriksaan dokumen dan penilaian ' +
        'kelayakan terhadap kelengkapan persyaratan, Pemberi Kerja TKA ' +
        'dinyatakan layak untuk mempekerjakan TKA;',
      'bahwa berdasarkan pertimbangan huruf a, huruf b dan huruf c, maka ' +
        'perlu menetapkan Hasil Penilaian Kelayakan Pengesahan RPTKA ' +
        `dengan Keputusan ${DIRJEN_TITLE}.`]))}
    ${klausa('Mengingat', daftar(MENGINGAT, 'decimal'))}
    <p class="my-3 text-center">MEMUTUSKAN</p>
    ${klausa('Menetapkan', `KEPUTUSAN ${DIRJEN} TENTANG HASIL PENILAIAN ` +
      'KELAYAKAN PENGESAHAN RENCANA PENGGUNAAN TENAGA KERJA ASING.')}
    ${klausa('KESATU', `Hasil Penilaian Kelayakan Pengesahan RPTKA ${jenis} ` +
      `pada ${co.nama} berlaku selama ${durasi(v.tanggalMulai,
        v.tanggalSelesai)} terhitung mulai dari ${tanggal(v.tanggalMulai)} ` +
      `s/d ${tanggal(v.tanggalSelesai)} sebanyak ${daftarJabatan(v).length} ` +
      `(${angka(daftarJabatan(v).length)}) jabatan dengan ` +
      `jumlah Tenaga Kerja Asing ${angka(total(v))} orang dengan ` +
      'lokasi sebagaimana terlampir dalam keputusan ini, yang selanjutnya ' +
      'dapat dipergunakan sebagai dasar pengajuan Permohonan Pengesahan ' +
      'RPTKA.')}
    ${pendamping ? klausa('KEDUA', 'Pemberi Kerja TKA wajib menunjuk ' +
      'Tenaga Kerja Pendamping TKA yang dipekerjakan untuk alih teknologi ' +
      'dan alih keahlian dari TKA.') : ''}
    ${klausa(pendamping ? 'KETIGA' : 'KEDUA', 'Pemberi Kerja TKA wajib ' +
      'melaporkan setiap 1 (satu) tahun untuk pelaksanaan penggunaan TKA' +
      `${pendamping ? ', pelaksanaan pendidikan dan pelatihan kerja bagi ' +
        'Tenaga Kerja Pendamping TKA, pelaksanaan alih teknologi dan alih ' +
        'keahlian dari TKA kepada Tenaga Kerja Pendamping TKA,' : ''} dan ` +
      'berakhirnya penggunaan TKA kepada Direktur Jenderal Pembinaan ' +
      'Penempatan Tenaga Kerja dan Perluasan Kesempatan Kerja c.q. ' +
      'Direktur Pengendalian Penggunaan Tenaga Kerja Asing secara online.')}
    ${klausa(pendamping ? 'KEEMPAT' : 'KETIGA', 'Keputusan ini mulai ' +
      'berlaku sejak tanggal ditetapkan, dengan ketentuan apabila ' +
      'dikemudian hari terdapat kekeliruan dalam keputusan ini, akan ' +
      'diperbaiki sebagaimana mestinya.')}
    <div class="mt-6 flex flex-wrap items-end justify-between gap-4">
      ${kodeQr(item.surat.nomor.split('/')[1],
        `QR code ${nomorKeputusan(item)}`)}
      ${tandaTangan({ tempat: KOTA, tanggal: tanggal(item.surat.terbit),
        jabatan: ['a.n. DIREKTUR JENDERAL', 'DIREKTUR PENGENDALIAN',
          'PENGGUNAAN TENAGA KERJA ASING'], nama: PENANDA.nama,
        nip: PENANDA.nip })}</div>
    <div class="mt-4 text-xs"><p>Tembusan:</p>${daftar(TEMBUSAN, 'decimal')}
      </div>`;
}

function keterangan(item, v) {
  const lokasi = String(v.lokasiKerja).split(',').map((l) => l.trim())
    .filter(Boolean);
  const butir = [
    html`Hasil Penilaian Kelayakan Pengesahan RPTKA<br>${tail(item.jenis)}`,
    html`Lokasi kerja TKA${lokasi.map((l) => html`<br>- ${l}`)}`,
    html`Penggunaan TKA disetujui:<br>- Jumlah TKA ${angka(total(v))}
      orang<br>Berlaku ${tanggal(v.tanggalMulai)} s.d. tanggal
      ${tanggal(v.tanggalSelesai)} (kolom 3, 4)`,
  ];
  if (v.pendampingNama) {
    butir.push(html`Tenaga Kerja Pendamping : ${v.pendampingNama}
      (${v.pendampingJabatan})`);
  }
  if (v.rencanaPenyerapanTki) {
    butir.push(html`Rencana penyerapan TKI : ${v.rencanaPenyerapanTki}`);
  }
  return daftar(butir, 'decimal');
}

function halamanLampiran(item, v) {
  const co = state.data.company;
  const first = Number(v.tanggalMulai.slice(0, 4));
  const last = Number(v.tanggalSelesai.slice(0, 4));
  const tahun = Array.from({ length: last - first + 1 }, (_, i) => first + i);
  const cell = 'border border-base-content px-2 py-1 align-top';
  return html`<div class="mb-4 ms-auto max-w-sm text-[11.5px] uppercase
      print:break-before-page">
      <p>LAMPIRAN<br>KEPUTUSAN ${DIRJEN}<br>NOMOR ${nomorKeputusan(item)}<br>
      TENTANG HASIL PENILAIAN KELAYAKAN PENGESAHAN RENCANA PENGGUNAAN TENAGA
      KERJA ASING PADA ${co.nama}</p></div>
    <dl class="mb-3 grid grid-cols-[170px_1fr] gap-y-0.5 uppercase">
      <dt>Pemberi Kerja TKA</dt><dd>: ${co.nama}</dd><dt>Alamat</dt>
      <dd>: ${co.jalan}, ${co.kab}, ${co.prov}</dd><dt>Telepon</dt>
      <dd>: ${co.telp}, Fax: ${co.fax}</dd><dt>Jenis usaha / komoditi</dt>
      <dd>: ${JENIS_USAHA[state.role] ?? co.kategori}</dd></dl>
    <div class="overflow-x-auto"><table class="w-full border-collapse
        border border-base-content text-[12px]">
      <thead><tr class="text-center"><th rowspan="2" class="${cell}">NO.</th>
        <th rowspan="2" class="${cell}">JABATAN</th><th colspan="${tahun
        .length}" class="${cell}">TAHUN PENGGUNAAN</th>
        <th rowspan="2" class="${cell}">KETERANGAN</th></tr>
        <tr class="text-center">${tahun.map((y) => html`<th class="${cell}">
          ${y}</th>`)}</tr></thead>
      <tbody>${daftarJabatan(v).map((j, i) => html`<tr>
        <td class="${cell} text-center">${i + 1}</td>
        <td class="${cell} uppercase">${j.nama}</td>
        ${tahun.map(() => html`<td class="${cell} text-center">
          ${j.jumlahTka}</td>`)}
        ${i === 0 ? html`<td class="${cell}" rowspan="${daftarJabatan(v)
    .length}">${keterangan(item, v)}</td>` : ''}</tr>`)}
        <tr><td class="${cell}"></td><td class="${cell}">JUMLAH</td>
        ${tahun.map(() => html`<td class="${cell} text-center">
          ${total(v)}</td>`)}<td class="${cell}"></td></tr></tbody>
    </table></div>
    <div class="mt-5 flex flex-wrap items-end justify-between gap-4">
      ${kodeQr(item.surat.nomor.split('/')[1],
        `QR code ${nomorKeputusan(item)}`)}
      <div class="text-center"><p>${KOTA}, ${tanggal(item.surat.terbit)}</p>
        <p>a.n. DIREKTUR JENDERAL<br>DIREKTUR PENGENDALIAN<br>PENGGUNAAN
        TENAGA KERJA ASING</p><div class="h-14"></div>
        <p class="font-bold underline">${PENANDA.nama}</p>
        <p>NIP. ${PENANDA.nip}</p></div></div>`;
}

/** Dialog content for a surat HPK (status HPK Terbit). */
export function letter(item) {
  const v = valuesOf(item);
  return html`<div class="flex flex-wrap items-center justify-between gap-2
      border-b border-base-300 px-6 py-4.5 print:hidden"><h2 class="font-bold">Surat
      Hasil Penilaian Kelayakan · ${nomorKeputusan(item)}</h2>
      <div class="flex items-center gap-2"><button type="button"
      class="${BTN} btn-sm" ${cetakAttrs(`Surat HPK ${item.noHpk}`)}
      data-testid="hpk-btn-cetak-pdf">Cetak / Simpan PDF</button>
      ${dialogClose()}</div></div>
    <div class="${PAPER} px-6 py-8 md:px-10">
      ${halamanKeputusan(item, v)}
      <hr class="my-8 border-dashed border-base-300 print:hidden">
      ${halamanLampiran(item, v)}
      <p class="mt-6 text-[11px] text-base-content/70 print:hidden">${raw('Pratinjau ' +
        'prototipe berdasarkan format Hasil Penilaian Kelayakan; nama ' +
        'dan NIP penandatangan serta teks resmi menunggu ketetapan ' +
        'Direktorat PPTKA.')}</p></div>`;
}
