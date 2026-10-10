/**
 * @fileoverview Detail data for the seeded pendaftar (verifikasi akun
 * pemberi kerja, akun Verifikator). Keyed by pendaftar id (digits of NPWP,
 * or a name slug when there is no NPWP). Names, emails, NIB are fictional.
 * `emailAdmin` = email SIAPkerja pendaftar (admin pemberi kerja).
 */

const SURAT_OSS = 'Surat Penunjukan Operator/PIC';
const SURAT_NON_OSS = 'Surat Permohonan Pengajuan TKA';

const op = (nama, email) => ({ nama, email, terdaftar: true });
const doc = (jenis, fileName, fileSize) => ({
  jenis, fileName, fileSize, mimeType: 'application/pdf',
});

/** Fallback for rows without a fixture entry. */
export const DETAIL_DEFAULT = {
  statusPenanamModal: 'Bukan Penanam Modal', metodePendaftaran: 'OSS',
  nib: '', kodeWlkp: '', emailAdmin: '', operators: [], dokumen: null,
};

export const PENDAFTAR_DETAIL = {
  '0761220441801000': {
    statusPenanamModal: 'Bukan Penanam Modal', metodePendaftaran: 'OSS',
    nib: '9120301234001', kodeWlkp: '3174.2024.001201',
    emailAdmin: 'andi.pratama@cahayadigital.id',
    operators: [op('Dewi Lestari', 'dewi.l@cahayadigital.id')],
    dokumen: doc(SURAT_OSS, 'surat-penunjukan-cahaya-digital.pdf', 312480),
  },
  '0823551907217000': {
    statusPenanamModal: 'Penanam Modal', metodePendaftaran: 'OSS',
    nib: '9120301234002', kodeWlkp: '6402.2023.000874',
    emailAdmin: 'siti.rahmawati@borneohijau.co.id',
    operators: [op('Bayu Anggoro', 'bayu.a@borneohijau.co.id'),
      op('Siti Rahmawati', 'siti.rahmawati@borneohijau.co.id')],
    dokumen: doc(SURAT_OSS, 'surat-penunjukan-borneo-hijau.pdf', 287901),
  },
  '0911003488304000': {
    statusPenanamModal: 'Bukan Penanam Modal', metodePendaftaran: 'OSS',
    nib: '9120301234003', kodeWlkp: '3273.2022.000419',
    emailAdmin: 'hendra.g@kursuspelita.id',
    operators: [op('Hendra Gunawan', 'hendra.g@kursuspelita.id')],
    dokumen: doc(SURAT_OSS, 'surat-penunjukan-pelita-buram.pdf', 198311),
  },
  '0712664120093000': {
    statusPenanamModal: 'Bukan Penanam Modal', metodePendaftaran: 'OSS',
    nib: '9120301234004', kodeWlkp: '1471.2024.000266',
    emailAdmin: 'lina.marlina@samudraoffshore.co.id',
    operators: [op('Rizal Hakim', 'rizal.h@samudraoffshore.co.id')],
    dokumen: doc(SURAT_OSS, 'surat-penunjukan-samudra.pdf', 301774),
  },
  '0845112077342000': {
    statusPenanamModal: 'Bukan Penanam Modal', metodePendaftaran: 'OSS',
    nib: '9120301234005', kodeWlkp: '3171.2021.000932',
    emailAdmin: 'maria.ulfa@harapananakbangsa.or.id',
    operators: [op('Maria Ulfa', 'maria.ulfa@harapananakbangsa.or.id')],
    dokumen: doc(SURAT_OSS, 'surat-penunjukan-yhab.pdf', 254630),
  },
  'kedutaan-besar-republik-estonia': {
    statusPenanamModal: 'Bukan Penanam Modal', metodePendaftaran: 'Non-OSS',
    nib: '', kodeWlkp: '', emailAdmin: 'kadri.tamm@estonia.ee',
    operators: [op('Kadri Tamm', 'kadri.tamm@estonia.ee'),
      op('Mart Kask', 'mart.kask@estonia.ee')],
    dokumen: doc(SURAT_NON_OSS, 'permohonan-pengajuan-tka-estonia.pdf', 176540),
  },
  '0932441855216000': {
    statusPenanamModal: 'Bukan Penanam Modal', metodePendaftaran: 'OSS',
    nib: '9120301234006', kodeWlkp: '3578.2020.000711',
    emailAdmin: 'bagus.w@vokasiteknik.co.id',
    operators: [op('Bagus Wicaksono', 'bagus.w@vokasiteknik.co.id')],
    dokumen: doc(SURAT_OSS, 'surat-penunjukan-vokasi-teknik.pdf', 268004),
  },
  '0188223100459000': {
    statusPenanamModal: 'Bukan Penanam Modal', metodePendaftaran: 'OSS',
    nib: '9120301234007', kodeWlkp: '3173.2019.000058',
    emailAdmin: 'nadia.putri@kadin-jerman.id',
    operators: [op('Nadia Putri', 'nadia.putri@kadin-jerman.id')],
    dokumen: doc(SURAT_OSS, 'surat-penunjukan-kadin-jerman.pdf', 240119),
  },
  '0977331022841000': {
    statusPenanamModal: 'Penanam Modal', metodePendaftaran: 'OSS',
    nib: '9120301234008', kodeWlkp: '3175.2024.001077',
    emailAdmin: 'kevin.halim@arunikastudio.co.id',
    operators: [op('Kevin Halim', 'kevin.halim@arunikastudio.co.id')],
    dokumen: doc(SURAT_OSS, 'surat-penunjukan-arunika.pdf', 290347),
  },
  '0661772011935000': {
    statusPenanamModal: 'Bukan Penanam Modal', metodePendaftaran: 'OSS',
    nib: '9120301234009', kodeWlkp: '3171.2022.000601',
    emailAdmin: 'laura.s@pacificwire.com',
    operators: [op('Laura Simanjuntak', 'laura.s@pacificwire.com')],
    dokumen: doc(SURAT_OSS, 'surat-penunjukan-pacific-wire.pdf', 221908),
  },
  '0045667788991000': {
    statusPenanamModal: 'Penanam Modal', metodePendaftaran: 'OSS',
    nib: '9120301234567', kodeWlkp: '3216.2015.004512',
    emailAdmin: 'rina.wulandari@nusantarabaja.co.id',
    operators: [op('Rina Wulandari', 'hrd@nusantarabaja.co.id')],
    dokumen: doc(SURAT_OSS, 'surat-penunjukan-nusantara-baja.pdf', 284112),
  },
};
