/**
 * @fileoverview Fiktif OCR results per jenis dokumen (KAK Modul 6: OCR
 * untuk semua modul layanan). Values match the demo data already shown in
 * the portal (calon TKA Ravi Shankar) and the registration form (PT
 * Nusantara Baja Presisi), so "Terapkan"/compare flows are meaningful.
 * keyakinan 0–1; one field per document is deliberately low (< 0.85) for
 * Paspor and NIB to demonstrate "Periksa kembali".
 */

export const OCR_FIXTURES = {
  Paspor: [
    { kunci: 'nama', label: 'Nama lengkap', nilai: 'Ravi Shankar',
      keyakinan: 0.96 },
    { kunci: 'nomorPaspor', label: 'No. paspor', nilai: 'U7740219',
      keyakinan: 0.98 },
    { kunci: 'kewarganegaraan', label: 'Kewarganegaraan', nilai: 'India',
      keyakinan: 0.97 },
    { kunci: 'tanggalLahir', label: 'Tanggal lahir',
      nilai: '21 Januari 1985', keyakinan: 0.91 },
    { kunci: 'tempatLahir', label: 'Tempat lahir', nilai: 'Chennai',
      keyakinan: 0.93 },
    { kunci: 'jenisKelamin', label: 'Jenis kelamin', nilai: 'Laki-laki',
      keyakinan: 0.97 },
    { kunci: 'tanggalTerbit', label: 'Tanggal penerbitan',
      nilai: '15 Maret 2021', keyakinan: 0.9 },
    { kunci: 'tempatTerbit', label: 'Tempat diterbitkan', nilai: 'Chennai',
      keyakinan: 0.88 },
    { kunci: 'berlakuSampai', label: 'Berlaku s.d.', nilai: '14 Maret 2031',
      keyakinan: 0.79 },
  ],
  NPWP: [
    { kunci: 'npwp', label: 'Nomor NPWP', nilai: '0012345678012000',
      keyakinan: 0.97 },
    { kunci: 'nama', label: 'Nama wajib pajak',
      nilai: 'PT Nusantara Baja Presisi', keyakinan: 0.93 },
    { kunci: 'alamat', label: 'Alamat',
      nilai: 'Kawasan Industri Jababeka II, Cikarang Utara, Kab. Bekasi',
      keyakinan: 0.88 },
  ],
  NIB: [
    { kunci: 'nib', label: 'Nomor Induk Berusaha', nilai: '9120301234567',
      keyakinan: 0.95 },
    { kunci: 'nama', label: 'Nama pelaku usaha',
      nilai: 'PT Nusantara Baja Presisi', keyakinan: 0.82 },
    { kunci: 'kbli', label: 'KBLI utama', nilai: '24101 — Industri Besi dan Baja Dasar',
      keyakinan: 0.9 },
  ],
  Akta: [
    { kunci: 'nomorAkta', label: 'Nomor akta', nilai: '17', keyakinan: 0.94 },
    { kunci: 'tanggalAkta', label: 'Tanggal akta', nilai: '3 Maret 2019',
      keyakinan: 0.9 },
    { kunci: 'notaris', label: 'Notaris', nilai: 'Notaris Contoh, S.H., M.Kn.',
      keyakinan: 0.86 },
  ],
  Ijazah: [
    { kunci: 'namaLulusan', label: 'Nama lulusan', nilai: 'Ravi Shankar',
      keyakinan: 0.94 },
    { kunci: 'jenjang', label: 'Jenjang pendidikan', nilai: 'D4/S1',
      keyakinan: 0.96 },
    { kunci: 'institusi', label: 'Institusi', nilai: 'Anna University',
      keyakinan: 0.9 },
    { kunci: 'tahunLulus', label: 'Tahun lulus', nilai: '2007',
      keyakinan: 0.97 },
  ],
  'Dokumen Pendukung': [
    { kunci: 'nomorDokumen', label: 'Nomor dokumen',
      nilai: '045/SK/HRD/IX/2026', keyakinan: 0.96 },
    { kunci: 'tanggalDokumen', label: 'Tanggal dokumen',
      nilai: '14 September 2026', keyakinan: 0.92 },
    { kunci: 'penerbit', label: 'Penerbit',
      nilai: 'PT Nusantara Baja Presisi', keyakinan: 0.89 },
    { kunci: 'perihal', label: 'Perihal',
      nilai: 'Permohonan penilaian kelayakan', keyakinan: 0.83 },
  ],
};

/** File names containing this word simulate an unreadable scan (422). */
export const OCR_UNREADABLE_MARKER = /buram/i;
