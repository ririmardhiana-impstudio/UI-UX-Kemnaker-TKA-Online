# TKA Online — UI/UX Prototype

Prototipe statis TKA Online (Kemnaker) hasil migrasi dari ekspor Claude Design
(`*.dc.html`, React runtime `support.js` — sudah dihapus, lihat commit 2630ca4) ke stack kit.
**Tanpa redesign**: layout, palet, tipografi, copy, dan data harus sama dengan
halaman legacy; semua layar/state/role legacy harus tetap bisa diakses.

**Pengecualian — layar usulan KAK** (plan `docs/plans/20261001-penyesuaian-kak.md`): layar baru berikut tidak punya
padanan legacy sehingga bebas dari aturan "tanpa redesign/paritas legacy", tetapi WAJIB memakai token, komponen, dan pola
layar yang sudah ada (copy ditandai usulan/[I] bila tidak bersumber dari KAK/analisis):
portal `hpkHasil` (menu Hasil Penilaian dan Kelayakan (HPK), kelompok A/B; sumber: lembar kebutuhan Tabel/Form HPK, Ekspose, BAP), `notifikasi`, `operator` (Operator & Akses), `suratKeterangan`, kartu Verifikasi NIB di Profil, langkah cakupan
wilayah perpanjangan, jenis perubahan "Nama TKI Pendamping", OCR paspor (wizard TKA), lonceng notifikasi header;
`verifikator-akun.html` (akun Verifikator, AK-20/AK-21: Beranda, Daftar Pemberi Kerja, Detail, Verifikasi → email aktivasi ke admin + operator; menu Verifikasi HPK: daftar/detail/Verifikasi → jadwal ekspos otomatis | Tolak + alasan → Perbaikan data; menu Perubahan RPTKA & Pencabutan RPTKA (AK-24: pengajuan nyata dari portal pemberi kerja, real time; Verifikasi → Validator | Tolak + alasan → Perbaikan → pemberi kerja "Ajukan kembali"; `POST /pencabutan`); menu Perpanjangan RPTKA Lintas Kab/Kota dalam 1 Provinsi (AK-25: ketentuan sama AK-23, data nyata real time dari Form RPTKA, dipisah per jenis via `scopeOf`); menu Perpanjangan RPTKA Lintas Provinsi (AK-23: tabel pengajuan, Detail, Verifikasi → Validator | Tolak + alasan → Perbaikan; memakai route Pengesahan AK-22, dipisah dari menu Pengesahan RPTKA); menu Pengesahan RPTKA (AK-22): 2 tabel — pengajuan (Verifikasi → Validator) dan terverifikasi (Verifikasi → kode billing DKPTKA terbit otomatis, nominal sesuai jenis pemberi kerja & jenis RPTKA, masa berlaku 5 hari kerja; Simponi di luar lingkup aplikasi, tidak ada akun Simponi); layout portal pemberi kerja), `registrasi-pemberi-kerja.html` (halaman sendiri, hanya dapat diakses setelah login di akun-login.html): layar `menu`
(deteksi otomatis status Pemberi Kerja setelah login SIAPKerja, usulan KAK Modul 1) dan wizard `daftar` — 5 langkah
untuk metode `OSS`, 4 langkah untuk `Non-OSS` (langkah "Data Perusahaan" dilewati total, bukan cuma disembunyikan
[AK-18]; stepper & "Validasi & lanjut"/"← Kembali" melompat 2 ↔ 4): Status Penanam Modal, Jenis Pemberi Kerja +
Metode Pendaftaran OSS/Non-OSS, [Data Perusahaan via kode WLKP + OSS — khusus OSS], Data Operator via cek SIAPKerja
("Terdaftar di SIAPKerja" / "Data Ditemukan" untuk Non-OSS), Dokumen & Konfirmasi — jenis dokumen ikut metode: "Surat
Penunjukan Operator/PIC" (OSS) vs "Surat Permohonan Pengajuan TKA" (Non-OSS), tombol akhir "Submit Verifikasi"; NPWP/
nama perusahaan tidak dikumpulkan sama sekali untuk Non-OSS (keterbatasan demo disengaja) + layar status pendaftaran (dengan
contoh/dummy email aktivasi operator, peraga alur saja — bukan email sungguhan), mengikuti diagram "Registrasi Operator
TKA-Online"; tab "Cek status" landing.html jenis `pendaftaran` (cek status registrasi by NPWP tanpa login, AK-17, deep
link `landing.html#cek-status`);
back office peran Direktur Jenderal + tahap Dirjen, `pencabutan` (Keputusan pencabutan),
`analitik`, `notifikasi` (pengaturan), `audit`, `akses`, `keamanan`, ekspos daring + BAP, anotasi dokumen.
`petugas-ekspos.html` (akun Petugas Ekspos, EP-01..EP-05, lembar kebutuhan "Fitur Ekspose" + "Fitur Hasil Penilaian": menu Jadwal Ekspose = tabel berurutan no. antrian + jadwal, detail jadwal, link ekspose; menu Hasil Penilaian = Perbaiki Data dan Dokumen / Reschedule Ekspose / Buat BAP → status BAP "menunggu disetujui"; layout portal pemberi kerja, mengikuti verifikator-akun.html).
`validator-hpk.html` (akun Validator HPK, VL-01..VL-05, lembar kebutuhan "Tabel Daftar Pemberi Kerja": menu Daftar Pemberi Kerja = tabel HPK yang BAP-nya sudah disetujui, status "Menunggu Divalidasi", fitur Detail (data isian + dokumen HPK) dan Verifikasi → pernyataan kesesuaian → "Tervalidasi"; menu Pengesahan RPTKA, VP-01..VP-05 = tabel permohonan RPTKA yang sudah lolos Verifikator, Detail (isian + dokumen + DKPTKA), Verifikasi → kode billing DKPTKA terbit otomatis (bebas DKPTKA → langsung disetujui otomatis) | Tolak + alasan → Perbaikan; menu Perpanjangan RPTKA, VP-06 = view yang sama khusus jenis Perpanjangan Lintas Provinsi; menu Verifikasi Perpanjangan Lintas Kab/Kota 1 Provinsi, VP-07 (tombol "Validasi" | Tolak; Validasi → diteruskan ke Disnaker untuk SKRD, tanpa billing PNBP); daftar tersinkron real time dengan pengajuan pemberi kerja; menu Pencabutan RPTKA per TKA, PV-01..PV-05 (tombol "Validasi" | Tolak; tanpa billing); layout portal pemberi kerja, mengikuti petugas-ekspos.html).
`disnaker-akun.html` (akun Disnaker setempat, DN-01..DN-04, lembar kebutuhan "Tabel Daftar Pemberi Kerja" — SKRD: satu menu "Perpanjangan Lintas Kab/Kota 1 Provinsi" = tabel Perpanjangan RPTKA lintas kab/kota yang sudah divalidasi Validator, status Menunggu SKRD → SKRD terbit → Lunas, fitur Detail (isian + dokumen + retribusi) dan Terbitkan SKRD → nomor SKRD + nominal otomatis, SKRD terkirim dan diterima pemberi kerja (tagihan `jenis: SKRD` di Pembayaran DKPTKA + notifikasi); layout portal pemberi kerja, mengikuti validator-hpk.html).
`imigrasi-akun.html` (akun Superadmin view-only, IM-01..IM-14: menerima data Pengesahan RPTKA ber-Visa-ITAS dari integrasi Imigrasi + data Perpanjangan RPTKA dari pemberi kerja; dua menu tanpa aksi proses. Riwayat: awalnya akun Petugas Imigrasi (IM-01..IM-10, lembar kebutuhan "Integrasi Imigrasi": satu menu Pengajuan VISA dan ITAS (satu tabel TKA pada Pengesahan RPTKA terbit + tahap proses) dan form bertahap per TKA — Data Pengesahan (terima data via API/integrasi + payload), Visa dan ITAS (terbitkan VITAS + ITAS atau tolak), Data Perlintasan (catat + kirim ke Direktorat PPTKA), Ringkasan; tahap berikutnya terkunci sampai tahap sebelumnya selesai (IM-12); dokumen permohonan Pengesahan RPTKA tiap TKA bisa diperiksa/dipratinjau di tabel dan form (IM-13); layout portal pemberi kerja, mengikuti simponi-akun.html).
`direktur-hpk.html` (akun Direktur, DR-01..DR-06, lembar kebutuhan "Tabel Daftar Pemberi Kerja" Direktur: menu "Hasil Penilaian Kelayakan (HPK)" (sebelumnya Daftar Pemberi Kerja) = tabel HPK Tervalidasi / HPK Terbit, fitur Detail (data isian + dokumen HPK), "Terbitkan HPK" di halaman detail, TTE di halaman utama (per baris atau tombol "TTE otomatis semua") = sistem menjalankan TTE berupa barcode dan HPK Tervalidasi langsung terbit + tampil di akun pemberi kerja, kolom TTE → "Sudah di TTE"; layout portal pemberi kerja, mengikuti validator-hpk.html; menu kedua "Pengesahan RPTKA" (DP-01..DP-07, lembar kebutuhan "Tabel Daftar Pemberi Kerja" RPTKA Direktur): tabel RPTKA yang lolos DKPTKA (pemberi kerja konfirmasi sudah bayar / bebas DKPTKA), otomatis disetujui Direktur oleh sistem → status "Menunggu TTE" (surat belum turun); tombol TTE → "Sudah di TTE" + dokumen berisi nomor, TTE, QR Code dan surat terbit ke pemberi kerja; Detail).

## Stack

- HTML5 semantic + TailwindCSS v4 CDN (`@tailwindcss/browser@4.1`) + DaisyUI v5 CDN (`daisyui@5.5` `daisyui.css` + `themes.css`)
- Vanilla JS ES module (`<script type="module">`), tanpa framework/bundler/TypeScript
- Font Plus Jakarta Sans (Google Fonts)
- DILARANG: React/Vue/Alpine/HTMX/jQuery/axios/Zod, `cdn.tailwindcss.com`, `@plugin`/`@theme`/`tailwind.config`,
  template `{{ }}`/`sc-for`/`sc-if`, inline `style=""` (kecuali nilai dinamis per data, mis. lebar progress %), hex di HTML/JS halaman.
- Chart.js v4 (`https://cdn.jsdelivr.net/npm/chart.js@4.5/dist/chart.umd.min.js`) HANYA di `back-office.html` (layar Analitik),
  lewat `js/components/chart-panel.js`; tabel fallback "Lihat tabel" wajib dan layar tetap jalan tanpa CDN. Library chart lain dilarang.

## Menjalankan

```bash
python3 -m http.server 8000      # lalu buka http://localhost:8000/index.html
node scripts/generate-openapi.js # regenerasi docs/shared/openapi.yaml
node --test test/contract/*.test.js                               # contract test vs mock
BASE_URL=http://host/api/v1 node --test test/contract/*.test.js   # contract test vs backend asli
```

Halaman WAJIB dibuka via HTTP server (ES module tidak jalan di `file://`).
`package.json` hanya berisi `"type": "module"` + script; tidak ada dependensi.

## Struktur

```
index.html, landing.html, akun-login.html, registrasi-pemberi-kerja.html,
portal-pemberi-kerja.html, verifikator-akun.html, petugas-ekspos.html, validator-hpk.html, direktur-hpk.html, disnaker-akun.html, imigrasi-akun.html, hotline.html, back-office.html   halaman (fase halaman)
css/tokens.css      SEMUA nilai mentah: primitive oklch, tema [data-theme="tka"] & [data-theme="tka-office"], keyframes
css/base.css        font body, :focus-visible, reduced-motion, helper class token non-DaisyUI (@layer utilities —
                    DaisyUI 5 menaruh komponen di sub-layer utilities, helper di layer components selalu kalah)
js/api/client.js    override window.fetch -> mock saat USE_MOCK (lazy import js/mocks)
js/api/http.js      apiGet/apiPost/apiPut/apiPatch/apiDelete + ApiError (lempar Error bila !res.ok)
js/api/<resource>.js  helper per resource (listTiket, getCompany, submitLaporan, ...)
js/contracts/*.js   kontrak + validator vanilla (validateX(payload) -> {valid, errors})
js/mocks/data.js    port 1:1 legacy data.js (export TKA_DATA)
js/mocks/fixtures.js  konstanta halaman legacy (LG, percakapan tiket, statistik hotline, pemda, ekspos, akun demo)
js/mocks/fixtures/<x>.js  fixture per modul KAK (operator, security, siklus, back-office, analitik, ocr, notifikasi);
                    di-seed lazy di route (`store.x ??= structuredClone(X_FIXTURE)`), store.js tidak diubah
js/mocks/handlers.js  tabel route /api/v1 (gabungan js/mocks/routes/*.js) + createMockApi()
js/mocks/routes/security.js  `appendAudit(store, {pengguna, peran, aksi, modul, objek, perubahan, ip})` — audit log berantai hash;
                    aksi/modul wajib dari AUDIT_ACTIONS/AUDIT_MODULES (js/contracts/security.js)
js/mocks/routes/notifikasi.js  `pushNotifikasi(store, role, {judul, isi, kategori, tautan})` untuk route perubahan status
js/mocks/routes/siklus-events.js  efek samping siklus (audit + notifikasi pemberi kerja)
js/mocks/routes/pendaftar.js  aktivasi/perbaikan/unggah-ulang pendaftar (AK-15): `activate|request-fix|resubmit`
js/components/      qr-code.js (draft; `qrCode`, QR peraga SVG), live-sync.js (draft; `startLiveSync(refresh)` — sinkron real time: storage lintas tab + fokus + polling, dipakai akun Direktur), dom.js, dropdown.js (`bindDropdowns`, dipakai portal & verifikator), status-badge.js, pagination.js, screen-switcher.js, brand.js, empty-state.js (`emptyState`),
                    form-ui.js (clearFieldErrors/setAlert/setButtonBusy/showFieldErrors/showToast/createResendCountdown/
                    formatFileSize/formatNpwp — dipakai akun-login/ & registrasi-pemberi-kerja/),
                    operator-session.js (setOperatorEmail/getOperatorEmail — handoff sessionStorage akun-login.html ->
                    registrasi-pemberi-kerja.html, BUKAN session manager sungguhan, lihat "Sesi" di bawah),
                    chart-panel.js (draft; wrapper Chart.js, warna dari token tema), ocr-panel.js (draft; `ocrPanel`, `confidenceBadge`)
js/config/page-status.js + js/prototype-banner.js   banner PROTOTYPE per halaman
js/pages/<page>.js  logika per halaman (fase halaman)
js/pages/portal/    view portal; Form RPTKA (Pengesahan RPTKA, 11 jenis dari uploads/Pengesahan RPTKA.txt, page `rptka` + `rptkaList` untuk submenu jenis baru): rptka (+ -data, -panels, -docs-view, -upload, -list, -errors, -jabatan, -confirm; usulan [I] dari lembar kebutuhan "Form RPTKA", menggantikan tombol Tambah per jabatan di hpkDetail); baru: hpk-hasil (+ -data, -form, -fields, -detail, -views, -surat; menu HPK), surat-resmi.js + sk-pengesahan-doc.js (format surat Keputusan Dirjen), notifikasi.js (+ lonceng `#nt-bell-slot`, `mountBell`), operator.js, surat-keterangan.js, tka-ocr.js
js/pages/back-office/  view back office; baru: pencabutan-view, analitik-view (+ -charts, -export), notif-config-view (+ notif-template),
                    security-view (+ security-audit-view, security-ui), annotation-view, ekspos-bap-view
js/pages/akun-login/  login.js, password.js, verify.js — login SIAPkerja, password, verifikasi email (akun-login.html)
js/pages/verifikator-akun/  state, shell, list-view (Beranda + Daftar), detail-view, verify-dialog, hpk-* , pengesahan-list-view / pengesahan-detail-view (dipakai bersama menu Perpanjangan RPTKA) / pengesahan-dialog — akun Verifikator (verifikator-akun.html)
js/pages/petugas-ekspos/  state, shell, format, list-view (Jadwal Ekspose + Hasil Penilaian), detail-view, actions (dialog Perbaiki/Reschedule/BAP) — akun Petugas Ekspos (petugas-ekspos.html)
js/pages/validator-hpk/  state, shell, list-view (Daftar Pemberi Kerja), detail-view, actions (dialog Verifikasi), pengesahan-list-view / pengesahan-detail-view / pengesahan-actions — akun Validator (validator-hpk.html)
js/pages/disnaker-akun/  state, shell (satu menu), list-view (tabel + Terbitkan SKRD), detail-view (kartu dipakai ulang dari validator-hpk/pengesahan-detail-view), actions (dialog Terbitkan SKRD) — akun Disnaker (disnaker-akun.html)
js/pages/imigrasi-akun/  state (daftar + form bertahap, gerbang tahap), shell (satu menu), format, list-view (satu tabel, tab tahap proses), proses-view (form 4 tahap), proses-actions (simpan tahap + lanjut) — akun Petugas Imigrasi (imigrasi-akun.html)
js/pages/direktur-hpk/  state, shell, list-view (Hasil Penilaian Kelayakan (HPK) + TTE / TTE otomatis semua), detail-view (Terbitkan HPK; kartu dari validator-hpk/detail-view), actions (dialog Terbitkan/TTE/Barcode), pengesahan-list-view / pengesahan-detail-view (menu Pengesahan RPTKA, view-only) — akun Direktur (direktur-hpk.html)
js/pages/registrasi-pemberi-kerja/  register.js (+ register-view, register-company, register-operator, status) —
                    wizard registrasi 5 langkah (Status Penanam Modal, Jenis Pemberi Kerja, Data Perusahaan via
                    WLKP+OSS, Data Operator via SIAPKerja, Dokumen & Konfirmasi) + layar `menu` (deteksi status) &
                    status pendaftaran + loop perbaikan (AK-13/14/15/16); halaman registrasi-pemberi-kerja.html
docs/shared/openapi.yaml, docs/shared/business-rules.md
test/contract/      contract test portable untuk BE
```

## Aturan halaman

- `<head>` persis seperti template di bawah; `<html lang="id" data-theme="tka">` (Back Office: `data-theme="tka-office"`).
- Halaman **TIDAK BOLEH** import `js/mocks/*`. Data diambil lewat `js/api/<resource>.js` (fetch `/api/v1/...`).
  Halaman boleh import `js/contracts/*` (validator + enum seperti `TIKET_CATEGORIES`) dan `js/components/*`.
- Semua teks dari data di-escape: `html\`\`` + `setHtml` atau `renderList` (`<template>` + `textContent`). Jangan `innerHTML` string mentah.
- Boolean di dalam nilai atribut ber-kutip (`aria-pressed="${isActive}"`) dirender `html\`\`` sebagai `"true"`/`"false"`; di posisi teks `false`/`null`/`undefined` tetap kosong.
- Elemen interaktif = `<button type="button">` / `<a href>`; tab pakai `role="tablist"`/`aria-selected` atau DaisyUI `tabs`; label form terhubung (`for`/`id`), error per field via `aria-describedby` + `aria-live`; `aria-busy` saat loading; img `alt` bermakna.
- Tangani error API: mock menyuntik 500 acak 5% (`<meta name="mock-error-rate" content="0">` untuk mematikan) — sediakan state error + tombol Coba lagi.
- Responsive mobile-first (`md:`/`lg:`), file kebab-case, JS ≤ 400 baris/file (kecuali `js/mocks/data.js` yang port verbatim).

### Head template

```html
<!DOCTYPE html>
<html lang="id" data-theme="tka">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Judul Halaman — TKA Online</title>
  <link rel="icon" href="uploads/kemnaker_new.svg" type="image/svg+xml" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4.1"></script>
  <link href="https://cdn.jsdelivr.net/npm/daisyui@5.5/daisyui.css" rel="stylesheet" type="text/css" />
  <link href="https://cdn.jsdelivr.net/npm/daisyui@5.5/themes.css" rel="stylesheet" type="text/css" />
  <link href="css/tokens.css" rel="stylesheet" type="text/css" />
  <link href="css/base.css" rel="stylesheet" type="text/css" />
  <meta name="use-mock" content="true" />
  <meta name="api-base-url" content="/api/v1" />
  <script>window.USE_MOCK = document.querySelector('meta[name="use-mock"]')?.content === 'true'; window.API_BASE_URL = document.querySelector('meta[name="api-base-url"]')?.content ?? '/api/v1';</script>
  <script type="module" src="js/api/client.js"></script>
  <script type="module" src="js/prototype-banner.js"></script>
</head>
```

Script halaman di akhir `<body>`: `<script type="module" src="js/pages/<page>.js"></script>`.

## Toggle mock

`<meta name="use-mock" content="true">` -> `window.USE_MOCK`. Saat `false`, `client.js` tidak memuat `js/mocks/*`
dan semua `fetch('/api/v1/...')` diteruskan ke backend asli (`api-base-url`). Banner PROTOTYPE hanya tampil saat mock aktif.
Mock: latensi ~200–320 ms, `console.info('[MOCK] ...')`. Store (`js/mocks/store.js`) **persisten ke `localStorage`**
(key `tka:mock-store`, origin yang sama dipakai semua halaman) — data dari alur pendaftaran/verifikasi/permohonan yang
diinput di satu halaman tetap ada saat pindah/reload ke halaman lain, bukan reset ke dummy tiap page load. Seed dummy
(`TKA_DATA` + fixtures) hanya dipakai sebagai baseline saat `localStorage` kosong (pertama kali) atau `__version`
(`STORE_VERSION` di store.js) basi — naikkan versi itu kalau mengubah bentuk data seed. Reset manual: hapus key
`tka:mock-store` di localStorage (DevTools) lalu reload. Node/contract test tidak punya `localStorage` → tiap test
tetap mulai dari store segar seperti sebelumnya (tidak terpengaruh).
**Sinkron antar-tab**: `createMockApi()` memuat store sekali per page load (per tab) — tanpa penanganan khusus, tab
yang sudah terbuka (mis. portal pemberi kerja) tidak pernah melihat mutasi dari tab LAIN (mis. Verifikator/Validator/
Simponi back office) walau sudah tersimpan ke `localStorage`, sampai di-reload penuh. `store.js` `watchExternalChanges`
menutup gap ini lewat event `storage` bawaan browser (hanya terpicu di tab LAIN, bukan tab yang menulis) — begitu
terpicu, isi store tab ini di-timpa dari `localStorage` terbaru. Ini baru membuat data BACKEND (mock) ikut
mutakhir; halaman tetap perlu me-refresh `state.data`-nya sendiri saat navigasi (lihat `reloadCollection` di
`js/pages/portal/data.js`, dipanggil dari `VIEWS.<page>.load`) supaya tampilan ikut berubah tanpa reload — pola yang
sudah dipakai `hpk.js` `loadList`/`loadDetail` untuk tabel status Pengesahan RPTKA.

## Token & kelas (hex legacy -> kelas)

| Legacy | Kelas |
|---|---|
| `#0b2a5b` navy (tombol utama, sidebar portal, header hotline, hero) | `bg-primary` / `text-primary` / `btn-primary`; teks di atasnya `text-primary-content`, redup `text-primary-content/70` |
| `#0b5bd3` biru (link, aktif, langkah berjalan) | `text-secondary` / `link-secondary` / `border-secondary`; info `badge-info` |
| `#0f1f3d` teks & bilah gelap | `text-base-content`; bilah `bg-neutral text-neutral-content` |
| `#101a2e` sidebar back office | tema `tka-office`: `bg-primary`/`bg-neutral` |
| `#ffffff` kartu | `bg-base-100` |
| `#f5f8fd` / `#f3f7ff` / `#f7f9fc` latar halaman & panel lembut | `bg-base-200` (lebih pucat: `bg-base-200/50`) |
| `#f4f5f7` latar back office | `bg-base-200` (tema `tka-office`) |
| `#e1e7f2` / `#e3e7ee` / `#d9dee7` border kartu | `border-base-300` |
| `#eef1f6` / `#f1f4f9` / `#f0f2f5` pemisah baris | `border-base-200` / `bg-base-200` |
| `#c9d3e6` border input | DaisyUI `input`/`select`/`textarea` (default) atau `border-base-content/20` |
| `#34466b` / `#3d4a60` teks sekunder kuat | `text-base-content/80` |
| `#5b6b8a` / `#6b778c` teks sekunder | `text-base-content/70` |
| `#7a88a4` / `#94a1bb` / `#9aa4b5` teks redup/placeholder | `text-base-content/60` / `text-base-content/50` (AA lebih baik dari legacy 3.6:1) |
| `#067647` + `#e6f6ee` | `text-success` + `bg-success/10`; badge `badge-soft badge-success` |
| `#b54708` + `#fff4e5` / `#fff8e6` (+ border `#f3e2b3`, teks `#5a4410`) | `text-warning` + `bg-warning/10` (+ `border-warning/30`); banner usulan `alert alert-warning alert-soft` |
| `#c0262d` + `#fdecec` (+ border `#f0c2c4`) | `text-error` + `bg-error/10` (+ `border-error/30`) |
| `#e7f0ff` / `#dbe5f5` info lembut | `bg-info/10` / `border-info/20` |
| `#6941c6` + `#f1ecfd` tag "Khusus" | `.badge-special` (base.css) |
| `#f5c542` + `#3d2c00` badge di sidebar gelap | `.badge-highlight` (base.css); status "Memeriksa" `.text-warning-bright` |
| `#7fe0b8` sukses di latar gelap | `.text-success-bright` / `.bg-success-bright` |
| `#8fb4ff` link di latar gelap | `.text-info-bright` / `.bg-info-bright` |
| `#cfd9ec` / `#b8c7e4` / `#8fa3c8` / `#6f86b3` teks di navy | `text-primary-content/80` / `/70` / `/60` / `/50` |
| `rgba(255,255,255,.08–.12)` chip/hover di navy | `bg-primary-content/10` (bilah neutral: `bg-neutral-content/10`) |

Tone data (`tone` di TKA_DATA): `green|blue|amber|red|gray` -> `statusBadge(label, tone)` (`js/components/status-badge.js`);
teks `TONE_TEXT_CLASS`, latar lembut `TONE_SOFT_BG_CLASS`.
Opacity semantic hanya kelipatan 10 (`/10`–`/90`); `bg-primary/25` tidak ter-generate.

## Endpoint (prefix `/api/v1`)

Lihat `docs/shared/openapi.yaml` untuk skema lengkap. Role-scoped = wajib `?role=swasta|lembaga|pemerintah`.

- Referensi: `GET /system-info`, `/workflow-steps`, `/sso-sessions/current`, `/companies`, `/companies/{role}`, `/pengumuman`, `/wilayah` (`?provinsi=&kabupaten=&kecamatan=`)
- Publik: `GET /status-permohonan?jenis=rptka|hpk|billing|pendaftaran&nomor=` (tanpa data pribadi; `pendaftaran` usulan
  [I] AK-17 — cek status registrasi pemberi kerja by NPWP tanpa login, tab "Cek status" di landing.html, deep link `landing.html#cek-status`)
- Portal (role-scoped): `GET /tka` (`?barcode=`), `/hpk` (`?layanan=`), `/hpk/{id}`, `/pengesahan` (`?hpk=&layanan=`), `/billing`, `POST /billing/{id}/reissue`, `POST /billing/{id}/confirm-bayar` (pemberi kerja konfirmasi sudah bayar → tagihan Lunas, SK disetujui otomatis Direktur dan masuk daftar Menunggu TTE, BT-03/BT-04, usulan [I]), `GET /ekspos` (+ `mode`, `platform`, `meetingUrl`)
- Perubahan: `GET /perubahan`, `/perubahan/{id}`, `POST /perubahan`, `/perubahan/{id}/documents`, `/submit`, `/cancel`
  (`PERUBAHAN_JENIS` ke-4 "Nama TKI Pendamping": `pendampingNama` + `pendampingJabatan`)
- Siklus RPTKA: `POST /perpanjangan?role=` (`basisBarcode, tkaIds[], cakupanWilayah: satu-kabupaten|satu-provinsi|lintas-provinsi, provinsiTujuan?, kabupatenTujuan?`
  -> 201 `{noPermohonan, diprosesOleh}`), `GET|POST /keputusan-pencabutan` (Direktur), `POST /keputusan-pencabutan/{id}/decision` (Dirjen: setujui|kembalikan + catatan),
  `GET /surat-keterangan?role=`, `GET /surat-keterangan/{id}?role=`, `POST /surat-keterangan?role=`, `POST /surat-keterangan/{id}/transition?role=` (usulan, petugas)
- Operator (role-scoped): `GET|POST /operators?role=`, `PATCH /operators/{id}?role=` (body `actorLevel`, prototipe; 403 bukan admin, 409 email ganda / admin terakhir),
  `POST /companies/{role}/nib-verifications` (OSS: Sesuai/Tidak sesuai, 422, 503 untuk NIB demo 9999999999999)
- Form RPTKA (Pengesahan RPTKA 11 jenis, role-scoped, usulan [I], business-rules §16; jenis Non DKPTKA Non HPK tanpa HPK untuk lembaga/pemerintah): `GET /pengesahan-rptka/hpk` (Nomor HPK aktif + sisa kuota; kelompok C 403), `GET /pengesahan-rptka` (`?jenis=`), `/pengesahan-rptka/{id}`, `POST /pengesahan-rptka` (Draf), `PUT /pengesahan-rptka/{id}`, `POST .../{id}/submit` (Menunggu Verifikasi; kuota HPK terpakai + baris pengesahan + antrian + notifikasi)
- Penilaian Kelayakan (HPK, role-scoped, kelompok C 403): `GET /penilaian-kelayakan`, `/penilaian-kelayakan/formulir?jenis=`, `/penilaian-kelayakan/{id}`, `POST /penilaian-kelayakan`, `PUT /penilaian-kelayakan/{id}`, `POST .../{id}/submit|bap-approval|transition` (transition = verifikator/sistem [I])
- Notifikasi: `GET /notifikasi?role=&status=unread` (`meta.unread`), `POST /notifikasi/{id}/read?role=`, `POST /notifikasi/read-all?role=`,
  `GET /notification-settings`, `PUT /notification-settings/{event}`
- Analitik & OCR: `GET /analitik/dimensi`, `GET /analitik/penggunaan-tka?provinsi=&kabupaten=&sektor=&jabatan=&dari=&sampai=`, `POST /analitik/exports`,
  `GET /analitik/exports/{id}`, `POST /ocr/extractions` (422 `OCR_UNREADABLE`; demo: nama berkas mengandung "buram")
- Keamanan: `GET /audit-logs` (`?pengguna=&modul=&aksi=&dari=&sampai=&page=`, meta page), `GET /audit-logs/integrity`, `GET /access-roles`, `GET /internal-users`,
  `PATCH /internal-users/{id}` (409 Admin Pusat terakhir), `GET /security-alerts` (`?status=`, `meta.baru`), `POST /security-alerts/{id}/acknowledge`
- Laporan: `GET /laporan-def`, `/laporan` (role), `/laporan-penggunaan`, `POST /laporan`, `POST /laporan/uploads`
- Pencabutan RPTKA per TKA (pemberi kerja, usulan PC-01..PC-05): `GET /pencabutan`, `GET /pencabutan/{id}?role=`, `POST /pencabutan` (`role, barcode, jenis` 6 jenis, `alasan` 10–500, `dokumen[]`, `draft` true = Draf), `PUT /pencabutan/{id}` (ubah Draf; `draft:false` = submit -> antrean Verifikator AK-24)
- Legacy & lain: `GET /legacy?grp=&layanan=&role=`
- Hotline: `GET /tiket` (`?perusahaan=&status=`), `/tiket/{no}`, `/tiket/{no}/messages`, `POST /tiket`, `/tiket/{no}/messages`, `/tiket/{no}/take|close|reopen`, `GET /hotline-stats`, `GET|PUT /hotline-profiles/{akun}`
- Verifikasi HPK (Verifikator, AK-21): `GET /hpk-verifikasi`, `GET /hpk-verifikasi/{id}`, `POST /hpk-verifikasi/{id}/verify` (generate sesi ekspos) | `reject` (`alasan`) | `resubmit`
- Petugas Ekspos (EP-01..EP-05, usulan): `GET /ekspos-hpk` (HPK fase ekspose lintas pemberi kerja, urut jadwal + no. antrian), `GET /ekspos-hpk/{id}`, `POST /ekspos-hpk/{id}/reschedule` | `perbaikan` (`catatan` 10–500) | `bap` (hanya dari Terjadwal; BAP menunggu disetujui pemberi kerja)
- Validator HPK (usulan, VL-01..VL-05): `GET /validasi-hpk` (HPK dengan BAP disetujui: Menunggu Divalidasi | Tervalidasi, urut tanggal persetujuan BAP), `GET /validasi-hpk/{id}` (+ `formulir` isian & dokumen, `bap`, `riwayat`, `aksi.validasi`), `POST /validasi-hpk/{id}/validate` (`konfirmasi: true`; 409 bila bukan Menunggu Divalidasi)
- Direktur HPK (usulan, DR-01..DR-07): `GET /penerbitan-hpk` (HPK Tervalidasi | HPK Terbit + `surat.tte` + `aksi {terbitkan, tte}`), `GET /penerbitan-hpk/{id}` (+ `formulir`, `bap`, `riwayat`), `POST /penerbitan-hpk/{id}/terbitkan` (`konfirmasi: true`; 409 bila bukan Tervalidasi), `POST /penerbitan-hpk/{id}/tte` (barcode; HPK Tervalidasi diterbitkan dulu; 409 bila sudah TTE), `POST /penerbitan-hpk/tte-semua` ("TTE otomatis semua": TTE untuk semua HPK belum ber-TTE — Tervalidasi ikut diterbitkan — `{jumlah, ids, rows}`; 409 bila kosong)
- Disnaker SKRD (usulan, DN-01..DN-04): `GET /skrd-disnaker` (Perpanjangan Lintas Kab/Kota yang sudah divalidasi: `status` Menunggu SKRD | SKRD terbit | Lunas, `aksi.terbitkan`, `skrd` null sebelum terbit), `GET /skrd-disnaker/{id}` (+ isian, dokumen, `dkptka`), `POST /skrd-disnaker/{id}/terbitkan` (`konfirmasi: true`; 409 bila bukan Menunggu SKRD; SKRD diterima pemberi kerja sebagai tagihan `jenis: SKRD`)
- Imigrasi (usulan, IM-01..IM-10): `GET /imigrasi/tka` (`?tahap=pengesahan|visa|perlintasan`; TKA pada Pengesahan RPTKA terbit + status pengesahan/visa/perlintasan + `tahapSaatIni`/`labelTahap`), `GET /imigrasi/tka/{id}` (+ `pengesahan.payload`, `visa.maksBerlaku`, `perlintasan`, `aksi`), `POST /imigrasi/tka/{id}/receive` (`konfirmasi: true`), `/visa` (`nomorVisa, nomorItas, berlakuSampai`), `/visa-rejection` (`alasan`), `/perlintasan` (`tanggalMasuk, tempatPemeriksaan`)
- Pengesahan RPTKA (Verifikator, AK-22): `GET /pengesahan-verifikasi`, `GET /pengesahan-verifikasi/{id}` (+ `dkptka`), `POST .../{id}/verify|reject|resubmit` dengan body `tahap` (Verifikator hanya `verifikasi`; `billing` → 400, diproses Validator; `resubmit` pemberi kerja menerima keduanya)
- Pengesahan RPTKA (Validator, VP-01..VP-05, usulan): `GET /pengesahan-validasi` (RPTKA lolos Verifikator di tahap Validator / sudah ditindaklanjuti), `GET /pengesahan-validasi/{id}` (+ `dkptka`, `billing`, `aksi.verifikasi`), `POST /pengesahan-validasi/{id}/verify` (kode billing DKPTKA terbit otomatis) | `reject` (`alasan` 10–1000); submit ulang pemberi kerja tetap `POST /pengesahan-verifikasi/{id}/resubmit` (`tahap: billing`)
- Pencabutan RPTKA Direktur (usulan, PD-01..PD-05, view-only + TTE semua): `GET /pencabutan-direktur` (pengajuan Tervalidasi: `status` Menunggu TTE|Sudah di TTE, `sk {nomor, tte, qr}`), `GET /pencabutan-direktur/{id}`, `POST /pencabutan-direktur/tte-semua` (tanpa TTE per baris; 409 bila kosong; status pemberi kerja Terbit)
- Pengesahan + Perpanjangan RPTKA Direktur (usulan, DP-01..DP-12, TTE Direktur otomatis menerbitkan Visa + ITAS ke akun pemberi kerja; menu ketiga Perpanjangan Lintas Kab/Kota 1 Provinsi = `menu: kabkota`, TTE keseluruhan lewat `tte-semua {menu: kabkota}`; baris punya `menu` pengesahan|perpanjangan, `tte-semua` menerima body opsional `{menu: pengesahan|perpanjangan|kabkota}`): `GET /pengesahan-direktur` (RPTKA lolos DKPTKA: `status` Menunggu TTE | Sudah di TTE, `statusDkptka` Lunas | Bebas DKPTKA, `aksi.tte`, `pengesahan {nomor, tte, qr}` null sebelum TTE), `GET /pengesahan-direktur/{id}` (+ isian, dokumen, `dkptka`, `persetujuan`), `POST /pengesahan-direktur/{id}/tte` (tombol TTE; 409 bila sudah di-TTE → surat terbit ke pemberi kerja); persetujuan otomatis dipicu konfirmasi bayar pemberi kerja (lunas) atau `POST /pengesahan-validasi/{id}/verify` (bebas)
- Pencabutan RPTKA (Validator, PV-01..PV-05, usulan): `GET /pencabutan-validasi` (pengajuan pencabutan pemberi kerja real time), `GET /pencabutan-validasi/{id}` (+ `isian`, `dokumen`, `aksi.validasi`), `POST /pencabutan-validasi/{id}/validate` | `reject` (`alasan` 10–1000); submit ulang pemberi kerja tetap `POST /pencabutan-verifikasi/{id}/resubmit` (ditolak Validator → langsung ke Validator)
- Pendaftar (Verifikator, AK-20): `GET /pendaftar` (+ `id`, `emailAdmin`, `operators`, `dokumen`, `emailTerkirim`), `GET /pendaftar/{id}` (id = NPWP / slug nama Non-OSS), `activate` mengirim email aktivasi ke admin + tiap operator
- Back office: `GET /antrian` (`?tahap=a,b&jenis=`), `/jabatan-master`, `/ekspos-schedule`, `/pemda-validations`, `POST /pemda-validations/{id}/decision`,
  `POST /antrian/{id}/decision` (setujui|kembalikan; `billing` kode saat Dirjen menyetujui Pengesahan), `POST /antrian/signatures` (TTE direktur ->
  `{signed, ids, forwardedToDirjen, rows}`), `POST /pendaftar/{npwp}/activate|request-fix|resubmit` (AK-15: `activate`
  tanpa prasyarat email; `resubmit` = pemohon unggah ulang dokumen setelah `request-fix`), `GET|POST /antrian/{id}/annotations`,
  `DELETE /antrian/{id}/annotations/{annotationId}?tahap=`, `POST /ekspos-schedule/{id}/meetings`, `POST /ekspos-schedule/{id}/bap`
  (`GET /ekspos-schedule` juga memuat `sessions[]`)
- Akun: `POST /auth/login`, `/auth/register` (5 langkah: status penanam modal, jenis pemberi kerja, data perusahaan,
  data operator, dokumen — AK-13/14/15/16; dipicu dari layar `menu` setelah login SIAPKerja, bukan tombol terpisah;
  status awal pendaftar `Menunggu verifikasi`; tanpa username/password — identitas dari SIAPKerja + email operator),
  `POST /auth/register/company-lookup` (cari NIB/WLKP/NPWP dari kode WLKP ke OSS, pola OP-06, AK-14),
  `POST /auth/register/operator-check` (cek email operator ke SIAPKerja, AK-16),
  `GET /auth/email-verifications/{token}`, `POST /auth/email-verifications` (kirim ulang), `POST /auth/password-reset`, `/auth/password-reset/confirm`,
  `POST /auth/password-change`, `POST /auth/email-change` (field `username` = identitas prototipe; BE ambil dari sesi)

Akun demo (mock): `nbp.hrd`/`ypkn.admin`/`okta.jkt` + `rahasia123` (swasta/lembaga/pemerintah), `nbp.daftar`/`rahasia123`
(Rina Wulandari, belum terdaftar — berpasangan dengan `nbp.hrd` untuk demo AK-19; keduanya ditampilkan sebagai tombol
isi-cepat di bawah form login akun-login.html), `nbp.baru`/`sementara01` (wajib ganti password), `nbp.sso` (status 3),
`nbp.nonaktif` (status 5), agen hotline `fajar.n`/`hotline2026`, Verifikator `verif.akun`/`verifikator2026` (langsung ke `verifikator-akun.html`).
Akun demo Petugas Ekspos: `petugas.ekspos`/`ekspos2026` (kind `petugas-ekspos`, langsung ke `petugas-ekspos.html`, tombol isi-cepat di akun-login.html).
Akun demo Superadmin: `superadmin`/`superadmin2026` (kind `superadmin`, langsung ke `imigrasi-akun.html`, tombol isi-cepat di akun-login.html).
Akun demo Disnaker: `disnaker.bekasi`/`disnaker2026` (kind `disnaker`, Rudi Hartono, langsung ke `disnaker-akun.html`, tombol isi-cepat di akun-login.html).
Akun demo Direktur: `direktur.pptka`/`direktur2026` (kind `direktur-hpk`, Direktur PPTKA, langsung ke `direktur-hpk.html`, tombol isi-cepat di akun-login.html).
Akun demo Validator HPK: `validator.hpk`/`validator2026` (kind `validator-hpk`, Maya Anggraeni, langsung ke `validator-hpk.html`, tombol isi-cepat di akun-login.html).
Peran demo Back Office: Verifikator Akun, Verifikator Permohonan, Petugas Ekspos, Validator (Kasi/Subkoordinator), Kasubdit / Koordinator,
Direktur PPTKA, **Direktur Jenderal** (tahap "Persetujuan Direktur Jenderal", tahap akhir HPK & Pengesahan, rantai Gabungan [I]), Pejabat Pemda, Admin Pusat.
Level operator portal (usulan [I]): `admin` (Admin perusahaan) / `operator` / `lihat` (Hanya lihat) — demo "Masuk sebagai" di Operator & Akses.
Sesi: tidak ada session manager baru; field pelaku di body (`actorLevel`, `penulis`, `username`) dan pelaku demo di audit log hanya prototipe (lihat AK-12, SC-08). Pengecualian kecil: `operator-session.js` menitip email operator yang login
ke `sessionStorage` murni untuk deteksi "sudah terdaftar" di layar `menu` (AK-19) — bukan session manager, hilang saat tab ditutup.
Akun `nbp.hrd` (swasta), `ypkn.admin` (lembaga, `sekretariat@ypkn.or.id`) dan `okta.jkt` (pemerintah, `admin.jakarta@okta-asia.org`) adalah operator
yang pendaftarannya sudah `Aktif` (seed `pendaftar`) — klik kartu "TKA - Online" langsung ke `portal-pemberi-kerja.html?role=<kelompok>`
(role dari `companyKey` login via `operator-session.js`), bukan wizard; ketiganya punya tombol isi-cepat di akun-login.html. Menu portal
"Perpanjangan" (submenu Lintas Provinsi, Lintas Kab/Kota dalam 1 Provinsi; business-rules RP-16) terpisah dari "Pengesahan RPTKA".
Respons: `{ data, meta? }`; error `{ error: { code, message, field?, fields? } }`.

## Menambah endpoint

1. Kontrak request di `js/contracts/<resource>.js` (+ `validateX`).
2. Route di `js/mocks/routes/<resource>.js` (enforce aturan bisnis, lihat `docs/shared/business-rules.md`), daftarkan di `js/mocks/handlers.js`.
3. Helper di `js/api/<resource>.js`.
4. Contract test di `test/contract/`, lalu `node scripts/generate-openapi.js`.
