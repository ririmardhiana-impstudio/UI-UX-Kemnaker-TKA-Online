# 03. Aktor, Layanan, dan Aturan Bisnis

Penanda sumber: **[T]** teramati, **[P]** buku panduan 2021, **[K]** KAK, **[I]** inferensi.

## 1. Daftar istilah

| Istilah | Arti |
|---|---|
| TKA | Tenaga Kerja Asing |
| Pemberi Kerja TKA | Badan yang mempekerjakan TKA; pemegang akun |
| RPTKA | Rencana Penggunaan Tenaga Kerja Asing |
| HPK | Hasil Penilaian Kelayakan — keluaran tahap pertama, berisi jabatan, jumlah, lokasi, dan jangka waktu yang disetujui |
| Pengesahan RPTKA | SK per TKA yang terbit setelah data calon TKA diverifikasi (dan DKPTKA dibayar) |
| DKPTKA | Dana Kompensasi Penggunaan TKA, US$100 per jabatan per orang per bulan |
| Non-DKPTKA | Layanan yang dibebaskan dari DKPTKA |
| Non-HPK | Layanan yang dikecualikan dari penilaian kelayakan |
| Ekspos / telewicara | Penilaian kelayakan tatap muka secara daring |
| TKI / Tenaga Kerja Pendamping | Pekerja Indonesia penerima alih keahlian dari TKA |
| Notifikasi, IMTA | Bentuk izin rezim lama (sebelum PP 34/2021); masih ada sisa yang hidup |
| TA.01, TA.03 | Rekomendasi kawat visa (lama) dan rekomendasi alih jabatan/alih sponsor |
| Dahsuskim | Kategori darurat/khusus keimigrasian (muncul di menu dan video tutorial) [I] |
| ITAS / ITAP | Izin tinggal terbatas / tetap |
| WLKP | Wajib Lapor Ketenagakerjaan Perusahaan |
| Simponi | Sistem penerimaan negara Kemenkeu; penerbit kode billing |
| Barcode | Nomor identitas di TKA Online. Dokumen terbit (HPK, Pengesahan) memakai 8 digit [T][P]; permohonan HPK memakai 12 digit [P] |
| SK01, SK02, SK05 | Kode internal di API: SK01 ≈ HPK, SK02 ≈ Pengesahan RPTKA, SK05 = Perubahan Pengesahan [I dari nama endpoint] |

## 2. Aktor

### 2.1 Pengguna eksternal

| Aktor | Peran | Sumber |
|---|---|---|
| Pemberi Kerja TKA (operator akun) | Mendaftar, mengajukan, mengunggah, membayar, mencetak SK, melapor | [T][P] |
| Pengurus / kuasa | Orang yang mengurus permohonan: "Karyawan Pemberi Kerja" atau "Pihak Ketiga / Agent"; datanya dicatat per permohonan | [T] |
| Wakil pemberi kerja saat ekspos | Hadir pada penilaian kelayakan daring | [T] |
| TKA | Subjek data; bukan pengguna sistem | [T] |

Satu pemberi kerja hanya mendapat satu akun ("tidak duplikasi") [P]. KAK meminta hierarki multi-operator per perusahaan [K] — ini perubahan, bukan fitur yang sudah ada.

### 2.2 Tiga kelompok pemberi kerja

Pengelompokan ini menentukan menu, alur, dan kewajiban bayar. [P]

| Kelompok | Status badan usaha (pilihan saat daftar) | HPK | DKPTKA | Syarat NPWP saat daftar |
|---|---|---|---|---|
| A. Swasta | Perusahaan Swasta Asing · Swasta Nasional · PMA · PMDN · Kantor Perwakilan Dagang Asing · Kantor Perwakilan Perusahaan Asing · Kantor Berita Asing Swasta · Kamar Dagang · Lembaga Pendidikan dan Kebudayaan · Start-up · Vokasi | Ya | Ya | Ya |
| B. Lembaga/yayasan | Lembaga Sosial · Lembaga Keagamaan | Ya | Tidak | Ya |
| C. Pemerintah/internasional | Instansi Pemerintah · Badan Internasional · Kantor Berita Asing Pemerintah · Kementerian · LPNK · Perwakilan Negara Asing | Tidak | Tidak | Tidak |

Di SPA pendaftaran sekarang, daftar kategori diambil dari API (`getLegalCategory`) dan semua kategori melewati langkah NPWP. Apakah kelompok C masih dibebaskan dari NPWP tidak terlihat dari klien. [T][I]

Yang **tidak boleh** menjadi pemberi kerja TKA: perseroan perorangan. [T]

### 2.3 Pengguna internal

Layarnya tidak teramati. Yang diketahui:

| Peran | Sumber |
|---|---|
| Petugas verifikasi akun pendaftar | [P] |
| Petugas verifikasi data dan unggahan; petugas ekspos | [P] riwayat status |
| Kasi → Kasubdit (pada HPK), Subkoordinator → Koordinator (pada Pengesahan) | [P] riwayat status; dua pasang nama untuk jenjang yang sama |
| Verifikator, Validator | [T] muncul sebagai kategori di aplikasi Hotline: "Antrian Verifikator", "Antrian Validator", "Pendingan Verifikator", "Pendingan Validator" |
| Petugas ekspos | [K] |
| Direktur PPTKA | [T] penanda tangan SK (a.n. Dirjen) |
| Direktur Jenderal | [K] |
| Admin Pusat, Admin Daerah | [K] diagram use case |
| Pejabat pemda | [T] validasi pembayaran DKPTKA sebagai retribusi daerah |
| Agen hotline | [T] aplikasi Hotline punya antarmuka agen dan dasbor kinerja petugas |

Rantai persetujuan yang diminta KAK untuk sistem baru: Verifikator → Validator → Petugas Ekspos → Direktur → Direktur Jenderal. [K]

## 3. Katalog layanan

### 3.1 Layanan rezim sekarang (PP 34/2021)

| # | Layanan | Kelompok | HPK | Bayar | Di mana sekarang |
|---|---|---|---|---|---|
| 1 | Pengesahan RPTKA pekerjaan lebih dari 6 bulan (7 bulan – 2 tahun) | A, B | Ya | A: ya | ASP |
| 2 | Pengesahan RPTKA sementara (1–6 bulan) | A, B | Ya | A: ya | ASP |
| 3 | Pengesahan RPTKA Direktur/Komisaris | A | Ya | Ya | ASP |
| 4 | Pengesahan RPTKA Non-DKPTKA | B (+ jabatan tertentu lembaga pendidikan) | Ya | Tidak | ASP |
| 5 | Pengesahan RPTKA tanpa penilaian kelayakan (baru / jangka pendek) | C | Tidak | Tidak | ASP |
| 6 | Perpanjangan Pengesahan RPTKA | A, B | Ya | A: ya | ASP |
| 7 | Perpanjangan Non-DKPTKA | B | Ya | Tidak | ASP |
| 8 | Perpanjangan tanpa penilaian kelayakan | C | Tidak | Tidak | ASP |
| 9 | Pemegang Izin Tinggal (alih status) — sub-varian saat menambah TKA pada HPK | A, B | mengikuti HPK | mengikuti | ASP |
| 10 | Rangkap jabatan | A (sektor tertentu) | — | — | ASP [I] |
| 11 | Perubahan Pengesahan RPTKA | semua | Tidak | Tidak | **SPA** |
| 12 | Pencabutan Pengesahan RPTKA/Notifikasi | semua | — | — | ASP (iframe di SPA) |
| 13 | Penarikan DKPTKA (pengembalian) | A | — | — | ASP |
| 14 | Surat penggunaan TKA Start-up / Vokasi (≤ 3 bulan, tanpa Pengesahan) | A | Tidak | — | ASP |
| 15 | Layanan kawasan khusus: KEK (`kek=88`) dan IKN (`w=ikn`) | A | — | — | ASP |
| 16 | Pelaporan tahunan (4 laporan) | semua | — | — | **SPA** |
| 17 | TA.03 alih jabatan / alih sponsor | semua | — | — | di luar sistem (email) |

### 3.2 Layanan warisan rezim lama

Masih tersedia di menu [P]: **Sisa RPTKA Lama**, **Sisa Notifikasi**, **Peralihan** (menerbitkan Pengesahan RPTKA dari RPTKA lama yang masih berlaku; memperpanjang Notifikasi menjadi Pengesahan RPTKA).

Buku panduan terbit 2021; RPTKA lama berlaku paling lama beberapa tahun. Sebagian besar menu ini kemungkinan sudah tidak punya data aktif pada 2026, tetapi itu harus dipastikan dari basis data, bukan diasumsikan. [I]

### 3.3 Layanan pendukung

Akun (daftar, login, verifikasi email, reset/ganti password, ganti email, profil dan dokumen perusahaan) · dasbor (jadwal ekspos, akan berakhir, billing) · pengumuman wajib baca · hotline tiket/chat · informasi publik.

## 4. Syarat subjek

**TKA** [T]:

1. pendidikan sesuai kualifikasi jabatan,
2. kompetensi atau pengalaman kerja minimal 5 tahun sesuai jabatan,
3. mengalihkan keahlian kepada Tenaga Kerja Pendamping.

**Jabatan**: mengacu Kepmenaker 228/2019 (boleh) dan 349/2019 (dilarang). "Jabatan tidak tersedia" adalah kategori tiket hotline, artinya master jabatan membatasi pilihan dan penambahannya lewat petugas. [T]

## 5. Matriks persyaratan dokumen

Sumber: halaman Persyaratan [T], dilengkapi buku panduan [P] bila lebih rinci. "Surat tugas/kuasa" selalu disertai salinan identitas pemberi dan penerima kuasa.

### 5.1 Tahap penilaian kelayakan (dokumen pemberi kerja)

| Dokumen | Sementara | > 6 bulan / KEK | Non-DKPTKA (B) | Perpanjangan |
|---|:-:|:-:|:-:|:-:|
| Surat permohonan | ✓ | ✓ | ✓ | ✓ |
| Surat tugas / kuasa | ✓ | ✓ | ✓ | ✓ |
| NIB dan/atau izin usaha | ✓ | ✓ | ✓ | |
| Akta + SK pengesahan pendirian/perubahan | ✓ | ✓ | ✓ | |
| Bukti WLKP | ✓ | ✓ | ✓ | ✓ |
| Domisili pemberi kerja | ✓ | ✓ | ✓ | ✓ |
| Rancangan perjanjian kerja | ✓ | ✓ | ✓ | |
| Bagan struktur organisasi | | ✓ | ✓ | |
| Surat persetujuan pembebasan DKPTKA dari K/L terkait | | | ✓ | |
| Laporan realisasi diklat bagi tenaga kerja Indonesia | | | | ✓ |

### 5.2 Tahap Pengesahan RPTKA (dokumen per TKA)

| Dokumen | Baru | Perpanjangan |
|---|:-:|:-:|
| Ijazah | ✓ | |
| Sertifikat kompetensi / pengalaman kerja | ✓ | |
| Perjanjian kerja | ✓ | ✓ |
| Paspor (berwarna) | ✓ | ✓ |
| Pas foto 4x6 latar merah | ✓ | ✓ |
| Izin tinggal yang masih berlaku | | ✓ |
| BPJS Ketenagakerjaan dan BPJS Kesehatan TKA | | ✓ [P] |
| NPWP TKA | | ✓ [P] |
| Laporan pelaksanaan pendampingan | | ✓ |

Dokumen pemberi kerja pada tahap pengesahan (baru): surat permohonan · surat tugas/kuasa · surat permohonan visa kerja kepada Dirjen Imigrasi · rekening koran/tabungan · surat persetujuan Rp0,00 · surat penunjukan Tenaga Kerja Pendamping · surat pernyataan penjamin TKA.

Tambahan untuk TKA jangka pendek: polis asuransi yang minimal menjamin kecelakaan kerja (Permenaker 8/2021 Ps. 16). [T]

### 5.3 Kelompok C (tanpa HPK)

Surat permohonan dan alasan penggunaan TKA · surat tugas/kuasa · perjanjian kerja · dan/atau surat persetujuan instansi berwenang.

### 5.4 Layanan lain

| Layanan | Dokumen |
|---|---|
| Rangkap jabatan | + surat persetujuan pemberi kerja pertama |
| Perubahan | Surat permohonan · surat tugas/kuasa [P] · pendukung sesuai jenis: NIB/akta (alamat pemberi kerja), paspor (identitas TKA), domisili/kontrak (lokasi kerja), surat penunjukan (nama pendamping) |
| Pencabutan | Surat permohonan · surat kuasa · dokumen yang dicabut · bukti setor DKPTKA · ITAS/ITAP · paspor · bukti ERP/MERP atau stempel EPO, atau bukti PHK/pengunduran diri/surat kematian |
| Penarikan DKPTKA [P] | Surat permohonan · surat kuasa · SK pencabutan · bukti setor · bukti TKA batal datang · rekening bank USD atas nama pemberi kerja · NPWP |
| TA.03 alih jabatan | Surat permohonan · surat kuasa · RPTKA/HPK jabatan baru · ITAS/ITAP · Notifikasi/Pengesahan sebelumnya · akta terbaru (level direktur/komisaris) |
| TA.03 alih sponsor | Surat permohonan · surat kuasa · RPTKA/HPK lama dan baru · Notifikasi/Pengesahan sebelumnya · ITAS/ITAP · akta dan SK sesuai kasus (keluar-masuk direksi, ganti nama, merger) |

Halaman Persyaratan di situs dan buku panduan **tidak identik** (contoh: butir BPJS dan NPWP TKA untuk perpanjangan hanya ada di buku panduan; "Penarikan DKPTKA" hanya di buku panduan). Daftar dokumen final harus diambil dari konfigurasi sistem berjalan.

## 6. Aturan bisnis

### 6.1 Waktu dan SLA

| Aturan | Sumber |
|---|---|
| HPK terbit paling lama 2 hari kerja sejak penilaian kelayakan dinyatakan layak | [T] FAQ |
| Pengesahan RPTKA terbit paling lama 2 hari kerja sejak data calon TKA lengkap dan DKPTKA dibayar | [T] FAQ |
| Perubahan: 2 hari dari pemeriksaan ke penerbitan | [T] diagram alur |
| Pekerjaan lebih dari 6 bulan: masa berlaku 7 bulan s.d. 2 tahun | [P] |
| Perpanjangan diajukan 30 hari sebelum masa berlaku berakhir | [T] pengumuman |
| Rangkap jabatan: paling lama sampai akhir masa pengesahan di pemberi kerja pertama | [T] |
| Start-up/vokasi: tanpa Pengesahan RPTKA paling lama 3 bulan | [T] FAQ |
| Kode billing berlaku 5 hari kerja | [T] FAQ. Contoh surat tagihan di buku panduan menulis "5 (lima) hari" tanpa kata "kerja" [P] |
| RPTKA jangka pendek tidak bisa diperpanjang | [P] layar pilih RPTKA |
| Pengesahan berlaku N bulan sejak tanggal tanda masuk | [P] diktum SK |
| Pemberi kerja wajib melapor tiap 1 tahun | [P] diktum HPK |

### 6.2 DKPTKA

- Tarif US$100 per jabatan per orang per bulan, sebagai PNBP atau retribusi daerah. [T]
- Kurang dari 1 bulan tetap dibayar 1 bulan penuh. [T]
- Dibayar di muka untuk seluruh jangka waktu pengesahan. [T]
- Perpanjangan dengan lokasi kerja dalam satu provinsi/kabupaten/kota masuk pendapatan daerah; pembayarannya divalidasi pejabat pemda lebih dulu. [T][K]
- Kode billing kedaluwarsa: sistem menerbitkan ulang otomatis setelah menerima notifikasi kedaluwarsa dari Simponi **dan** pemberi kerja klik Proses lagi. [T]
- Kesalahan data TKA pada surat perintah bayar harus dikoreksi lewat hotline sebelum membayar; kalau tetap dibayar, jadi tanggung jawab pemberi kerja. [T]
- Penambahan/perubahan lokasi kerja hanya boleh bila tidak mengubah jenis pembayaran (PNBP ↔ pendapatan daerah). [T]
- Dibebaskan: kelompok B dan C.

### 6.3 Aturan proses

- Data calon TKA boleh disampaikan sekaligus saat permohonan HPK bila sudah siap. [T] FAQ
- WNA pemegang izin tinggal wajib diajukan sebagai jenis "pemegang izin tinggal", bukan "baru". Nomor registrasi izin tinggal diverifikasi ke data Imigrasi. [T][P]
- Setiap pengajuan diakhiri persetujuan **Surat Pernyataan Penyangkalan** (centang wajib). [T][P]
- Tiap jabatan pada HPK punya kuota TKA; kuota terisi saat Pengesahan diajukan. [P]
- Setelah Pengesahan terbit, data TKA dikirim otomatis ke Ditjen Imigrasi. [P]
- Rangkap jabatan hanya untuk: direksi/komisaris (nama tercantum di akta), pendidikan/pelatihan vokasi, ekonomi digital, migas KKKS; jabatan harus sama. [T]
- Pekerjaan sementara hanya untuk: film komersial berizin; audit/kendali mutu/inspeksi cabang lebih dari 1 bulan; pemasangan mesin, elektrikal, purna jual, produk dalam penjajakan; jasa impresariat; pekerjaan sekali selesai atau kurang dari 6 bulan. [T]
- Sanksi administratif: denda, penghentian sementara proses permohonan, pencabutan Pengesahan. Sistem perlu status "dihentikan sementara" per pemberi kerja. [T][I]
- Syarat praktis perpanjangan: TKA aktif BPJS TK dan Kesehatan, NPWP TKA aktif di Coretax, laporan pendampingan dan alih keahlian sudah disampaikan. [T] dasbor SPA

### 6.4 Validasi isian

| Isian | Aturan | Sumber |
|---|---|---|
| Uraian jabatan TKA dan TKI pendamping | 350–800 karakter | [P] |
| Foto TKI pendamping | 122 x 144 px; bmp/png/jpg/gif | [P] |
| Unggah dokumen permohonan (aplikasi lama) | jpg/png/bmp atau PDF, maks. 2 MB, pindai berwarna dari asli | [P] |
| Pas foto, permohonan VITAS, surat pernyataan dan jaminan, buku rekening, paspor | hanya JPG berwarna, maks. 250 KB | [P] |
| Pas foto TKA | form unggah menulis 3x4 cm; halaman Persyaratan menulis 4x6 latar merah — tidak konsisten | [P][T] |
| Sertifikat kompetensi, keterangan jabatan | maks. 250 karakter | [P] |
| Kartu identitas pengurus | kartu ID pegawai, bukan KTP | [P] |
| Nomor register izin tinggal Imigrasi | awalan 2B/2C/2D; rangkap jabatan hanya 2C/2D; dicocokkan dengan nomor paspor | [P] |
| Dokumen pendaftaran (aplikasi lama) | gambar jpeg/png | [P] |
| Dokumen pendaftaran (SPA) | `application/pdf, image/*` | [T] |
| Unggah scan identitas pengurus | maks. 2 MB, gambar atau PDF | [T] |
| Dokumen perubahan | ekstensi dan ukuran maksimum ditentukan per kategori oleh server | [T] |
| Unggah laporan | `.xlsx`, maks. 1 MB | [T] |
| NPWP | 15 atau 16 digit angka | [T] |
| Barcode | angka, maks. 8 digit | [T] |
| Kode pos | tepat 5 digit | [T] |
| Alamat (modul perubahan) | disusun otomatis dan dikapitalkan: jalan, KELURAHAN, KECAMATAN, KAB/KOTA, PROVINSI, KODE POS | [T] |

Rincian validasi akun dan form SPA ada di dokumen 05.

## 7. Status

### 7.1 Status akun saat login (`loginStatusId`) [T]

| Nilai | Perilaku di klien |
|---|---|
| 0, 1, tidak ada | login dianggap berhasil |
| 3 | tampilkan ajakan login SSO |
| 4 | tampilkan reCAPTCHA |
| 5 | alihkan ke halaman "Login gagal" |

Klaim pada token: `mustchangepassword`, `mustverifyemail`, `mustupdateprofile` — masing-masing memaksa pengguna menyelesaikan kewajiban itu sebelum bisa ke halaman lain.

### 7.2 Status permohonan Perubahan (`statusId`) [T]

| Nilai | Arti |
|---|---|
| 1 | Draf — masih bisa diedit, diunggah, dibatalkan, dan diajukan |
| 6 | Terbit — tombol cetak SK muncul |
| lainnya | Tidak tertulis di klien; label status dikirim server (`displayHeaderName`). Kemungkinan tahap di sisi petugas dan status batal/tolak [I] |

Tersedia riwayat status per permohonan dan pembatalan dengan alasan (maks. 1000 karakter).

Prasyarat tombol **Proses**: `attachmentStatus` (dokumen lengkap) dan `representativeStatus` (data pengurus terisi) keduanya benar.

### 7.3 Status laporan [T]

Draft → Terkirim (`statusId = 2`). Cetak hanya tersedia setelah Terkirim.

### 7.4 Status dokumen unggahan (modul perubahan) [T]

Empat nilai dengan ikon jam / berkas masuk / centang / seru. Labelnya dari server; urutan wajarnya: belum diunggah → diunggah → diterima → ditolak. [I]

### 7.5 Status permohonan HPK dan Pengesahan (aplikasi lama) [P]

Kode statusnya tidak terlihat, tetapi label tahapnya terbaca dari tangkapan layar riwayat status (rincian di dokumen 07):

**HPK**: `Permohonan Online` → `Verifikasi Data dan Upload` (atau `… tidak disetujui: <catatan>`, kembali ke pemohon) → `Jadwal Ekspos` → `Pengesahan Ekspos` → `Print Draft Surat` → `Pemeriksaan Kasi` → `Pemeriksaan Kasubdit` → `Pemeriksaan dan Penandatanganan Direktur/Dirjen/Kasi` → `Penomoran dan surat sudah bisa diprint`.

**Pengesahan RPTKA**: `Permohonan` → `Verifikasi Data dan Upload` → `Pemeriksaan Subkoordinator` → `Pemeriksaan Koordinator` → `Persetujuan Direktur` → `Pembayaran … sudah dilakukan melalui Simponi` → `Sudah Berhasil Diterima Dirjen Imigrasi`.

Persetujuan Direktur terjadi **sebelum** pembayaran; setelah bayar, penerbitan dan pengiriman ke Imigrasi otomatis.

Tersedia tautan "lihat proses selengkapnya" untuk riwayat lengkap, serta cetak Berita Acara Persetujuan HPK, HPK, tagihan DKPTKA, dan SK Pengesahan.
