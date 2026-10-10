/**
 * @fileoverview Contracts + validators for employer registration:
 * POST /auth/register (5-step wizard: status penanam modal, jenis pemberi
 * kerja, data perusahaan via kode WLKP, data operator, dokumen),
 * POST /auth/register/company-lookup (OSS by kode WLKP) and
 * POST /auth/register/operator-check (cek email operator ke SIAPKerja).
 * Flow dari diagram "Registrasi Operator TKA-Online" (usulan KAK
 * Modul 1), dipicu dari menu layanan setelah login SIAPKerja (bukan dari
 * tombol terpisah di halaman login): docs/shared/business-rules.md
 * AK-13/14/15/16.
 * Rules: uploads/03-aktor-layanan-dan-aturan-bisnis.md §2.2, §6.4.
 */

import { mergeErrors, validateContract } from './schema.js';

/**
 * Status penanam modal (usulan KAK Modul 1, AK-13): langkah 1, menentukan
 * daftar Jenis Pemberi Kerja di langkah 2.
 */
export const STATUS_PENANAM_MODAL = ['Penanam Modal', 'Bukan Penanam Modal'];

/**
 * Jenis Pemberi Kerja per status penanam modal (langkah 2, AK-13).
 * Pemetaan hasil gabungan dari daftar lama (19 kategori) — "Yayasan" baru,
 * "Kantor Berita Asing" dan "Kantor Perwakilan Dagang/Perusahaan Asing"
 * digabung; perlu konfirmasi Direktorat PPTKA [I].
 */
export const JENIS_PEMBERI_KERJA_OPTIONS = {
  'Penanam Modal': [
    'Perusahaan/badan usaha dengan modal dalam negeri',
    'Perusahaan dengan modal asing',
    'Joint Venture',
  ],
  'Bukan Penanam Modal': [
    'Instansi Pemerintah', 'Lembaga Sosial', 'Yayasan',
    'Perusahaan Swasta Asing', 'Perusahaan Swasta Nasional',
    'Lembaga Pemerintah Non Kementerian', 'Kementerian',
    'Badan Internasional', 'Lembaga Keagamaan', 'Perwakilan Negara Asing',
    'Lembaga Pendidikan dan Kebudayaan',
    'Kantor Perwakilan Dagang Asing/Kantor Perwakilan Perusahaan Asing',
    'Kantor Berita Asing', 'Start-up', 'Kamar Dagang', 'Vokasi',
  ],
};

export const ALL_JENIS_PEMBERI_KERJA = [
  ...JENIS_PEMBERI_KERJA_OPTIONS['Penanam Modal'],
  ...JENIS_PEMBERI_KERJA_OPTIONS['Bukan Penanam Modal'],
];

/**
 * Jenis Pemberi Kerja yang tersedia untuk satu status penanam modal.
 * @param {?string} status
 * @return {!Array<string>} Semua pilihan bila status tidak dikenali.
 */
export function jenisForStatus(status) {
  return JENIS_PEMBERI_KERJA_OPTIONS[status] ?? ALL_JENIS_PEMBERI_KERJA;
}

/**
 * Metode pendaftaran (langkah 2, usulan [I] — belum ada di KAK/diagram):
 * `OSS` lanjut isi kode WLKP di langkah 3 (AK-14); `Non-OSS` isi NPWP dan
 * nama perusahaan/instansi manual, untuk instansi/lembaga yang tidak
 * terdaftar OSS (lihat AK-18).
 */
export const METODE_PENDAFTARAN = ['OSS', 'Non-OSS'];

export const WLKP_PATTERN = '^[0-9]{4}\\.[0-9]{4}\\.[0-9]{6}$';
export const NPWP_PATTERN = '^[0-9]{15,16}$';
export const NIB_PATTERN = '^[0-9]{13}$';
export const MAX_OPERATORS = 2;
export const REGISTER_DOCUMENT_TYPE = 'Surat Penunjukan Operator/PIC';
/** Dokumen langkah 5 untuk metode Non-OSS (AK-18, usulan [I]) — pengganti
 * Surat Penunjukan Operator/PIC untuk instansi/lembaga tanpa OSS. */
export const NON_OSS_DOCUMENT_TYPE = 'Surat Permohonan Pengajuan TKA';
export const REGISTER_STEP_LABELS = [
  'Status Penanam Modal', 'Jenis Pemberi Kerja', 'Data Perusahaan',
  'Data Operator', 'Dokumen',
];

export const REGISTER_STEP_CONTRACTS = [
  {
    name: 'RegisterStepStatus',
    description: 'Langkah 1 — status penanam modal (usulan KAK Modul 1, ' +
      'AK-13), dipicu dari menu layanan TKA Online setelah login SIAPKerja.',
    fields: {
      statusPenanamModal: { type: 'string', required: true,
        enum: STATUS_PENANAM_MODAL, example: 'Penanam Modal' },
    },
  },
  {
    name: 'RegisterStepJenis',
    description: 'Langkah 2 — jenis pemberi kerja, daftar pilihan ' +
      'tergantung status penanam modal langkah 1 (AK-13); metode ' +
      'pendaftaran OSS/Non-OSS menentukan isian langkah 3 (AK-18).',
    fields: {
      jenisPemberiKerja: { type: 'string', required: true,
        enum: ALL_JENIS_PEMBERI_KERJA,
        example: 'Perusahaan dengan modal asing' },
      metodePendaftaran: { type: 'string', required: true,
        enum: METODE_PENDAFTARAN, example: 'OSS' },
    },
  },
  {
    name: 'RegisterStepPerusahaan',
    description: 'Langkah 3 — data perusahaan, HANYA untuk metode `OSS`: ' +
      'kode pendaftaran WLKP, dicocokkan ke OSS untuk memperoleh NIB, ' +
      'WLKP, dan NPWP (AK-14); field nib/npwp/namaPemberiKerja terisi ' +
      'otomatis dari hasil POST /auth/register/company-lookup. Metode ' +
      '`Non-OSS` (AK-18) melewati langkah ini sepenuhnya — lihat ' +
      '`validateRegisterStep` — npwp/namaPemberiKerja/nib/kodeWlkp tidak ' +
      'dikumpulkan sama sekali untuk Non-OSS [I, keterbatasan demo yang ' +
      'disengaja: tampilan yang bergantung nama perusahaan/NPWP kosong ' +
      'untuk pendaftaran Non-OSS].',
    fields: {
      kodeWlkp: { type: 'string', required: false, pattern: WLKP_PATTERN,
        message: 'Format kode WLKP: 0000.0000.000000.',
        example: '3216.2015.004512' },
      nib: { type: 'string', required: false, pattern: NIB_PATTERN,
        example: '9120301234567' },
      npwp: { type: 'string', required: true, pattern: NPWP_PATTERN,
        example: '0012345678012000' },
      namaPemberiKerja: { type: 'string', required: true, maxLength: 200,
        example: 'PT Nusantara Baja Presisi' },
    },
  },
  {
    name: 'RegisterStepOperator',
    description: 'Langkah 4 — data operator: email operator (maksimal 2, ' +
      'minimal 1), dicocokkan ke SIAPKerja (AK-16).',
    fields: {
      operatorEmails: { type: 'array', required: true, maxItems: MAX_OPERATORS,
        items: 'OperatorEmailEntry',
        description: 'Setiap entri wajib status `terdaftar = true` ' +
          '(sudah dicek ke SIAPKerja) sebelum submit.',
        example: [{ email: 'hrd@nusantarabaja.co.id', nama: 'Rina Wulandari',
          terdaftar: true }] },
    },
  },
  {
    name: 'RegisterStepDokumen',
    description: 'Langkah 5 — unggah dokumen pendukung, lalu submit ' +
      'verifikasi ke Verifikator (AK-15). Jenis dokumen tergantung metode ' +
      'langkah 2 (AK-18): `OSS` -> Surat Penunjukan Operator/PIC, ' +
      '`Non-OSS` -> Surat Permohonan Pengajuan TKA.',
    fields: {
      documents: { type: 'array', required: true, maxItems: 1,
        items: 'RegisterDocument',
        example: [{ jenis: REGISTER_DOCUMENT_TYPE,
          fileName: 'surat-penunjukan-operator.pdf', fileSize: 284112,
          mimeType: 'application/pdf' }] },
    },
  },
];

export const OPERATOR_EMAIL_ENTRY = {
  name: 'OperatorEmailEntry',
  description: 'Satu baris email operator pada langkah Data Operator.',
  fields: {
    email: { type: 'string', required: true, format: 'email',
      maxLength: 254, example: 'hrd@nusantarabaja.co.id' },
    nama: { type: 'string', example: 'Rina Wulandari' },
    terdaftar: { type: 'boolean', required: true, example: true },
  },
};

export const COMPANY_LOOKUP_REQUEST = {
  name: 'CompanyLookupRequest',
  description: 'Langkah 3: cari data perusahaan di OSS dari kode ' +
    'pendaftaran WLKP (AK-14). Pola serupa OP-06 "Verifikasi NIB ke OSS" ' +
    'di kartu Profil, tanpa prasyarat sesi perusahaan.',
  fields: {
    kodeWlkp: { type: 'string', required: true, pattern: WLKP_PATTERN,
      message: 'Format kode WLKP: 0000.0000.000000.',
      example: '3216.2015.004512' },
  },
};

export const OPERATOR_CHECK_REQUEST = {
  name: 'OperatorCheckRequest',
  description: 'Langkah 4: cek apakah email operator terdaftar di ' +
    'SIAPKerja (AK-16).',
  fields: {
    email: { type: 'string', required: true, format: 'email',
      maxLength: 254, example: 'hrd@nusantarabaja.co.id' },
  },
};

export const REGISTER_DOCUMENT = {
  name: 'RegisterDocument',
  description: 'Metadata berkas pendaftaran. `jenis` tergantung metode ' +
    'pendaftaran langkah 2 — lihat `stepDokumenRules` (AK-18).',
  fields: {
    jenis: { type: 'string', required: true,
      enum: [REGISTER_DOCUMENT_TYPE, NON_OSS_DOCUMENT_TYPE],
      example: REGISTER_DOCUMENT_TYPE },
    fileName: { type: 'string', required: true,
      example: 'surat-penunjukan-operator.pdf' },
    fileSize: { type: 'integer', required: true, minimum: 1,
      example: 284112 },
    mimeType: { type: 'string', required: true,
      pattern: '^(application/pdf|image/.+)$',
      message: 'Hanya PDF atau gambar.', example: 'application/pdf' },
    berkasId: { type: 'string', required: false, maxLength: 64,
      description: 'Id berkas terunggah (dipakai pratinjau di akun ' +
        'Verifikator).' },
  },
};

export const REGISTER_REQUEST = {
  name: 'RegisterRequest',
  description: 'Pendaftaran pemberi kerja TKA (gabungan langkah 1–5).',
  fields: Object.assign(
    {}, ...REGISTER_STEP_CONTRACTS.map((step) => step.fields),
  ),
};

/**
 * Validate one registration step (1-based, 1..5).
 * @param {number} step
 * @param {!Object} payload Full wizard state; only step fields are checked.
 * @return {{valid: boolean, errors: !Object<string, string>}}
 */
export function validateRegisterStep(step, payload) {
  const body = payload ?? {};
  // Langkah 3 "Data Perusahaan" tidak ada untuk metode Non-OSS (AK-18) —
  // layar itu sendiri dilewati di wizard, jadi tidak ada field untuk
  // divalidasi sama sekali.
  if (step === 3 && body.metodePendaftaran === 'Non-OSS') {
    return { valid: true, errors: {} };
  }
  const contract = REGISTER_STEP_CONTRACTS[step - 1];
  if (!contract) {
    throw new Error(`Unknown register step: ${step}`);
  }
  const base = validateContract(contract, payload);
  const extraByStep = {
    1: () => ({}), 2: stepJenisRules, 3: stepPerusahaanRules,
    4: stepOperatorRules, 5: stepDokumenRules,
  };
  return mergeErrors(base, extraByStep[step](payload ?? {}));
}

/** @param {!Object} payload @return {{valid: boolean, errors: !Object}} */
export function validateCompanyLookup(payload) {
  return validateContract(COMPANY_LOOKUP_REQUEST, payload);
}

/** @param {!Object} payload @return {{valid: boolean, errors: !Object}} */
export function validateOperatorCheck(payload) {
  return validateContract(OPERATOR_CHECK_REQUEST, payload);
}

/** @param {!Object} payload @return {{valid: boolean, errors: !Object}} */
export function validateRegister(payload) {
  const results = [1, 2, 3, 4, 5].map((s) => validateRegisterStep(s, payload));
  const errors = Object.assign({}, ...results.map((r) => r.errors));
  return { valid: Object.keys(errors).length === 0, errors };
}

/** Langkah 2: jenis pemberi kerja wajib sesuai status penanam modal (AK-13). */
function stepJenisRules(payload) {
  if (payload.statusPenanamModal && payload.jenisPemberiKerja &&
      !jenisForStatus(payload.statusPenanamModal)
        .includes(payload.jenisPemberiKerja)) {
    return { jenisPemberiKerja: `Jenis pemberi kerja tidak termasuk ` +
      `status "${payload.statusPenanamModal}".` };
  }
  return {};
}

/** Langkah 3: kode WLKP wajib hanya untuk metode OSS (AK-18). */
function stepPerusahaanRules(payload) {
  if (payload.metodePendaftaran === 'OSS' && !payload.kodeWlkp) {
    return { kodeWlkp: 'Kode pendaftaran WLKP wajib diisi untuk metode OSS.' };
  }
  return {};
}

/** Langkah 4: minimal satu operator, semua entri wajib terdaftar (AK-16). */
function stepOperatorRules(payload) {
  const entries = Array.isArray(payload.operatorEmails)
    ? payload.operatorEmails : [];
  if (!entries.length) {
    return { operatorEmails: 'Minimal satu email operator wajib diisi.' };
  }
  const unverified = entries.find((entry) => !entry?.terdaftar);
  return unverified
    ? { operatorEmails:
        `${unverified.email}: belum terverifikasi di SIAPKerja.` }
    : {};
}

/**
 * Langkah 5: satu dokumen, jenis tergantung metode pendaftaran (AK-18) —
 * `OSS` -> Surat Penunjukan Operator/PIC, `Non-OSS` -> Surat Permohonan
 * Pengajuan TKA. PDF/gambar.
 */
function stepDokumenRules(payload) {
  const docs = Array.isArray(payload.documents) ? payload.documents : [];
  const doc = docs[0];
  if (!doc) {
    return {};
  }
  const expected = payload.metodePendaftaran === 'Non-OSS'
    ? NON_OSS_DOCUMENT_TYPE : REGISTER_DOCUMENT_TYPE;
  if (doc.jenis !== expected) {
    return { documents: `Dokumen wajib berjenis "${expected}".` };
  }
  if (!/^(application\/pdf|image\/.+)$/.test(doc.mimeType ?? '')) {
    return { documents: 'Hanya PDF atau gambar.' };
  }
  return {};
}
