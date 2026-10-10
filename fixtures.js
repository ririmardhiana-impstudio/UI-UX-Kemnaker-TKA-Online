/**
 * @fileoverview Page-level fixtures that lived inside the legacy page
 * scripts (not in data.js). Values are copied verbatim from
 * legacy (git 2630ca4) *.html so the migrated pages render identical content.
 * Only js/mocks/* may import this module.
 */

/** Label used for employer-side messages in TKA Hotline. */
export const PK_LABEL = 'Rina Wulandari (PT Nusantara Baja Presisi)';

/** Hand-written legacy rows per layanan (Portal "legacy" menu). */
export const LEGACY_FIXTURES = {
  'Perpanjangan (Hanya Cetak)': [{ a: 'KEP.19872/PPTKA/PTK/2020', b: 'RPTKA Perpanjangan', c: 'Plant Manager, QC Engineer', d: 'Berakhir 31 Desember 2021' }, { a: 'KEP.20114/PPTKA/PTK/2020', b: 'RPTKA Perpanjangan', c: 'Maintenance Supervisor', d: 'Berakhir 30 Juni 2021' }],
  'Penambahan (Hanya Cetak)': [{ a: 'KEP.18830/PPTKA/PTK/2019', b: 'RPTKA Penambahan', c: 'Welding Inspector ×2', d: 'Berakhir 31 Maret 2021' }],
  'Baru': [{ a: 'KEP.17702/PPTKA/PTK/2019', b: 'RPTKA Baru', c: 'QC Engineer ×3, Process Engineer ×2', d: 'Berakhir 31 Desember 2021' }],
  'Perubahan': [{ a: 'KEP.19011/PPTKA/PTK/2020', b: 'Perubahan RPTKA — lokasi kerja', c: 'Plant Manager', d: 'Berakhir 31 Desember 2021' }],
  'Baru (di atas 7 bulan)': [{ a: 'B.3/12093/PK.04.01/IV/2021', b: 'Notifikasi', c: 'Hiroshi Tanaka — Plant Manager', d: 'Berakhir 14 April 2022' }, { a: 'B.3/12871/PK.04.01/V/2021', b: 'Notifikasi', c: 'Wang Lei — QC Engineer', d: 'Berakhir 2 Mei 2022' }],
  'Pemegang Izin Tinggal': [{ a: 'B.3/13310/PK.04.01/VI/2021', b: 'Notifikasi · izin tinggal 2C', c: 'Lukas Becker — Direktur Teknik', d: 'Berakhir 20 Juni 2022' }],
  'Perubahan Notifikasi': [{ a: 'B.3/13552/PK.04.02/VI/2021', b: 'Perubahan Notifikasi — paspor', c: 'Hiroshi Tanaka', d: 'Terbit 28 Juni 2021' }],
  'Non DKPTKA': [{ a: 'B.3/11420/PK.04.01/III/2021', b: 'Notifikasi Non DKPTKA', c: 'Matteo Rossi — Rohaniwan', d: 'Berakhir 10 Maret 2022' }],
  'Non RPTKA': [{ a: 'B.3/10877/PK.04.01/II/2021', b: 'Notifikasi Non RPTKA', c: 'Kenji Watanabe — Tenaga Ahli Irigasi', d: 'Berakhir 19 Februari 2022' }],
  'Start-up atau Vokasi': [{ a: 'B.3/26031/PK.04.05/VIII/2026', b: 'Surat penggunaan TKA (3 bulan)', c: 'Elena Petrova — Trainer CNC', d: 'Berlaku s.d. 30 November 2026' }, { a: 'B.3/26018/PK.04.05/V/2026', b: 'Surat penggunaan TKA (2 bulan)', c: 'Tomasz Nowak — Instruktur Robotik', d: 'Berakhir 31 Juli 2026' }],
  'Penarikan': [{ a: 'PNR-2602-0041', b: 'Penarikan DKPTKA Rp18.000.000', c: 'Rahul Verma — batal datang', d: 'Diproses · rekening USD BNI' }],
};

/** Seed conversations per ticket number (TKA Hotline). */
export const TIKET_BASE_MESSAGES = {
  'HT-2609-0418': [{ me: 1, from: PK_LABEL, time: '29 Sep, 10.14', text: 'Selamat pagi. NPWP TKA Hiroshi Tanaka (paspor TR1234567) sudah aktif di Coretax, tetapi di TKA Online masih tertera belum aktif sehingga perpanjangan tidak bisa diajukan.', file: 'npwp-hiroshi-tanaka.pdf', ext: 'PDF', size: '312 KB' }, { me: 0, from: 'Fajar N. (Agen)', time: '29 Sep, 11.02', text: 'Terima kasih, Bu Rina. Data NPWP sedang kami sinkronkan dengan DJP. Mohon ditunggu maksimal 1×24 jam kerja.' }],
  'HT-2609-0377': [{ me: 1, from: PK_LABEL, time: '23 Sep, 15.02', text: 'Foto TKA Sato Kenji ditolak karena latar belum merah. Mohon dibuka kembali unggahan fotonya.' }, { me: 0, from: 'Maya L. (Agen)', time: '23 Sep, 16.40', text: 'Data telah kami tindak lanjuti. Unggahan foto sudah dibuka kembali, silakan unggah ulang dengan latar merah 4x6.' }],
  'HT-2609-0352': [{ me: 1, from: PK_LABEL, time: '19 Sep, 08.47', text: 'Masa berlaku SK Chen Wei (25103377) tertulis 11 bulan, seharusnya 12 bulan sesuai HPK.' }, { me: 0, from: 'Fajar N. (Agen)', time: '19 Sep, 13.15', text: 'Data telah kami tindak lanjuti. Masa berlaku sudah direvisi menjadi 12 bulan, s.d. 22 Oktober 2026.' }],
  'HT-2609-0431': [{ me: 1, from: PK_LABEL, time: '30 Sep, 08.05', text: 'Saat menambah TKA pada HPK 26004518, jabatan Welding Inspector tidak tersedia di daftar pilihan. Mohon ditambahkan ke master jabatan.' }],
};

/** Hotline dashboard (TKA Hotline "Dasbor"). */
export const HOTLINE_STATS = {
  kpi: [{ l: 'Tiket masuk', v: '1.500' }, { l: 'Tiket selesai', v: '1.440' }, { l: 'Masih terbuka', v: '60' }, { l: 'Rata-rata penyelesaian', v: '6,4 jam' }],
  months: [['Apr', 212, 205], ['Mei', 246, 238], ['Jun', 231, 229], ['Jul', 268, 251], ['Agu', 259, 255], ['Sep', 284, 262]],
  perCategory: [['Username dan Password', 318], ['Update NPWP', 241], ['Revisi masa berlaku', 187], ['Upload ulang foto TKA', 162], ['Pembatalan HPK', 118], ['Penambahan Lokasi', 97], ['Jabatan tidak tersedia', 84], ['Penambahan jangka waktu HPK', 61]],
  agents: [{ n: 'Fajar N.', h: 412, s: 398, r: '18 menit', p: '5,2 jam' }, { n: 'Maya L.', h: 386, s: 377, r: '22 menit', p: '5,9 jam' }, { n: 'Dedi S.', h: 351, s: 334, r: '31 menit', p: '7,8 jam' }, { n: 'Ayu P.', h: 351, s: 331, r: '27 menit', p: '6,9 jam' }],
};

/** Regional DKPTKA payments awaiting pemda validation (Back Office). */
export const PEMDA_VALIDATIONS = [{ id: 'd1', pk: 'PT Nusantara Baja Presisi', tka: 'Chen Wei', jab: 'Quality Control Engineer', jml: 'Rp18.000.000', bukti: 'STS-3216-26-004471.pdf' }, { id: 'd2', pk: 'PT Cikarang Otomotif Parts', tka: 'Kim Min-jun', jab: 'Production Engineer', jml: 'Rp9.000.000', bukti: 'STS-3216-26-004455.pdf' }, { id: 'd3', pk: 'PT Jababeka Kimia Prima', tka: 'Liu Yang', jab: 'Chemist', jml: 'Rp18.000.000', bukti: 'STS-3216-26-004402.pdf', done: 'Tervalidasi' }, { id: 'd4', pk: 'PT Nusantara Baja Presisi', tka: 'Yamamoto Daisuke', jab: 'Production Planner', jml: 'Rp18.000.000', bukti: 'STS-3216-26-004480.pdf' }, { id: 'd5', pk: 'PT Lippo Cikarang Electronics', tka: 'Nguyen Thi Lan', jab: 'SMT Engineer', jml: 'Rp18.000.000', bukti: 'STS-3216-26-004433.pdf' }, { id: 'd6', pk: 'PT Hyundai Presisi Bekasi', tka: 'Lee Jae-hyun', jab: 'Plant Controller', jml: 'Rp36.000.000', bukti: 'STS-3216-26-004391.pdf', done: 'Tervalidasi' }, { id: 'd7', pk: 'PT MM2100 Logistik', tka: 'Sato Riku', jab: 'Warehouse Systems Lead', jml: 'Rp9.000.000', bukti: 'STS-3216-26-004377.pdf', done: 'Ditolak' }];

/** Ekspos calendar (Back Office "Jadwal ekspos"). Key = 'HH.MM-dayIdx'. */
export const EKSPOS_SCHEDULE = {
  days: ['Senin, 5 Okt', 'Selasa, 6 Okt', 'Rabu, 7 Okt', 'Kamis, 8 Okt', 'Jumat, 9 Okt'],
  times: ['09.00', '09.30', '10.00', '10.30', '13.00', '14.00'],
  events: { '09.00-1': ['PT Mitra Kilang Utama', 'Lebih dari 6 bulan · #11'], '09.30-2': ['PT Nusantara Baja Presisi', 'Perpanjangan · #14'], '10.00-2': ['PT Sinar Energi Kalimantan', 'Lebih dari 6 bulan · #15'], '14.00-0': ['PT Borneo Hijau Lestari', 'Sementara · #09'], '14.00-3': ['PT Sulawesi Nikel Smelter', 'Lebih dari 6 bulan · #18'], '10.30-4': ['Yayasan Pelayanan Kasih Nusantara', 'Non DKPTKA · #21'], '09.00-0': ['PT Borneo Hijau Lestari', 'Sementara · #03'], '10.00-0': ['PT Cahaya Digital Asia', 'Direktur/Komisaris · #04'], '13.00-1': ['PT Samudra Offshore Services', 'Lebih dari 6 bulan · #12'], '09.30-3': ['PT Mitra Kilang Utama', 'Perpanjangan · #16'], '13.00-3': ['PT Nusantara Baja Presisi', 'Perpanjangan · #22'], '10.00-3': ['PT Sinar Energi Kalimantan', 'Sementara · #17'], '09.00-4': ['PT Jababeka Kimia Prima', 'Lebih dari 6 bulan · #19'], '14.00-1': ['PT Sulawesi Nikel Smelter', 'Perpanjangan · #13'], '09.30-0': ['Lembaga Kursus Bahasa Pelita', 'Non DKPTKA · #02'] },
};

/** Replacement values when billing b2 is reissued (legacy Portal). */
export const REISSUED_BILLING = {
  kode: '820260930120944',
  batas: '7 Oktober 2026',
  status: 'Belum dibayar',
  tone: 'amber',
};

/**
 * Demo accounts for POST /auth/login. loginStatusId follows §7.1:
 * 0/1 ok, 3 SSO required, 4 reCAPTCHA required, 5 login failed.
 */
export const MOCK_ACCOUNTS = [
  { username: 'nbp.hrd', password: 'rahasia123', kind: 'pemberi-kerja',
    companyKey: 'swasta', email: 'hrd@nusantarabaja.co.id',
    name: 'Rina Wulandari', loginStatusId: 0, claims: {} },
  /** Demo: akun SIAPkerja belum terverifikasi sebagai Pemberi Kerja —
   * klik "TKA - Online" lanjut ke wizard registrasi (AK-13), berpasangan
   * dengan nbp.hrd di atas yang sudah Aktif (AK-19). Email memakai
   * identitas SSO tetap (`store.sso`, "Rina Wulandari") supaya konsisten
   * dengan header "Didaftarkan oleh" di wizard. */
  { username: 'nbp.daftar', password: 'rahasia123', kind: 'pemberi-kerja',
    companyKey: 'swasta', email: 'rina.wulandari@nusantarabaja.co.id',
    name: 'Rina Wulandari', loginStatusId: 0, claims: {} },
  { username: 'ypkn.admin', password: 'rahasia123', kind: 'pemberi-kerja',
    companyKey: 'lembaga', email: 'sekretariat@ypkn.or.id',
    name: 'Yohanes Sitompul', loginStatusId: 0, claims: {} },
  { username: 'okta.jkt', password: 'rahasia123', kind: 'pemberi-kerja',
    companyKey: 'pemerintah', email: 'admin.jakarta@okta-asia.org',
    name: 'Dewi Anggraini', loginStatusId: 0, claims: {} },
  { username: 'nbp.baru', password: 'sementara01', kind: 'pemberi-kerja',
    companyKey: 'swasta', email: 'hrd@nusantarabaja.co.id',
    name: 'Rina Wulandari', loginStatusId: 1,
    claims: { mustChangePassword: true, mustVerifyEmail: true } },
  { username: 'nbp.sso', password: 'rahasia123', kind: 'pemberi-kerja',
    companyKey: 'swasta', email: 'hrd@nusantarabaja.co.id',
    name: 'Rina Wulandari', loginStatusId: 3, claims: {} },
  { username: 'nbp.nonaktif', password: 'rahasia123',
    kind: 'pemberi-kerja', companyKey: 'swasta',
    email: 'hrd@nusantarabaja.co.id', name: 'Rina Wulandari',
    loginStatusId: 5, claims: {} },
  /** Verifikator akun pemberi kerja (AK-20) — langsung ke
   * verifikator-akun.html, tanpa menu layanan TKA Online. */
  { username: 'verif.akun', password: 'verifikator2026',
    kind: 'verifikator', companyKey: null,
    email: 'andika.pratama@kemnaker.go.id', name: 'Andika Pratama',
    loginStatusId: 0, claims: {} },
  /** Petugas Ekspos (usulan, lembar kebutuhan Fitur Ekspose) — langsung
   * ke petugas-ekspos.html. */
  { username: 'petugas.ekspos', password: 'ekspos2026',
    kind: 'petugas-ekspos', companyKey: null,
    email: 'bayu.kurniawan@kemnaker.go.id', name: 'Bayu Kurniawan',
    loginStatusId: 0, claims: {} },
  /** Validator HPK (usulan, lembar kebutuhan "Tabel Daftar Pemberi Kerja")
   * — langsung ke validator-hpk.html. */
  { username: 'validator.hpk', password: 'validator2026',
    kind: 'validator-hpk', companyKey: null,
    email: 'maya.anggraeni@kemnaker.go.id', name: 'Maya Anggraeni',
    loginStatusId: 0, claims: {} },
  /** Disnaker setempat (usulan, lembar kebutuhan "Tabel Daftar Pemberi
   * Kerja" — SKRD): Perpanjangan Lintas Kab/Kota + Terbitkan SKRD —
   * langsung ke disnaker-akun.html. */
  { username: 'disnaker.bekasi', password: 'disnaker2026',
    kind: 'disnaker', companyKey: null,
    email: 'rudi.hartono@disnaker.bekasikab.go.id', name: 'Rudi Hartono',
    loginStatusId: 0, claims: {} },
  /** Direktur PPTKA (usulan, lembar kebutuhan "Tabel Daftar Pemberi Kerja"
   * Direktur) — langsung ke direktur-hpk.html. */
  { username: 'direktur.pptka', password: 'direktur2026',
    kind: 'direktur-hpk', companyKey: null,
    email: 'direktur.pptka@kemnaker.go.id', name: 'Direktur PPTKA',
    loginStatusId: 0, claims: {} },
  /** Superadmin (usulan, lembar kebutuhan "Integrasi Imigrasi"): menerima
   * data Visa/ITAS dari Imigrasi + perpanjangan RPTKA, view-only —
   * langsung ke imigrasi-akun.html. */
  { username: 'superadmin', password: 'superadmin2026',
    kind: 'superadmin', companyKey: null,
    email: 'superadmin@kemnaker.go.id', name: 'Superadmin',
    loginStatusId: 0, claims: {} },
  { username: 'fajar.n', password: 'hotline2026', kind: 'agen',
    companyKey: null, email: 'fajar.n@kemnaker.go.id', name: 'Fajar N.',
    loginStatusId: 0, claims: {} },
];

/** Email verification link tokens (Akun & Login "Verifikasi email"). */
export const EMAIL_VERIFY_TOKENS = {
  'verify-ok': 'Berhasil',
  'verify-used': 'Sudah terverifikasi',
};

/**
 * Region reference for GET /wilayah (registration address). Demo subset;
 * the legacy registration address is JAWA BARAT / KAB. BEKASI /
 * CIKARANG SELATAN / PASIRSARI.
 */
export const WILAYAH = {
  'JAWA BARAT': {
    'KAB. BEKASI': {
      'CIKARANG SELATAN': ['PASIRSARI', 'SERANG', 'SUKADAMI', 'SUKARESMI'],
      'CIKARANG UTARA': ['KARANGASIH', 'SIMPANGAN', 'WANGUNHARJA'],
    },
    'KAB. KARAWANG': {
      'TELUKJAMBE TIMUR': ['SUKALUYU', 'PUSEURJAYA', 'SIRNABAYA'],
    },
  },
  'DKI JAKARTA': {
    'KOTA ADM. JAKARTA SELATAN': {
      'KEBAYORAN BARU': ['SENAYAN', 'MELAWAI', 'GUNUNG'],
      'SETIABUDI': ['KUNINGAN TIMUR', 'KARET SEMANGGI'],
    },
  },
  'BANTEN': {
    'KOTA CILEGON': {
      'CIWANDAN': ['KUBANGSARI', 'TEGALRATU', 'GUNUNGSUGIH'],
    },
  },
};

/** Hotline profile per employer account (TKA Hotline "Profil"). */
export const HOTLINE_PROFILES = {
  'nbp.hrd': {
    akun: 'nbp.hrd', perusahaan: 'PT Nusantara Baja Presisi',
    penanggungJawab: 'Rina Wulandari', telepon: '081287654321',
    email: 'hrd@nusantarabaja.co.id', lengkap: false,
  },
};
