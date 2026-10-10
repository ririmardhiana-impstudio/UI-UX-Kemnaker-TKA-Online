/**
 * @fileoverview Ketentuan form per jenis HPK (sumber: "Jenis HPK"):
 * isian dan dokumen permohonan tiap jenis, sumber data (OSS / input /
 * upload), batas jangka waktu dan ada-tidaknya video conference (ekspose).
 * Dipakai contract (validator) dan mock (skema GET /formulir).
 */

export const J = Object.freeze({
  SEMENTARA: 'HPK pekerjaan kurang dari 6 (enam) bulan',
  LEBIH6: 'HPK pekerjaan lebih dari 6 (enam) bulan',
  NON_DKPTKA: 'HPK non-DKPTKA',
  KEK: 'HPK KEK',
  IKN: 'HPK Ibu Kota Nusantara',
  KERJASAMA: 'HPK Kerjasama Internasional',
  DIREKSI: 'HPK Direksi/Komisaris',
});

/** Tujuh jenis HPK (urutan sesuai lembar kebutuhan). */
export const PK_JENIS = Object.values(J);
export const PK_JENIS_DIREKSI = J.DIREKSI;

/** Ekspose berlaku untuk semua jenis kecuali HPK Direksi/Komisaris. */
export const hasEkspose = (jenis) => jenis !== J.DIREKSI;

/** Sumber isian: oss = otomatis dari OSS (read-only), input = diisi. */
export const PK_SUMBER_ISIAN = { OSS: 'oss', INPUT: 'input' };
/** Sumber dokumen: data OSS, berkas OSS (cukup dilihat), upload. */
export const PK_SUMBER_DOKUMEN = {
  OSS_DATA: 'oss-data', OSS_BERKAS: 'oss-berkas', UPLOAD: 'upload',
};

const G = { ID: 'Identitas pemberi kerja', TKA: 'Penggunaan TKA',
  PENDAMPING: 'Tenaga kerja pendamping',
  TKI: 'Penyerapan tenaga kerja Indonesia', KERJASAMA: 'Kerjasama' };

const oss = (kunci, label) => ({ kunci, label, tipe: 'teks', grup: G.ID,
  sumber: PK_SUMBER_ISIAN.OSS, wajib: true });
const input = (kunci, label, tipe, grup, extra = {}) => ({ kunci, label,
  tipe, grup, sumber: PK_SUMBER_ISIAN.INPUT, wajib: true, ...extra });

const OSS_FIELDS = [
  oss('namaPemberiKerja', 'Nama pemberi kerja'), oss('nib', 'NIB'),
  oss('npwp', 'NPWP'), oss('alamat', 'Alamat pemberi kerja'),
];
const ALASAN = input('alasanPenggunaan', 'Alasan penggunaan TKA', 'area',
  G.TKA, { minLength: 20, maxLength: 1000 });
/** Daftar jabatan: boleh lebih dari satu, tiap jabatan punya jumlah TKA. */
const jabatanTka = (label = 'Jabatan yang akan diduduki TKA') => input(
  'jabatanTka', label, 'daftar-jabatan', G.TKA, { maxItems: 20,
    maxNama: 100, min: 1, max: 99,
    hint: 'Tambahkan jabatan lain bila perlu dan tentukan jumlah TKA per ' +
      'jabatan.' });

/**
 * Turunan isian lama dari daftar jabatan: `jabatan` (nama dipisah koma) dan
 * `jumlahTka` (total) — dipakai akun Ekspos/Validator/Direktur dan surat.
 * @param {!Array<{nama: string, jumlahTka: number}>} daftar
 */
export const turunanJabatan = (daftar) => ({
  jabatan: daftar.map((j) => j.nama).join(', '),
  jumlahTka: daftar.reduce((n, j) => n + (Number(j.jumlahTka) || 0), 0) });

/** "Welder (2 TKA), QC (1 TKA)" untuk tampilan ringkas. */
export const ringkasJabatan = (daftar) => (daftar ?? []).map((j) =>
  `${j.nama} (${j.jumlahTka} TKA)`).join(', ');
const mulai = input('tanggalMulai', 'Jangka waktu: tanggal mulai', 'tanggal',
  G.TKA);
const selesai = (durasi, hint) => input('tanggalSelesai',
  'Jangka waktu: tanggal selesai', 'tanggal', G.TKA, { durasi, hint });
const lokasi = (extra = {}) => input('lokasiKerja', extra.minItem
  ? 'Lokasi kerja TKA (lebih dari satu Kabupaten/Kota)'
  : 'Lokasi kerja TKA (Kabupaten/Kota)', 'teks', G.TKA,
{ maxLength: 200, ...extra });
const PENDAMPING = [
  input('pendampingNama', 'Nama tenaga kerja pendamping', 'teks',
    G.PENDAMPING, { maxLength: 100 }),
  input('pendampingJabatan', 'Jabatan tenaga kerja pendamping', 'teks',
    G.PENDAMPING, { maxLength: 100 }),
];
const PENYERAPAN = input('rencanaPenyerapanTki',
  'Rencana penyerapan tenaga kerja Indonesia setiap tahun', 'area', G.TKI,
  { minLength: 10, maxLength: 1000,
    hint: 'Contoh: 2027: 5 orang; 2028: 8 orang.' });

/** durasi pada tanggalSelesai: kurangDari / lebihDari / maksBulan (bulan). */
const LOKASI_MULTI = { minItem: 2,
  hint: 'Pisahkan dengan koma, minimal dua Kabupaten/Kota.' };
const FIELDS = {
  [J.SEMENTARA]: [ALASAN, jabatanTka(), mulai,
    selesai({ kurangDari: 6 }, 'Kurang dari 6 (enam) bulan.'),
    lokasi(LOKASI_MULTI)],
  [J.LEBIH6]: [ALASAN, jabatanTka(), mulai,
    selesai({ lebihDari: 6 }, 'Lebih dari 6 (enam) bulan.'), lokasi(),
    ...PENDAMPING, PENYERAPAN],
  [J.NON_DKPTKA]: [ALASAN,
    jabatanTka('Jabatan atau kedudukan TKA dalam struktur organisasi ' +
      'perusahaan'), mulai, selesai({}), lokasi(), ...PENDAMPING],
  [J.KEK]: [ALASAN, jabatanTka(), mulai,
    selesai({ maksBulan: 60 }, 'Maksimal 5 tahun.'), lokasi(), ...PENDAMPING,
    PENYERAPAN],
  [J.IKN]: [ALASAN, jabatanTka(), mulai,
    selesai({ maksBulan: 120 }, 'Maksimal 10 tahun.'), lokasi(),
    ...PENDAMPING, PENYERAPAN],
  [J.KERJASAMA]: [ALASAN, jabatanTka(), mulai, selesai({}), lokasi(),
    ...PENDAMPING, PENYERAPAN,
    input('bentukKerjasama', 'Bentuk kerjasama', 'teks', G.KERJASAMA,
      { maxLength: 150 })],
  [J.DIREKSI]: [jabatanTka(), mulai, selesai({}), lokasi()],
};

/**
 * Isian per jenis HPK sesuai ketentuan "Jenis HPK" (identitas dari OSS
 * lebih dulu, lalu input).
 * @param {string} jenis
 * @return {!Array<!Object>}
 */
export function fieldDefs(jenis) {
  return [...OSS_FIELDS, ...FIELDS[jenis] ?? []];
}

const dok = (kunci, label, sumber = PK_SUMBER_DOKUMEN.UPLOAD, extra = {}) => ({
  kunci, label, sumber, wajib: true, ...extra });
const opsional = (kunci, label) => dok(kunci, `${label} (opsional)`,
  PK_SUMBER_DOKUMEN.UPLOAD, { wajib: false });

const DOK_COMMON = [
  dok('suratPermohonan', 'Surat permohonan pengesahan RPTKA'),
  dok('suratTugas', 'Surat tugas atau surat kuasa'),
  dok('nib', 'Nomor Induk Berusaha (NIB)', PK_SUMBER_DOKUMEN.OSS_DATA),
  dok('aktaPendirian', 'Akta dan keputusan pengesahan pendirian dan/atau ' +
    'perubahan dari instansi yang berwenang', PK_SUMBER_DOKUMEN.OSS_BERKAS),
  dok('npwp', 'Nomor pokok wajib pajak', PK_SUMBER_DOKUMEN.OSS_BERKAS),
  dok('wajibLapor', 'Bukti wajib lapor ketenagakerjaan di perusahaan'),
  dok('domisili', 'Domisili Pemberi Kerja TKA'),
];
const STRUKTUR = dok('strukturOrganisasi', 'Struktur organisasi');
const ALIH = dok('alihTeknologi',
  'Rencana pelaksanaan alih teknologi dan alih keahlian');
const PERNYATAAN = (relevan) => dok('suratPernyataan',
  'Surat pernyataan Pemberi Kerja TKA', PK_SUMBER_DOKUMEN.UPLOAD, {
    keterangan: 'Berisi pernyataan untuk: (1) menunjuk Tenaga Kerja ' +
      `Pendamping TKA${relevan ? ' yang memiliki kualifikasi jabatan ' +
        'relevan dengan jenis pekerjaan TKA' : ''}; (2) melaksanakan ` +
      'pendidikan dan pelatihan kerja bagi Tenaga Kerja Pendamping TKA ' +
      'sesuai kualifikasi jabatan yang diduduki TKA; (3) memfasilitasi ' +
      'pendidikan dan pelatihan bahasa Indonesia kepada TKA.' });
const LANJUT = (kunci, label) => [dok(kunci, label),
  opsional('kontrak', 'Kontrak pekerjaan dan kerjasama'), STRUKTUR, ALIH,
  PERNYATAAN(true)];

const DOK_EXTRA = {
  [J.SEMENTARA]: [opsional('kontrak', 'Kontrak pekerjaan')],
  [J.LEBIH6]: [STRUKTUR, ALIH, PERNYATAAN(false),
    opsional('kontrak', 'Kontrak pekerjaan/kerjasama')],
  [J.NON_DKPTKA]: [STRUKTUR, ALIH, dok('suratPembebasan',
    'Surat persetujuan dari kementerian/lembaga untuk pembebasan DKPTKA'),
  PERNYATAAN(true)],
  [J.KEK]: LANJUT('suratDewanKek', 'Surat persetujuan Dewan Nasional KEK'),
  [J.IKN]: LANJUT('suratOtorita', 'Surat persetujuan Kepala Otorita IKN'),
  [J.KERJASAMA]: LANJUT('rekomendasiNegaraAsing', 'Rekomendasi pemerintah ' +
    'negara asing sebagai mitra kerjasama internasional'),
  [J.DIREKSI]: [],
};

/**
 * Dokumen permohonan per jenis HPK sesuai ketentuan "Jenis HPK".
 * @param {string} jenis
 * @return {!Array<{kunci: string, label: string, sumber: string,
 *     wajib: boolean, keterangan: (string|undefined)}>}
 */
export function dokumenDefs(jenis) {
  return [...DOK_COMMON, ...DOK_EXTRA[jenis] ?? []];
}
