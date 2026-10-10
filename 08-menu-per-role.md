# 08. Daftar Menu per Role

Penanda sumber: **[T]** teramati di situs/kode 30 Sep 2026 · **[P]** buku panduan 2021 (teks dan tangkapan layar) · **[K]** KAK · **[I]** inferensi.

Keterangan yang bertanda [I] disimpulkan dari nama menu atau konteksnya, karena buku panduan tidak menjelaskan menu itu. Perlu dikonfirmasi dengan akun uji.

## Ringkasan role

| # | Role | Cara masuk | Sumber menu |
|---|---|---|---|
| 1 | Publik (tanpa login) | — | [T] |
| 2 | Pemberi Kerja — perusahaan swasta | SSO SIAPkerja + akun TKA Online | [P] + [T] |
| 3 | Pemberi Kerja — lembaga/yayasan sosial atau keagamaan | sama | [P] + [T] |
| 4 | Pemberi Kerja — instansi pemerintah, perwakilan negara asing, badan internasional | sama | [P] + [T] |
| 5 | Pengguna TKA Hotline — pemberi kerja | sesi TKA Online | [T] |
| 6 | Pengguna TKA Hotline — agen/petugas | login hotline | [T] sebagian |
| 7 | Petugas internal (verifikasi, ekspos, Kasi/Subkoordinator, Kasubdit/Koordinator, Direktur) | tidak diketahui | **menu tidak teramati** |

Sistem menentukan role 2–4 secara otomatis dari **status badan usaha** yang dipilih saat pendaftaran. [P]

Role 2–4 melihat dua lapis menu: menu aplikasi lama (ASP) setelah login, dan menu SPA `/apl`. Keduanya dicantumkan.

---

## 1. Publik (tanpa login) [T]

### Bilah atas

| Menu | Keterangan |
|---|---|
| Kawasan Ekonomi Khusus | Halaman `kek.asp`: daftar 25 KEK dan pintu masuk pengajuan Pengesahan RPTKA khusus KEK (perlu login) |
| Daftar | Pendaftaran akun pemberi kerja; diawali pemeriksaan sesi SIAPkerja |
| Login | Halaman login SPA |

### Bilah alat

| Menu | Submenu | Keterangan |
|---|---|---|
| Beranda | — | Slider dan pengumuman terbaru |
| Jaminan Sosial Nasional TKA | BPJS Kesehatan · BPJS Ketenagakerjaan | Tautan keluar untuk TKA yang bekerja lebih dari 6 bulan |
| Asuransi TKA Jangka Pendek | Sinar Mas · Jasindo · Tri Pakarta | Tautan keluar ke penyedia asuransi untuk TKA yang bekerja kurang dari 6 bulan |
| Video Tutorial | Baru (5) · Perpanjangan (3) · Pengesahan (4) | 12 video panduan di Google Drive |
| Buku Panduan | — | PDF panduan pengguna |
| Kontak | — | Alamat, telepon, email, jam kerja |
| Bantuan Hotline | — | Panel kanal bantuan: tiga alamat email sesuai jenis keperluan, tautan TKA Hotline, WhatsApp |

### Menu utama

| Menu | Submenu | Keterangan |
|---|---|---|
| Beranda | — | |
| Informasi | Peraturan | Unduh 6 templat formulir dan 41 peraturan |
| | Alur Proses | 7 diagram alur pengesahan |
| | Persyaratan | 13 kelompok persyaratan dokumen |
| | Pertanyaan Umum | 19 tanya-jawab (hal umum, kebijakan, biaya) |
| Laporan TKA | — | Menuju `/apl/laporan`; perlu login |

---

## 2. Pemberi Kerja — perusahaan swasta

Proses: melalui HPK dan membayar DKPTKA. [P]

### 2.1 Menu aplikasi lama [P]

Bilah menu: **Beranda · Pengajuan Surat · Pembayaran · Informasi**

| Menu | Submenu | Sub-submenu | Keterangan |
|---|---|---|---|
| Beranda | | | Dasbor setelah login (`dashboard.asp`) |
| Pengajuan Surat | Upload Dokumen Pengguna | | Unggah dokumen perusahaan sekali (NIB/izin usaha, akta + SK pengesahan, dll.) untuk dipakai di semua permohonan |
| | Sisa RPTKA Lama | Baru | Menyelesaikan/memakai RPTKA rezim lama, jenis baru [I] |
| | | Darurat dan Sementara (1 bulan) | RPTKA lama untuk pekerjaan darurat atau 1 bulan [I] |
| | | Sementara (1–6 bulan) | RPTKA lama jangka pendek [I] |
| | | Perubahan | Perubahan atas RPTKA lama [I] |
| | | Perpanjangan (Hanya Cetak) | Hanya mencetak dokumen perpanjangan lama; tidak bisa mengajukan baru |
| | | Penambahan (Hanya Cetak) | Hanya mencetak dokumen penambahan lama |
| | Sisa Notifikasi | Baru (di atas 7 bulan) | Notifikasi rezim lama yang masih berjalan [I] |
| | | Sementara (1 bulan) | sda. [I] |
| | | Jangka Pendek (2–6 bulan) | sda. [I] |
| | | Dahsuskim/Perairan | Notifikasi kategori darurat/khusus keimigrasian dan wilayah perairan [I] |
| | | Pemegang Izin Tinggal | Notifikasi untuk WNA yang sudah memegang izin tinggal [I] |
| | | Perubahan Notifikasi | Perubahan data pada Notifikasi [I] |
| | | Pencabutan | Permohonan pencabutan Notifikasi/Pengesahan (FAQ: jalur pencabutan ada di sini) |
| | | Penarikan | Permohonan penarikan (pengembalian) DKPTKA setelah pencabutan |
| | Pengesahan RPTKA | Direktur/Komisaris | HPK + Pengesahan untuk jabatan direktur/komisaris; data TKA diisi sekaligus |
| | | Sementara (1–6 bulan) | HPK + Pengesahan untuk pekerjaan bersifat sementara |
| | | Pekerjaan Lebih dari 6 bulan | HPK + Pengesahan, berlaku 7 bulan s.d. 2 tahun |
| | | Perpanjangan | HPK perpanjangan + Pengesahan perpanjangan untuk TKA yang sudah bekerja |
| | Peralihan | Pengesahan RPTKA dengan RPTKA Lama → Baru (pekerjaan lebih dari 6 bulan) | Mengajukan Pengesahan untuk calon TKA baru dengan dasar RPTKA lama yang masih berlaku (tanpa HPK baru) |
| | | … → Jangka Pendek (1–6 bulan) | sda. untuk pekerjaan jangka pendek |
| | | … → Dahsuskim/Perairan | sda. untuk kategori Dahsuskim/perairan [I] |
| | | … → Pemegang Izin Tinggal | sda. untuk WNA pemegang izin tinggal; wajib nomor register Imigrasi |
| | | Perpanjangan Pengesahan RPTKA dari Notifikasi dengan RPTKA Lama | Memperpanjang Notifikasi lama menjadi Pengesahan RPTKA, dengan RPTKA yang sama atau RPTKA baru |
| Pembayaran | (tidak ditampilkan di buku) | | Kemungkinan daftar tagihan dan riwayat pembayaran DKPTKA [I] |
| Informasi | Peraturan · Alur Proses · Persyaratan · Pertanyaan Umum | | Sama dengan menu publik |

Menu tambahan yang disebut FAQ tetapi tidak ada di daftar buku panduan [T]:

| Menu | Keterangan |
|---|---|
| Pengajuan Surat > Start-up atau Vokasi | Surat penggunaan TKA tanpa Pengesahan RPTKA, paling lama 3 bulan |

Pintu masuk varian kawasan [T]:

| Pintu | Keterangan |
|---|---|
| `kek.asp` > Pengesahan RPTKA > Direktur/Komisaris · Sementara · Lebih dari 6 bulan · Perpanjangan | Varian yang sama dengan penanda KEK |
| Slide beranda IKN | Pengesahan RPTKA dengan penanda Ibu Kota Nusantara |

### 2.2 Menu profil (pojok kanan atas) [P]

| Menu | Keterangan |
|---|---|
| Profil Perusahaan | Ubah data profil; ada lencana status kelengkapan |
| Dokumen Perusahaan | Menuju Upload Dokumen Pengguna; lencana "upload" bila belum lengkap |
| Ganti Password | Kini di SPA |
| Ganti Alamat Email | Kini di SPA, dengan OTP |
| Logout/Keluar | |

### 2.3 Menu SPA `/apl` [T]

| Menu / halaman | Keterangan |
|---|---|
| Dashboard | Tiga panel: Jadwal Ekspos · Pengesahan RPTKA yang akan berakhir (30/60/90 hari) · Billing belum dibayar |
| Perubahan Pengesahan RPTKA | Daftar, tambah baru (berdasarkan barcode), edit, unggah dokumen, data pengurus, ajukan, batalkan, cetak SK |
| Pencabutan Pengesahan RPTKA | Menampilkan halaman aplikasi lama di dalam bingkai |
| Laporan TKA | Ringkasan per periode + 4 laporan: Penggunaan TKA · Pendidikan dan Pelatihan · Alih Teknologi dan Alih Keahlian · Berakhirnya Penggunaan TKA; masing-masing Buka, Upload Excel, Print |
| Pengumuman Penting | Muncul otomatis bila ada pengumuman wajib baca |
| Menu pengguna: Ganti Email · Ganti Password · Logout | |
| Bilah alat: BPJS · Asuransi · Video Panduan · Buku Panduan · Kontak · Bantuan Hotline | Sama dengan menu publik |

---

## 3. Pemberi Kerja — lembaga/yayasan sosial atau keagamaan

Proses: melalui HPK, **tanpa** membayar DKPTKA. [P]

Bilah menu sama: **Beranda · Pengajuan Surat · Pembayaran · Informasi**. Hanya isi Pengajuan Surat yang berbeda dari role 2:

| Submenu | Isi | Beda dari swasta |
|---|---|---|
| Upload Dokumen Pengguna | | sama |
| Sisa RPTKA Lama | Baru · Darurat dan Sementara (1 bulan) · Sementara (1–6 bulan) · Perubahan · Perpanjangan (Hanya Cetak) · Penambahan (Hanya Cetak) | sama |
| Sisa Notifikasi | Baru (di atas 7 bulan) · Sementara (1 bulan) · Jangka Pendek (2–6 bulan) · Pemegang Izin Tinggal · **Non DKPTKA** · **Perubahan dari IMTA/Notifikasi Non DKPTKA** · Perubahan Notifikasi · Pencabutan · Penarikan | tambah dua butir Non DKPTKA; tanpa Dahsuskim/Perairan |
| Pengesahan RPTKA | Sementara (1–6 bulan) · Pekerjaan Lebih dari 6 bulan · **Non DKPTKA** · Perpanjangan · **Perpanjangan Non DKPTKA** | tanpa Direktur/Komisaris; tambah dua butir Non DKPTKA |
| Peralihan | Pengesahan RPTKA dengan RPTKA Lama → Baru · Jangka Pendek · Pemegang Izin Tinggal · **Non DKPTKA** | tanpa Dahsuskim; tambah Non DKPTKA |
| | Perpanjangan Pengesahan RPTKA dari Notifikasi dengan RPTKA Lama | sama |
| | **Perpanjangan Pengesahan RPTKA Non DKPTKA dari Notifikasi dengan RPTKA Lama** | tambahan |

Keterangan butir khusus role ini:

| Menu | Keterangan |
|---|---|
| Pengesahan RPTKA > Non DKPTKA | HPK + Pengesahan tanpa pembayaran; wajib nomor dan tanggal surat persetujuan pembebasan DKPTKA |
| Pengesahan RPTKA > Perpanjangan Non DKPTKA | Perpanjangan tanpa pembayaran. Hanya terlihat di tangkapan layar hlm. 74, tidak ada di daftar teks buku |
| Sisa Notifikasi > Non DKPTKA | Notifikasi lama yang bebas DKPTKA [I] |
| Sisa Notifikasi > Perubahan dari IMTA/Notifikasi Non DKPTKA | Perubahan atas IMTA/Notifikasi lama yang bebas DKPTKA [I] |
| Peralihan > … > Non DKPTKA | Pengesahan Non DKPTKA dengan dasar RPTKA lama yang masih berlaku |

Menu profil dan menu SPA: sama dengan role 2. Panel "Billing belum dibayar" di dasbor kemungkinan selalu kosong untuk role ini. [I]

---

## 4. Pemberi Kerja — instansi pemerintah, perwakilan negara asing, badan internasional

Proses: **tanpa** HPK dan **tanpa** DKPTKA. [P]

Bilah menu: **Beranda · Pengajuan Surat · Informasi** (tidak ada menu Pembayaran).

| Menu | Submenu | Keterangan |
|---|---|---|
| Beranda | | Dasbor |
| Pengajuan Surat | Upload Dokumen Pengguna | Unggah dokumen instansi |
| | Sisa Notifikasi > Non RPTKA | Notifikasi lama tanpa RPTKA [I] |
| | Sisa Notifikasi > Perubahan dari IMTA/Notifikasi Non RPTKA | Perubahan atas IMTA/Notifikasi Non RPTKA lama [I] |
| | Sisa Notifikasi > Perubahan Notifikasi | Perubahan data Notifikasi [I] |
| | Sisa Notifikasi > Pencabutan | Permohonan pencabutan |
| | Pengesahan RPTKA Tanpa Penilaian Kelayakan > Baru (pekerjaan lebih dari 6 bulan) | Pengesahan langsung untuk calon TKA baru: data TKA → dokumen → pengurus → Proses |
| | Pengesahan RPTKA Tanpa Penilaian Kelayakan > Jangka Pendek (1–6 bulan) | sda. untuk pekerjaan sementara |
| | Pengesahan RPTKA Tanpa Penilaian Kelayakan > Perpanjangan | Memperpanjang Notifikasi Non RPTKA atau Pengesahan Non-HPK sebelumnya |
| | Peralihan > Perpanjangan Pengesahan RPTKA dari Notifikasi Non RPTKA | Memperpanjang Notifikasi Non RPTKA lama menjadi Pengesahan |
| Informasi | Peraturan · Alur Proses · Persyaratan · Pertanyaan Umum | |

Tidak ada: Sisa RPTKA Lama, Penarikan, Direktur/Komisaris, menu Pembayaran.

Menu profil dan menu SPA: sama dengan role 2. Apakah Perubahan Pengesahan RPTKA dan Laporan TKA di SPA berlaku untuk role ini tidak terlihat dari kode klien. [I]

---

## 5. Perbandingan cepat antar role pemberi kerja [P]

| Menu | Swasta | Lembaga | Pemerintah/internasional |
|---|:-:|:-:|:-:|
| Upload Dokumen Pengguna | ✓ | ✓ | ✓ |
| Sisa RPTKA Lama | ✓ | ✓ | — |
| Sisa Notifikasi | ✓ | ✓ | ✓ (versi Non RPTKA) |
| — Dahsuskim/Perairan | ✓ | — | — |
| — Penarikan | ✓ | ✓ | — |
| Pengesahan RPTKA (dengan HPK) | ✓ | ✓ | — |
| — Direktur/Komisaris | ✓ | — | — |
| — Non DKPTKA, Perpanjangan Non DKPTKA | — | ✓ | — |
| Pengesahan RPTKA Tanpa Penilaian Kelayakan | — | — | ✓ |
| Peralihan | ✓ | ✓ | ✓ (satu butir) |
| Menu Pembayaran | ✓ | ✓ | — |

---

## 6. TKA Hotline — pemberi kerja [T]

Dibaca dari kode aplikasi hotline; tata letak menunya tidak dilihat langsung.

| Fungsi | Keterangan |
|---|---|
| Data isian profil | Nama pemberi kerja, penanggung jawab, email, telepon, foto profil; diisi saat pertama masuk |
| Buat Tiket Baru | Pilih kategori pengaduan (mis. revisi masa berlaku, penambahan jangka waktu HPK, upload ulang foto, update NPWP, jabatan tidak tersedia), lalu isi rincian |
| Daftar tiket | Tiket milik perusahaan beserta statusnya |
| Percakapan tiket | Kirim pesan, gambar, dan berkas ke petugas |

Syarat: sudah login di TKA Online; bila tidak, muncul "Anda belum login di TKA-Online".

## 7. TKA Hotline — agen/petugas [T sebagian]

| Fungsi | Keterangan |
|---|---|
| Login agen | Username dan password hotline |
| Daftar tiket masuk + pencarian | Antrian tiket dari seluruh pemberi kerja |
| Buka / kunci tiket | Tiket yang sedang ditangani agen lain terkunci |
| Balas percakapan | Termasuk jawaban baku ("data telah kami tindak lanjuti…") |
| Tutup / buka kembali tiket | |
| Dasbor | Jumlah tiket per bulan, tiket masuk vs selesai, jumlah per kategori, kinerja semua petugas, filter rentang tanggal |

Kategori internal yang terlihat: Antrian Verifikator · Antrian Validator · Pendingan Verifikator · Pendingan Validator · SK Perubahan · Pembatalan HPK · Penambahan Lokasi · Username dan Password · Penonaktifan akun.

---

## 8. Petugas internal — menu tidak teramati

Tidak ada satu pun layar back-office yang terlihat, baik di situs, di kode klien, maupun di buku panduan. Yang diketahui hanyalah **tahap kerja** tiap peran, dari riwayat status yang tampil ke pemohon [P]. Tabel ini adalah daftar fungsi yang pasti dibutuhkan, **bukan** daftar menu yang ada.

| Peran | Tahap yang dikerjakan | Fungsi yang tersirat [I] |
|---|---|---|
| Petugas verifikasi akun | Verifikasi data dan dokumen pendaftar | Daftar pendaftar, setujui/tolak dengan alasan |
| Petugas verifikasi permohonan | "Verifikasi Data dan Upload" (HPK dan Pengesahan) | Antrian permohonan, periksa isian dan dokumen, setujui atau kembalikan dengan catatan |
| Petugas ekspos | "Jadwal Ekspos", "Pengesahan Ekspos", "Print Draft Surat" | Penjadwalan + nomor antrian, pencatatan hasil, BAP, draft surat |
| Kasi / Subkoordinator | "Pemeriksaan Kasi" / "Pemeriksaan Subkoordinator" | Antrian pemeriksaan, teruskan atau kembalikan |
| Kasubdit / Koordinator | "Pemeriksaan Kasubdit" / "Pemeriksaan Koordinator" | sda. |
| Direktur PPTKA | "Pemeriksaan dan Penandatanganan", "Persetujuan Direktur" | Persetujuan, tanda tangan, penomoran surat |
| Pejabat pemda | Validasi pembayaran DKPTKA sebagai retribusi daerah [T FAQ] | Daftar pembayaran daerah, validasi |
| Admin | — | Master jabatan, kategori dokumen, pengumuman, pengguna internal |

Role internal menurut KAK untuk sistem baru: Verifikator · Validator · Petugas Ekspos · Direktur · Direktur Jenderal · Admin Pusat · Admin Daerah. [K]

Untuk melengkapi bagian ini diperlukan akun uji tiap peran internal atau wawancara dengan petugas.
