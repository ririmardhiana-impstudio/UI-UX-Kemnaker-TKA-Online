/**
 * @fileoverview Akun Superadmin (usulan, lembar kebutuhan "Integrasi
 * Imigrasi"): menerima (view-only) (1) data Pengesahan RPTKA yang SUDAH punya
 * Visa dan ITAS — diproses Imigrasi di aplikasinya sendiri lalu dikirim ke
 * TKA Online lewat API integrasi (POST .../visa-itas, .../perlintasan;
 * pemanggil = sistem Imigrasi, bukan UI) — dan (2) data perpanjangan RPTKA
 * dari pemberi kerja. Satu baris = satu TKA pada Pengesahan RPTKA terbit
 * (store.pengesahan[role], stepIdx 6); status integrasi di
 * `store.imigrasi[id]`. Aturan IM-01..IM-14 (docs/shared/business-rules.md).
 */

import {
  IMIGRASI_PENGESAHAN as P, IMIGRASI_PERLINTASAN as L, IMIGRASI_VISA as V,
  validateImigrasiPerlintasan, validateImigrasiVisa,
} from '../../contracts/imigrasi.js';
import {
  DOKUMEN, dokumenTka, dokumenUntuk, jenisDef, kolomTka,
} from '../../contracts/pengesahan-rptka.js';
import { fail, invalid, list, notFound, ok, route } from '../router.js';
import { pushNotifikasi } from './notifikasi.js';
import { seed as seedRptka } from './pengesahan-rptka.js';
import { appendAudit } from './security.js';

const TAG = 'Imigrasi';
const ROLES = ['swasta', 'lembaga', 'pemerintah'];
const TERBIT_STEP = 6;
const ACTOR = ['Sistem Imigrasi', 'Integrasi Imigrasi', '10.18.2.30'];
const DEFAULT_TODAY = '2026-09-30';
const BULAN_ID = ['januari', 'februari', 'maret', 'april', 'mei', 'juni',
  'juli', 'agustus', 'september', 'oktober', 'november', 'desember'];
const NOT_FOUND = 'Data TKA pada Pengesahan RPTKA';
const EXAMPLE_ID = { params: { id: 'swasta-p5' } };
const bk = (nama, ukuranKb = 100) => ({ namaBerkas: nama, ukuranKb });
/** Perpanjangan lengkap (contoh OpenAPI): dibuat + disubmit sebelum dibaca. */
const PRP_EXAMPLE = {
  jenis: 'Perpanjangan Lintas Provinsi', hpkId: 'h5',
  jabatan: [{ nama: 'Rolling Mill Specialist', jumlahTka: 1,
    jangkaWaktuBulan: 12 }],
  tka: [{ jabatan: 'Rolling Mill Specialist', urut: 1, ocr: {},
    data: { nama: 'Arjun Nair', tempatLahir: 'Chennai',
      tanggalLahir: '1988-04-12', jenisKelamin: 'Laki-laki', pendidikan: 'S2',
      statusPerkawinan: 'Kawin', kebangsaan: 'India',
      nomorPaspor: 'K1234567', tanggalTerbitPaspor: '2024-01-10',
      tanggalBerakhirPaspor: '2034-01-09', tempatTerbitPaspor: 'Chennai',
      alamatTinggal: 'Jl. Industri 5', kodePos: '17530',
      email: 'arjun@example.com', telepon: '081234567890',
      jaminanSosial: '0001234567', npwpTka: '123456789012345',
      lokasiKerja: 'KAB. BEKASI' },
    dokumen: { 'p-perjanjian': bk('pk.pdf'), 'p-izin-tinggal': bk('itas.pdf'),
      'p-paspor': bk('paspor.jpg'), 'p-pas-foto': bk('foto.png') } }],
  dokumenJabatan: {},
  dokumenPermohonan: Object.fromEntries(['p-permohonan', 'p-tugas',
    'p-domisili', 'p-wajib-lapor', 'p-diklat', 'p-pendampingan', 'p-tki']
    .map((k) => [k, bk(`${k}.pdf`, 500)])),
};
const PRP_BEFORE = [
  { method: 'POST', path: '/pengesahan-rptka', query: { role: 'swasta' },
    body: PRP_EXAMPLE },
  { method: 'POST', path: '/pengesahan-rptka/rp5/submit',
    query: { role: 'swasta' }, body: {} },
];

export const IMIGRASI_ROUTES = [
  route('GET', '/imigrasi/tka', listTka, {
    tag: TAG,
    summary: 'Superadmin (view-only): TKA pada Pengesahan RPTKA terbit yang ' +
      'SUDAH memiliki Visa dan ITAS (diproses Imigrasi di aplikasinya lalu ' +
      'dikirim ke TKA Online lewat integrasi) + status perlintasan, ' +
      'dokumen permohonan.',
  }),
  route('GET', '/imigrasi/tka/:id', getTka, {
    tag: TAG, example: { params: { id: 'swasta-p3' } },
    summary: 'Detail view-only: data pengesahan, Visa/ITAS, perlintasan, ' +
      'dokumen. 404 bila Visa/ITAS belum diterima dari Imigrasi.',
    responses: { 404: 'Data TKA tidak ditemukan / belum ber-Visa-ITAS.' },
  }),
  route('GET', '/imigrasi/perpanjangan', listPerpanjangan, {
    tag: TAG,
    query: { cakupan: 'Lintas Provinsi | Lintas Kab/Kota dalam 1 Provinsi ' +
      '(opsional)' },
    summary: 'Superadmin (view-only): perpanjangan RPTKA yang diajukan ' +
      'pemberi kerja (Form RPTKA jenis Perpanjangan: Lintas Provinsi dan ' +
      'Lintas Kab/Kota dalam 1 Provinsi, status bukan Draf); `?cakupan=` ' +
      'menyaring satu cakupan.',
  }),
  route('GET', '/imigrasi/perpanjangan/:id', getPerpanjangan, {
    tag: TAG, summary: 'Detail view-only satu perpanjangan RPTKA.',
    example: { params: { id: 'swasta-rp5' }, before: PRP_BEFORE },
    responses: { 404: 'Perpanjangan tidak ditemukan.' },
  }),
  route('POST', '/imigrasi/tka/:id/visa-itas', receiveVisa, {
    tag: TAG, request: 'ImigrasiVisaRequest',
    example: { params: EXAMPLE_ID.params,
      body: { nomorVisa: 'VITAS26100001', nomorItas: 'ITAS26100001A',
        berlakuSampai: '2027-01-31' } },
    summary: 'API integrasi (dipanggil sistem Imigrasi, bukan UI): terima ' +
      'data Visa dan ITAS satu TKA. Berlaku s.d. ≥ hari ini dan ≤ masa ' +
      'berlaku pengesahan. Sekali terima (409). Notifikasi ke pemberi kerja.',
    responses: { 400: 'Isian tidak valid / berlaku di luar masa pengesahan.',
      404: 'Pengesahan tidak ditemukan.',
      409: 'Data Visa dan ITAS sudah diterima.' },
  }),
  route('POST', '/imigrasi/tka/:id/perlintasan', receivePerlintasan, {
    tag: TAG, request: 'ImigrasiPerlintasanRequest',
    example: { params: EXAMPLE_ID.params,
      body: { tanggalMasuk: '2026-09-30',
        tempatPemeriksaan: 'Soekarno-Hatta (Tangerang)' },
      before: [{ method: 'POST', path: '/imigrasi/tka/swasta-p5/visa-itas',
        body: { nomorVisa: 'VITAS26100001', nomorItas: 'ITAS26100001A',
          berlakuSampai: '2027-01-31' } }] },
    summary: 'API integrasi: terima data perlintasan (kedatangan) TKA untuk ' +
      'Direktorat PPTKA. Hanya setelah Visa/ITAS diterima; sekali terima.',
    responses: { 400: 'Tanggal masuk sebelum visa terbit / di masa depan.',
      409: 'Visa belum diterima atau perlintasan sudah diterima.' },
  }),
];

const todayIso = (store) => store.todayIso ?? DEFAULT_TODAY;

/** "14 Agustus 2026" -> '2026-08-14'; '' bila bukan format itu. */
function isoDariId(text) {
  const [d, month, y] = String(text ?? '').trim().split(/\s+/);
  const m = BULAN_ID.indexOf(String(month).toLowerCase());
  return m < 0 ? '' : `${y}-${String(m + 1).padStart(2, '0')}-` +
    String(d).padStart(2, '0');
}

function addMonths(iso, months) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

const MIME = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg' };
/** Dokumen standar untuk data seed lama (tanpa pengajuan Form RPTKA asli). */
const DOKUMEN_SEED = ['ijazah', 'sertifikat', 'perjanjian', 'polis-asal',
  'paspor', 'pas-foto'];
const slug = (text) => String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

const berkas = (jenis, namaBerkas, ukuranKb, berkasId = null) => ({ jenis,
  fileName: namaBerkas, fileSize: ukuranKb * 1024, berkasId,
  mimeType: MIME[namaBerkas.split('.').pop().toLowerCase()] ??
    'application/pdf' });

const hash = (text) => [...String(text)].reduce((s, c) => s + c.charCodeAt(0),
  0);

/**
 * Dokumen permohonan Pengesahan RPTKA satu TKA untuk diperiksa petugas
 * Imigrasi: berkas asli pengajuan Form RPTKA (berkasId) bila ada; data seed
 * lama memakai daftar dokumen standar (pratinjau = lembar contoh).
 */
function dokumenOf(store, { role, p }) {
  const item = p.rptkaId
    ? store.pengesahanRptka?.[role]?.find((r) => r.id === p.rptkaId) : null;
  const t = item?.tka.find((x) => x.jabatan === p.jabatan &&
    x.data?.nama === p.nama);
  if (item && t) {
    const jabatan = item.jabatan.find((j) => j.nama === t.jabatan);
    const rows = [...dokumenTka(item, t).map((d) => [d.label,
      t.dokumen[d.kunci]]), ...(jabatan ? dokumenUntuk(item, 'jabatan',
      jabatan).map((d) => [d.label,
      item.dokumenJabatan?.[jabatan.nama]?.[d.kunci]]) : [])];
    return rows.filter(([, saved]) => saved).map(([label, saved]) =>
      berkas(label, saved.namaBerkas, saved.ukuranKb, saved.berkasId ?? null));
  }
  return DOKUMEN_SEED.map((kunci, i) => berkas(DOKUMEN[kunci].label,
    `${kunci}-${slug(p.nama)}.${DOKUMEN[kunci].jpg ? 'jpg' : 'pdf'}`,
    90 + ((hash(p.id) + i * 37) % 400)));
}

/** Pengesahan terbit milik tiap role = sumber data integrasi. */
function sources(store) {
  return ROLES.flatMap((role) => (store.pengesahan[role] ?? [])
    .filter((p) => p.stepIdx >= TERBIT_STEP)
    .map((p) => ({ id: `${role}-${p.id}`, role, p })));
}

const nomorOf = ({ p }) => p.pengesahan?.nomor ?? p.barcode ?? '—';
const terbitOf = (store, { p }) => p.pengesahan?.tanggal ??
  (isoDariId(p.tgl) || todayIso(store));

/** Status awal: data seed yang sudah ✓ terkirim punya riwayat visa/perlintasan. */
function defaultState(store, src) {
  const { p } = src;
  const base = { pengesahan: { status: P.TERSEDIA, tanggal: '' },
    visa: { status: V.BELUM }, perlintasan: { status: L.BELUM } };
  // Sebagian data seed belum ditarik Imigrasi (status Tersedia) supaya alur
  // pertukaran data bisa didemokan; kolom Imigrasi pemberi kerja ikut.
  if (!p.imigrasi || hash(src.id) % 4 === 1) {
    p.imigrasi = false;
    return base;
  }
  const terbit = terbitOf(store, src);
  const kode = String(hash(src.id)).padStart(5, '0');
  const state = { ...base, pengesahan: { status: P.DITERIMA, tanggal: terbit },
    visa: { status: V.MENUNGGU } };
  if (hash(src.id) % 3 === 0) {
    state.visa = { status: V.TERBIT, nomorVisa: `VITAS${terbit
      .replaceAll('-', '').slice(2)}${kode}`,
    nomorItas: `ITAS${kode}${terbit.slice(5, 7)}A`, tanggalTerbit: terbit,
    berlakuSampai: addMonths(terbit, p.bulan) };
    if (hash(src.id) % 2 === 0) {
      state.perlintasan = { status: L.TERKIRIM, tanggalMasuk: terbit,
        tempatPemeriksaan: 'Soekarno-Hatta (Tangerang)',
        tanggalKirim: terbit };
    }
  }
  return state;
}

/** Mutasi `s` jadi Visa/ITAS terbit (tidak memanggil `stateOf` — dipakai
 * `terimaVisaOtomatis` dan backfill lazy `stateOf` di bawah, tanpa rekursi). */
function fillVisaTerbit(store, src, s) {
  const terbit = terbitOf(store, src);
  const kode = String(hash(src.id)).padStart(5, '0');
  const nomorVisa = `VITAS${terbit.replaceAll('-', '').slice(2)}${kode}`;
  const nomorItas = `ITAS${kode}${terbit.slice(5, 7)}A`;
  s.pengesahan = { status: P.DITERIMA, tanggal: terbit };
  s.visa = { status: V.TERBIT, nomorVisa, nomorItas, tanggalTerbit: terbit,
    berlakuSampai: addMonths(terbit, src.p.bulan) };
  src.p.imigrasi = true;
  return { nomorVisa, nomorItas };
}

/**
 * Baris `store.pengesahan[role]` Pengesahan RPTKA ASAL yang diperpanjang
 * oleh `p` (Perpanjangan) — ditautkan lewat item Form RPTKA `p.rptkaId` ->
 * `item.rptkaAsalId` (diisi `applyRptkaAsal`, rptka.js, saat pemberi kerja
 * memilih "Nomor RPTKA" asal). `null` kalau `p` bukan Perpanjangan, atau
 * asalnya tak bisa ditautkan (mis. data seed/legacy lama tanpa
 * `rptkaAsalId`).
 */
function asalRowFor(store, role, p) {
  if (!p.rptkaId) {
    return null;
  }
  seedRptka(store);
  const item = store.pengesahanRptka[role]?.find((i) => i.id === p.rptkaId);
  return item?.rptkaAsalId
    ? store.pengesahan[role]?.find((x) => x.id === item.rptkaAsalId) ?? null
    : null;
}

function stateOf(store, src) {
  const perpanjangan = jenisDef(src.p.layanan)?.menu === 'perpanjangan';
  if (perpanjangan) {
    const asal = asalRowFor(store, src.role, src.p);
    // Perpanjangan RPTKA tidak punya Visa/ITAS/lalu lintas keimigrasian
    // SENDIRI — TKA-nya SAMA dengan yang ada pada Pengesahan RPTKA asal
    // yang sedang diperpanjang, jadi datanya diambil dari sana (permintaan
    // user: "data visa itas dan lintas imigrasinya diambil dari pengesahan
    // karena hanya perpanjangan rptka bukan pengesahan"), bukan dihasilkan
    // ulang (RV-17) ataupun dikosongkan (RV-18) — proxy langsung ke
    // `stateOf` baris asal (rekursi, berhenti karena baris asal sendiri
    // BUKAN Perpanjangan) supaya selalu sinkron dengan data asal yang
    // sebenarnya (termasuk ikut ter-backfill di bawah kalau asalnya
    // sendiri belum terisi).
    if (asal) {
      return stateOf(store, { id: `${src.role}-${asal.id}`, role: src.role,
        p: asal });
    }
    // Tidak ada Pengesahan RPTKA asal yang bisa ditautkan (data lama/seed
    // tanpa `rptkaAsalId`) — bersihkan sisa data salah dari sebelum gerbang
    // RV-17/18 ada (kalau ada) dan biarkan kosong, bukan menebak.
    store.imigrasi ??= {};
    const s = (store.imigrasi[src.id] ??= defaultState(store, src));
    if (s.visa.status !== V.BELUM || s.pengesahan.status !== P.TERSEDIA) {
      Object.assign(s, { pengesahan: { status: P.TERSEDIA, tanggal: '' },
        visa: { status: V.BELUM }, perlintasan: { status: L.BELUM } });
      src.p.imigrasi = false;
    }
    return s;
  }
  store.imigrasi ??= {};
  const s = (store.imigrasi[src.id] ??= defaultState(store, src));
  // Backfill lazy: pengajuan Form RPTKA (`rptkaId` ada — sumber hanya
  // `applySubmitEffects` di routes/pengesahan-rptka.js, TIDAK PERNAH data
  // seed/fixture) yang sudah di-TTE tapi belum ter-Visa/ITAS sama sekali
  // (mis. pengajuan lama yang sempat di-TTE SEBELUM `terimaVisaOtomatis`
  // ditambahkan, tersimpan stale di `localStorage` — "existing", sama
  // seperti RV-13) — supaya tetap terisi begitu dibuka, bukan cuma pengajuan
  // yang di-TTE SETELAH kode ini ada. SENGAJA digerbang `src.p.rptkaId`:
  // data seed/demo (tanpa `rptkaId`) TIDAK disentuh di sini, staggering
  // hash `defaultState` di atas (sebagian sengaja belum ditarik Imigrasi,
  // untuk variasi demo) tetap berlaku apa adanya.
  if (src.p.rptkaId && src.p.stepIdx >= TERBIT_STEP &&
      s.visa.status !== V.TERBIT) {
    const { nomorVisa, nomorItas } = fillVisaTerbit(store, src, s);
    audit(store, src, 'Setujui', [{ field: 'visa', sebelum: V.BELUM,
      sesudah: nomorVisa }]);
    notify(store, src, `Visa dan ITAS terbit (${src.p.nama})`,
      `Pengesahan RPTKA terbit; Visa ${nomorVisa} dan ITAS ${nomorItas} ` +
      `untuk ${src.p.nama} berlaku sampai ${s.visa.berlakuSampai}.`);
  }
  return s;
}

function findSrc(store, id) {
  return sources(store).find((s) => s.id === id) ?? null;
}

/**
 * Visa dan ITAS diterima otomatis begitu SK Pengesahan RPTKA terbit (TTE
 * Direktur, `jalankanTte` di billing-dkptka.js): tanpa menunggu panggilan
 * integrasi Imigrasi, data langsung tampil di akun pemberi kerja (kolom
 * Imigrasi + panel keimigrasian). Nomor dibuat sistem (peraga), berlaku
 * sepanjang masa berlaku pengesahan. Idempoten: data yang sudah diterima
 * tidak ditimpa.
 * @param {!Object} store
 * @param {!Object} p Baris `store.pengesahan[role]` yang baru terbit.
 * @return {boolean} true bila Visa/ITAS baru diterbitkan.
 */
export function terimaVisaOtomatis(store, p) {
  const role = ROLES.find((r) => store.pengesahan[r]?.includes(p));
  if (!role || p.stepIdx < TERBIT_STEP) {
    return false;
  }
  const src = { id: `${role}-${p.id}`, role, p };
  // `stateOf` sendiri sudah lazy-backfill untuk baris Form RPTKA (`rptkaId`
  // ada, lihat di atas) — kalau sudah terisi lewat jalur itu, `s.visa`
  // sudah TERBIT di sini, tinggal berhenti (idempoten, tanpa audit/
  // notifikasi dobel). Baris antrian LAMA tanpa `rptkaId` (dicocokkan lewat
  // nama TKA, `linkedPengesahanRows`) tidak digerbang jalur lazy itu, jadi
  // tetap diisi eksplisit di sini seperti semula.
  const s = stateOf(store, src);
  if (s.visa.status === V.TERBIT) {
    return false;
  }
  const { nomorVisa, nomorItas } = fillVisaTerbit(store, src, s);
  audit(store, src, 'Setujui', [{ field: 'visa', sebelum: V.BELUM,
    sesudah: nomorVisa }]);
  notify(store, src, `Visa dan ITAS terbit (${p.nama})`,
    `Pengesahan RPTKA terbit; Visa ${nomorVisa} dan ITAS ${nomorItas} untuk ` +
    `${p.nama} berlaku sampai ${s.visa.berlakuSampai}.`);
  return true;
}

/**
 * Ringkasan Visa/ITAS + lalu lintas keimigrasian untuk satu baris
 * `store.pengesahan[role]` — dipakai `routes/portal.js` `listPengesahan`
 * supaya pemberi kerja bisa melihat data ITAS & lalu lintas keimigrasian
 * pada permohonannya sendiri (usulan, lembar kebutuhan "Tampilkan data
 * ITAS per TKA"), bukan cuma kolom boolean `p.imigrasi` ("✓ Terkirim").
 * `null` sebelum Pengesahan RPTKA terbit (stepIdx < 6) — belum ada apa pun
 * untuk Imigrasi proses.
 * @return {?Object}
 */
export function snapshotFor(store, role, p) {
  if (p.stepIdx < TERBIT_STEP) {
    return null;
  }
  const src = { id: `${role}-${p.id}`, role, p };
  const s = stateOf(store, src);
  const terbit = terbitOf(store, src);
  return {
    pengesahan: { status: s.pengesahan.status, tone: TONE[s.pengesahan.status] },
    visa: { ...s.visa, tone: TONE[s.visa.status],
      maksBerlaku: addMonths(terbit, p.bulan) },
    perlintasan: { ...s.perlintasan, tone: TONE[s.perlintasan.status] },
  };
}

const TONE = { [P.TERSEDIA]: 'amber', [P.DITERIMA]: 'green',
  [V.BELUM]: 'gray', [V.MENUNGGU]: 'amber', [V.TERBIT]: 'green',
  [V.DITOLAK]: 'red', [L.BELUM]: 'gray', [L.TERKIRIM]: 'green' };

function summary(store, src) {
  const { p, role } = src;
  const s = stateOf(store, src);
  const company = store.companies[role];
  const row = {
    id: src.id, nomorPengesahan: nomorOf(src), nama: p.nama,
    negara: p.negara, paspor: p.paspor, jabatan: p.jabatan,
    pemberiKerja: company.nama, kategori: company.kategori,
    tanggalTerbit: terbitOf(store, src), bulan: p.bulan,
    statusPengesahan: s.pengesahan.status,
    tonePengesahan: TONE[s.pengesahan.status],
    statusVisa: s.visa.status, toneVisa: TONE[s.visa.status],
    visa: { ...s.visa },
    statusPerlintasan: s.perlintasan.status,
    tonePerlintasan: TONE[s.perlintasan.status],
  };
  const dokumen = dokumenOf(store, src);
  return { ...row, dokumen, jumlahDokumen: dokumen.length };
}

function detail(store, src) {
  const { p, role } = src;
  const s = stateOf(store, src);
  const sum = summary(store, src);
  const terbit = sum.tanggalTerbit;
  return {
    ...sum,
    pengesahan: { status: s.pengesahan.status, tanggalDiterima:
      s.pengesahan.tanggal, tte: p.pengesahan?.tte ?? null,
    payload: { nomorPengesahan: sum.nomorPengesahan, tanggalTerbit: terbit,
      masaBerlakuBulan: p.bulan,
      pemberiKerja: { nama: sum.pemberiKerja, kategori: sum.kategori },
      tka: { nama: p.nama, kebangsaan: p.negara, nomorPaspor: p.paspor,
        jabatan: p.jabatan },
      tte: p.pengesahan?.tte ?? null } },
    visa: { ...s.visa, maksBerlaku: addMonths(terbit, p.bulan) },
    perlintasan: s.perlintasan,
    integrasi: { sumber: 'TKA Online (Pengesahan RPTKA terbit)',
      tujuan: 'Superadmin TKA Online',
      antarmuka: `POST /api/v1/imigrasi/tka/${src.id}/visa-itas`, role },
  };
}

function audit(store, src, aksi, perubahan) {
  const [pengguna, peran, ip] = ACTOR;
  appendAudit(store, { pengguna, peran, aksi, modul: 'Permohonan',
    objek: `Imigrasi ${nomorOf(src)} · ${src.p.nama}`, perubahan, ip });
}

function notify(store, src, judul, isi) {
  pushNotifikasi(store, src.role, { judul, isi, kategori: 'Pengesahan',
    tautan: { page: 'hpkList' } });
}

const hasVisa = (store, src) => stateOf(store, src).visa.status === V.TERBIT;

function listTka({ store }) {
  const rows = sources(store).filter((src) => hasVisa(store, src))
    .map((src) => summary(store, src));
  return list(rows.sort((a, b) => b.tanggalTerbit.localeCompare(a.tanggalTerbit)
    || a.nama.localeCompare(b.nama)));
}

function getTka({ params, store }) {
  const src = findSrc(store, params.id);
  return src && hasVisa(store, src) ? ok(detail(store, src))
    : notFound(NOT_FOUND);
}

function receiveVisa({ params, body, store }) {
  const result = validateImigrasiVisa(body);
  if (!result.valid) {
    return invalid(result);
  }
  const src = findSrc(store, params.id);
  if (!src) {
    return notFound(NOT_FOUND);
  }
  const s = stateOf(store, src);
  if (s.visa.status === V.TERBIT) {
    return fail(409, 'INVALID_STATE', 'Data Visa dan ITAS sudah diterima.');
  }
  const maks = addMonths(terbitOf(store, src), src.p.bulan);
  if (body.berlakuSampai < todayIso(store) || body.berlakuSampai > maks) {
    return fail(400, 'VALIDATION_ERROR', `Berlaku sampai harus antara hari ` +
      `ini dan masa berlaku pengesahan (${maks}).`,
    { field: 'berlakuSampai', fields: { berlakuSampai:
      `Harus antara hari ini dan ${maks}.` } });
  }
  s.pengesahan = { status: P.DITERIMA, tanggal: todayIso(store) };
  s.visa = { status: V.TERBIT, nomorVisa: body.nomorVisa,
    nomorItas: body.nomorItas, tanggalTerbit: todayIso(store),
    berlakuSampai: body.berlakuSampai };
  src.p.imigrasi = true;
  audit(store, src, 'Setujui', [{ field: 'visa', sebelum: V.BELUM,
    sesudah: body.nomorVisa }]);
  notify(store, src, `Visa dan ITAS terbit (${src.p.nama})`,
    `Visa ${body.nomorVisa} dan ITAS ${body.nomorItas} untuk ${src.p.nama} ` +
    `berlaku sampai ${body.berlakuSampai}.`);
  return ok(detail(store, src));
}

function receivePerlintasan({ params, body, store }) {
  const result = validateImigrasiPerlintasan(body);
  if (!result.valid) {
    return invalid(result);
  }
  const src = findSrc(store, params.id);
  if (!src) {
    return notFound(NOT_FOUND);
  }
  const s = stateOf(store, src);
  if (s.visa.status !== V.TERBIT) {
    return fail(409, 'INVALID_STATE', 'Visa dan ITAS belum diterima.');
  }
  if (s.perlintasan.status === L.TERKIRIM) {
    return fail(409, 'INVALID_STATE', 'Data perlintasan sudah diterima.');
  }
  const today = todayIso(store);
  if (body.tanggalMasuk > today || body.tanggalMasuk < s.visa.tanggalTerbit) {
    return fail(400, 'VALIDATION_ERROR', 'Tanggal masuk harus antara ' +
      `tanggal terbit visa (${s.visa.tanggalTerbit}) dan hari ini.`,
    { field: 'tanggalMasuk', fields: { tanggalMasuk:
      `Harus antara ${s.visa.tanggalTerbit} dan ${today}.` } });
  }
  s.perlintasan = { status: L.TERKIRIM, tanggalMasuk: body.tanggalMasuk,
    tempatPemeriksaan: body.tempatPemeriksaan, tanggalKirim: today };
  audit(store, src, 'Tindak lanjut', [{ field: 'perlintasan',
    sebelum: L.BELUM, sesudah: L.TERKIRIM }]);
  notify(store, src, `TKA tercatat masuk Indonesia (${src.p.nama})`,
    `${src.p.nama} tercatat masuk ${body.tanggalMasuk} di ` +
    `${body.tempatPemeriksaan}; data diterima Direktorat PPTKA.`);
  return ok(detail(store, src));
}

/** Pengajuan Form RPTKA jenis Perpanjangan (bukan Draf) lintas pemberi kerja. */
function perpanjanganRows(store) {
  seedRptka(store);
  return ROLES.flatMap((role) => (store.pengesahanRptka[role] ?? [])
    .filter((item) => item.status !== 'Draf' &&
      jenisDef(item.jenis)?.menu === 'perpanjangan')
    .map((item) => ({ id: `${role}-${item.id}`, role, item })));
}

function perpanjanganSummary(store, { id, role, item }) {
  const company = store.companies[role];
  return { id, noAjuan: item.noAjuan, jenis: item.jenis,
    cakupan: jenisDef(item.jenis)?.label ?? item.jenis,
    kegiatan: item.kegiatan ?? null, pemberiKerja: company.nama,
    kategori: company.kategori, jumlahTka: item.jabatan
      .reduce((n, j) => n + j.jumlahTka, 0), status: item.status,
    tone: item.tone ?? 'amber', diajukan: item.diajukan ?? item.diubah,
    rptkaAsalId: item.rptkaAsalId ?? null };
}

function listPerpanjangan({ query, store }) {
  const rows = perpanjanganRows(store)
    .map((src) => perpanjanganSummary(store, src))
    .filter((r) => !query.cakupan || r.cakupan === query.cakupan);
  return list(rows.sort((a, b) => String(b.diajukan)
    .localeCompare(String(a.diajukan)) || b.id.localeCompare(a.id)));
}

function getPerpanjangan({ params, store }) {
  const src = perpanjanganRows(store).find((s) => s.id === params.id);
  if (!src) {
    return notFound('Perpanjangan RPTKA');
  }
  const { item, role } = src;
  const dokumen = [];
  for (const t of item.tka) {
    for (const d of dokumenTka(item, t)) {
      const saved = t.dokumen?.[d.kunci];
      if (saved) {
        dokumen.push(berkas(`${d.label} — ${t.data?.nama ?? t.jabatan}`,
          saved.namaBerkas, saved.ukuranKb, saved.berkasId ?? null));
      }
    }
  }
  for (const j of item.jabatan) {
    for (const d of dokumenUntuk(item, 'jabatan', j)) {
      const saved = item.dokumenJabatan?.[j.nama]?.[d.kunci];
      if (saved) {
        dokumen.push(berkas(`${d.label} — ${j.nama}`, saved.namaBerkas,
          saved.ukuranKb, saved.berkasId ?? null));
      }
    }
  }
  for (const [kunci, saved] of Object.entries(item.dokumenPermohonan ?? {})) {
    dokumen.push(berkas(DOKUMEN[kunci]?.label ?? kunci, saved.namaBerkas,
      saved.ukuranKb, saved.berkasId ?? null));
  }
  const asal = item.rptkaAsalId
    ? store.pengesahanRptka[role]?.find((r) => r.id === item.rptkaAsalId) : null;
  const kolom = kolomTka(item.jenis);
  return ok({ ...perpanjanganSummary(store, src), role,
    rptkaAsal: asal ? { noAjuan: asal.noAjuan, jenis: asal.jenis } : null,
    hpkBarcode: item.hpkBarcode ?? null,
    jabatan: item.jabatan, riwayat: item.riwayat ?? [],
    tka: item.tka.map((t) => ({ nama: t.data?.nama ?? '',
      kebangsaan: t.data?.kebangsaan ?? '', paspor: t.data?.nomorPaspor ?? '',
      jabatan: t.jabatan, identitas: kolom.map((c) => ({ label: c.label,
        nilai: String(t.data?.[c.kunci] ?? ''),
        tanggal: c.tipe === 'tanggal' })) })),
    dokumen, jumlahDokumen: dokumen.length });
}
