/**
 * @fileoverview UI-only configuration of the Back Office prototype (port of
 * the legacy `Component.ROLES`, menu definition, document checklists and
 * static copy). Data comes from /api/v1 via js/api/*.
 */

/** Final approval stage (HPK & Pengesahan) — usulan [I]. */
export const DIRJEN_STAGE = 'Persetujuan Direktur Jenderal';

/**
 * Demo roles ("MASUK SEBAGAI (DEMO)"); `stages` = queue filter (tahap).
 * Rantai "Gabungan" KAK Modul 5 [I]: Verifikator -> Validator (Kasi /
 * Subkoordinator) -> Petugas Ekspos -> Kasubdit / Koordinator -> Direktur
 * -> Direktur Jenderal (tahap akhir HPK & Pengesahan).
 */
export const ROLES = [
  { k: 'akun', label: 'Verifikator Akun', nama: 'Andika Pratama',
    jab: 'Petugas Verifikasi Akun', home: 'akun' },
  { k: 'verif', label: 'Verifikator Permohonan', nama: 'Nur Aisyah',
    jab: 'Verifikator · Subdit Pengesahan', home: 'antrian',
    stages: ['Verifikasi Data dan Upload', 'Pemeriksaan Petugas'] },
  { k: 'ekspos', label: 'Petugas Ekspos', nama: 'Bayu Kurniawan',
    jab: 'Petugas Ekspos', home: 'ekspos', stages: ['Jadwal Ekspos'] },
  { k: 'kasi', label: 'Validator (Kasi/Subkoordinator)',
    nama: 'Hendro Wibowo',
    jab: 'Subkoordinator Pengesahan RPTKA', home: 'antrian',
    stages: ['Pemeriksaan Kasi', 'Pemeriksaan Subkoordinator'] },
  { k: 'kasubdit', label: 'Kasubdit / Koordinator', nama: 'Ratna Sari Dewi',
    jab: 'Koordinator Pengesahan RPTKA', home: 'antrian',
    stages: ['Pemeriksaan Kasubdit', 'Pemeriksaan Koordinator'] },
  { k: 'dir', label: 'Direktur PPTKA', nama: 'Direktur PPTKA',
    jab: 'Direktur Pengendalian Penggunaan TKA', home: 'ttd',
    stages: ['Pemeriksaan dan Penandatanganan Direktur',
      'Persetujuan Direktur'] },
  { k: 'dirjen', label: 'Direktur Jenderal',
    nama: 'Direktur Jenderal Binapenta dan PKK',
    jab: 'Direktur Jenderal Binapenta dan PKK', home: 'antrian',
    stages: [DIRJEN_STAGE] },
  { k: 'pemda', label: 'Pejabat Pemda', nama: 'Siti Nurhaliza',
    jab: 'Disnaker Kab. Bekasi', home: 'pemda' },
  { k: 'admin', label: 'Admin Pusat', nama: 'Admin Sistem',
    jab: 'Admin Pusat PPTKA', home: 'admin' },
];

export const DEFAULT_ROLE = 'verif';

/** Sidebar menu per role: [pageKey, label]. */
export const MENU = {
  akun: [['akun', 'Pendaftar']],
  verif: [['antrian', 'Antrian verifikasi']],
  ekspos: [['ekspos', 'Jadwal ekspos'], ['antrian', 'Antrian ekspos']],
  kasi: [['antrian', 'Antrian pemeriksaan']],
  kasubdit: [['antrian', 'Antrian pemeriksaan']],
  dir: [['ttd', 'Tanda tangan'], ['antrian', 'Semua antrian direktur'],
    ['pencabutan', 'Keputusan pencabutan'], ['analitik', 'Analitik']],
  dirjen: [['antrian', 'Antrian persetujuan Dirjen'],
    ['pencabutan', 'Persetujuan pencabutan'], ['analitik', 'Analitik']],
  pemda: [['pemda', 'Validasi pembayaran']],
  admin: [['admin', 'Pengaturan'], ['akses', 'Peran & akses'],
    ['audit', 'Audit log'], ['keamanan', 'Peringatan keamanan'],
    ['notifikasi', 'Pengaturan notifikasi'], ['analitik', 'Analitik']],
};

export const PAGES = ['antrian', 'review', 'ekspos', 'ttd', 'pemda', 'akun',
  'admin', 'pencabutan', 'analitik', 'notifikasi', 'audit', 'akses',
  'keamanan'];

/** "Selesai hari ini" counter per role. */
export const DONE_TODAY = {
  verif: 9, ekspos: 4, kasi: 6, kasubdit: 5, dir: 3, dirjen: 2,
};

export const JENIS_OPTIONS = ['HPK', 'Pengesahan', 'Perubahan'];

/** Checklist documents per application type. */
export function documentsFor(jenis) {
  if (jenis === 'Perubahan') {
    return ['Surat permohonan perubahan', 'Surat tugas / kuasa',
      'NIB / akta perubahan alamat', 'Data pengurus'];
  }
  if (jenis === 'Pengesahan') {
    return ['Paspor (berwarna)', 'Pas foto 4x6 latar merah',
      'Perjanjian kerja', 'Surat persetujuan instansi berwenang',
      'Data calon TKA', 'Data pengurus'];
  }
  return ['Surat permohonan', 'Surat tugas / kuasa',
    'NIB dan/atau izin usaha', 'Akta + SK pengesahan', 'Bukti WLKP',
    'Rancangan perjanjian kerja', 'Uraian jabatan TKA (350–800 karakter)'];
}

/** Pre-filled "Tidak sesuai" findings for demo application q1. */
export const DEFAULT_FINDINGS = {
  q1: {
    5: 'Belum ditandatangani kedua pihak.',
    6: 'Uraian Commissioning Specialist kurang dari 350 karakter.',
  },
};

export const NOTE_PLACEHOLDER = 'Tuliskan alasan';

/** Preview skeleton line widths (Tailwind arbitrary classes). */
export const FAKE_LINE_CLASSES = ['w-[92%]', 'w-[88%]', 'w-[95%]', 'w-[70%]',
  'w-[90%]', 'w-[84%]', 'w-[93%]', 'w-[60%]', 'w-[89%]', 'w-[76%]'];

/** Previous-stage notes shown to reviewers after verification. */
export function chainNotesFor(roleKey) {
  const notes = [
    { s: 'Verifikasi Data dan Upload', d: 'Nur Aisyah · 12 Sep',
      t: 'Dokumen lengkap dan sesuai.' },
    { s: 'Pengesahan Ekspos', d: 'Bayu Kurniawan · 16 Sep',
      t: 'Layak. Jumlah dan jangka waktu sesuai permohonan.' },
  ];
  const later = ['kasubdit', 'dir', 'dirjen'];
  if (later.includes(roleKey)) {
    notes.push({ s: 'Validator (Kasi/Subkoordinator)',
      d: 'Hendro Wibowo · 22 Sep', t: 'Draft surat sesuai; diteruskan.' });
  }
  if (roleKey === 'dir' || roleKey === 'dirjen') {
    notes.push({ s: 'Kasubdit / Koordinator', d: 'Ratna Sari Dewi · 24 Sep',
      t: 'Sesuai ketentuan; diteruskan ke Direktur.' });
  }
  if (roleKey === 'dirjen') {
    notes.push({ s: 'Direktur PPTKA', d: 'Direktur PPTKA · 28 Sep',
      t: 'Ditandatangani elektronik; mohon persetujuan akhir.' });
  }
  return notes;
}

/** Next stage label after approval by the active role. */
export function nextStageFor(roleKey, jenis) {
  const isHpk = jenis === 'HPK';
  return {
    verif: isHpk ? 'Jadwal Ekspos' : 'Pemeriksaan Subkoordinator',
    ekspos: 'Pengesahan Ekspos',
    kasi: isHpk ? 'Pemeriksaan Kasubdit' : 'Pemeriksaan Koordinator',
    kasubdit: 'Direktur',
    dir: jenis === 'Perubahan' ? 'Terbit' : DIRJEN_STAGE,
    dirjen: isHpk ? 'Penomoran'
      : 'Pembayaran DKPTKA (kode billing ke Simponi)',
  }[roleKey] ?? '';
}

/** Legacy grupOf(kategori): employer group label. */
export function groupLabelOf(kategori) {
  if (/Lembaga Sosial|Keagamaan/.test(kategori)) {
    return 'B · Lembaga (HPK, bebas DKPTKA)';
  }
  if (/Pemerintah|Internasional|Kementerian|LPNK|Perwakilan Negara/
    .test(kategori)) {
    return 'C · Pemerintah/internasional';
  }
  return 'A · Swasta (HPK + DKPTKA)';
}

/** Admin "Kategori dokumen" tab rows. */
export const DOCUMENT_CATEGORIES = [
  ['Paspor (berwarna)', 'Pengesahan', 'JPG · 250 KB'],
  ['Pas foto 4x6 latar merah', 'Pengesahan', 'JPG · 250 KB'],
  ['Rancangan perjanjian kerja', 'HPK', 'PDF · 2 MB'],
  ['Surat persetujuan pembebasan DKPTKA', 'HPK Non DKPTKA', 'PDF · 2 MB'],
  ['Laporan TKA', 'Pelaporan', 'XLSX · 1 MB'],
];

export const ADMIN_TABS = ['Master jabatan', 'Kategori dokumen', 'Pengumuman',
  'Pengguna internal'];

/** Static "Hasil ekspos" card (legacy copy). */
export const EKSPOS_RESULT = {
  no: '260900012345',
  rows: [
    ['Pemohon', 'PT Nusantara Baja Presisi'],
    ['Layanan', 'Perpanjangan · QC Engineer ×1, Plant Manager ×1'],
    ['Jadwal', 'Rabu, 7 Oktober 2026 · 09.30 WIB · antrian 14'],
    ['Wakil hadir', 'Rina Wulandari (HRD)'],
  ],
  note: 'Pemberi kerja memaparkan rencana alih keahlian kepada 2 TKI ' +
    'pendamping. Jumlah dan jangka waktu disetujui sesuai permohonan.',
};

/** Highlight rule of the ekspos calendar (the reviewed applicant). */
export const EKSPOS_HIGHLIGHT = /Nusantara Baja/;
