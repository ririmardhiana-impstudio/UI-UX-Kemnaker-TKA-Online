/**
 * @fileoverview TKA Hotline UI configuration (pure UI copy, not data).
 * Values are verbatim from legacy (git 2630ca4) TKA Hotline.dc.html.
 */

/** Demo employer session (legacy: hotline uses the TKA Online session). */
export const PK_SESSION = {
  name: 'Rina Wulandari',
  perusahaan: 'PT Nusantara Baja Presisi',
  akun: 'nbp.hrd',
};

/** Default agent until "Masuk agen hotline" returns the real name. */
export const DEFAULT_AGENT = 'Fajar N.';

export const MODES = [
  { key: 'pk', label: 'Pemberi kerja', defaultView: 'tiket',
    defaultTicket: 'HT-2609-0418' },
  { key: 'agen', label: 'Agen / petugas', defaultView: 'antrian',
    defaultTicket: 'HT-2609-0431' },
];

/** Header navigation per mode: [viewKey, label]. */
export const NAV = {
  pk: [
    ['profil', 'Profil'],
    ['tiket', 'Tiket saya'],
    ['baru', 'Buat tiket'],
    ['notlogin', 'Belum login (state)'],
  ],
  agen: [
    ['login', 'Login agen'],
    ['antrian', 'Antrian tiket'],
    ['dashboard', 'Dasbor'],
  ],
};

/** View key -> <section data-view>. Ticket list views share "chat". */
export const VIEW_SECTION = {
  profil: 'profil',
  notlogin: 'notlogin',
  tiket: 'chat',
  antrian: 'chat',
  baru: 'baru',
  login: 'login',
  dashboard: 'dashboard',
};

export const STATUS_FILTERS = ['Semua', 'Baru', 'Diproses', 'Selesai'];

export const CANNED_REPLIES = [
  'Data telah kami tindak lanjuti',
  'Mohon lampirkan dokumen pendukung',
  'Silakan ajukan melalui user.pptka@kemnaker.go.id',
];

export const INTERNAL_QUEUES = [
  'Antrian Verifikator',
  'Antrian Validator',
  'Pendingan Verifikator',
  'Pendingan Validator',
  'SK Perubahan',
];

/** Legacy default category on "Buat tiket baru" (index 4). */
export const DEFAULT_CATEGORY = 'Jabatan tidak tersedia';
