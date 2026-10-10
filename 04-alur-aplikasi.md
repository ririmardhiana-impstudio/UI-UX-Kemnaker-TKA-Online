# 04. Alur Aplikasi

Penanda sumber: **[T]** teramati, **[P]** buku panduan 2021, **[K]** KAK, **[I]** inferensi.

Semua swimlane ada di folder [swimlane/](swimlane/) sebagai SVG; buka [swimlane/index.html](swimlane/index.html) untuk melihat semuanya dalam satu halaman. Diagram lebar — geser mendatar.

Pelaku (lane) yang dipakai:

| Lane | Siapa |
|---|---|
| Pemberi Kerja TKA | Operator akun perusahaan/lembaga |
| SIAPkerja (SSO) | `account.kemnaker.go.id` |
| Sistem TKA Online | Aplikasi (ASP lama, SPA, API) |
| Petugas PPTKA | Verifikator/validator; pembagian peran di dalamnya tidak teramati |
| Direktur PPTKA | Penanda tangan HPK dan SK (a.n. Dirjen) |
| Simponi / bank persepsi | Penerbit kode billing dan penerima setoran |
| Ditjen Imigrasi | Penerima data calon TKA |

**Peringatan penting**: lane internal digambar dari sudut pandang pemohon. Urutan tahap pemeriksaan diketahui dari riwayat status di buku panduan 2021 (dokumen 07 bagian 4.9 dan 5.4) dan sudah dimasukkan ke swimlane 03; varian lain (04–07) memakai rantai yang sama tetapi digambar ringkas. Cara kerja di dalamnya (antrian, disposisi, penjadwalan ekspos, tanda tangan) tetap harus digali lewat wawancara.

Field tiap form, kolom tiap daftar, dan daftar dokumen per jenis layanan ada di [07-detail-layar-aplikasi-lama.md](07-detail-layar-aplikasi-lama.md).

## Pola umum

Hampir semua layanan inti mengikuti pola dua tahap ini:

```
TAHAP 1 — Hasil Penilaian Kelayakan (tingkat pemberi kerja/jabatan)
  isi permohonan → unggah dokumen → pernyataan → Proses
  → verifikasi petugas ⇄ perbaikan → ekspos daring → HPK terbit

TAHAP 2 — Pengesahan RPTKA (tingkat tiap TKA)
  pilih jabatan di HPK → isi data TKA → unggah dokumen TKA → pernyataan → Proses
  → verifikasi petugas ⇄ perbaikan → billing DKPTKA → bayar → SK terbit → kirim ke Imigrasi
```

Variasi antar layanan hanyalah **bagian mana yang dilewati**:

| Layanan | Tahap 1 (HPK) | Data TKA diisi | Bayar DKPTKA |
|---|---|---|---|
| > 6 bulan, Sementara | ya | setelah HPK (boleh sekaligus di awal) | ya |
| Direktur/Komisaris | ya | sekaligus di awal | ya |
| Perpanjangan | ya | sekaligus di awal (pilih TKA lama) | ya |
| Non-DKPTKA | ya | setelah HPK | tidak |
| Tanpa penilaian kelayakan | tidak | langsung | tidak |
| Perubahan | tidak | — | tidak |

Untuk rewrite, ini berarti satu mesin alur (workflow engine) dengan langkah yang bisa dinyalakan/dimatikan per jenis layanan, bukan enam alur yang ditulis terpisah.

---

## 1. Pendaftaran akun

![Swimlane pendaftaran](swimlane/01-pendaftaran-akun.svg)

**Kondisi sekarang [T]** (SPA):

1. Pengguna klik **Daftar** → `/apl/account/register-start`.
2. SPA memanggil `GET account/sso/status`. Tampil "Memeriksa sesi SIAPkerja…".
3. Bila belum ada sesi SSO, SPA meminta `GET account/auth-url?intent=register` dan mengalihkan ke SIAPkerja. Setelah login SSO, kembali ke pendaftaran. Judul form menampilkan "Didaftarkan oleh: [pengguna SSO]".
4. **Langkah 1 — NPWP**: pilih Kategori Badan Usaha, isi Nama Pemberi Kerja (sesuai NPWP), isi NPWP pusat. Server memvalidasi (`validate-npwp`); gagal bila "NPWP tidak valid atau sudah terdaftar".
5. **Langkah 2 — Legalitas**: Nomor Akta Pendirian, Nomor Pengesahan Akta Pendirian, NIB, kode WLKP. Server memvalidasi (`validate-legal`).
6. **Langkah 3 — Akun**: email, username, password, alamat lengkap, kode pos, provinsi → kabupaten/kota → kecamatan → kelurahan/desa (dropdown bertingkat). Server memvalidasi (`validate-profile`).
7. **Langkah 4 — Unggah dokumen**: NPWP, WLKP, NIB, dan dokumen lainnya (boleh banyak). Server memvalidasi (`validate-upload`).
8. **Langkah 5 — Ringkasan**: Detail Perusahaan, Detail Akun & Lokasi, Dokumen Terupload → **Submit** (`register/submit`, multipart, menyertakan ID login SSO).
9. Sistem mengirim email verifikasi. Pengguna klik tautan → `/apl/account/email-verify/:code`. Hasil: berhasil, sudah terverifikasi, atau tidak valid (dengan tombol kirim ulang).
10. Petugas memverifikasi data dan dokumen pendaftar. Kekurangan ditampilkan saat pengguna login. [P]
11. Setelah aktif dan terverifikasi, akun bisa mengajukan permohonan. [P]

Tiap langkah mengembalikan "tanda tangan" (`signatureStep1..3`) yang dikirim lagi di langkah berikutnya, sehingga langkah tidak bisa dilompati dari sisi klien. [T]

**Beda dengan buku panduan [P]**: versi 2021 tidak memakai SSO; langkah pertama adalah memilih status badan usaha dari tiga kelompok, kelompok C melewati NPWP, dan form berisi blok Pemimpin/Penanggung Jawab serta Izin Usaha. Blok-blok itu tidak ada di form SPA sekarang.

## 2. Login dan sesi

![Swimlane login](swimlane/02-login-dan-sesi.svg)

1. Buka `/apl/account/login`. SPA memanggil `GET account/sso/status`.
2. Sesi SSO tidak aktif → pesan "Mohon login SIAPkerja terlebih dahulu" dan tombol ke SSO (`auth-url?intent=login`). Sesi aktif → nama lengkap SSO ditampilkan dan form login dibuka.
3. Isi **username** dan **password** akun TKA Online (masing-masing maks. 20 karakter). reCAPTCHA muncul bila server memintanya (`loginStatusId = 4`).
4. `POST account/login`. Berhasil → API mengembalikan token akses (JWT); token penyegar disimpan sebagai cookie.
5. Pemeriksaan berurutan setelah login:
   - wajib ganti password → `/account/change-password-required`
   - wajib verifikasi email → `/account/verify-email-required`
   - wajib lengkapi profil → `/account/update-profile-required` (rute ini tidak terdaftar)
   - ada pengumuman aktif → `/dashboard/announcement`; pengguna klik "Saya Mengerti & Lanjutkan"
6. Lolos semua → browser diarahkan ke `dashboard.asp` (aplikasi lama) atau ke `returnUrl`.

Jadi pengguna memegang **dua lapis identitas**: akun SIAPkerja (orangnya) dan akun TKA Online (perusahaannya). [T]

**Sesi** [T]: token akses hanya di memori; saat halaman dimuat ulang SPA memanggil `refresh-token`. Bila API menjawab 401, SPA mencoba menyegarkan token sekali lalu mengulang permintaan; bila gagal, muncul dialog "Sesi Berakhir" dan pengguna kembali ke login dengan `returnUrl`.

**Logout** [T]: `POST account/logout` → kembali ke halaman login. Tersedia juga "logout SSO" yang mengalihkan ke `account.kemnaker.go.id/auth/logout`.

### Alur akun lain (tanpa swimlane)

| Alur | Langkah |
|---|---|
| Lupa password | Isi email → `forgot-password` → email berisi tautan → `reset-password?token=&email=` → password baru. Tombol kirim terkunci selama masa tunggu (default 300 detik). Email harus terdaftar pada tepat satu akun. |
| Ganti password | Password lama, baru, konfirmasi → setelah berhasil otomatis logout. |
| Ganti email | Password saat ini + email baru → `request-otp` → OTP 6 digit (berlaku 600 detik) → `confirm`. |
| Verifikasi email setelah login | Layar paksa; kirim ulang tautan (dengan hitung mundur) atau ganti email. |

## 3. Pengesahan RPTKA — pekerjaan lebih dari 6 bulan

![Swimlane pengesahan](swimlane/03-pengesahan-rptka-lebih-6-bulan.svg)

Alur acuan. **Sementara (1–6 bulan)** memakai alur yang sama, tanpa form TKI pendamping pada tahap HPK. [P]

### Tahap 1 — Hasil Penilaian Kelayakan [P]

1. Menu **Pengajuan Surat > Pengesahan RPTKA > Pekerjaan lebih dari 6 bulan**. Tampil "Daftar Hasil Penilaian Kelayakan dan Pengesahan RPTKA". Klik **Tambah Baru**.
2. **Input form permohonan penilaian kelayakan** → Submit.
3. **Edit form**: daftar jabatan, lokasi penempatan, kewarganegaraan TKA → Submit.
4. **Upload softcopy dokumen perusahaan** (pindai berwarna dari asli) → Simpan Dokumen.
5. **Uraian jabatan TKA** (350–800 karakter) → Simpan.
6. **Data TKI pendamping** (uraian jabatan 350–800 karakter, pas foto 122x144) → Simpan.
7. **Data pegawai/pengurus** → Simpan.
8. **Surat Pernyataan Penyangkalan** → centang setuju → klik tombol proses.
9. **Verifikasi data perusahaan** oleh petugas. Bila belum lengkap, baris permohonan menampilkan "Data atau dokumen belum lengkap, belum bisa diproses" dengan tautan edit tiap bagian; pemberi kerja memperbaiki lalu klik **Proses Kembali**.
10. **Telewicara/ekspos** dijadwalkan; jadwal tampil di kolom Proses Status. Panel "Jadwal Ekspos" di dasbor SPA menampilkan tanggal, jam, dan nomor antrian. [T]
11. Setelah ekspos: Pengesahan Ekspos → draft surat → Pemeriksaan Kasi → Kasubdit → tanda tangan Direktur → penomoran.
    **HPK terbit** paling lama 2 hari kerja setelah dinyatakan layak. Bisa dicetak: Berita Acara Persetujuan HPK dan HPK.

### Tahap 2 — Pengesahan RPTKA [P]

12. Pada baris HPK yang sudah terbit, klik **Proses Selanjutnya** → "Daftar Pengesahan RPTKA". Bagian atas: rencana jabatan beserta kuota. Bagian bawah: pengesahan yang sudah diajukan.
13. Pada jabatan yang dituju, klik panah di samping **Tambah** → pilih **Baru** atau **Pemegang Izin Tinggal**.
14. **Form data TKA** → Submit. Untuk pemegang izin tinggal wajib mengisi Nomor Registrasi (Permit Number) yang dicocokkan dengan data Imigrasi.
15. **Upload dokumen TKA** → Simpan Dokumen.
16. **Data pegawai/pengurus** → Simpan.
17. **Surat Pernyataan Penyangkalan** → setuju → proses. Kuota jabatan terisi.
18. **Verifikasi data calon TKA** oleh petugas; bila kurang, perbaiki lalu **Proses Kembali**.
19. Pemeriksaan berjenjang: Subkoordinator → Koordinator → **Persetujuan Direktur**.
20. **Surat pemberitahuan pembayaran DKPTKA** terbit (kolom "Jangka Waktu Disetujui"). Lihat alur 9.
21. Setelah pembayaran terkonfirmasi, **Pengesahan RPTKA terbit** tanpa langkah manusia lagi; data calon TKA dikirim otomatis ke Ditjen Imigrasi; status "terkirim ke Imigrasi" tampil di daftar; SK bisa dicetak.

Yang tidak tergambar karena tidak teramati: penolakan (tidak layak), pembatalan oleh pemohon (lewat email `user.pptka@`), dan kedaluwarsa permohonan.

## 4. Pengesahan RPTKA — Direktur/Komisaris

![Swimlane direktur](swimlane/04-pengesahan-rptka-direktur-komisaris.svg)

Beda dari alur 3: data dan dokumen TKA diisi **sekaligus** dengan permohonan, petugas memverifikasi dokumen dan data TKA dalam satu langkah, baru kemudian penilaian kelayakan, HPK, pembayaran, dan penerbitan. Diagram resmi tidak menyebut "tatap muka daring" untuk varian ini. [T]

## 5. Pengesahan RPTKA Non-DKPTKA

![Swimlane non-dkptka](swimlane/05-pengesahan-rptka-non-dkptka.svg)

Untuk lembaga sosial, keagamaan, dan jabatan tertentu di lembaga pendidikan. Sama dengan alur 3 dengan dua beda: form permohonan meminta **nomor dan tanggal surat persetujuan pembebasan DKPTKA**, dan **tidak ada langkah pembayaran** — setelah data calon TKA diverifikasi, SK langsung terbit. [P]

## 6. Pengesahan RPTKA tanpa penilaian kelayakan

![Swimlane non-hpk](swimlane/06-pengesahan-rptka-tanpa-hpk.svg)

Untuk instansi pemerintah, perwakilan negara asing, badan internasional. Satu tahap saja [P]:

1. **Pengajuan Surat > Pengesahan RPTKA Tanpa Penilaian Kelayakan >** Baru / Jangka Pendek / Perpanjangan → Tambah Baru.
2. Form data calon TKA → unggah dokumen → data pegawai/pengurus → pernyataan → proses.
3. Verifikasi data calon TKA ⇄ perbaikan.
4. Pengesahan RPTKA Non-DKPTKA (Non-HPK) terbit → data dikirim ke Imigrasi.

Untuk perpanjangan: pilih dulu Notifikasi Non RPTKA atau Pengesahan sebelumnya, klik **Perpanjang**.

## 7. Perpanjangan Pengesahan RPTKA

![Swimlane perpanjangan](swimlane/07-perpanjangan-pengesahan-rptka.svg)

1. **Pengajuan Surat > Pengesahan RPTKA > Perpanjangan > Tambah Baru**. [P]
2. **Pilih RPTKA atau HPK** sebelumnya yang akan diperpanjang.
3. **Pilih TKA** — centang TKA yang diperpanjang → Lanjut.
4. **Edit form permohonan** (data terisi dari dokumen sebelumnya) → Submit.
5. Unggah dokumen → uraian jabatan → TKI pendamping → pengurus → pernyataan → **Proses**.
6. Verifikasi ⇄ perbaikan → ekspos → HPK perpanjangan.
7. **Proses Selanjutnya** → klik **Tambah** pada jabatan → centang nama TKA dari pengesahan sebelumnya → Lanjut → edit data TKA, unggah dokumen TKA, pengurus, pernyataan.
8. Billing → bayar → SK perpanjangan → kirim ke Imigrasi.

Diagram resmi menggambarkan data TKA diunggah sekaligus di langkah pertama; buku panduan menggambarkannya dua tahap seperti di atas. Urutan yang benar-benar berjalan perlu dicek di sistem. [T][P]

Prasyarat yang diingatkan dasbor [T]: BPJS TKA aktif, NPWP TKA aktif di Coretax, laporan pendampingan dan alih keahlian sudah dikirim. Dasbor juga menunjukkan, per pengesahan yang hampir habis, HPK mana yang tersedia dan apakah sudah diperpanjang.

Varian: **Perpanjangan Non-DKPTKA** (tanpa TKI pendamping pada langkah 5, tanpa bayar) dan **Perpanjangan tanpa HPK** (lihat alur 6).

## 8. Perubahan Pengesahan RPTKA

![Swimlane perubahan](swimlane/08-perubahan-pengesahan-rptka.svg)

Satu-satunya layanan inti yang sudah di SPA, sehingga paling rinci teramati. [T]

1. **Daftar Perubahan Pengesahan RPTKA** — tabel: Barcode · Pengesahan RPTKA (barcode, nomor, tanggal) · Nama TKA (paspor, jabatan) · Jenis Perubahan · Persyaratan (dokumen ✓/✗, pengurus ✓/✗) · Status. Cari minimal 3 karakter; 10/25/50 baris per halaman.
2. **Tambah Baru** → isi **Barcode Pengesahan RPTKA** → sistem menampilkan SK No., Nama Pemberi Kerja, Nama TKA, Lokasi Kerja.
3. **Input Data Perubahan**:
   - No. Surat Permohonan, Tanggal Surat Permohonan (tidak boleh sebelum tanggal SK lama), Keterangan (maks. 250)
   - **Jenis Perubahan** (pilih satu):
     - *Data Tenaga Kerja Asing* — centang bagian yang diubah: Data Nama · Data Kelahiran (tempat, tanggal) · Data Paspor (nomor, kewarganegaraan) · Data Alamat. Minimal satu dicentang, dan nilai baru harus berbeda dari nilai lama.
     - *Alamat Pemberi Kerja* — jalan, provinsi → kabupaten/kota → kecamatan → desa/kelurahan, kode pos.
     - *Lokasi Kerja* — daftar lokasi; minimal satu.
   - Nilai lama ditampilkan berdampingan ("Semula tertulis"). Simpan → berpindah ke halaman edit.
4. **Upload Dokumen Perubahan** — daftar kategori dokumen dari server, masing-masing dengan format dan ukuran maksimum; bisa pratinjau; ada "Tambah Upload Baru (Optional)" dengan keterangan.
5. **Pengurus** — jenis (Karyawan Pemberi Kerja / Pihak Ketiga-Agent), nama lengkap, nomor kontak (angka saja), nama perusahaan, unggah scan identitas (maks. 2 MB).
6. **Ringkasan** — tombol **Proses** aktif hanya bila dokumen dan pengurus lengkap → dialog **Surat Pernyataan Penyangkalan** → setuju → diajukan.
7. Petugas memeriksa data dan kelengkapan; SK Perubahan terbit dalam 2 hari. [T diagram resmi]
8. Status terbit → tombol **Cetak**: "Keputusan Dirjen … tentang Perubahan Pengesahan RPTKA", memuat "Semula tertulis" dan nilai baru, tanda tangan Direktur PPTKA a.n. Dirjen, QR code, dan tembusan.

Selama masih draf pemohon bisa **Batalkan Pengajuan** dengan alasan. Riwayat status bisa dibuka dari daftar.

Diagram resmi menyebut empat objek perubahan (alamat pemberi kerja, identitas TKA, lokasi kerja, nama tenaga kerja pendamping). Antarmuka SPA hanya menyediakan tiga yang pertama; store API punya `t4` yang belum dipakai antarmuka — kemungkinan untuk tenaga kerja pendamping. [T][I]

## 9. Pembayaran DKPTKA

![Swimlane pembayaran](swimlane/09-pembayaran-dkptka.svg)

1. Data calon TKA dinyatakan lengkap dan benar, lalu diperiksa berjenjang sampai Persetujuan Direktur. [P]
2. Sistem meminta kode billing ke Simponi; surat perintah pembayaran terbit atas nama Direktur PPTKA. [T][K]
3. Tagihan tampil di daftar pengesahan (bisa dicetak) dan di panel dasbor "Billing belum dibayar".
4. Pemberi kerja **memeriksa data TKA pada surat** lalu membayar di bank persepsi (contoh surat di buku panduan menyebut BNI, Mandiri, BRI) dengan menunjukkan kode billing. Jumlah = US$100 x jumlah bulan, dibayar di muka.
5. Batas bayar 5 hari kerja. Lewat batas: Simponi memberi tahu kedaluwarsa → pemberi kerja klik Proses lagi → kode billing baru terbit.
6. Pembayaran terverifikasi → lanjut penerbitan SK.

Cabang yang tidak tergambar: perpanjangan yang DKPTKA-nya masuk pendapatan daerah dibayar ke pemda, lalu **divalidasi pejabat pemda** sebelum SK terbit (Permenaker 8/2021 Ps. 36 ayat 7). Peran "Admin Daerah" di KAK berkaitan dengan ini. [T][K]

## 10. Pelaporan penggunaan TKA

![Swimlane pelaporan](swimlane/10-pelaporan-tka.svg)

`/apl/laporan`, terbuka dari menu publik "Laporan TKA" (perlu login). [T]

1. **Ringkasan**: profil pemberi kerja (nama, alamat, telepon, faksimil, email), pilihan **Periode** (tahun; default tahun lalu), penjelasan status Draft/Terkirim.
2. Tabel empat laporan, tiap baris: nama, jumlah data, terakhir diperbarui, status, tombol **Buka · Upload · Print**.
   - Laporan Pelaksanaan Penggunaan TKA
   - Laporan Pelaksanaan Pendidikan dan Pelatihan Kerja bagi Tenaga Kerja Pendamping TKA
   - Laporan Pelaksanaan Alih Teknologi dan Alih Keahlian
   - Laporan Berakhirnya Penggunaan TKA
3. **Buka**: tabel data + form tambah/edit/hapus (field di dokumen 05).
4. **Upload**: unduh templat → unggah `.xlsx` (maks. 1 MB) dengan deskripsi → **Review dan Proses**: baris tidak valid ditampilkan, lalu diproses.
5. **Kirim Laporan Periode N** → konfirmasi → keempat laporan berstatus Terkirim → "Terima kasih sudah mengirimkan Laporan TKA Periode N".
6. **Print** tersedia setelah Terkirim.

## 11. Alur yang diketahui ada tetapi tidak teramati

| Alur | Yang diketahui | Sumber |
|---|---|---|
| Pencabutan | Halaman `aps_imta_list.asp?t=c`; daftar dokumen syarat; menghasilkan SK Pencabutan | [T][P] |
| Penarikan DKPTKA | Setelah pencabutan karena TKA batal datang; perlu rekening USD | [P] |
| Peralihan dari RPTKA lama / Notifikasi | Pilih RPTKA lama → data TKA → dokumen → pengurus → Proses → verifikasi → bayar → terbit. Untuk perpanjangan Notifikasi: "dengan RPTKA yang sama" atau "dengan RPTKA baru" | [P] |
| Rangkap jabatan | Syarat tambahan surat persetujuan pemberi kerja pertama | [T] |
| Start-up / vokasi | Isi data calon TKA → Direktur menerbitkan surat penggunaan TKA | [T] FAQ |
| KEK dan IKN | Varian alur 3/4/7 dengan penanda kawasan | [T] |
| TA.03 alih jabatan / alih sponsor | Lewat email `ta03pptka@` | [T] |
| Koreksi data pasca-terbit | Lewat tiket Hotline (lihat kategori di dokumen 02) | [T] |
| Hotline | Login TKA Online → buat tiket dengan kategori → chat dengan agen (teks, gambar, berkas) → agen menutup tiket; agen punya dasbor jumlah tiket dan kinerja | [T] |
| Verifikasi akun oleh petugas | Disebut, detail tidak terlihat | [P] |
| Seluruh back-office | — | tidak teramati |
