/**
 * @fileoverview Shared state + helpers of the Form RPTKA page (page key
 * "rptka", params {baru, jenis?, hpk?, jabatan?} atau {id}): sesi kerja
 * (state.ui.rptka, reset tiap navigasi), load() HPK aktif + lokasi + detail,
 * sinkronisasi slot TKA dan format tanggal/rupiah.
 */

import { getRptka, listHpkAktif, listRptka } from '../../api/pengesahan-rptka.js';
import { listWilayah } from '../../api/wilayah.js';
import {
  RPTKA_MAX_BULAN, RPTKA_STATUS, butuhHpk, dokumenTka, dokumenUntuk,
  jenisDef, jenisPerpanjangan, slotTka,
} from '../../contracts/pengesahan-rptka.js';
import { reloadCollection, withRetry } from './data.js';
import { state } from './state.js';

export const PAGE = 'rptka';
export const MODAL = 'portal-modal';
export const TABS = [
  { key: 'jabatan', label: 'Jabatan TKA' },
  { key: 'dokumen', label: 'Unggah Dokumen' },
  { key: 'data', label: 'Data TKA' },
  { key: 'preview', label: 'Preview' },
];

const DATE = new Intl.DateTimeFormat('id-ID', { day: 'numeric',
  month: 'long', year: 'numeric', timeZone: 'UTC' });
const RUPIAH = new Intl.NumberFormat('id-ID', { style: 'currency',
  currency: 'IDR', maximumFractionDigits: 0 });

/** @param {string} iso YYYY-MM-DD */
export const tanggal = (iso) => iso ? DATE.format(new Date(`${iso}T00:00:00Z`))
  : '—';
export const rupiah = (n) => RUPIAH.format(n);

/** Cache lives in state.extra (reset on role switch). */
export function cache() {
  state.extra.rptka ??= { hpk: [], detail: null, list: null, lokasi: null,
    perpanjanganSemua: null };
  return state.extra.rptka;
}

/** Drop cached list + detail after a write. */
export function invalidate() {
  Object.assign(cache(), { detail: null, list: null, perpanjanganSemua: null });
}

/** "KAB. BEKASI, JAWA BARAT" options for Lokasi kerja (dari /wilayah). */
async function loadLokasi() {
  const provinsi = await withRetry(() => listWilayah());
  const nested = await Promise.all(provinsi.map(async (p) => {
    const kab = await withRetry(() => listWilayah({ provinsi: p.nama }));
    return kab.map((k) => `${k.nama}, ${p.nama}`);
  }));
  return nested.flat();
}

/**
 * VIEWS[PAGE].load — HPK aktif (segar), lokasi (sekali), detail dibuka.
 * Detail SELALU di-fetch ulang (bukan cuma saat id berubah) — Verifikator/
 * Validator/Simponi bisa mengubah status & billing-nya (lihat
 * routes/pengesahan-verifikasi.js `syncEmployerPengesahan`) sementara tab
 * portal ini sudah terbuka, jadi membuka ulang pengajuan yang sama (lewat
 * menu, bukan reload penuh) tidak boleh menampilkan cache basi. Ganti tab
 * dalam halaman ini sendiri (`setTab`) tidak lewat router/`go()` jadi tidak
 * memicu `load()` lagi — aman, tidak fetch berulang saat sekadar pindah tab.
 */
export async function load() {
  const c = cache();
  const { role } = state;
  if (state.p.id) {
    // `pengesahan` juga dibaca di sini (dokumenPengesahanPanel,
    // keimigrasianPanel, billingPanel di rptka-panels.js) — refresh sama
    // seperti billing, bukan cuma saat id berubah (pola AK-23).
    [c.detail] = await Promise.all([
      withRetry(() => getRptka(role, state.p.id)),
      reloadCollection('billing'), reloadCollection('pengesahan'),
    ]);
  }
  // Riwayat Terkait (revisi akun pemberi kerja, poin 7): baris Perpanjangan
  // (semua jenis) yang rptkaAsalId-nya mungkin menunjuk ke RPTKA yang
  // sedang dipilih di pemilih "Nomor RPTKA" — perlu dimuat untuk pengajuan
  // baru juga (bukan cuma saat `state.p.id` ada), dimuat sekali per
  // halaman dibuka.
  c.perpanjanganSemua ??= (await Promise.all(jenisPerpanjangan(role)
    .map((j) => withRetry(() => listRptka(role, j.nama))))).flat();
  c.hpk = state.data.company.hpk
    ? await withRetry(() => listHpkAktif(role)) : [];
  c.lokasi ??= await loadLokasi();
}

/** Rows of the "Pengajuan Form RPTKA" card (cached). */
export async function loadList(jenis) {
  const c = cache();
  c.list = await withRetry(() => listRptka(state.role, jenis));
  return c.list;
}

/** Apakah jenis termasuk menu Perpanjangan (bukan Pengesahan RPTKA). */
export const isPerpanjangan = (jenis) => jenisDef(jenis)?.menu === 'perpanjangan';

/** Jenis RPTKA yang sedang dipilih (definisi) atau null. */
export const jenisOf = (S) => jenisDef(S.w.jenis);

/** Halaman daftar tempat jenis ini berada di sidebar. */
export function listTarget(jenis) {
  return jenisDef(jenis)?.hpkLayanan
    ? ['hpkList', { layanan: jenis }] : ['rptkaList', { jenis: jenis ?? '' }];
}

/** Kunci stabil satu slot TKA (tahan terhadap perubahan urutan jabatan). */
export const ocrKey = (t) => `${t.jabatan}#${t.urut}`;

/** Kunci berkas sesi per slot (tahan terhadap pergeseran indeks). */
export const berkasKey = (t, kunci) => `${ocrKey(t)}:${kunci}`;

/** HPK aktif terpilih (null bila tanpa HPK / belum / tidak lagi aktif). */
export const hpkOf = (S) => butuhHpk(S.w.jenis)
  ? cache().hpk.find((h) => h.id === S.w.hpkId) ?? null : null;

/** HPK yang boleh dipilih untuk jenis ini (layanan HPK harus sama). */
export function hpkPilihan(S) {
  const layanan = jenisOf(S)?.hpkLayanan;
  return cache().hpk.filter((h) => !layanan || h.layanan === layanan);
}

/**
 * Baris Pengesahan RPTKA yang sudah terbit (SK + TTE Direktur / sudah
 * Terbit, `stepIdx` 6) milik pemberi kerja ini — sumber pemilih "Nomor
 * RPTKA" untuk Perpanjangan (revisi akun pemberi kerja, poin 5): dipilih
 * langsung dari RPTKA yang sudah pernah diajukan & terbit, bukan pilih
 * Nomor HPK dari awal lagi. Mencakup baris lama (seed, `p.barcode`) dan
 * baris Form RPTKA baru yang sudah di-TTE Direktur (`p.pengesahan`,
 * DP-07) — keduanya sama-sama "RPTKA sudah terbit" dari sudut pandang
 * pemberi kerja.
 */
export const rptkaTerbitPilihan = () =>
  state.data.pengesahan.filter((p) => p.stepIdx === 6);

/** Nomor RPTKA untuk ditampilkan: nomor SK+TTE (DP-07) atau barcode lama. */
export const nomorRptka = (p) => p.pengesahan?.nomor ?? p.barcode ?? p.id;

/**
 * Relasi antar dokumen RPTKA untuk satu TKA (revisi akun pemberi kerja,
 * poin 7, "tambahkan fitur lihat rptka perubahan, rptka pencabutan,
 * rptka perpanjangan ... untuk mempermudah user lihat relasi"). Perubahan
 * & Pencabutan memakai dataset `store.tka` (ditautkan lewat `t.barcode`,
 * lihat RV-04); Perpanjangan memakai dataset Form RPTKA (ditautkan lewat
 * `rptkaAsalId` ke id baris `store.pengesahan` — dicocokkan dari paspor
 * TKA yang sama). `excludeId` = jangan sertakan dirinya sendiri (saat
 * dipanggil dari halaman Perpanjangan yang sedang membuat/mengedit baris
 * itu sendiri).
 * @param {?{barcode: string, paspor: string}} tka
 * @param {string=} excludeId
 * @return {{perubahan: !Array, pencabutan: !Array, perpanjangan: !Array}}
 */
export function relasiTka(tka, excludeId = null) {
  if (!tka) {
    return { perubahan: [], pencabutan: [], perpanjangan: [] };
  }
  const pengesahanId = state.data.pengesahan
    .find((p) => p.paspor === tka.paspor)?.id;
  const perpanjangan = (cache().perpanjanganSemua ?? [])
    .filter((r) => r.rptkaAsalId === pengesahanId && r.id !== excludeId);
  return {
    perubahan: state.data.perubahan.filter((c) => c.skBarcode === tka.barcode),
    pencabutan: state.data.pencabutan.filter((x) => x.barcode === tka.barcode),
    perpanjangan,
  };
}

/** Apakah relasi (`relasiTka`) punya data untuk ditampilkan. */
export const adaRelasi = (r) =>
  Boolean(r.perubahan.length || r.pencabutan.length || r.perpanjangan.length);

function blank() {
  const def = jenisDef(state.p.jenis);
  const jenis = def?.roles.includes(state.role) ? def.nama : null;
  return { id: null, noAjuan: null, jenis, kegiatan: null,
    hpkId: butuhHpk(jenis) ? state.p.hpk ?? '' : '',
    rptkaAsalId: null, status: RPTKA_STATUS.DRAF, jabatan: [], tka: [],
    dokumenJabatan: {}, dokumenPermohonan: {} };
}

/**
 * Sesi kerja form (dibuat sekali per navigasi).
 * jenisTetap = jenis sudah ditentukan submenu / draft (tab Jenis read-only).
 * @return {{w: !Object, tab: string, errors: !Object, open: !Set,
 *     files: !Map, ocr: !Object, editJab: number, jenisTetap: boolean}}
 */
export function session() {
  if (!state.ui.rptka) {
    const detail = state.p.id ? structuredClone(cache().detail) : null;
    const w = detail ?? blank();
    const S = { w, errors: {}, open: new Set(['t0']), files: new Map(),
      urls: new Map(), ocr: {}, editJab: -1, jenisTetap: Boolean(w.jenis),
      tab: w.status === RPTKA_STATUS.DRAF ? 'jabatan'
        : w.perluRevisi ? 'dokumen' : 'preview',
      // Tab bar halaman detail (ro mode): "data" | "imigrasi" — lihat
      // rptka-panels.js `roTabBar`.
      roTab: 'data' };
    state.ui.rptka = S;
    prefillJabatan(S);
  }
  return state.ui.rptka;
}

/** Jangka waktu awal: pilihan jenis terbesar yang <= batas HPK. */
function bulanAwal(jenis, batas) {
  const pilihan = jenisDef(jenis)?.bulan;
  const maks = Math.min(batas, RPTKA_MAX_BULAN);
  return pilihan ? Math.max(...pilihan.filter((b) => b <= maks), pilihan[0])
    : maks;
}

/** Datang dari tombol "Ajukan" pada jabatan di detail HPK. */
function prefillJabatan(S) {
  const master = hpkOf(S)?.jabatan.find((j) => j.nama === state.p.jabatan);
  if (S.w.id || !master || master.sisa < 1) {
    return;
  }
  S.w.jabatan = [{ nama: master.nama, jumlahTka: 1,
    jangkaWaktuBulan: bulanAwal(S.w.jenis, master.bulan) }];
  syncTka(S.w);
  S.tab = 'jabatan';
}

/** Samakan tka[] dengan jabatan (satu entri per orang), buang sisa data. */
export function syncTka(w) {
  const old = w.tka;
  w.tka = slotTka(w.jabatan).map((s) => old.find((t) =>
    t.jabatan === s.jabatan && t.urut === s.urut) ??
    { ...s, data: {}, dokumen: {}, ocr: {} });
  w.dokumenJabatan = Object.fromEntries(Object.entries(w.dokumenJabatan)
    .filter(([nama]) => w.jabatan.some((j) => j.nama === nama)));
}

/** Buang dokumen yang tidak berlaku lagi (jenis / kegiatan / jangka berubah). */
export function pruneDokumen(w) {
  for (const t of w.tka) {
    const keep = new Set(dokumenTka(w, t).map((d) => d.kunci));
    t.dokumen = Object.fromEntries(Object.entries(t.dokumen)
      .filter(([k]) => keep.has(k)));
  }
  for (const j of w.jabatan) {
    const keep = new Set(dokumenUntuk(w, 'jabatan', j).map((d) => d.kunci));
    w.dokumenJabatan[j.nama] = Object.fromEntries(Object.entries(
      w.dokumenJabatan[j.nama] ?? {}).filter(([k]) => keep.has(k)));
  }
  const berlaku = new Set(dokumenUntuk(w, 'permohonan', null)
    .map((d) => d.kunci));
  w.dokumenPermohonan = Object.fromEntries(Object.entries(
    w.dokumenPermohonan ?? {}).filter(([k]) => berlaku.has(k)));
}

/** Body request (PengesahanRptkaRequest) dari sesi kerja. */
export function payload(w) {
  return { hpkId: w.hpkId || undefined, jenis: w.jenis ?? undefined,
    kegiatan: w.kegiatan ?? undefined, jabatan: w.jabatan, tka: w.tka,
    dokumenJabatan: w.dokumenJabatan,
    dokumenPermohonan: w.dokumenPermohonan ?? {},
    rptkaAsalId: w.rptkaAsalId || undefined };
}
