/**
 * @fileoverview Shared TKA Online fixture data (reference date:
 * Wednesday, 30 September 2026). Ported 1:1 from legacy (git 2630ca4) data.js —
 * content and generator logic are intentionally unchanged so every page
 * shows the same names and numbers as the legacy prototype.
 *
 * Only js/mocks/handlers.js may import this module. Pages read data through
 * js/api/* (fetch -> /api/v1/*).
 */

const HPK_STEPS = ['Permohonan Online', 'Verifikasi Data dan Upload', 'Jadwal Ekspos', 'Pengesahan Ekspos', 'Print Draft Surat', 'Pemeriksaan Kasi', 'Pemeriksaan Kasubdit', 'Pemeriksaan dan Penandatanganan Direktur', 'Penomoran dan surat sudah bisa diprint'];
const PENG_STEPS = ['Permohonan', 'Verifikasi Data dan Upload', 'Pemeriksaan Subkoordinator', 'Pemeriksaan Koordinator', 'Persetujuan Direktur', 'Pembayaran DKPTKA melalui Simponi', 'Sudah Berhasil Diterima Dirjen Imigrasi'];

const sso = { name: 'Rina Wulandari', email: 'rina.wulandari@nusantarabaja.co.id', nik: '3216•••••••••0042' };

const companies = {
  swasta: {
    key: 'swasta', roleLabel: 'Perusahaan Swasta', grup: 'A', hpk: true, dk: true,
    nama: 'PT Nusantara Baja Presisi', singkat: 'NBP', kategori: 'Penanaman Modal Asing (PMA)',
    username: 'nbp.hrd', email: 'hrd@nusantarabaja.co.id', telp: '021-8983 0120', fax: '021-8983 0121',
    npwp: '0012 3456 7801 2000', nib: '9120301234567', akta: 'No. 14 tanggal 3 Maret 2015', aktaSah: 'AHU-0012345.AH.01.01.Tahun 2015', wlkp: '3216.2015.004512',
    jalan: 'Jl. Industri Selatan 5 Blok GG No. 8, Kawasan Industri Jababeka II', kel: 'PASIRSARI', kec: 'CIKARANG SELATAN', kab: 'KAB. BEKASI', prov: 'JAWA BARAT', kodepos: '17530',
    pengurus: { jenis: 'Karyawan Pemberi Kerja', nama: 'Rina Wulandari', kontak: '081287654321', perusahaan: 'PT Nusantara Baja Presisi' },
  },
  lembaga: {
    key: 'lembaga', roleLabel: 'Lembaga Sosial / Keagamaan', grup: 'B', hpk: true, dk: false,
    nama: 'Yayasan Pelayanan Kasih Nusantara', singkat: 'YPKN', kategori: 'Lembaga Keagamaan',
    username: 'ypkn.admin', email: 'sekretariat@ypkn.or.id', telp: '021-3190 4455', fax: '021-3190 4456',
    npwp: '0098 7654 3202 7000', nib: '—', akta: 'No. 7 tanggal 21 Januari 2009', aktaSah: 'AHU-0004471.AH.01.04.Tahun 2009', wlkp: '3171.2009.001873',
    jalan: 'Jl. Kramat Raya No. 65', kel: 'KRAMAT', kec: 'SENEN', kab: 'KOTA ADM. JAKARTA PUSAT', prov: 'DKI JAKARTA', kodepos: '10450',
    pembebasan: { no: 'B-1127/DJ.V/KS.01.1/03/2026', tgl: '18 Maret 2026', instansi: 'Kementerian Agama RI' },
    pengurus: { jenis: 'Karyawan Pemberi Kerja', nama: 'Yohanes Sitompul', kontak: '081311220987', perusahaan: 'Yayasan Pelayanan Kasih Nusantara' },
  },
  pemerintah: {
    key: 'pemerintah', roleLabel: 'Instansi Pemerintah / Badan Internasional', grup: 'C', hpk: false, dk: false,
    nama: 'Kantor Perwakilan Organisasi Kerja Sama Teknik Asia (OKTA)', singkat: 'OKTA', kategori: 'Badan Internasional',
    username: 'okta.jkt', email: 'admin.jakarta@okta-asia.org', telp: '021-3983 7700', fax: '021-3983 7701',
    npwp: '—', nib: '—', akta: '—', aktaSah: '—', wlkp: '—',
    jalan: 'Menara Thamrin Lt. 12, Jl. M.H. Thamrin Kav. 3', kel: 'KEBON SIRIH', kec: 'MENTENG', kab: 'KOTA ADM. JAKARTA PUSAT', prov: 'DKI JAKARTA', kodepos: '10340',
    persetujuan: { no: 'B/0412/KS/04/2026/DJKA', tgl: '9 April 2026', instansi: 'Kementerian Luar Negeri RI' },
    pengurus: { jenis: 'Karyawan Pemberi Kerja', nama: 'Dewi Anggraini', kontak: '081219876543', perusahaan: 'Kantor Perwakilan OKTA Jakarta' },
  },
};

// TKA per pemberi kerja. sisa = hari menuju berakhir dari 30 Sep 2026.
const tka = {
  swasta: [
    { nama: 'Chen Wei', negara: 'Republik Rakyat Tiongkok', paspor: 'EH4471028', jabatan: 'Quality Control Engineer', barcode: '25103377', skNo: 'B.3/25103377/PK.04.01/X/2025', skTgl: '15 Oktober 2025', mulai: '23 Oktober 2025', akhir: '22 Oktober 2026', sisa: 22, bpjs: true, npwp: true, lapor: true, lokasi: 'KAB. BEKASI' },
    { nama: 'Hiroshi Tanaka', negara: 'Jepang', paspor: 'TR1234567', jabatan: 'Plant Manager', barcode: '24871365', skNo: 'B.3/24871365/PK.04.01/XI/2024', skTgl: '8 November 2024', mulai: '15 November 2024', akhir: '14 November 2026', sisa: 45, bpjs: true, npwp: false, lapor: true, lokasi: 'KAB. BEKASI' },
    { nama: 'Park Ji-won', negara: 'Korea Selatan', paspor: 'M58204417', jabatan: 'Maintenance Supervisor', barcode: '25220914', skNo: 'B.3/25220914/PK.04.01/XII/2025', skTgl: '1 Desember 2025', mulai: '4 Desember 2025', akhir: '3 Desember 2026', sisa: 64, bpjs: true, npwp: true, lapor: false, lokasi: 'KAB. BEKASI' },
    { nama: 'Rajesh Kumar', negara: 'India', paspor: 'Z6120934', jabatan: 'Process Engineer', barcode: '26045102', skNo: 'B.3/26045102/PK.04.01/IX/2026', skTgl: '1 September 2026', mulai: '8 September 2026', akhir: '7 September 2027', sisa: 342, bpjs: true, npwp: true, lapor: true, lokasi: 'KAB. BEKASI' },
    { nama: 'Lukas Becker', negara: 'Jerman', paspor: 'C4F7K92LT', jabatan: 'Direktur Teknik', barcode: '25009981', skNo: 'B.3/25009981/PK.04.01/III/2025', skTgl: '11 Maret 2025', mulai: '17 Maret 2025', akhir: '16 Maret 2027', sisa: 167, bpjs: true, npwp: true, lapor: true, lokasi: 'KAB. BEKASI' },
  ],
  lembaga: [
    { nama: 'Matteo Rossi', negara: 'Italia', paspor: 'YA2290417', jabatan: 'Rohaniwan', barcode: '25188230', skNo: 'B.3/25188230/PK.04.01/XI/2025', skTgl: '3 November 2025', mulai: '10 November 2025', akhir: '9 November 2026', sisa: 40, bpjs: true, npwp: true, lapor: true, lokasi: 'KOTA ADM. JAKARTA PUSAT' },
    { nama: 'Maria Luisa Santos', negara: 'Filipina', paspor: 'P7730215B', jabatan: 'Pengajar Bahasa Inggris', barcode: '26031145', skNo: 'B.3/26031145/PK.04.01/VI/2026', skTgl: '12 Juni 2026', mulai: '19 Juni 2026', akhir: '18 Juni 2027', sisa: 261, bpjs: true, npwp: true, lapor: true, lokasi: 'KOTA ADM. JAKARTA PUSAT' },
  ],
  pemerintah: [
    { nama: 'Kenji Watanabe', negara: 'Jepang', paspor: 'TK8810352', jabatan: 'Tenaga Ahli Irigasi', barcode: '25197764', skNo: 'B.3/25197764/PK.04.01/XI/2025', skTgl: '14 November 2025', mulai: '20 November 2025', akhir: '19 November 2026', sisa: 50, bpjs: true, npwp: true, lapor: true, lokasi: 'KOTA ADM. JAKARTA PUSAT' },
    { nama: 'Sarah Mitchell', negara: 'Australia', paspor: 'PA4418820', jabatan: 'Program Advisor', barcode: '26050318', skNo: 'B.3/26050318/PK.04.01/VIII/2026', skTgl: '20 Agustus 2026', mulai: '27 Agustus 2026', akhir: '26 Agustus 2027', sisa: 330, bpjs: true, npwp: true, lapor: true, lokasi: 'KOTA ADM. JAKARTA PUSAT' },
  ],
};

// Permohonan HPK (tahap 1). stepIdx = indeks HPK_STEPS saat ini.
const hpk = {
  swasta: [
    { id: 'h1', layanan: 'Pekerjaan Lebih dari 6 bulan', noPermohonan: '260600031874', barcode: '26004518', tgl: '22 Juli 2026', terbit: '12 Agustus 2026', stepIdx: 8, status: 'HPK terbit', tone: 'green',
      jabatan: [{ nama: 'Quality Control Engineer', kuota: 2, terisi: 2, bulan: 12 }, { nama: 'Process Engineer', kuota: 2, terisi: 2, bulan: 12 }, { nama: 'Welding Inspector', kuota: 1, terisi: 0, bulan: 12 }],
      lokasi: 'KAB. BEKASI, JAWA BARAT', negara: 'India, Vietnam, Jepang' },
    { id: 'h2', layanan: 'Perpanjangan', noPermohonan: '260900012345', barcode: '—', tgl: '15 September 2026', terbit: '—', stepIdx: 2, status: 'Jadwal Ekspos: 7 Okt 2026, 09.30 WIB', tone: 'blue',
      jabatan: [{ nama: 'Quality Control Engineer', kuota: 1, terisi: 0, bulan: 12 }, { nama: 'Plant Manager', kuota: 1, terisi: 0, bulan: 24 }], lokasi: 'KAB. BEKASI, JAWA BARAT', negara: 'RRT, Jepang' },
    { id: 'h3', layanan: 'Sementara (1–6 bulan)', noPermohonan: '260900014410', barcode: '—', tgl: '24 September 2026', terbit: '—', stepIdx: 1, status: 'Data atau dokumen belum lengkap, belum bisa diproses', tone: 'red',
      catatan: 'Rancangan perjanjian kerja belum ditandatangani kedua pihak. Uraian jabatan Commissioning Specialist kurang dari 350 karakter.',
      jabatan: [{ nama: 'Commissioning Specialist', kuota: 2, terisi: 0, bulan: 4 }], lokasi: 'KAB. KARAWANG, JAWA BARAT', negara: 'Jerman' },
    { id: 'h4', layanan: 'Direktur/Komisaris', noPermohonan: '250200008812', barcode: '25009980', tgl: '10 Februari 2025', terbit: '4 Maret 2025', stepIdx: 8, status: 'HPK terbit', tone: 'green',
      jabatan: [{ nama: 'Direktur Teknik', kuota: 1, terisi: 1, bulan: 24 }], lokasi: 'KAB. BEKASI, JAWA BARAT', negara: 'Jerman' },
  ],
  lembaga: [
    { id: 'h1', layanan: 'Non DKPTKA', noPermohonan: '260500022019', barcode: '26003307', tgl: '28 Mei 2026', terbit: '8 Juni 2026', stepIdx: 8, status: 'HPK terbit', tone: 'green',
      jabatan: [{ nama: 'Pengajar Bahasa Inggris', kuota: 2, terisi: 1, bulan: 12 }], lokasi: 'KOTA ADM. JAKARTA PUSAT, DKI JAKARTA', negara: 'Filipina' },
    { id: 'h2', layanan: 'Perpanjangan Non DKPTKA', noPermohonan: '260900013020', barcode: '—', tgl: '18 September 2026', terbit: '—', stepIdx: 1, status: 'Verifikasi Data dan Upload', tone: 'amber',
      jabatan: [{ nama: 'Rohaniwan', kuota: 1, terisi: 0, bulan: 12 }], lokasi: 'KOTA ADM. JAKARTA PUSAT, DKI JAKARTA', negara: 'Italia' },
  ],
  pemerintah: [],
};

// Pengesahan RPTKA (tahap 2) yang sedang/sudah diproses.
const pengesahan = {
  swasta: [
    { id: 'p1', hpk: 'h1', nama: 'Nguyen Van Minh', negara: 'Vietnam', paspor: 'C9912045', jabatan: 'Quality Control Engineer', jenis: 'Baru', bulan: 12, tgl: '26 Agustus 2026', stepIdx: 5, status: 'Menunggu pembayaran DKPTKA', tone: 'amber', billing: 'b1', imigrasi: false },
    { id: 'p2', hpk: 'h1', nama: 'Sato Kenji', negara: 'Jepang', paspor: 'TZ0038871', jabatan: 'Process Engineer', jenis: 'Pemegang Izin Tinggal', permit: '2C21JE0041-AR', bulan: 12, tgl: '21 September 2026', stepIdx: 3, status: 'Pemeriksaan Koordinator', tone: 'blue', imigrasi: false },
    { id: 'p3', hpk: 'h1', nama: 'Rajesh Kumar', negara: 'India', paspor: 'Z6120934', jabatan: 'Process Engineer', jenis: 'Baru', bulan: 12, tgl: '14 Agustus 2026', stepIdx: 6, status: 'Terbit · terkirim ke Imigrasi', tone: 'green', billing: 'b3', imigrasi: true, barcode: '26045102' },
    { id: 'p4', hpk: 'h1', nama: 'Aarav Mehta', negara: 'India', paspor: 'W3348120', jabatan: 'Quality Control Engineer', jenis: 'Baru', bulan: 12, tgl: '17 Agustus 2026', stepIdx: 5, status: 'Kode billing kedaluwarsa', tone: 'red', billing: 'b2', imigrasi: false },
  ],
  lembaga: [
    { id: 'p1', hpk: 'h1', nama: 'Maria Luisa Santos', negara: 'Filipina', paspor: 'P7730215B', jabatan: 'Pengajar Bahasa Inggris', jenis: 'Baru', bulan: 12, tgl: '9 Juni 2026', stepIdx: 6, status: 'Terbit · terkirim ke Imigrasi', tone: 'green', imigrasi: true, barcode: '26031145' },
  ],
  pemerintah: [
    { id: 'p1', hpk: null, layanan: 'Baru (lebih dari 6 bulan)', nama: 'Sarah Mitchell', negara: 'Australia', paspor: 'PA4418820', jabatan: 'Program Advisor', jenis: 'Baru', bulan: 12, tgl: '14 Agustus 2026', stepIdx: 6, status: 'Terbit · terkirim ke Imigrasi', tone: 'green', imigrasi: true, barcode: '26050318' },
    { id: 'p2', hpk: null, layanan: 'Jangka Pendek (1–6 bulan)', nama: 'Tomás Herrera', negara: 'Chili', paspor: 'F20981736', jabatan: 'Konsultan Pengelolaan Air', jenis: 'Baru', bulan: 3, tgl: '25 September 2026', stepIdx: 1, status: 'Verifikasi Data dan Upload', tone: 'amber', imigrasi: false },
    { id: 'p3', hpk: null, layanan: 'Perpanjangan', nama: 'Kenji Watanabe', negara: 'Jepang', paspor: 'TK8810352', jabatan: 'Tenaga Ahli Irigasi', jenis: 'Perpanjangan', bulan: 12, tgl: '—', stepIdx: 0, status: 'Draf — belum diproses', tone: 'gray', imigrasi: false },
  ],
};

const billing = {
  swasta: [
    { id: 'b1', kode: '820260930114572', ntpn: '—', tka: 'Nguyen Van Minh', paspor: 'C9912045', jabatan: 'Quality Control Engineer', bulan: 12, rupiah: 18000000, terbit: '30 September 2026', batas: '7 Oktober 2026', status: 'Belum dibayar', tone: 'amber', jenis: 'PNBP' },
    { id: 'b2', kode: '820260818093310', ntpn: '—', tka: 'Aarav Mehta', paspor: 'W3348120', jabatan: 'Quality Control Engineer', bulan: 12, rupiah: 18000000, terbit: '18 Agustus 2026', batas: '25 Agustus 2026', status: 'Kedaluwarsa', tone: 'red', jenis: 'PNBP' },
    { id: 'b3', kode: '820260825140018', ntpn: 'A1B2C3D4E5F6G7H8', tka: 'Rajesh Kumar', paspor: 'Z6120934', jabatan: 'Process Engineer', bulan: 12, rupiah: 18000000, terbit: '25 Agustus 2026', batas: '1 September 2026', bayar: '28 Agustus 2026', bank: 'Bank Mandiri', status: 'Lunas', tone: 'green', jenis: 'PNBP' },
    { id: 'b4', kode: '820251124101145', ntpn: 'Q9W8E7R6T5Y4U3I2', tka: 'Park Ji-won', paspor: 'M58204417', jabatan: 'Maintenance Supervisor', bulan: 12, rupiah: 18000000, terbit: '24 November 2025', batas: '1 Desember 2025', bayar: '27 November 2025', bank: 'BNI', status: 'Lunas', tone: 'green', jenis: 'PNBP' },
  ],
  lembaga: [], pemerintah: [],
};

const ekspos = {
  swasta: [{ hpk: 'h2', tgl: 'Rabu, 7 Oktober 2026', jam: '09.30 – 10.00 WIB', antrian: 14, layanan: 'Perpanjangan', media: 'Telewicara (tautan dikirim H-1 ke email akun)' }],
  lembaga: [], pemerintah: [],
};

const perubahan = {
  swasta: [
    { id: 'c1', barcode: '26091204', skBarcode: '25103377', skNo: 'B.3/25103377/PK.04.01/X/2025', skTgl: '15 Oktober 2025', nama: 'Chen Wei', paspor: 'EH4471028', jabatan: 'Quality Control Engineer', jenis: 'Data Tenaga Kerja Asing', detail: 'Data Paspor', dok: false, pengurus: true, status: 'Draf', statusId: 1, tone: 'gray',
      semula: 'EH4471028 · Republik Rakyat Tiongkok', menjadi: 'EK0923316 · Republik Rakyat Tiongkok', surat: '045/NBP-HRD/IX/2026', suratTgl: '28 September 2026' },
    { id: 'c2', barcode: '26083377', skBarcode: '24871365', skNo: 'B.3/24871365/PK.04.01/XI/2024', skTgl: '8 November 2024', nama: 'Hiroshi Tanaka', paspor: 'TR1234567', jabatan: 'Plant Manager', jenis: 'Lokasi Kerja', detail: '+ KAB. KARAWANG', dok: true, pengurus: true, status: 'Terbit', statusId: 6, tone: 'green', sk: 'B.3/26083377/PK.04.02/IX/2026', skTerbit: '11 September 2026',
      semula: 'KAB. BEKASI, JAWA BARAT', menjadi: 'KAB. BEKASI, JAWA BARAT; KAB. KARAWANG, JAWA BARAT', surat: '039/NBP-HRD/IX/2026', suratTgl: '2 September 2026' },
    { id: 'c3', barcode: '26090581', skBarcode: '25220914', skNo: 'B.3/25220914/PK.04.01/XII/2025', skTgl: '1 Desember 2025', nama: 'Park Ji-won', paspor: 'M58204417', jabatan: 'Maintenance Supervisor', jenis: 'Alamat Pemberi Kerja', detail: 'Pindah blok kawasan', dok: true, pengurus: true, status: 'Pemeriksaan Petugas', statusId: 3, tone: 'blue',
      semula: 'Jl. Industri Selatan 3 Blok F No. 2, Kawasan Industri Jababeka II', menjadi: 'Jl. Industri Selatan 5 Blok GG No. 8, Kawasan Industri Jababeka II', surat: '042/NBP-HRD/IX/2026', suratTgl: '22 September 2026' },
  ],
  lembaga: [], pemerintah: [],
};

const laporanDef = [
  { kode: 'L1', nama: 'Laporan Pelaksanaan Penggunaan TKA' },
  { kode: 'L2', nama: 'Laporan Pelaksanaan Pendidikan dan Pelatihan Kerja bagi Tenaga Kerja Pendamping TKA' },
  { kode: 'L3', nama: 'Laporan Pelaksanaan Alih Teknologi dan Alih Keahlian' },
  { kode: 'L4', nama: 'Laporan Berakhirnya Penggunaan TKA' },
];
const laporan = {
  swasta: { periode: 2025, rows: [{ n: 5, upd: '19 September 2026, 14.22' }, { n: 4, upd: '19 September 2026, 14.40' }, { n: 0, upd: '—' }, { n: 1, upd: '12 Agustus 2026, 10.05' }], status: 'Draft' },
  lembaga: { periode: 2025, rows: [{ n: 2, upd: '3 Februari 2026, 09.12' }, { n: 2, upd: '3 Februari 2026, 09.20' }, { n: 2, upd: '3 Februari 2026, 09.31' }, { n: 0, upd: '3 Februari 2026, 09.33' }], status: 'Terkirim' },
  pemerintah: { periode: 2025, rows: [{ n: 2, upd: '—' }, { n: 0, upd: '—' }, { n: 0, upd: '—' }, { n: 0, upd: '—' }], status: 'Draft' },
};
const laporanPenggunaan = [
  { nama: 'Park Ji-won', paspor: 'M58204417', jabatan: 'Maintenance Supervisor', sk: '25220914', pendamping: 'Agus Setiawan', mulai: '4 Desember 2025', akhir: '3 Desember 2026', lokasi: 'KAB. BEKASI' },
  { nama: 'Chen Wei', paspor: 'EH4471028', jabatan: 'Quality Control Engineer', sk: '25103377', pendamping: 'Dimas Prasetyo', mulai: '23 Oktober 2025', akhir: '22 Oktober 2026', lokasi: 'KAB. BEKASI' },
  { nama: 'Hiroshi Tanaka', paspor: 'TR1234567', jabatan: 'Plant Manager', sk: '24871365', pendamping: 'Bambang Hartono', mulai: '15 November 2024', akhir: '14 November 2026', lokasi: 'KAB. BEKASI' },
  { nama: 'Lukas Becker', paspor: 'C4F7K92LT', jabatan: 'Direktur Teknik', sk: '25009981', pendamping: 'Sri Mulyani Putri', mulai: '17 Maret 2025', akhir: '16 Maret 2027', lokasi: 'KAB. BEKASI' },
  { nama: 'Wang Lei', paspor: 'EG1180342', jabatan: 'Quality Control Engineer', sk: '24101876', pendamping: 'Dimas Prasetyo', mulai: '2 Oktober 2024', akhir: '1 Oktober 2025', lokasi: 'KAB. BEKASI' },
];

const tiket = [
  { no: 'HT-2609-0418', kategori: 'Update NPWP', judul: 'Update NPWP TKA Hiroshi Tanaka (Coretax)', tgl: '29 September 2026, 10.14', status: 'Diproses', tone: 'blue', agen: 'Fajar N.', perusahaan: 'PT Nusantara Baja Presisi', lock: 'Fajar N.' },
  { no: 'HT-2609-0377', kategori: 'Upload ulang foto TKA', judul: 'Foto TKA Sato Kenji tidak berlatar merah', tgl: '23 September 2026, 15.02', status: 'Selesai', tone: 'green', agen: 'Maya L.', perusahaan: 'PT Nusantara Baja Presisi' },
  { no: 'HT-2609-0352', kategori: 'Revisi masa berlaku', judul: 'Masa berlaku SK Chen Wei tertulis 11 bulan', tgl: '19 September 2026, 08.47', status: 'Selesai', tone: 'green', agen: 'Fajar N.', perusahaan: 'PT Nusantara Baja Presisi' },
  { no: 'HT-2609-0431', kategori: 'Jabatan tidak tersedia', judul: 'Jabatan "Welding Inspector" tidak muncul di pilihan', tgl: '30 September 2026, 08.05', status: 'Baru', tone: 'amber', perusahaan: 'PT Nusantara Baja Presisi' },
  { no: 'HT-2609-0429', kategori: 'Penambahan jangka waktu HPK', judul: 'Penambahan jangka waktu HPK 26002281', tgl: '30 September 2026, 07.41', status: 'Baru', tone: 'amber', perusahaan: 'PT Sinar Energi Kalimantan' },
  { no: 'HT-2609-0426', kategori: 'Username dan Password', judul: 'Tidak menerima email reset password', tgl: '29 September 2026, 16.55', status: 'Baru', tone: 'amber', perusahaan: 'PT Cahaya Digital Asia' },
  { no: 'HT-2609-0421', kategori: 'Pembatalan HPK', judul: 'Pembatalan HPK 26001874 (proyek ditunda)', tgl: '29 September 2026, 13.20', status: 'Diproses', tone: 'blue', agen: 'Maya L.', perusahaan: 'PT Mitra Kilang Utama', lock: 'Maya L.' },
  { no: 'HT-2609-0415', kategori: 'Penambahan Lokasi', judul: 'Tambah lokasi kerja Kab. Morowali', tgl: '28 September 2026, 11.09', status: 'Diproses', tone: 'blue', agen: 'Fajar N.', perusahaan: 'PT Sulawesi Nikel Smelter' },
];

const pengumuman = [
  { tgl: '1 Desember 2025', tag: 'Penting', judul: 'Pengalihan layanan email hotline ke user.pptka@kemnaker.go.id', isi: 'Mulai 8 Desember 2025, permohonan username & password, penonaktifan akun, dan pembatalan HPK/RPTKA dilayani melalui user.pptka@kemnaker.go.id. Email pptka.contact@gmail.com tidak lagi menerima layanan.' },
  { tgl: '20 Oktober 2025', tag: 'Layanan', judul: 'Pembaruan layanan TKA Hotline', isi: 'TKA Hotline kini mendukung lampiran berkas dan gambar pada percakapan tiket. Unduh panduan penggunaannya di menu Bantuan Hotline.' },
  { tgl: '2 September 2026', tag: 'Pengingat', judul: 'Perpanjangan diajukan paling lambat 30 hari sebelum masa berlaku berakhir', isi: 'Pastikan BPJS TKA aktif, NPWP TKA aktif di Coretax, serta laporan pendampingan dan alih keahlian sudah dikirim sebelum mengajukan perpanjangan.' },
];

// Antrian back office — merujuk pemberi kerja di atas + pemberi kerja lain.
const antrian = [
  { id: 'q1', no: '260900014410', jenis: 'HPK', layanan: 'Sementara (1–6 bulan)', pemohon: 'PT Nusantara Baja Presisi', kategori: 'PMA', masuk: '24 Sep 2026', tahap: 'Verifikasi Data dan Upload', sla: 'Dikembalikan', tone: 'red', tka: 'Commissioning Specialist ×2' },
  { id: 'q2', no: '260900013020', jenis: 'HPK', layanan: 'Perpanjangan Non DKPTKA', pemohon: 'Yayasan Pelayanan Kasih Nusantara', kategori: 'Lembaga Keagamaan', masuk: '18 Sep 2026', tahap: 'Verifikasi Data dan Upload', sla: '8 hari', tone: 'amber', tka: 'Rohaniwan ×1' },
  { id: 'q3', no: 'P-26092114', jenis: 'Pengesahan', layanan: 'Jangka Pendek tanpa HPK', pemohon: 'Kantor Perwakilan OKTA', kategori: 'Badan Internasional', masuk: '25 Sep 2026', tahap: 'Verifikasi Data dan Upload', sla: '3 hari', tone: 'blue', tka: 'Tomás Herrera' },
  { id: 'q4', no: '260900015102', jenis: 'HPK', layanan: 'Pekerjaan Lebih dari 6 bulan', pemohon: 'PT Sulawesi Nikel Smelter', kategori: 'PMA', masuk: '26 Sep 2026', tahap: 'Verifikasi Data dan Upload', sla: '2 hari', tone: 'blue', tka: 'Metallurgist ×3, Furnace Engineer ×2' },
  { id: 'q5', no: '260900012345', jenis: 'HPK', layanan: 'Perpanjangan', pemohon: 'PT Nusantara Baja Presisi', kategori: 'PMA', masuk: '15 Sep 2026', tahap: 'Jadwal Ekspos', sla: 'Ekspos 7 Okt', tone: 'blue', tka: 'QC Engineer ×1, Plant Manager ×1' },
  { id: 'q6', no: 'P-26092106', jenis: 'Pengesahan', layanan: 'Pekerjaan Lebih dari 6 bulan', pemohon: 'PT Nusantara Baja Presisi', kategori: 'PMA', masuk: '21 Sep 2026', tahap: 'Pemeriksaan Koordinator', sla: '1 hari', tone: 'amber', tka: 'Sato Kenji' },
  { id: 'q7', no: 'P-26092011', jenis: 'Pengesahan', layanan: 'Direktur/Komisaris', pemohon: 'PT Cahaya Digital Asia', kategori: 'Start-up', masuk: '20 Sep 2026', tahap: 'Persetujuan Direktur', sla: '1 hari', tone: 'amber', tka: 'Daniel Okafor' },
  { id: 'q8', no: '260900011876', jenis: 'HPK', layanan: 'Pekerjaan Lebih dari 6 bulan', pemohon: 'PT Mitra Kilang Utama', kategori: 'PMDN', masuk: '11 Sep 2026', tahap: 'Pemeriksaan Kasi', sla: '2 hari', tone: 'blue', tka: 'Process Safety Engineer ×2' },
  { id: 'q9', no: '260900010544', jenis: 'HPK', layanan: 'Pekerjaan Lebih dari 6 bulan', pemohon: 'PT Sinar Energi Kalimantan', kategori: 'PMA', masuk: '8 Sep 2026', tahap: 'Pemeriksaan Kasubdit', sla: '1 hari', tone: 'amber', tka: 'Geologist ×2' },
  { id: 'q10', no: '260900010921', jenis: 'HPK', layanan: 'Direktur/Komisaris', pemohon: 'PT Cahaya Digital Asia', kategori: 'Start-up', masuk: '9 Sep 2026', tahap: 'Pemeriksaan dan Penandatanganan Direktur', sla: 'Hari ini', tone: 'red', tka: 'Direktur Utama ×1' },
  { id: 'q11', no: 'C-26090581', jenis: 'Perubahan', layanan: 'Alamat Pemberi Kerja', pemohon: 'PT Nusantara Baja Presisi', kategori: 'PMA', masuk: '22 Sep 2026', tahap: 'Pemeriksaan Petugas', sla: 'Lewat 2 hari', tone: 'red', tka: 'Park Ji-won' },
];

const pendaftar = [
  { nama: 'PT Cahaya Digital Asia', kategori: 'Start-up', jenisPemberiKerja: 'Bukan Penanam Modal', npwp: '0761 2204 4180 1000', tgl: '29 Sep 2026', sso: 'Andi Pratama', status: 'Menunggu verifikasi', tone: 'amber', email: false },
  { nama: 'PT Borneo Hijau Lestari', kategori: 'Penanaman Modal Dalam Negeri (PMDN)', jenisPemberiKerja: 'Penanam Modal', npwp: '0823 5519 0721 7000', tgl: '28 Sep 2026', sso: 'Siti Rahmawati', status: 'Menunggu verifikasi', tone: 'amber', email: false },
  { nama: 'Lembaga Kursus Bahasa Pelita', kategori: 'Lembaga Pendidikan dan Kebudayaan', jenisPemberiKerja: 'Bukan Penanam Modal', npwp: '0911 0034 8830 4000', tgl: '26 Sep 2026', sso: 'Hendra Gunawan', status: 'Perlu perbaikan', tone: 'red', email: false, catatan: 'Dokumen NIB buram dan tidak terbaca; unggah ulang pindaian berwarna.' },
  { nama: 'PT Samudra Offshore Services', kategori: 'Perusahaan Swasta Nasional', jenisPemberiKerja: 'Bukan Penanam Modal', npwp: '0712 6641 2009 3000', tgl: '25 Sep 2026', sso: 'Lina Marlina', status: 'Menunggu verifikasi', tone: 'amber', email: false },
];

const jabatanMaster = [
  { kode: '2141.01', nama: 'Quality Control Engineer', kbji: '2141', status: 'Diperbolehkan', dasar: 'Kepmenaker 228/2019' },
  { kode: '1321.03', nama: 'Plant Manager', kbji: '1321', status: 'Diperbolehkan', dasar: 'Kepmenaker 228/2019' },
  { kode: '3115.02', nama: 'Maintenance Supervisor', kbji: '3115', status: 'Diperbolehkan', dasar: 'Kepmenaker 228/2019' },
  { kode: '2145.04', nama: 'Process Engineer', kbji: '2145', status: 'Diperbolehkan', dasar: 'Kepmenaker 228/2019' },
  { kode: '1120.01', nama: 'Direktur Teknik', kbji: '1120', status: 'Diperbolehkan', dasar: 'Kepmenaker 228/2019' },
  { kode: '1212.01', nama: 'Manajer Personalia', kbji: '1212', status: 'Dilarang', dasar: 'Kepmenaker 349/2019' },
  { kode: '3115.07', nama: 'Welding Inspector', kbji: '3115', status: 'Usulan baru', dasar: 'Tiket HT-2609-0431' },
];

// ===== Data dummy tambahan =====
const T = (nama, negara, paspor, jabatan, barcode, bln, skTgl, mulai, akhir, sisa, lokasi, pre) => ({ nama, negara, paspor, jabatan, barcode, skNo: 'B.3/' + barcode + '/PK.04.01/' + bln, skTgl, mulai, akhir, sisa, bpjs: pre[0], npwp: pre[1], lapor: pre[2], lokasi });
tka.swasta.push(
  T('Tran Quoc Bao', 'Vietnam', 'C8840217', 'Process Engineer', '25118840', 'X/2025', '27 Oktober 2025', '3 November 2025', '12 Oktober 2026', 12, 'KAB. BEKASI', [true, true, true]),
  T('Yamamoto Daisuke', 'Jepang', 'TS5521904', 'Production Planner', '24902211', 'XI/2024', '18 November 2024', '25 November 2024', '28 Oktober 2026', 28, 'KAB. BEKASI', [true, false, false]),
  T('Wang Hao', 'Republik Rakyat Tiongkok', 'EJ7705128', 'Furnace Technician', '25140662', 'XI/2025', '10 November 2025', '17 November 2025', '16 November 2026', 47, 'KAB. KARAWANG', [false, true, true]),
  T('Arjun Nair', 'India', 'Y4471903', 'Electrical Engineer', '25160019', 'XI/2025', '20 November 2025', '27 November 2025', '26 November 2026', 57, 'KAB. BEKASI', [true, true, true]),
  T('Choi Seung-hoon', 'Korea Selatan', 'M72201388', 'Mould Designer', '25231190', 'XII/2025', '8 Desember 2025', '15 Desember 2025', '14 Desember 2026', 75, 'KAB. BEKASI', [true, true, false]),
  T('Somchai Wongsakul', 'Thailand', 'AA9012774', 'Maintenance Planner', '25240551', 'XII/2025', '15 Desember 2025', '22 Desember 2025', '21 Desember 2026', 82, 'KAB. KARAWANG', [true, true, true]),
  T('Marco Bianchi', 'Italia', 'YB0931742', 'Commissioning Engineer', '26012045', 'II/2026', '2 Februari 2026', '9 Februari 2026', '8 Februari 2027', 131, 'KAB. KARAWANG', [true, true, true]),
  T('Suzuki Haruto', 'Jepang', 'TR8834102', 'Quality Assurance Manager', '26020388', 'III/2026', '5 Maret 2026', '12 Maret 2026', '11 Maret 2027', 162, 'KAB. BEKASI', [true, true, true]),
  T('Liu Jian', 'Republik Rakyat Tiongkok', 'EK3309916', 'Rolling Mill Specialist', '26033671', 'V/2026', '4 Mei 2026', '11 Mei 2026', '10 Mei 2027', 222, 'KAB. BEKASI', [true, true, true]),
  T('Pradeep Singh', 'India', 'W8120557', 'Welding Engineer', '26041208', 'VII/2026', '6 Juli 2026', '13 Juli 2026', '12 Juli 2027', 285, 'KAB. KARAWANG', [true, true, true]),
  T('Ahmad Faizal bin Rahman', 'Malaysia', 'A51128834', 'Komisaris', '25009982', 'III/2025', '11 Maret 2025', '17 Maret 2025', '16 Maret 2027', 167, 'KAB. BEKASI', [true, true, true]),
);
tka.lembaga.push(
  T('John Patrick O\'Brien', 'Irlandia', 'PE7701234', 'Rohaniwan', '25201877', 'XI/2025', '24 November 2025', '1 Desember 2025', '30 November 2026', 61, 'KOTA ADM. JAKARTA PUSAT', [true, true, false]),
  T('Anna Kowalska', 'Polandia', 'EA3348821', 'Pekerja Sosial', '26010554', 'I/2026', '19 Januari 2026', '26 Januari 2026', '25 Oktober 2026', 25, 'KOTA ADM. JAKARTA TIMUR', [true, false, true]),
  T('Samuel Okonkwo', 'Nigeria', 'A09812276', 'Konselor Pendidikan', '26022103', 'III/2026', '16 Maret 2026', '23 Maret 2026', '22 Maret 2027', 173, 'KOTA ADM. JAKARTA PUSAT', [true, true, true]),
  T('Grace Tan Mei Ling', 'Singapura', 'K1928374Z', 'Pengajar Musik', '26038816', 'VI/2026', '22 Juni 2026', '29 Juni 2026', '28 Juni 2027', 271, 'KOTA ADM. JAKARTA PUSAT', [true, true, true]),
);
tka.pemerintah.push(
  T('Hannah Schmidt', 'Jerman', 'C01X8T4K2', 'Penasihat Energi Terbarukan', '25170342', 'XI/2025', '26 November 2025', '3 Desember 2025', '2 November 2026', 33, 'KOTA ADM. JAKARTA PUSAT', [true, true, true]),
  T('Pierre Laurent', 'Prancis', '19AB44120', 'Ahli Tata Kelola Air', '25210987', 'XII/2025', '10 Desember 2025', '17 Desember 2025', '16 Desember 2026', 77, 'KOTA BANDUNG', [true, true, true]),
  T('Yuki Nakamura', 'Jepang', 'TK4412099', 'Koordinator Program', '26019932', 'II/2026', '9 Februari 2026', '16 Februari 2026', '15 Februari 2027', 138, 'KOTA ADM. JAKARTA PUSAT', [true, true, true]),
  T('David Kim', 'Amerika Serikat', '568820341', 'Spesialis Monitoring & Evaluasi', '26040177', 'VII/2026', '1 Juli 2026', '8 Juli 2026', '7 Juli 2027', 280, 'KOTA SURABAYA', [true, true, true]),
);

hpk.swasta.push(
  { id: 'h5', layanan: 'Pekerjaan Lebih dari 6 bulan', noPermohonan: '260300014472', barcode: '26001902', tgl: '2 Maret 2026', terbit: '19 Maret 2026', stepIdx: 8, status: 'HPK terbit', tone: 'green',
    jabatan: [{ nama: 'Quality Assurance Manager', kuota: 1, terisi: 1, bulan: 12 }, { nama: 'Rolling Mill Specialist', kuota: 2, terisi: 1, bulan: 12 }, { nama: 'Commissioning Engineer', kuota: 2, terisi: 2, bulan: 12 }], lokasi: 'KAB. BEKASI, KAB. KARAWANG, JAWA BARAT', negara: 'Jepang, RRT, Italia' },
  { id: 'h6', layanan: 'Pekerjaan Lebih dari 6 bulan', noPermohonan: '260800020931', barcode: '—', tgl: '18 Agustus 2026', terbit: '—', stepIdx: 5, status: 'Pemeriksaan Kasi', tone: 'blue',
    jabatan: [{ nama: 'Metallurgical Engineer', kuota: 2, terisi: 0, bulan: 24 }, { nama: 'Automation Engineer', kuota: 1, terisi: 0, bulan: 12 }], lokasi: 'KAB. KARAWANG, JAWA BARAT', negara: 'Jerman, Korea Selatan' },
  { id: 'h7', layanan: 'Pekerjaan Lebih dari 6 bulan', noPermohonan: '260900016650', barcode: '—', tgl: '28 September 2026', terbit: '—', stepIdx: 0, status: 'Draf — belum diproses', tone: 'gray',
    jabatan: [{ nama: 'Hydraulic Specialist', kuota: 1, terisi: 0, bulan: 12 }], lokasi: 'KAB. BEKASI, JAWA BARAT', negara: 'Jepang' },
  { id: 'h8', layanan: 'Sementara (1–6 bulan)', noPermohonan: '260500011093', barcode: '26002760', tgl: '4 Mei 2026', terbit: '18 Mei 2026', stepIdx: 8, status: 'HPK terbit', tone: 'green',
    jabatan: [{ nama: 'Machine Installation Technician', kuota: 3, terisi: 3, bulan: 3 }], lokasi: 'KAB. KARAWANG, JAWA BARAT', negara: 'Jerman' },
  { id: 'h9', layanan: 'Sementara (1–6 bulan)', noPermohonan: '260900015517', barcode: '—', tgl: '26 September 2026', terbit: '—', stepIdx: 1, status: 'Verifikasi Data dan Upload', tone: 'amber',
    jabatan: [{ nama: 'Auditor Mutu Grup', kuota: 1, terisi: 0, bulan: 2 }], lokasi: 'KAB. BEKASI, JAWA BARAT', negara: 'Jepang' },
  { id: 'h10', layanan: 'Direktur/Komisaris', noPermohonan: '260900017002', barcode: '—', tgl: '29 September 2026', terbit: '—', stepIdx: 1, status: 'Verifikasi Data dan Upload', tone: 'amber',
    jabatan: [{ nama: 'Direktur Keuangan', kuota: 1, terisi: 0, bulan: 24 }], lokasi: 'KAB. BEKASI, JAWA BARAT', negara: 'Singapura' },
  { id: 'h11', layanan: 'Perpanjangan', noPermohonan: '260400009921', barcode: '26002214', tgl: '6 April 2026', terbit: '24 April 2026', stepIdx: 8, status: 'HPK terbit', tone: 'green',
    jabatan: [{ nama: 'Maintenance Supervisor', kuota: 1, terisi: 1, bulan: 12 }, { nama: 'Mould Designer', kuota: 1, terisi: 1, bulan: 12 }], lokasi: 'KAB. BEKASI, JAWA BARAT', negara: 'Korea Selatan' },
  { id: 'h12', layanan: 'Perpanjangan', noPermohonan: '260900016021', barcode: '—', tgl: '22 September 2026', terbit: '—', stepIdx: 3, status: 'Pengesahan Ekspos', tone: 'blue',
    jabatan: [{ nama: 'Process Engineer', kuota: 1, terisi: 0, bulan: 12 }, { nama: 'Production Planner', kuota: 1, terisi: 0, bulan: 12 }], lokasi: 'KAB. BEKASI, JAWA BARAT', negara: 'Vietnam, Jepang' },
);
hpk.lembaga.push(
  { id: 'h3', layanan: 'Non DKPTKA', noPermohonan: '260800019220', barcode: '—', tgl: '12 Agustus 2026', terbit: '—', stepIdx: 6, status: 'Pemeriksaan Kasubdit', tone: 'blue', jabatan: [{ nama: 'Konselor Pendidikan', kuota: 1, terisi: 0, bulan: 12 }, { nama: 'Pengajar Musik', kuota: 1, terisi: 0, bulan: 12 }], lokasi: 'KOTA ADM. JAKARTA PUSAT, DKI JAKARTA', negara: 'Singapura, Nigeria' },
  { id: 'h4', layanan: 'Sementara (1–6 bulan)', noPermohonan: '260700018117', barcode: '26003981', tgl: '8 Juli 2026', terbit: '21 Juli 2026', stepIdx: 8, status: 'HPK terbit', tone: 'green', jabatan: [{ nama: 'Pelatih Relawan Kebencanaan', kuota: 2, terisi: 2, bulan: 3 }], lokasi: 'KOTA MATARAM, NUSA TENGGARA BARAT', negara: 'Jepang' },
  { id: 'h5', layanan: 'Pekerjaan Lebih dari 6 bulan', noPermohonan: '260900016390', barcode: '—', tgl: '25 September 2026', terbit: '—', stepIdx: 1, status: 'Data atau dokumen belum lengkap, belum bisa diproses', tone: 'red', catatan: 'Bagan struktur organisasi belum diunggah.', jabatan: [{ nama: 'Pekerja Sosial', kuota: 1, terisi: 0, bulan: 12 }], lokasi: 'KOTA ADM. JAKARTA TIMUR, DKI JAKARTA', negara: 'Polandia' },
  { id: 'h6', layanan: 'Perpanjangan Non DKPTKA', noPermohonan: '251100030417', barcode: '25003345', tgl: '3 November 2025', terbit: '20 November 2025', stepIdx: 8, status: 'HPK terbit', tone: 'green', jabatan: [{ nama: 'Rohaniwan', kuota: 2, terisi: 2, bulan: 12 }], lokasi: 'KOTA ADM. JAKARTA PUSAT, DKI JAKARTA', negara: 'Italia, Irlandia' },
);

pengesahan.swasta.push(
  { id: 'p5', hpk: 'h5', nama: 'Suzuki Haruto', negara: 'Jepang', paspor: 'TR8834102', jabatan: 'Quality Assurance Manager', jenis: 'Baru', bulan: 12, tgl: '23 Februari 2026', stepIdx: 6, status: 'Terbit · terkirim ke Imigrasi', tone: 'green', billing: 'b5', imigrasi: true, barcode: '26020388' },
  { id: 'p6', hpk: 'h5', nama: 'Liu Jian', negara: 'Republik Rakyat Tiongkok', paspor: 'EK3309916', jabatan: 'Rolling Mill Specialist', jenis: 'Baru', bulan: 12, tgl: '22 April 2026', stepIdx: 6, status: 'Terbit · terkirim ke Imigrasi', tone: 'green', billing: 'b6', imigrasi: true, barcode: '26033671' },
  { id: 'p7', hpk: 'h5', nama: 'Marco Bianchi', negara: 'Italia', paspor: 'YB0931742', jabatan: 'Commissioning Engineer', jenis: 'Baru', bulan: 12, tgl: '26 Januari 2026', stepIdx: 6, status: 'Terbit · terkirim ke Imigrasi', tone: 'green', billing: 'b7', imigrasi: true, barcode: '26012045' },
  { id: 'p8', hpk: 'h5', nama: 'Giulia Romano', negara: 'Italia', paspor: 'YC2203881', jabatan: 'Commissioning Engineer', jenis: 'Pemegang Izin Tinggal', permit: '2C11JE7714-AR', bulan: 12, tgl: '24 September 2026', stepIdx: 1, status: 'Verifikasi Data dan Upload', tone: 'amber', imigrasi: false },
  { id: 'p9', hpk: 'h8', nama: 'Felix Wagner', negara: 'Jerman', paspor: 'C77H1K2P9', jabatan: 'Machine Installation Technician', jenis: 'Baru', bulan: 3, tgl: '20 Mei 2026', stepIdx: 6, status: 'Terbit · terkirim ke Imigrasi', tone: 'green', billing: 'b8', imigrasi: true, barcode: '26028810' },
  { id: 'p10', hpk: 'h8', nama: 'Jonas Fischer', negara: 'Jerman', paspor: 'C77H3M4R1', jabatan: 'Machine Installation Technician', jenis: 'Baru', bulan: 3, tgl: '20 Mei 2026', stepIdx: 6, status: 'Terbit · terkirim ke Imigrasi', tone: 'green', billing: 'b9', imigrasi: true, barcode: '26028811' },
  { id: 'p11', hpk: 'h8', nama: 'Tobias Braun', negara: 'Jerman', paspor: 'C77H5N6S3', jabatan: 'Machine Installation Technician', jenis: 'Baru', bulan: 3, tgl: '21 Mei 2026', stepIdx: 4, status: 'Persetujuan Direktur', tone: 'blue', imigrasi: false },
  { id: 'p12', hpk: 'h11', nama: 'Park Ji-won', negara: 'Korea Selatan', paspor: 'M58204417', jabatan: 'Maintenance Supervisor', jenis: 'Perpanjangan', bulan: 12, tgl: '28 April 2026', stepIdx: 2, status: 'Pemeriksaan Subkoordinator', tone: 'blue', imigrasi: false },
  { id: 'p13', hpk: 'h11', nama: 'Choi Seung-hoon', negara: 'Korea Selatan', paspor: 'M72201388', jabatan: 'Mould Designer', jenis: 'Perpanjangan', bulan: 12, tgl: '28 April 2026', stepIdx: 1, status: 'Data TKA belum lengkap — BPJS belum aktif', tone: 'red', imigrasi: false },
);
pengesahan.lembaga.push(
  { id: 'p2', hpk: 'h4', nama: 'Kaori Fujita', negara: 'Jepang', paspor: 'TZ7741820', jabatan: 'Pelatih Relawan Kebencanaan', jenis: 'Baru', bulan: 3, tgl: '23 Juli 2026', stepIdx: 6, status: 'Terbit · terkirim ke Imigrasi', tone: 'green', imigrasi: true, barcode: '26039012' },
  { id: 'p3', hpk: 'h4', nama: 'Ren Takahashi', negara: 'Jepang', paspor: 'TZ7741821', jabatan: 'Pelatih Relawan Kebencanaan', jenis: 'Baru', bulan: 3, tgl: '23 Juli 2026', stepIdx: 6, status: 'Terbit · terkirim ke Imigrasi', tone: 'green', imigrasi: true, barcode: '26039013' },
  { id: 'p4', hpk: 'h1', nama: 'Rosa Delgado', negara: 'Filipina', paspor: 'P8812047C', jabatan: 'Pengajar Bahasa Inggris', jenis: 'Baru', bulan: 12, tgl: '21 September 2026', stepIdx: 3, status: 'Pemeriksaan Koordinator', tone: 'blue', imigrasi: false },
  { id: 'p5', hpk: 'h6', nama: 'John Patrick O\'Brien', negara: 'Irlandia', paspor: 'PE7701234', jabatan: 'Rohaniwan', jenis: 'Perpanjangan', bulan: 12, tgl: '24 November 2025', stepIdx: 6, status: 'Terbit · terkirim ke Imigrasi', tone: 'green', imigrasi: true, barcode: '25201877' },
);
pengesahan.pemerintah.push(
  { id: 'p4', hpk: null, layanan: 'Baru (lebih dari 6 bulan)', nama: 'Yuki Nakamura', negara: 'Jepang', paspor: 'TK4412099', jabatan: 'Koordinator Program', jenis: 'Baru', bulan: 12, tgl: '2 Februari 2026', stepIdx: 6, status: 'Terbit · terkirim ke Imigrasi', tone: 'green', imigrasi: true, barcode: '26019932' },
  { id: 'p5', hpk: null, layanan: 'Baru (lebih dari 6 bulan)', nama: 'David Kim', negara: 'Amerika Serikat', paspor: '568820341', jabatan: 'Spesialis Monitoring & Evaluasi', jenis: 'Baru', bulan: 12, tgl: '22 Juni 2026', stepIdx: 6, status: 'Terbit · terkirim ke Imigrasi', tone: 'green', imigrasi: true, barcode: '26040177' },
  { id: 'p6', hpk: null, layanan: 'Baru (lebih dari 6 bulan)', nama: 'Amara Diallo', negara: 'Senegal', paspor: 'A03318842', jabatan: 'Ahli Gizi Masyarakat', jenis: 'Baru', bulan: 12, tgl: '23 September 2026', stepIdx: 2, status: 'Pemeriksaan Subkoordinator', tone: 'blue', imigrasi: false },
  { id: 'p7', hpk: null, layanan: 'Jangka Pendek (1–6 bulan)', nama: 'Lars Andersen', negara: 'Denmark', paspor: '210987443', jabatan: 'Narasumber Lokakarya Iklim', jenis: 'Baru', bulan: 1, tgl: '1 Juli 2026', stepIdx: 6, status: 'Terbit · terkirim ke Imigrasi', tone: 'green', imigrasi: true, barcode: '26040902' },
  { id: 'p8', hpk: null, layanan: 'Jangka Pendek (1–6 bulan)', nama: 'Mei Chen', negara: 'Taiwan', paspor: '311904728', jabatan: 'Evaluator Program', jenis: 'Baru', bulan: 2, tgl: '28 September 2026', stepIdx: 1, status: 'Data atau dokumen belum lengkap', tone: 'red', imigrasi: false },
  { id: 'p9', hpk: null, layanan: 'Perpanjangan', nama: 'Hannah Schmidt', negara: 'Jerman', paspor: 'C01X8T4K2', jabatan: 'Penasihat Energi Terbarukan', jenis: 'Perpanjangan', bulan: 12, tgl: '26 September 2026', stepIdx: 1, status: 'Verifikasi Data dan Upload', tone: 'amber', imigrasi: false },
);

const B = (id, kode, ntpn, t, bulan, terbit, batas, bayar, bank, status, tone) => ({ id, kode, ntpn, tka: t[0], paspor: t[1], jabatan: t[2], bulan, rupiah: bulan * 1500000, terbit, batas, bayar, bank, status, tone, jenis: 'PNBP' });
billing.swasta.push(
  B('b5', '820260225101882', 'K2L3M4N5P6Q7R8S9', ['Suzuki Haruto', 'TR8834102', 'Quality Assurance Manager'], 12, '25 Februari 2026', '4 Maret 2026', '2 Maret 2026', 'BRI', 'Lunas', 'green'),
  B('b6', '820260424130551', 'Z1X2C3V4B5N6M7L8', ['Liu Jian', 'EK3309916', 'Rolling Mill Specialist'], 12, '24 April 2026', '4 Mei 2026', '29 April 2026', 'Bank Mandiri', 'Lunas', 'green'),
  B('b7', '820260128094417', 'H7G6F5D4S3A2P1O0', ['Marco Bianchi', 'YB0931742', 'Commissioning Engineer'], 12, '28 Januari 2026', '4 Februari 2026', '30 Januari 2026', 'BNI', 'Lunas', 'green'),
  B('b8', '820260522110934', 'R4T5Y6U7I8O9P0A1', ['Felix Wagner', 'C77H1K2P9', 'Machine Installation Technician'], 3, '22 Mei 2026', '29 Mei 2026', '26 Mei 2026', 'Bank Mandiri', 'Lunas', 'green'),
  B('b9', '820260522110935', 'R4T5Y6U7I8O9P0A2', ['Jonas Fischer', 'C77H3M4R1', 'Machine Installation Technician'], 3, '22 Mei 2026', '29 Mei 2026', '26 Mei 2026', 'Bank Mandiri', 'Lunas', 'green'),
  B('b10', '820260929153306', '—', ['Tobias Braun', 'C77H5N6S3', 'Machine Installation Technician'], 3, '29 September 2026', '6 Oktober 2026', null, null, 'Belum dibayar', 'amber'),
  B('b11', '820251103082210', 'W1E2R3T4Y5U6I7O8', ['Chen Wei', 'EH4471028', 'Quality Control Engineer'], 12, '17 Oktober 2025', '24 Oktober 2025', '21 Oktober 2025', 'BNI', 'Lunas', 'green'),
  B('b12', '820241111140017', 'M9N8B7V6C5X4Z3L2', ['Hiroshi Tanaka', 'TR1234567', 'Plant Manager'], 24, '11 November 2024', '18 November 2024', '13 November 2024', 'BRI', 'Lunas', 'green'),
);

ekspos.swasta.push(
  { hpk: 'h12', tgl: 'Kamis, 8 Oktober 2026', jam: '13.00 – 13.30 WIB', antrian: 22, layanan: 'Perpanjangan', media: 'Telewicara (tautan dikirim H-1 ke email akun)' },
  { hpk: 'h6', tgl: 'Senin, 12 Oktober 2026', jam: '10.00 – 10.45 WIB', antrian: 7, layanan: 'Pekerjaan Lebih dari 6 bulan', media: 'Telewicara · ekspos ulang atas permintaan Kasi' },
);
ekspos.lembaga.push({ hpk: 'h3', tgl: 'Jumat, 9 Oktober 2026', jam: '10.30 – 11.00 WIB', antrian: 21, layanan: 'Non DKPTKA', media: 'Telewicara (tautan dikirim H-1 ke email akun)' });

const C = (id, barcode, t, jenis, detail, dok, pengurus, statusId, semula, menjadi, surat, suratTgl, extra) => ({ id, barcode, skBarcode: t.barcode, skNo: t.skNo, skTgl: t.skTgl, nama: t.nama, paspor: t.paspor, jabatan: t.jabatan, jenis, detail, dok, pengurus, statusId,
  status: { 1: 'Draf', 2: 'Diajukan', 3: 'Pemeriksaan Petugas', 6: 'Terbit', 9: 'Dibatalkan' }[statusId], tone: { 1: 'gray', 2: 'blue', 3: 'blue', 6: 'green', 9: 'red' }[statusId], semula, menjadi, surat, suratTgl, ...(extra || {}) });
const ts = tka.swasta, tl = tka.lembaga, tp = tka.pemerintah;
perubahan.swasta.push(
  C('c4', '26085512', ts[4], 'Data Tenaga Kerja Asing', 'Data Alamat', true, true, 6, 'Jl. Kemang Raya No. 12, Jakarta Selatan', 'Apartemen Casa Grande Tower B/1802, Jakarta Selatan', '036/NBP-HRD/VIII/2026', '12 Agustus 2026', { sk: 'B.3/26085512/PK.04.02/VIII/2026', skTerbit: '17 Agustus 2026' }),
  C('c5', '26080917', ts[7], 'Lokasi Kerja', '+ KAB. BEKASI', true, true, 6, 'KAB. KARAWANG, JAWA BARAT', 'KAB. KARAWANG, JAWA BARAT; KAB. BEKASI, JAWA BARAT', '031/NBP-HRD/VIII/2026', '3 Agustus 2026', { sk: 'B.3/26080917/PK.04.02/VIII/2026', skTerbit: '6 Agustus 2026' }),
  C('c6', '26092733', ts[9], 'Data Tenaga Kerja Asing', 'Data Nama', true, false, 1, 'Wang Hao', 'Wang Haoran', '049/NBP-HRD/IX/2026', '29 September 2026'),
  C('c7', '26092208', ts[6], 'Data Tenaga Kerja Asing', 'Data Kelahiran', true, true, 2, 'Seoul, 14 Maret 1986', 'Seoul, 14 Maret 1985', '044/NBP-HRD/IX/2026', '25 September 2026'),
  C('c8', '26071140', ts[3], 'Lokasi Kerja', '+ KOTA CILEGON', true, true, 9, 'KAB. BEKASI, JAWA BARAT', 'KAB. BEKASI, JAWA BARAT; KOTA CILEGON, BANTEN', '028/NBP-HRD/VII/2026', '14 Juli 2026'),
);
perubahan.lembaga.push(
  C('c1', '26090344', tl[0], 'Alamat Pemberi Kerja', 'Pindah kantor sekretariat', false, true, 1, 'Jl. Kramat Raya No. 65, Jakarta Pusat', 'Jl. Salemba Raya No. 24, Jakarta Pusat', '112/YPKN/IX/2026', '27 September 2026'),
  C('c2', '26061208', tl[1], 'Data Tenaga Kerja Asing', 'Data Paspor', true, true, 6, 'P7730215B · Filipina', 'P9901744C · Filipina', '087/YPKN/VI/2026', '15 Juni 2026', { sk: 'B.3/26061208/PK.04.02/VI/2026', skTerbit: '18 Juni 2026' }),
);
perubahan.pemerintah.push(
  C('c1', '26091877', tp[1], 'Lokasi Kerja', '+ KOTA BANDUNG', true, true, 3, 'KOTA ADM. JAKARTA PUSAT, DKI JAKARTA', 'KOTA ADM. JAKARTA PUSAT, DKI JAKARTA; KOTA BANDUNG, JAWA BARAT', 'OKTA/JKT/2026/0419', '21 September 2026'),
  C('c2', '26072290', tp[0], 'Data Tenaga Kerja Asing', 'Data Alamat', true, true, 6, 'Jl. Cikini Raya No. 4, Jakarta Pusat', 'Jl. Teuku Umar No. 18, Jakarta Pusat', 'OKTA/JKT/2026/0301', '6 Juli 2026', { sk: 'B.3/26072290/PK.04.02/VII/2026', skTerbit: '9 Juli 2026' }),
);

laporanPenggunaan.push(
  { nama: 'Tran Quoc Bao', paspor: 'C8840217', jabatan: 'Process Engineer', sk: '25118840', pendamping: 'Fikri Hidayat', mulai: '3 November 2025', akhir: '12 Oktober 2026', lokasi: 'KAB. BEKASI' },
  { nama: 'Yamamoto Daisuke', paspor: 'TS5521904', jabatan: 'Production Planner', sk: '24902211', pendamping: 'Wulan Sari', mulai: '25 November 2024', akhir: '28 Oktober 2026', lokasi: 'KAB. BEKASI' },
  { nama: 'Wang Hao', paspor: 'EJ7705128', jabatan: 'Furnace Technician', sk: '25140662', pendamping: 'Joko Susilo', mulai: '17 November 2025', akhir: '16 November 2026', lokasi: 'KAB. KARAWANG' },
  { nama: 'Arjun Nair', paspor: 'Y4471903', jabatan: 'Electrical Engineer', sk: '25160019', pendamping: 'Reza Maulana', mulai: '27 November 2025', akhir: '26 November 2026', lokasi: 'KAB. BEKASI' },
  { nama: 'Choi Seung-hoon', paspor: 'M72201388', jabatan: 'Mould Designer', sk: '25231190', pendamping: 'Taufik Hidayat', mulai: '15 Desember 2025', akhir: '14 Desember 2026', lokasi: 'KAB. BEKASI' },
  { nama: 'Somchai Wongsakul', paspor: 'AA9012774', jabatan: 'Maintenance Planner', sk: '25240551', pendamping: 'Andi Saputra', mulai: '22 Desember 2025', akhir: '21 Desember 2026', lokasi: 'KAB. KARAWANG' },
  { nama: 'Ahmad Faizal bin Rahman', paspor: 'A51128834', jabatan: 'Komisaris', sk: '25009982', pendamping: 'Hendra Kusuma', mulai: '17 Maret 2025', akhir: '16 Maret 2027', lokasi: 'KAB. BEKASI' },
);
laporan.swasta.rows[0].n = laporanPenggunaan.length; laporan.swasta.rows[2] = { n: 6, upd: '29 September 2026, 16.05' };

tiket.push(
  { no: 'HT-2609-0409', kategori: 'Revisi masa berlaku', judul: 'Masa berlaku SK Marco Bianchi tidak sesuai tanda masuk', tgl: '27 September 2026, 09.33', status: 'Selesai', tone: 'green', agen: 'Dedi S.', perusahaan: 'PT Nusantara Baja Presisi' },
  { no: 'HT-2609-0398', kategori: 'Penambahan Lokasi', judul: 'Tambah lokasi Kab. Karawang untuk Suzuki Haruto', tgl: '26 September 2026, 14.12', status: 'Selesai', tone: 'green', agen: 'Ayu P.', perusahaan: 'PT Nusantara Baja Presisi' },
  { no: 'HT-2609-0433', kategori: 'Update NPWP', judul: 'NPWP TKA Yamamoto Daisuke belum tersinkron', tgl: '30 September 2026, 09.20', status: 'Baru', tone: 'amber', perusahaan: 'PT Nusantara Baja Presisi' },
  { no: 'HT-2609-0432', kategori: 'Upload ulang foto TKA', judul: 'Foto paspor Amara Diallo buram', tgl: '30 September 2026, 08.52', status: 'Baru', tone: 'amber', perusahaan: 'Kantor Perwakilan OKTA' },
  { no: 'HT-2609-0430', kategori: 'Username dan Password', judul: 'Akun terkunci setelah 5 kali salah password', tgl: '30 September 2026, 07.58', status: 'Baru', tone: 'amber', perusahaan: 'PT Borneo Hijau Lestari' },
  { no: 'HT-2609-0427', kategori: 'Revisi masa berlaku', judul: 'Masa berlaku HPK tertulis 6 bulan, seharusnya 12', tgl: '29 September 2026, 17.10', status: 'Diproses', tone: 'blue', agen: 'Dedi S.', perusahaan: 'PT Mitra Kilang Utama', lock: 'Dedi S.' },
  { no: 'HT-2609-0424', kategori: 'Pembatalan HPK', judul: 'Batalkan permohonan HPK 260900016650 (duplikat)', tgl: '29 September 2026, 15.44', status: 'Diproses', tone: 'blue', agen: 'Ayu P.', perusahaan: 'PT Nusantara Baja Presisi', lock: 'Ayu P.' },
  { no: 'HT-2609-0419', kategori: 'Jabatan tidak tersedia', judul: 'Jabatan "Drone Pilot Instructor" belum ada', tgl: '29 September 2026, 10.40', status: 'Selesai', tone: 'green', agen: 'Maya L.', perusahaan: 'PT Cahaya Digital Asia' },
  { no: 'HT-2609-0412', kategori: 'Penonaktifan akun', judul: 'Nonaktifkan akun lama pasca merger', tgl: '28 September 2026, 09.01', status: 'Selesai', tone: 'green', agen: 'Fajar N.', perusahaan: 'PT Sinar Energi Kalimantan' },
  { no: 'HT-2609-0405', kategori: 'SK Perubahan', judul: 'SK Perubahan belum bisa dicetak', tgl: '27 September 2026, 13.27', status: 'Selesai', tone: 'green', agen: 'Maya L.', perusahaan: 'Yayasan Pelayanan Kasih Nusantara' },
);

pengumuman.push(
  { tgl: '15 September 2026', tag: 'Pemeliharaan', judul: 'Pemeliharaan sistem Sabtu, 3 Oktober 2026 pukul 22.00–02.00 WIB', isi: 'Selama pemeliharaan, pengajuan dan pembayaran tidak dapat diproses. Kode billing yang jatuh tempo pada periode tersebut diperpanjang otomatis 1 hari kerja.' },
  { tgl: '1 Agustus 2026', tag: 'Pelaporan', judul: 'Batas pengiriman Laporan TKA Periode 2025: 31 Oktober 2026', isi: 'Pemberi kerja yang belum mengirim laporan akan mendapat pengingat di dasbor dan dapat dikenai sanksi administratif.' },
  { tgl: '10 Juni 2026', tag: 'Layanan', judul: 'Layanan KEK dan IKN kini dalam satu menu', isi: 'Pengajuan Pengesahan RPTKA di Kawasan Ekonomi Khusus dan Ibu Kota Nusantara dapat diakses melalui menu Pengesahan RPTKA dengan penanda kawasan.' },
);

antrian.push(
  { id: 'q12', no: '260900016390', jenis: 'HPK', layanan: 'Pekerjaan Lebih dari 6 bulan', pemohon: 'Yayasan Pelayanan Kasih Nusantara', kategori: 'Lembaga Keagamaan', masuk: '25 Sep 2026', tahap: 'Verifikasi Data dan Upload', sla: 'Dikembalikan', tone: 'red', tka: 'Pekerja Sosial ×1' },
  { id: 'q13', no: '260900017002', jenis: 'HPK', layanan: 'Direktur/Komisaris', pemohon: 'PT Nusantara Baja Presisi', kategori: 'PMA', masuk: '29 Sep 2026', tahap: 'Verifikasi Data dan Upload', sla: '1 hari', tone: 'blue', tka: 'Direktur Keuangan ×1' },
  { id: 'q14', no: 'P-26092411', jenis: 'Pengesahan', layanan: 'Pekerjaan Lebih dari 6 bulan', pemohon: 'PT Nusantara Baja Presisi', kategori: 'PMA', masuk: '24 Sep 2026', tahap: 'Verifikasi Data dan Upload', sla: '2 hari', tone: 'amber', tka: 'Giulia Romano' },
  { id: 'q15', no: 'P-26092612', jenis: 'Pengesahan', layanan: 'Perpanjangan tanpa HPK', pemohon: 'Kantor Perwakilan OKTA', kategori: 'Badan Internasional', masuk: '26 Sep 2026', tahap: 'Verifikasi Data dan Upload', sla: '3 hari', tone: 'blue', tka: 'Hannah Schmidt' },
  { id: 'q16', no: '260900014881', jenis: 'HPK', layanan: 'Sementara (1–6 bulan)', pemohon: 'PT Borneo Hijau Lestari', kategori: 'PMDN', masuk: '23 Sep 2026', tahap: 'Jadwal Ekspos', sla: 'Ekspos 5 Okt', tone: 'blue', tka: 'Drilling Supervisor ×2' },
  { id: 'q17', no: '260900016021', jenis: 'HPK', layanan: 'Perpanjangan', pemohon: 'PT Nusantara Baja Presisi', kategori: 'PMA', masuk: '22 Sep 2026', tahap: 'Jadwal Ekspos', sla: 'Ekspos 8 Okt', tone: 'blue', tka: 'Process Engineer ×1, Production Planner ×1' },
  { id: 'q18', no: '260800020931', jenis: 'HPK', layanan: 'Pekerjaan Lebih dari 6 bulan', pemohon: 'PT Nusantara Baja Presisi', kategori: 'PMA', masuk: '18 Agu 2026', tahap: 'Pemeriksaan Kasi', sla: 'Lewat 3 hari', tone: 'red', tka: 'Metallurgical Engineer ×2, Automation Engineer ×1' },
  { id: 'q19', no: 'P-26092303', jenis: 'Pengesahan', layanan: 'Baru tanpa HPK', pemohon: 'Kantor Perwakilan OKTA', kategori: 'Badan Internasional', masuk: '23 Sep 2026', tahap: 'Pemeriksaan Subkoordinator', sla: '1 hari', tone: 'amber', tka: 'Amara Diallo' },
  { id: 'q20', no: 'P-26042807', jenis: 'Pengesahan', layanan: 'Perpanjangan', pemohon: 'PT Nusantara Baja Presisi', kategori: 'PMA', masuk: '28 Apr 2026', tahap: 'Pemeriksaan Subkoordinator', sla: '2 hari', tone: 'blue', tka: 'Park Ji-won' },
  { id: 'q21', no: '260800019220', jenis: 'HPK', layanan: 'Non DKPTKA', pemohon: 'Yayasan Pelayanan Kasih Nusantara', kategori: 'Lembaga Keagamaan', masuk: '12 Agu 2026', tahap: 'Pemeriksaan Kasubdit', sla: '1 hari', tone: 'amber', tka: 'Konselor Pendidikan ×1, Pengajar Musik ×1' },
  { id: 'q22', no: 'P-26092104', jenis: 'Pengesahan', layanan: 'Non DKPTKA', pemohon: 'Yayasan Pelayanan Kasih Nusantara', kategori: 'Lembaga Keagamaan', masuk: '21 Sep 2026', tahap: 'Pemeriksaan Koordinator', sla: '1 hari', tone: 'amber', tka: 'Rosa Delgado' },
  { id: 'q23', no: 'P-26052113', jenis: 'Pengesahan', layanan: 'Sementara (1–6 bulan)', pemohon: 'PT Nusantara Baja Presisi', kategori: 'PMA', masuk: '21 Mei 2026', tahap: 'Persetujuan Direktur', sla: 'Hari ini', tone: 'red', tka: 'Tobias Braun' },
  { id: 'q24', no: '260900011502', jenis: 'HPK', layanan: 'Perpanjangan', pemohon: 'PT Sulawesi Nikel Smelter', kategori: 'PMA', masuk: '10 Sep 2026', tahap: 'Pemeriksaan dan Penandatanganan Direktur', sla: '1 hari', tone: 'amber', tka: 'Smelter Engineer ×4' },
  { id: 'q25', no: 'C-26092208', jenis: 'Perubahan', layanan: 'Data Tenaga Kerja Asing', pemohon: 'PT Nusantara Baja Presisi', kategori: 'PMA', masuk: '25 Sep 2026', tahap: 'Pemeriksaan Petugas', sla: '1 hari', tone: 'amber', tka: 'Choi Seung-hoon' },
  { id: 'q26', no: 'C-26091877', jenis: 'Perubahan', layanan: 'Lokasi Kerja', pemohon: 'Kantor Perwakilan OKTA', kategori: 'Badan Internasional', masuk: '21 Sep 2026', tahap: 'Pemeriksaan Petugas', sla: 'Lewat 1 hari', tone: 'red', tka: 'Pierre Laurent' },
);

pendaftar.push(
  { nama: 'Yayasan Harapan Anak Bangsa', kategori: 'Lembaga Sosial', npwp: '0845 1120 7734 2000', tgl: '27 Sep 2026', sso: 'Maria Ulfa', status: 'Menunggu verifikasi', tone: 'amber', email: true },
  { nama: 'Kedutaan Besar Republik Estonia', kategori: 'Perwakilan Negara Asing', npwp: '—', tgl: '27 Sep 2026', sso: 'Kadri Tamm', status: 'Menunggu verifikasi', tone: 'amber', email: true },
  { nama: 'PT Vokasi Teknik Mandiri', kategori: 'Vokasi', npwp: '0932 4418 5521 6000', tgl: '24 Sep 2026', sso: 'Bagus Wicaksono', status: 'Aktif', tone: 'green', email: true },
  { nama: 'Kamar Dagang Jerman-Indonesia', kategori: 'Kamar Dagang', npwp: '0188 2231 0045 9000', tgl: '23 Sep 2026', sso: 'Nadia Putri', status: 'Aktif', tone: 'green', email: true },
  { nama: 'PT Arunika Kreatif Studio', kategori: 'Penanaman Modal Asing (PMA)', npwp: '0977 3310 2284 1000', tgl: '22 Sep 2026', sso: 'Kevin Halim', status: 'Ditolak — NPWP sudah terdaftar', tone: 'red', email: true },
  { nama: 'Kantor Berita Pacific Wire', kategori: 'Kantor Berita Asing Swasta', npwp: '0661 7720 1193 5000', tgl: '21 Sep 2026', sso: 'Laura Simanjuntak', status: 'Perlu perbaikan', tone: 'red', email: true },
  { nama: 'PT Nusantara Baja Presisi', kategori: 'Perusahaan dengan modal asing', npwp: '0045 6677 8899 1000', tgl: '15 Sep 2026', sso: 'Rina Wulandari', status: 'Aktif', tone: 'green', email: true, operatorEmails: ['hrd@nusantarabaja.co.id'] },
  { nama: 'Yayasan Pelayanan Kasih Nusantara', kategori: 'Lembaga Keagamaan', npwp: '0098 7654 3202 7000', tgl: '12 Sep 2026', sso: 'Yohanes Sitompul', status: 'Aktif', tone: 'green', email: true, operatorEmails: ['sekretariat@ypkn.or.id'] },
  { nama: 'Kantor Perwakilan Organisasi Kerja Sama Teknik Asia (OKTA)', kategori: 'Badan Internasional', npwp: '—', tgl: '10 Sep 2026', sso: 'Dewi Anggraini', status: 'Aktif', tone: 'green', email: true, operatorEmails: ['admin.jakarta@okta-asia.org'] },
);

jabatanMaster.push(
  { kode: '2141.07', nama: 'Quality Assurance Manager', kbji: '2141', status: 'Diperbolehkan', dasar: 'Kepmenaker 228/2019' },
  { kode: '2144.02', nama: 'Mould Designer', kbji: '2144', status: 'Diperbolehkan', dasar: 'Kepmenaker 228/2019' },
  { kode: '2151.03', nama: 'Electrical Engineer', kbji: '2151', status: 'Diperbolehkan', dasar: 'Kepmenaker 228/2019' },
  { kode: '3135.01', nama: 'Rolling Mill Specialist', kbji: '3135', status: 'Diperbolehkan', dasar: 'Kepmenaker 228/2019' },
  { kode: '1120.04', nama: 'Direktur Keuangan', kbji: '1120', status: 'Diperbolehkan', dasar: 'Kepmenaker 228/2019' },
  { kode: '2634.02', nama: 'Rohaniwan', kbji: '2634', status: 'Diperbolehkan', dasar: 'Kepmenaker 228/2019' },
  { kode: '1212.03', nama: 'Kepala Bagian Rekrutmen', kbji: '1212', status: 'Dilarang', dasar: 'Kepmenaker 349/2019' },
  { kode: '2423.05', nama: 'Spesialis Hubungan Industrial', kbji: '2423', status: 'Dilarang', dasar: 'Kepmenaker 349/2019' },
  { kode: '3153.09', nama: 'Drone Pilot Instructor', kbji: '3153', status: 'Usulan baru', dasar: 'Tiket HT-2609-0419' },
);

// Pengajuan Pencabutan RPTKA TIDAK diseed statis (beda dari koleksi legacy
// lain di file ini) — baris di sini tidak punya `id`/`role`/`noPermohonan`
// dkk. yang dipakai alur dinamis sungguhan (`routes/pencabutan.js`,
// `pengajuan-verifikasi.js`, `pencabutan-validasi.js`, `pencabutan-direktur.js`),
// jadi tampil di tabel tanpa tombol aksi apa pun (baris "mati") dan
// membingungkan — dikosongkan atas permintaan user. Tabel Pencabutan RPTKA
// (portal maupun Verifikator/Validator/Direktur) sekarang HANYA berisi
// pengajuan nyata yang dibuat lewat alur dinamis (`POST /pencabutan`).
const pencabutan = [];

// ===== Generator data massal (deterministik) — untuk tabel panjang & pagination =====
let seed = 7;
const setSeed = s => { seed = 7; for (const ch of String(s)) seed = (seed * 31 + ch.charCodeAt(0)) % 2147483647; if (seed <= 0) seed += 2147483646; };
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const pick = a => a[Math.floor(rnd() * a.length)];
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const MON = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const ROM = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
const NAT = [
  ['Jepang', 'T', ['Takeshi','Kaito','Ren','Haruki','Sota','Yuto','Aoi','Sakura','Mei','Riku'], ['Mori','Ueda','Kobayashi','Inoue','Kimura','Hayashi','Shimizu','Matsumoto','Ogawa','Fujii']],
  ['Republik Rakyat Tiongkok', 'E', ['Zhang','Li','Wang','Zhao','Huang','Zhou','Wu','Xu','Sun','Ma'], ['Wei','Lei','Jun','Yong','Ming','Tao','Bo','Hui','Qiang','Fang']],
  ['Korea Selatan', 'M', ['Kim','Lee','Park','Jung','Kang','Cho','Yoon','Jang','Lim','Han'], ['Min-ho','Ji-hoon','Seo-yeon','Hyun-woo','Da-eun','Sung-min','Eun-ji','Tae-yang','Joon-young','Ha-neul']],
  ['India', 'Z', ['Rohan','Vikram','Anil','Suresh','Kavya','Priya','Rahul','Deepak','Sanjay','Neha'], ['Sharma','Patel','Reddy','Iyer','Gupta','Menon','Rao','Joshi','Das','Pillai']],
  ['Vietnam', 'C', ['Nguyen','Tran','Le','Pham','Hoang','Vu','Dang','Bui','Do','Ngo'], ['Van An','Minh Duc','Thi Hoa','Quang Huy','Thanh Tung','Hoang Nam','Thi Mai','Duc Anh','Van Long','Thu Trang']],
  ['Jerman', 'C', ['Lukas','Maximilian','Felix','Paul','Leon','Anna','Lena','Sophie','Jonas','Emma'], ['Müller','Schneider','Weber','Wagner','Becker','Hoffmann','Koch','Richter','Klein','Wolf']],
  ['Filipina', 'P', ['Jose','Maria','Juan','Angelica','Mark','Kristine','Paolo','Jasmine','Carlo','Bea'], ['Reyes','Cruz','Bautista','Garcia','Mendoza','Villanueva','Ramos','Aquino','Castillo','Flores']],
  ['Malaysia', 'A', ['Muhammad','Nur','Siti','Ahmad','Farid','Aisyah','Hafiz','Zulkifli','Amirah','Irfan'], ['bin Ismail','binti Yusof','bin Hassan','binti Omar','bin Abdullah','bin Kamal','binti Rahim','bin Salleh','binti Aziz','bin Harun']],
  ['Australia', 'P', ['Jack','Oliver','Charlotte','Mia','Thomas','Chloe','James','Ruby','Liam','Grace'], ['Smith','Jones','Williams','Brown','Taylor','Wilson','Martin','Anderson','Clarke','Walker']],
  ['Thailand', 'A', ['Somchai','Anong','Kittisak','Nattaya','Prasert','Siriporn','Chaiwat','Malee','Wichai','Ratana'], ['Srisuk','Chaiyaporn','Boonmee','Kaewkla','Suwannarat','Thongchai','Rattanakorn','Wongsa','Phromma','Saengthong']],
];
const JAB_A = ['Quality Control Engineer','Process Engineer','Plant Manager','Maintenance Supervisor','Electrical Engineer','Welding Inspector','Production Planner','Automation Engineer','Metallurgical Engineer','Commissioning Engineer','Rolling Mill Specialist','Mould Designer','Safety Engineer','Supply Chain Manager','Hydraulic Specialist'];
const JAB_D = ['Direktur Utama','Direktur Teknik','Direktur Keuangan','Direktur Operasional','Komisaris','Komisaris Utama'];
const JAB_B = ['Rohaniwan','Pengajar Bahasa Inggris','Pekerja Sosial','Konselor Pendidikan','Pengajar Musik','Pelatih Relawan Kebencanaan','Dosen Tamu Teologi','Tenaga Medis Misi'];
const JAB_C = ['Tenaga Ahli Irigasi','Program Advisor','Penasihat Energi Terbarukan','Ahli Tata Kelola Air','Koordinator Program','Spesialis Monitoring & Evaluasi','Ahli Gizi Masyarakat','Konsultan Kesehatan Publik','Atase Teknis'];
const LOK_A = ['KAB. BEKASI, JAWA BARAT','KAB. KARAWANG, JAWA BARAT','KOTA CILEGON, BANTEN','KAB. MOROWALI, SULAWESI TENGAH','KOTA BATAM, KEPULAUAN RIAU','KAB. GRESIK, JAWA TIMUR'];
const LOK_B = ['KOTA ADM. JAKARTA PUSAT, DKI JAKARTA','KOTA ADM. JAKARTA TIMUR, DKI JAKARTA','KOTA MATARAM, NUSA TENGGARA BARAT','KOTA KUPANG, NUSA TENGGARA TIMUR','KOTA MEDAN, SUMATERA UTARA'];
const person = () => { const n = pick(NAT); return { nama: pick(n[2]) + ' ' + pick(n[3]), negara: n[0], paspor: n[1] + (n[1] === 'E' || n[1] === 'C' ? pick(['H','J','K','G']) : '') + int(1000000, 9999999) }; };
const date = (y0, y1) => { const y = int(y0, y1), m = int(0, 11), d = int(1, 28); return { s: d + ' ' + MON[m] + ' ' + y, m, y }; };
const pad = (n, l) => String(n).padStart(l, '0');

const genHpk = (role, layanan, n, jabPool, lokPool) => { setSeed('hpk' + role); const out = [];
  for (let i = 0; i < n; i++) { const lay = layanan[i % layanan.length]; const dt = date(2025, 2026); const st = pick([8, 8, 8, 8, 1, 2, 3, 5, 6, 7, 0, 1]); const back = st === 1 && rnd() < .4;
    const pool = /Direktur/.test(lay) ? JAB_D : jabPool; const jn = /Direktur/.test(lay) ? 1 : int(1, 3); const jabatan = [];
    for (let k = 0; k < jn; k++) { const kuota = int(1, 4); jabatan.push({ nama: pool[(i + k * 3) % pool.length], kuota, terisi: st === 8 ? int(0, kuota) : 0, bulan: /Sementara/.test(lay) ? int(1, 6) : pick([12, 12, 24, 18]) }); }
    out.push({ id: 'g' + role[0] + i, layanan: lay, noPermohonan: String(dt.y).slice(2) + pad(dt.m + 1, 2) + pad(int(1000, 39999), 8), barcode: st === 8 ? String(dt.y).slice(2) + pad(int(1000, 9999), 6) : '—', tgl: dt.s, terbit: st === 8 ? date(dt.y, dt.y).s : '—', stepIdx: st,
      status: st === 8 ? 'HPK terbit' : st === 0 ? 'Draf — belum diproses' : back ? 'Data atau dokumen belum lengkap, belum bisa diproses' : HPK_STEPS[st], tone: st === 8 ? 'green' : st === 0 ? 'gray' : back ? 'red' : st === 1 ? 'amber' : 'blue',
      catatan: back ? pick(['Surat tugas/kuasa belum dilampiri identitas penerima kuasa.', 'Bukti WLKP sudah kedaluwarsa.', 'Uraian jabatan kurang dari 350 karakter.', 'Akta perubahan terakhir belum diunggah.']) : undefined,
      jabatan, lokasi: pick(lokPool), negara: [pick(NAT)[0], pick(NAT)[0]].filter((v, j, a) => a.indexOf(v) === j).join(', ') }); }
  return out; };
hpk.swasta.push(...genHpk('swasta', ['Direktur/Komisaris', 'Sementara (1–6 bulan)', 'Pekerjaan Lebih dari 6 bulan', 'Perpanjangan'], 64, JAB_A, LOK_A));
hpk.lembaga.push(...genHpk('lembaga', ['Sementara (1–6 bulan)', 'Pekerjaan Lebih dari 6 bulan', 'Non DKPTKA', 'Perpanjangan', 'Perpanjangan Non DKPTKA'], 55, JAB_B, LOK_B));

const genPeng = (key, n, hpkId, jabPool, layanan, dk) => { setSeed('peng' + key); const out = [];
  for (let i = 0; i < n; i++) { const p = person(); const st = pick([6, 6, 6, 6, 1, 2, 3, 4, 5, 0]); const s = dk ? st : Math.min(st, 6); const lay = layanan ? layanan[i % layanan.length] : undefined;
    out.push({ id: 'gp' + key + i, hpk: hpkId, layanan: lay, ...p, jabatan: pick(jabPool), jenis: lay === 'Perpanjangan' ? 'Perpanjangan' : pick(['Baru', 'Baru', 'Baru', 'Pemegang Izin Tinggal']), bulan: lay && /Jangka/.test(lay) ? int(1, 6) : pick([12, 12, 24]), tgl: date(2025, 2026).s, stepIdx: s,
      status: s === 6 ? 'Terbit · terkirim ke Imigrasi' : s === 0 ? 'Draf — belum diproses' : s === 5 ? (dk ? 'Menunggu pembayaran DKPTKA' : 'Persetujuan Direktur') : PENG_STEPS[s], tone: s === 6 ? 'green' : s === 0 ? 'gray' : s === 5 ? 'amber' : s === 1 ? 'amber' : 'blue', imigrasi: s === 6, barcode: s === 6 ? '26' + pad(int(1000, 99999), 6) : undefined }); }
  return out; };
pengesahan.swasta.push(...genPeng('s', 38, 'h5', ['Quality Assurance Manager', 'Rolling Mill Specialist', 'Commissioning Engineer'], null, true));
pengesahan.lembaga.push(...genPeng('l', 26, 'h1', ['Pengajar Bahasa Inggris'], null, false));
pengesahan.pemerintah.push(...genPeng('p', 52, null, JAB_C, ['Baru (lebih dari 6 bulan)', 'Jangka Pendek (1–6 bulan)', 'Perpanjangan'], false));

setSeed('bill'); for (let i = 0; i < 46; i++) { const p = person(); const b = int(3, 24); const dt = date(2024, 2026); const lunas = rnd() > .06;
  billing.swasta.push({ id: 'gb' + i, kode: '82' + dt.y + pad(dt.m + 1, 2) + pad(int(1, 28), 2) + pad(int(10000, 99999), 5), ntpn: lunas ? Math.random().toString(36).slice(2, 10).toUpperCase() + int(10000000, 99999999) : '—', tka: p.nama, paspor: p.paspor, jabatan: pick(JAB_A), bulan: b, rupiah: b * 1500000, terbit: dt.s, batas: dt.s, bayar: lunas ? dt.s : null, bank: pick(['BNI', 'Bank Mandiri', 'BRI', 'BSI']), status: lunas ? 'Lunas' : 'Belum dibayar', tone: lunas ? 'green' : 'amber', jenis: rnd() > .8 ? 'Pendapatan Daerah' : 'PNBP' }); }

const genChg = (key, n, arr) => { setSeed('chg' + key); const J = [['Data Tenaga Kerja Asing', ['Data Paspor', 'Data Nama', 'Data Alamat', 'Data Kelahiran']], ['Alamat Pemberi Kerja', ['Pindah blok kawasan', 'Perubahan nama jalan', 'Pindah kantor']], ['Lokasi Kerja', ['+ KAB. KARAWANG', '+ KOTA CILEGON', '+ KAB. GRESIK', '− KOTA BATAM']]];
  for (let i = 0; i < n; i++) { const p = person(); const j = pick(J); const sid = pick([6, 6, 6, 3, 2, 1, 9]); const bc = '2' + int(4, 6) + pad(int(100000, 999999), 6); const dt = date(2025, 2026);
    arr.push({ id: 'gc' + key + i, barcode: '26' + pad(int(100000, 999999), 6), skBarcode: bc, skNo: 'B.3/' + bc + '/PK.04.01/' + ROM[dt.m] + '/' + dt.y, skTgl: dt.s, ...p, jabatan: pick(key === 'l' ? JAB_B : key === 'p' ? JAB_C : JAB_A), jenis: j[0], detail: pick(j[1]), dok: sid !== 1 || rnd() > .5, pengurus: true, statusId: sid,
      status: { 1: 'Draf', 2: 'Diajukan', 3: 'Pemeriksaan Petugas', 6: 'Terbit', 9: 'Dibatalkan' }[sid], tone: { 1: 'gray', 2: 'blue', 3: 'blue', 6: 'green', 9: 'red' }[sid], semula: '—', menjadi: '—', surat: pad(int(1, 120), 3) + '/HRD/' + ROM[dt.m] + '/' + dt.y, suratTgl: dt.s, sk: sid === 6 ? 'B.3/26' + pad(int(1000, 9999), 6) + '/PK.04.02/' + ROM[dt.m] + '/2026' : undefined, skTerbit: sid === 6 ? dt.s : undefined }); } };
genChg('s', 36, perubahan.swasta); genChg('l', 22, perubahan.lembaga); genChg('p', 24, perubahan.pemerintah);

setSeed('lap'); for (let i = 0; i < 34; i++) { const p = person(); laporanPenggunaan.push({ nama: p.nama, paspor: p.paspor, jabatan: pick(JAB_A), sk: '2' + int(4, 5) + pad(int(100000, 999999), 6), pendamping: pick(['Agus', 'Budi', 'Citra', 'Dewi', 'Eko', 'Fitri', 'Gilang', 'Hana', 'Irwan', 'Joko']) + ' ' + pick(['Santoso', 'Wijaya', 'Pratama', 'Lestari', 'Saputra', 'Kurniawan', 'Hidayat', 'Nugroho']), mulai: date(2024, 2025).s, akhir: date(2026, 2027).s, lokasi: pick(['KAB. BEKASI', 'KAB. KARAWANG']) }); }
laporan.swasta.rows[0].n = laporanPenggunaan.length;


const PEM = ['PT Krakatau Baja Mandiri', 'PT Delta Otomotif Indonesia', 'PT Morowali Energi Hijau', 'PT Batam Shipyard Nusantara', 'PT Gresik Petrokimia Jaya', 'PT Sinar Energi Kalimantan', 'PT Mitra Kilang Utama', 'PT Sulawesi Nikel Smelter', 'PT Cahaya Digital Asia', 'Yayasan Harapan Anak Bangsa', 'Lembaga Kursus Bahasa Pelita', 'Kantor Perwakilan OKTA', 'Kedutaan Besar Republik Estonia', 'PT Samudra Offshore Services'];
const STG = ['Verifikasi Data dan Upload', 'Verifikasi Data dan Upload', 'Verifikasi Data dan Upload', 'Jadwal Ekspos', 'Pemeriksaan Kasi', 'Pemeriksaan Subkoordinator', 'Pemeriksaan Kasubdit', 'Pemeriksaan Koordinator', 'Pemeriksaan dan Penandatanganan Direktur', 'Persetujuan Direktur', 'Pemeriksaan Petugas'];
setSeed('antri'); for (let i = 0; i < 90; i++) { const tahap = pick(STG); const jenis = /Subkoord|Koordinator|Persetujuan/.test(tahap) ? 'Pengesahan' : tahap === 'Pemeriksaan Petugas' ? 'Perubahan' : 'HPK'; const sla = pick([['1 hari', 'amber'], ['2 hari', 'blue'], ['3 hari', 'blue'], ['Hari ini', 'red'], ['Lewat 1 hari', 'red'], ['4 hari', 'blue']]); const p = person();
  antrian.push({ id: 'gq' + i, no: (jenis === 'HPK' ? '2609' + pad(int(10000, 99999), 8) : (jenis === 'Perubahan' ? 'C-2609' : 'P-2609') + pad(int(1000, 9999), 4)), jenis, layanan: jenis === 'Perubahan' ? pick(['Data Tenaga Kerja Asing', 'Lokasi Kerja', 'Alamat Pemberi Kerja']) : pick(['Pekerjaan Lebih dari 6 bulan', 'Sementara (1–6 bulan)', 'Perpanjangan', 'Direktur/Komisaris', 'Non DKPTKA']), pemohon: pick(PEM), kategori: pick(['PMA', 'PMDN', 'Swasta Nasional', 'Start-up', 'Lembaga Sosial']), masuk: int(1, 29) + ' Sep 2026', tahap, sla: sla[0], tone: sla[1], tka: jenis === 'HPK' ? pick(JAB_A) + ' ×' + int(1, 4) : p.nama }); }

setSeed('tiket'); const KAT = ['Revisi masa berlaku', 'Penambahan jangka waktu HPK', 'Upload ulang foto TKA', 'Update NPWP', 'Jabatan tidak tersedia', 'Username dan Password', 'Pembatalan HPK', 'Penambahan Lokasi'];
for (let i = 0; i < 40; i++) { const k = pick(KAT); const st = pick([['Selesai', 'green'], ['Selesai', 'green'], ['Diproses', 'blue'], ['Baru', 'amber']]); const p = person(); const ag = pick(['Fajar N.', 'Maya L.', 'Dedi S.', 'Ayu P.']);
  tiket.push({ no: 'HT-2609-0' + pad(300 - i * 3, 3), kategori: k, judul: k + ' — ' + p.nama, tgl: int(1, 29) + ' September 2026, ' + pad(int(7, 17), 2) + '.' + pad(int(0, 59), 2), status: st[0], tone: st[1], agen: st[0] === 'Baru' ? undefined : ag, lock: st[0] === 'Diproses' ? ag : undefined, perusahaan: i % 3 === 0 ? 'PT Nusantara Baja Presisi' : pick(PEM) }); }

const genLegacy = (grp, layanan, role) => { setSeed('lg' + grp + layanan + role); const n = int(18, 47); const out = [];
  const pool = role === 'lembaga' ? JAB_B : role === 'pemerintah' ? JAB_C : JAB_A; const isR = grp === 'Sisa RPTKA Lama';
  for (let i = 0; i < n; i++) { const p = person(); const y = int(2019, 2021), m = int(0, 11);
    const aktif = rnd() > .35; const akhir = int(1, 28) + ' ' + MON[int(0, 11)] + ' ' + (aktif ? int(2026, 2027) : int(2021, 2025));
    out.push({ a: isR ? 'KEP.' + int(10000, 29999) + '/PPTKA/PTK/' + y : grp === 'Peralihan' ? 'B.3/' + '26' + pad(int(1000, 9999), 6) + '/PK.04.01/' + ROM[m] + '/2026' : grp === 'Start-up / Vokasi' ? 'B.3/26' + pad(int(100, 999), 3) + '/PK.04.05/' + ROM[m] + '/2026' : 'B.3/' + int(10000, 19999) + '/PK.04.01/' + ROM[m] + '/' + y,
      b: (isR ? 'RPTKA ' : grp === 'Sisa Notifikasi' ? 'Notifikasi · ' : '') + layanan.split('→').pop().trim(), c: isR ? pick(pool) + ' ×' + int(1, 5) : p.nama + ' — ' + pick(pool), d: (aktif ? 'Berlaku s.d. ' : 'Berakhir ') + akhir }); }
  return out; };


export const TKA_DATA = { genLegacy, pencabutan, sso, companies, tka, hpk, pengesahan, billing, ekspos, perubahan, laporanDef, laporan, laporanPenggunaan, tiket, pengumuman, antrian, pendaftar, jabatanMaster, HPK_STEPS, PENG_STEPS, today: '30 September 2026' };
