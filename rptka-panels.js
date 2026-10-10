/**
 * @fileoverview Panel tab Form RPTKA yang tidak berkaitan dengan berkas:
 * Jenis RPTKA (+ kegiatan Non-DKPTKA), Jabatan TKA (tambah / ubah / hapus),
 * Preview (ringkasan semua tab + kelengkapan + estimasi DKPTKA) dan kartu
 * Nomor HPK. Render murni.
 */

import { html } from '../../components/dom.js';
import { pratinjauAttrs } from '../../components/doc-preview.js';
import { emptyState } from '../../components/empty-state.js';
import { statusBadge } from '../../components/status-badge.js';
import {
  RPTKA_MAX_BULAN, bebasDkptka, butuhHpk, dokumenTka, dokumenUntuk,
  estimasiDkptka, jenisDef, jenisUntukRole, kegiatanOpsi, kolomTka,
} from '../../contracts/pengesahan-rptka.js';
import { openRingkasanDoc } from './documents.js';
import {
  adaRelasi, hpkOf, hpkPilihan, jenisOf, nomorRptka, relasiTka,
  rptkaTerbitPilihan, rupiah, tanggal,
} from './rptka-data.js';
import { STEP_LABEL, groupErrors } from './rptka-gate.js';
import { state } from './state.js';
import {
  BTN, BTN_OUTLINE, CALLOUT_INFO, CALLOUT_WARN, CARD, LINK, THEAD, cardHeader,
  fieldError, riwayatTerkaitRingkas,
} from './ui.js';

/** Error per tahap (lihat rptka-gate). */
export const errorsByTab = groupErrors;

function kegiatanSelect(S, ro) {
  return html`<div class="grid content-start gap-1.5">
    <label for="rp-kegiatan" class="text-sm font-bold">Kegiatan</label>
    <select id="rp-kegiatan" class="select h-11 w-full" data-rp-kegiatan
      ${ro || S.w.id ? 'disabled' : ''}
      aria-describedby="rp-kegiatan-error">
      <option value="">Pilih kegiatan…</option>
      ${kegiatanOpsi(S.w.jenis, state.role).map((k) => html`<option ${k === S.w.kegiatan ? 'selected'
        : ''}>${k}</option>`)}</select>${fieldError('rp-kegiatan')}</div>`;
}

function jenisField(S, locked) {
  const def = jenisOf(S);
  const field = locked && def
    ? html`<input id="rp-jenis" type="text" disabled value="${def.judul}"
        class="input h-11 w-full" aria-describedby="rp-jenis-hint">`
    : html`<select id="rp-jenis" class="select h-11 w-full" data-rp-jenis
        ${locked ? 'disabled' : ''}
        aria-describedby="rp-jenis-hint rp-jenis-error">
        <option value="">Pilih jenis RPTKA…</option>
        ${jenisUntukRole(state.role).map((j) => html`<option value="${j.nama}"
        ${j.nama === S.w.jenis ? 'selected' : ''}>${j.judul}</option>`)}
      </select>`;
  return html`<div class="grid content-start gap-1.5">
    <label for="rp-jenis" class="text-sm font-bold">Jenis RPTKA</label>
    ${field}<p id="rp-jenis-hint" class="text-xs text-base-content/70">${def
    ? def.ket : 'Jangka waktu, dokumen, dan Nomor HPK menyesuaikan jenis.'}
    </p>${fieldError('rp-jenis')}</div>`;
}

function hpkField(S, ro) {
  const rows = hpkPilihan(S);
  const gone = S.w.hpkId && !hpkOf(S);
  const hint = S.w.id ? 'Nomor HPK terkunci setelah draft disimpan.'
    : !rows.length && !S.w.hpkId
      ? 'Belum ada Nomor HPK aktif' + (jenisOf(S)?.hpkLayanan
        ? ` (layanan ${jenisOf(S).hpkLayanan})` : '') + '.'
      : 'Data HPK tampil otomatis sebagai dasar permohonan.';
  return html`<div class="grid content-start gap-1.5">
    <label for="rp-hpk" class="text-sm font-bold">Nomor HPK</label>
    <select id="rp-hpk" class="select h-11 w-full"
      ${ro || S.w.id ? 'disabled' : ''} data-testid="rptka-select-hpk"
      aria-describedby="rp-hpk-hint rp-hpk-error">
      <option value="">Pilih Nomor HPK yang masih aktif…</option>
      ${rows.map((h) => hpkOption(h, S))}
      ${gone ? html`<option value="${S.w.hpkId}" selected>
        ${S.w.hpkBarcode} (tidak lagi aktif)</option>` : ''}</select>
    <p id="rp-hpk-hint" class="text-xs text-base-content/70">${hint}</p>
    ${fieldError('rp-hpk')}</div>`;
}

/**
 * Pemilih "Nomor RPTKA" untuk Perpanjangan (revisi akun pemberi kerja,
 * poin 5): menggantikan pemilih Nomor HPK — tidak perlu pilih HPK dari
 * awal lagi, langsung pilih dari RPTKA yang sudah pernah diajukan & terbit
 * (`rptkaTerbitPilihan`). Nomor HPK dan identitas TKA diisi otomatis dari
 * baris terpilih (lihat `rptka.js` `applyRptkaAsal`).
 */
function rptkaAsalField(S, ro) {
  const rows = rptkaTerbitPilihan();
  const selected = rows.find((p) => p.id === S.w.rptkaAsalId);
  const gone = S.w.rptkaAsalId && !selected;
  const hint = S.w.id ? 'Nomor RPTKA terkunci setelah draft disimpan.'
    : !rows.length ? 'Belum ada Pengesahan RPTKA yang terbit. Ajukan ' +
      'Pengesahan RPTKA dan tunggu TTE Direktur terlebih dahulu.'
      : 'Nomor HPK dan identitas TKA diisi otomatis dari RPTKA terpilih.';
  // Riwayat Terkait (poin 7) — relasi RPTKA terpilih ini, supaya pengguna
  // tahu bila sudah ada Perubahan/Pencabutan/Perpanjangan lain atas TKA
  // yang sama sebelum mengajukan lagi.
  const relasi = selected
    ? relasiTka({ paspor: selected.paspor, barcode: selected.barcode },
      S.w.id) : null;
  return html`<div class="grid content-start gap-1.5">
    <label for="rp-rptka-asal" class="text-sm font-bold">Nomor RPTKA</label>
    <select id="rp-rptka-asal" class="select h-11 w-full"
      ${ro || S.w.id ? 'disabled' : ''} data-testid="rptka-select-asal"
      aria-describedby="rp-rptka-asal-hint rp-rptka-asal-error">
      <option value="">Pilih Nomor RPTKA yang sudah terbit…</option>
      ${rows.map((p) => html`<option value="${p.id}"
        ${p.id === S.w.rptkaAsalId ? 'selected' : ''}>${nomorRptka(p)} ·
        ${p.nama} (${p.jabatan})</option>`)}
      ${gone ? html`<option value="${S.w.rptkaAsalId}" selected>
        (RPTKA tidak ditemukan)</option>` : ''}</select>
    <p id="rp-rptka-asal-hint" class="text-xs text-base-content/70">${hint}
      </p>${fieldError('rp-rptka-asal')}
    ${relasi && adaRelasi(relasi) ? riwayatTerkaitRingkas(relasi) : ''}</div>`;
}

/**
 * Kartu atas: Jenis RPTKA (disabled bila sudah ditentukan submenu / draft),
 * Kegiatan (Non DKPTKA) dan Nomor HPK (bila jenis memakai HPK) — Perpanjangan
 * memakai pemilih Nomor RPTKA sebagai gantinya dan tidak punya Kegiatan
 * (dihapus atas permintaan eksplisit, revisi akun pemberi kerja poin 5).
 */
export function renderHeader(S, ro) {
  const locked = ro || S.jenisTetap || Boolean(S.w.id);
  const perpanjangan = jenisOf(S)?.menu === 'perpanjangan';
  return html`<section class="${CARD} grid gap-4 px-5 py-6 md:grid-cols-2
      md:px-7" aria-label="Jenis RPTKA dan Nomor HPK">
    ${jenisField(S, locked)}
    ${perpanjangan ? rptkaAsalField(S, ro)
      : butuhHpk(S.w.jenis) ? hpkField(S, ro) : ''}
    ${!perpanjangan && jenisOf(S)?.kegiatan ? kegiatanSelect(S, ro) : ''}
  </section>`;
}

function jangkaInput(S, editing) {
  const pilihan = jenisOf(S)?.bulan;
  const awal = pilihan?.includes(12) ? 12 : pilihan?.at(-1) ?? 12;
  const nilai = editing?.jangkaWaktuBulan ?? awal;
  return pilihan
    ? html`<select id="rp-jab-bulan" class="select h-11 w-full"
        aria-describedby="rp-jab-bulan-error">${pilihan.map((b) => html`<option
        value="${b}" ${b === nilai ? 'selected' : ''}>${b} bulan</option>`)}
      </select>`
    : html`<input id="rp-jab-bulan" type="number" min="1"
        max="${RPTKA_MAX_BULAN}" inputmode="numeric"
        class="input h-11 w-full" value="${nilai}"
        aria-describedby="rp-jab-bulan-error">`;
}

function namaInput(S, hpk, editing) {
  if (!hpk) {
    return html`<input id="rp-jab-nama" type="text" maxlength="100"
      class="input h-11 w-full" value="${editing?.nama ?? ''}"
      placeholder="mis. Koordinator Program"
      aria-describedby="rp-jab-nama-error">`;
  }
  const used = new Set(S.w.jabatan.map((j) => j.nama));
  const options = hpk.jabatan.filter((j) => j.sisa > 0 &&
    (!used.has(j.nama) || j.nama === editing?.nama));
  return html`<select id="rp-jab-nama" class="select h-11 w-full"
      aria-describedby="rp-jab-nama-error">
    <option value="">Pilih jabatan pada HPK…</option>
    ${options.map((j) => html`<option value="${j.nama}"
      ${j.nama === editing?.nama ? 'selected' : ''}>${j.nama} · maks.
      ${j.bulan} bln</option>`)}</select>`;
}

/**
 * Form tambah/ubah jabatan. Satu pengajuan = satu jabatan (= satu TKA,
 * `jumlahTka` implisit 1, tanpa input terpisah) — lihat `renderJabatan`
 * untuk kapan form ini ditampilkan.
 */
function jabatanForm(S, hpk) {
  const editing = S.editJab >= 0 ? S.w.jabatan[S.editJab] : null;
  const pilihan = jenisOf(S)?.bulan;
  return html`<div class="grid gap-3 rounded-box border border-base-300
      p-4 md:grid-cols-[minmax(0,2fr)_1fr_auto] md:items-end">
    <div class="grid content-start gap-1.5">
      <label for="rp-jab-nama" class="text-sm font-bold">Jabatan TKA</label>
      ${namaInput(S, hpk, editing)}${fieldError('rp-jab-nama')}</div>
    <div class="grid content-start gap-1.5">
      <label for="rp-jab-bulan" class="text-sm font-bold">Jangka waktu
        bekerja</label>${jangkaInput(S, editing)}${fieldError('rp-jab-bulan')}
    </div>
    <div class="flex gap-2">
      <button type="button" class="${BTN}" data-action="rptka-jab-save"
        data-testid="rptka-btn-jabatan">${editing ? 'Simpan' : '+ Tambah'}
      </button>${editing ? html`<button type="button" class="${BTN_OUTLINE}"
        data-action="rptka-jab-cancel">Batal</button>` : ''}</div></div>
    <p class="text-xs text-base-content/70">${pilihan
    ? `Jangka waktu: ${pilihan.join(', ')} bulan.`
    : `Jangka waktu 1–${RPTKA_MAX_BULAN} bulan.`}${hpk
    ? ' Jangka waktu tidak melebihi HPK.' : ''}</p>`;
}

function jabatanRow(j, i, ro) {
  return html`<tr>
    <td class="font-semibold">${j.nama}</td>
    <td>${j.jangkaWaktuBulan} bulan</td>
    <td>${ro ? '' : html`<div class="flex justify-end gap-3">
      <button type="button" class="${LINK} text-xs" data-action="rptka-jab-edit"
        data-idx="${i}" aria-label="Ubah jabatan ${j.nama}">Ubah</button>
      <button type="button" class="link link-hover font-bold text-error
        text-xs" data-action="rptka-jab-del" data-idx="${i}"
        aria-label="Hapus jabatan ${j.nama}">Hapus</button></div>`}</td></tr>`;
}

/**
 * Tab "Jabatan TKA". Satu pengajuan Form RPTKA = satu jabatan = satu TKA
 * (permintaan "cuma bisa pilih 1 TKA … 1 Pemberi kerja pasti punya banyak
 * data rptka") — form tambah disembunyikan begitu satu jabatan tersimpan,
 * kecuali saat mengubah jabatan itu sendiri; hapus jabatan untuk mengajukan
 * TKA lain lewat pengajuan ini, atau mulai pengajuan baru untuk TKA lain.
 */
export function renderJabatan(S, ro) {
  const hpk = hpkOf(S);
  if (!S.w.jenis) {
    return emptyState({ icon: '▤', title: 'Pilih Jenis RPTKA terlebih dahulu',
      body: 'Pilihan jangka waktu mengikuti Jenis RPTKA.' });
  }
  if (butuhHpk(S.w.jenis) && !hpk) {
    return emptyState({ icon: '▤', title: 'Pilih Nomor HPK terlebih dahulu',
      body: 'Jabatan yang dapat ditambahkan mengikuti rencana jabatan pada ' +
        'HPK terpilih.' });
  }
  const penuh = S.w.jabatan.length > 0 && S.editJab < 0;
  return html`${ro || penuh ? '' : jabatanForm(S, hpk)}
    <section aria-labelledby="rp-jab-title" class="grid gap-2">
      <h3 id="rp-jab-title" class="text-sm font-bold">Jabatan yang diajukan
      </h3>
      ${S.w.jabatan.length ? html`<div class="overflow-x-auto rounded-box
          border border-base-300"><table class="table text-[13px]">
        <caption class="sr-only">Jabatan TKA yang diajukan</caption>
        <thead><tr class="${THEAD}"><th scope="col">Jabatan</th>
          <th scope="col" class="w-36">Jangka waktu</th>
          <th scope="col" class="w-32 text-right">Aksi</th></tr></thead>
        <tbody>${S.w.jabatan.map((j, i) => jabatanRow(j, i, ro))}</tbody>
      </table></div>` : emptyState({ title: 'Belum ada jabatan',
    body: 'Tambahkan satu jabatan (1 TKA) beserta jangka waktunya.' })}
      ${penuh ? html`<p class="text-xs text-base-content/70">Satu pengajuan
        hanya untuk 1 TKA. Hapus jabatan ini untuk menggantinya, atau ajukan
        permohonan baru untuk TKA lain.</p>` : ''}
      ${fieldError('rp-jabatan')}</section>`;
}

function section(title, tab, body, ro) {
  return html`<section class="${CARD} overflow-hidden" aria-label="${title}">
    ${cardHeader(title, ro ? '' : html`<button type="button"
      class="${LINK} text-xs" data-action="rptka-tab"
      data-tab="${tab}">Ubah</button>`)}
    <div class="px-5 py-4">${body}</div></section>`;
}

function tampil(col, value) {
  return col.tipe === 'tanggal' && value ? tanggal(value) : value || '—';
}

function tkaSummary(S, t, i) {
  return html`<article class="grid gap-3 rounded-box border border-base-300
      p-4" aria-label="TKA ${i + 1}">
    <h4 class="text-sm font-bold">TKA ${i + 1} · ${t.jabatan} (${t.urut})
    </h4>
    <dl class="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-x-5
        gap-y-4 text-[13px]">${kolomTka(S.w.jenis).map((c) => html`<div><dt
        class="text-base-content/60">${c.label}</dt><dd class="font-semibold
        ">${tampil(c, t.data[c.kunci])}</dd></div>`)}</dl></article>`;
}

/** Satu baris "Dokumen yang diunggah" (lihat `semuaDokumenPanel`). */
function dokumenRow(label, saved) {
  return html`<li class="flex items-center justify-between gap-3 border-t
      border-base-200 px-5 py-4 first:border-t-0">
    <div><p class="text-sm font-bold">${label}</p>
      <p class="text-xs text-base-content/60">${saved.namaBerkas} ·
      ${saved.ukuranKb} KB</p></div>
    <button type="button" class="${BTN_OUTLINE} btn-sm shrink-0"
      ${pratinjauAttrs({ judul: label, namaBerkas: saved.namaBerkas,
      ukuranKb: saved.ukuranKb, berkasId: saved.berkasId ?? null })}>
      Lihat dokumen</button></li>`;
}

/**
 * Kartu "Dokumen yang diunggah" — semua berkas yang sudah diunggah
 * (dokumen permohonan, dokumen per jabatan, dokumen per TKA) digabung
 * jadi satu daftar rata, bukan dipisah per jenis/TKA seperti sebelumnya.
 * Dipakai di tab Preview (draft, sebelum submit) maupun halaman detail
 * pengajuan (`ro`) — `renderPreview` memanggilnya di kedua mode.
 */
function semuaDokumenPanel(S) {
  const w = S.w;
  const items = [];
  for (const d of dokumenUntuk(w, 'permohonan', null)) {
    const saved = w.dokumenPermohonan?.[d.kunci];
    if (saved) {
      items.push([d.label, saved]);
    }
  }
  for (const j of w.jabatan) {
    for (const d of dokumenUntuk(w, 'jabatan', j)) {
      const saved = w.dokumenJabatan[j.nama]?.[d.kunci];
      if (saved) {
        items.push([w.jabatan.length > 1 ? `${d.label} — ${j.nama}`
          : d.label, saved]);
      }
    }
  }
  for (const t of w.tka) {
    for (const d of dokumenTka(w, t)) {
      const saved = t.dokumen[d.kunci];
      if (saved) {
        items.push([w.tka.length > 1
          ? `${d.label} — ${t.data?.nama || t.jabatan}` : d.label, saved]);
      }
    }
  }
  if (!items.length) {
    return '';
  }
  return html`<section class="${CARD} overflow-hidden"
      aria-label="Dokumen yang diunggah">
    ${cardHeader(`Dokumen yang diunggah (${items.length})`)}
    <ul>${items.map(([label, saved]) => dokumenRow(label, saved))}</ul>
  </section>`;
}

function statusPanel(S, byTab) {
  const tabs = Object.keys(byTab);
  if (!tabs.length) {
    return html`<p role="status" class="alert alert-success alert-soft
      text-sm">Semua data sudah lengkap. Pengajuan siap disubmit ke
      Verifikator.</p>`;
  }
  return html`<div role="alert" tabindex="-1" class="${CALLOUT_WARN} grid
      gap-1.5"><p class="font-bold">Pengajuan belum lengkap:</p>
    <ul class="grid gap-1">${tabs.map((tab) => html`<li><button type="button"
      class="${LINK} text-[13px]" data-action="rptka-tab" data-tab="${tab}">
      ${STEP_LABEL[tab]}</button> — ${Object.keys(byTab[tab]).length} bagian perlu
      dilengkapi</li>`)}</ul></div>`;
}

/**
 * Tagihan DKPTKA/SKRD yang sudah ditautkan sistem ke pengajuan ini
 * (`item.billing`, lihat routes/pengesahan-verifikasi.js
 * `syncEmployerPengesahan`) — supaya "Terbit Surat Pembayaran" juga
 * terlihat dari detail pengajuan, bukan cuma lewat notifikasi atau menu
 * Pembayaran DKPTKA terpisah. Bagian dari tab "Dokumen Administrasi"
 * (lihat `dokumenAdministrasiContent`). Tagihan SKRD (Perpanjangan Lintas
 * Kab/Kota, `b.jenis === 'SKRD'`) tampil dengan label retribusi daerah yang
 * sesuai, dan — setelah Lunas — tombol "Bukti pembayaran" terpisah yang
 * membuka berkas yang DIUNGGAH pemberi kerja (`b.buktiBayar`), beda dari
 * "Lihat bukti bayar"/"Lihat tagihan" yang membuka surat sistem.
 */
/**
 * Satu baris berkas (ikon PDF, judul, keterangan, aksi) — pola kartu berkas
 * "Dokumen yang diunggah". Aksi dokumen administrasi cuma dua: pratinjau
 * dan unduh/cetak (`preview`/`unduh` = atribut tombol, `unduh` opsional).
 */
function berkasRow({ judul, meta, status, preview, unduh, extra = '' }) {
  return html`<li class="${CARD} flex flex-wrap items-center gap-4 px-4 py-3">
    <span class="grid size-12 shrink-0 place-items-center rounded-field
      border border-base-300 bg-base-100" aria-hidden="true"><span
      class="rounded-sm bg-error px-1.5 py-0.5 text-[10px] font-extrabold
      text-error-content">PDF</span></span>
    <div class="min-w-0 flex-1"><p class="truncate text-[15px] font-bold">
      ${judul}</p>
      <p class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]
        text-base-content/70">${meta}${status ?? ''}</p></div>
    <div class="flex flex-wrap items-center gap-2">${extra}
      <button type="button" class="${BTN_OUTLINE} btn-sm" ${preview}>
        Pratinjau</button>
      ${unduh ? html`<button type="button" class="${BTN_OUTLINE} btn-sm"
        ${unduh}>Unduh / Cetak</button>` : ''}</div></li>`;
}

function billingPanel(S) {
  const bills = (S.w.billing ?? [])
    .map((id) => state.data.billing.find((b) => b.id === id)).filter(Boolean);
  if (!bills.length) {
    return '';
  }
  const jenis = bills[0]?.jenis === 'SKRD' ? 'SKRD' : 'DKPTKA';
  return html`<section aria-label="Pembayaran ${jenis}" class="grid gap-3">
    <h3 class="text-sm font-bold">Pembayaran ${jenis}</h3>
    <ul class="grid gap-3">${bills.map((b) => {
    const rows = [berkasRow({
      judul: b.status === 'Lunas' ? `Surat pembayaran ${jenis}`
        : `Tagihan ${jenis}`,
      meta: b.kode ?? b.id, status: statusBadge(b.status, b.tone),
      preview: html`data-action="open-billing" data-id="${b.id}"`,
      unduh: html`data-action="unduh-billing" data-id="${b.id}"`,
      extra: b.status === 'Belum dibayar' ? html`<button type="button"
        class="${BTN_OUTLINE} btn-sm" data-action="confirm-bayar-open"
        data-id="${b.id}">Konfirmasi Sudah Bayar</button>` : '' })];
    if (b.buktiBayar) {
      rows.push(berkasRow({ judul: b.buktiBayar.namaBerkas,
        meta: `Bukti pembayaran ${jenis} · ${b.buktiBayar.ukuranKb} KB`,
        preview: pratinjauAttrs({ judul: 'Bukti pembayaran (bank daerah)',
          namaBerkas: b.buktiBayar.namaBerkas,
          ukuranKb: b.buktiBayar.ukuranKb,
          berkasId: b.buktiBayar.berkasId ?? null }) }));
    }
    return rows;
  })}</ul></section>`;
}

/**
 * Dokumen Pengesahan RPTKA (nomor, TTE atas nama Direktur PPTKA, QR Code) —
 * begitu Direktur menjalankan TTE (`jalankanTte`, setelah pembayaran
 * lunas atau bebas DKPTKA), supaya bisa diunduh dari sini
 * juga, bukan cuma dari akun Direktur sendiri. Baris `store.pengesahan[role]`
 * yang ditautkan lewat `rptkaId` (satu per TKA — jenis dengan `jumlahTka` >
 * 1 bisa lebih dari satu) adalah sumber `p.pengesahan`, lihat
 * routes/pengesahan-verifikasi.js `syncEmployerPengesahan`. Bagian dari tab
 * "Dokumen Administrasi" (lihat `dokumenAdministrasiContent`).
 */
function dokumenPengesahanPanel(S) {
  const rows = state.data.pengesahan
    .filter((p) => p.rptkaId === S.w.id && p.pengesahan);
  if (!rows.length) {
    return '';
  }
  return html`<section aria-label="Dokumen Pengesahan RPTKA" class="grid gap-3">
    <h3 class="text-sm font-bold">Dokumen Pengesahan RPTKA</h3>
    <ul class="grid gap-3">${rows.map((p) => berkasRow({
    judul: rows.length > 1 ? `SK Pengesahan RPTKA — ${p.nama}`
      : 'SK Pengesahan RPTKA',
    meta: html`<span class="font-mono">${p.pengesahan.nomor}</span>`,
    status: html`<span class="badge badge-soft badge-success badge-sm">
      Terbit</span>`,
    preview: html`data-action="open-doc" data-doc="skPeng" data-id="${p.id}"`,
    unduh: html`data-action="unduh-doc" data-doc="skPeng" data-id="${p.id}"`,
  }))}</ul></section>`;
}

/**
 * Apakah pengajuan ini punya dokumen SK dan/atau tagihan DKPTKA untuk
 * ditampilkan di tab "Dokumen Administrasi" (menentukan tab muncul atau
 * tidak — lihat `roTabBar`).
 */
const hasDokumenAdministrasi = (S) => state.data.pengesahan
  .some((p) => p.rptkaId === S.w.id && p.pengesahan) ||
  (S.w.billing ?? []).some((id) => state.data.billing.some((b) => b.id === id));

/**
 * Tab "Dokumen Administrasi" — gabungan "Dokumen Pengesahan RPTKA" (SK) dan
 * "Bukti pembayaran DKPTKA"/tagihan, sebelumnya dua kartu berdiri sendiri DI
 * LUAR `#rp-panel` (RV-10), digabung jadi satu tab atas permintaan user
 * ("section dokumen pengesahan rptka dan bukti pembayaran dkptka digabung
 * aja jadi satu tab bar") supaya tidak ada dua kotak biru terpisah mengambang
 * di atas kartu data pengajuan.
 */
function dokumenAdministrasiContent(S) {
  return html`${dokumenPengesahanPanel(S)}${billingPanel(S)}`;
}

/** Baris keimigrasian milik pengajuan ini (dipakai `keimigrasianPanel` & `hasKeimigrasian`). */
const keimigrasianRows = (S) => state.data.pengesahan
  .filter((p) => p.rptkaId === S.w.id && p.keimigrasian);

/** Apakah pengajuan ini punya data ITAS/keimigrasian (menentukan tab ro-mode muncul atau tidak). */
const hasKeimigrasian = (S) => keimigrasianRows(S).length > 0;

/**
 * Data ITAS & lalu lintas keimigrasian per TKA (usulan, lembar kebutuhan
 * "Tampilkan data ITAS per TKA" — dikirim Imigrasi ke Direktorat PPTKA,
 * ditampilkan di sini untuk pemberi kerja). Baris `store.pengesahan[role]`
 * yang ditautkan lewat `rptkaId` adalah sumber `p.keimigrasian` (lihat
 * routes/portal.js `listPengesahan`, routes/imigrasi.js `snapshotFor`) —
 * `null`/tidak ada sebelum Pengesahan RPTKA terbit. Dipakai sebagai konten
 * tab "Data ITAS & Lalu Lintas Keimigrasian" di halaman detail (`ro`
 * mode) — lihat `roTabBar`/`renderDetailBody`.
 */
function keimigrasianPanel(S) {
  const rows = keimigrasianRows(S);
  if (!rows.length) {
    return '';
  }
  return html`<div class="grid gap-5">
    ${rows.map((p) => {
    const { visa: v, perlintasan: l } = p.keimigrasian;
    return html`<div class="grid gap-2 text-[13px]">
      ${rows.length > 1 ? html`<p class="font-semibold">${p.nama}</p>` : ''}
      <dl class="grid grid-cols-[190px_1fr] items-center gap-x-5 gap-y-2.5">
        <dt class="text-base-content/60">Status Visa dan ITAS</dt>
        <dd>${statusBadge(v.status, v.tone)}</dd>
        ${v.nomorVisa ? html`<dt class="text-base-content/60">Nomor Visa</dt>
          <dd class="font-mono">${v.nomorVisa}</dd>` : ''}
        ${v.nomorItas ? html`<dt class="text-base-content/60">Nomor ITAS</dt>
          <dd class="font-mono">${v.nomorItas}</dd>` : ''}
        ${v.berlakuSampai ? html`<dt class="text-base-content/60">ITAS
          Berlaku Sampai</dt><dd>${tanggal(v.berlakuSampai)}</dd>` : ''}
        <dt class="text-base-content/60">Lalu Lintas Keimigrasian</dt>
        <dd>${statusBadge(l.status, l.tone)}</dd>
        ${l.tanggalMasuk ? html`<dt class="text-base-content/60">Tanggal
          Masuk</dt><dd>${tanggal(l.tanggalMasuk)}</dd>` : ''}
        ${l.tempatPemeriksaan ? html`<dt class="text-base-content/60">Tempat
          Pemeriksaan</dt><dd>${l.tempatPemeriksaan}</dd>` : ''}
      </dl></div>`;
  })}
  </div>`;
}

/**
 * Tombol "Preview Dokumen" — HANYA untuk Perpanjangan (belum ada contoh
 * dokumen resmi/PDF asli untuk Perpanjangan seperti `Pengesahan RPTKA
 * Baru.pdf`, jadi ditampilkan sebagai ringkasan data, bukan mengarang
 * format surat resmi, lihat `openRingkasanDoc`). Pengesahan RPTKA biasa
 * TIDAK punya tombol ini di form pengajuan — SK Pengesahan baru benar-benar
 * ada setelah pengajuan lolos Verifikator, Validator, dan Direktur
 * menandatangani TTE; pratinjau draf sebelum itu (nomor/TTE "—") dinilai
 * menyesatkan, dihapus atas permintaan eksplisit user. Sesudah terbit,
 * SK sungguhan tetap bisa dilihat lewat `dokumenPengesahanPanel` di atas
 * (nomor & TTE asli, bukan pratinjau).
 */
export function previewDokumen(S) {
  const asal = rptkaTerbitPilihan().find((p) => p.id === S.w.rptkaAsalId);
  const hpk = hpkOf(S);
  const j = S.w.jabatan[0];
  const t = S.w.tka[0];
  openRingkasanDoc(jenisOf(S)?.judul ?? 'Perpanjangan RPTKA', [
    ['Nomor RPTKA asal', asal ? nomorRptka(asal) : '—'],
    ['Nomor HPK', hpk?.barcode ?? S.w.hpkBarcode ?? '—'],
    ['Nama TKA', t?.data?.nama ?? j?.nama ?? '—'],
    ['Paspor', t?.data?.nomorPaspor ?? '—'],
    ['Kebangsaan', t?.data?.kebangsaan ?? '—'],
    ['Jabatan', j?.nama ?? '—'],
    ['Jangka waktu', j ? `${j.jangkaWaktuBulan} bulan` : '—'],
    ['Lokasi kerja', t?.data?.lokasiKerja ?? '—'],
  ]);
}

/**
 * Jenis RPTKA – Data TKA – Dokumen yang diunggah: inti data pengajuan,
 * dipakai baik oleh tab "Preview" draft (non-`ro`) maupun tab "Data
 * Pengajuan RPTKA" di halaman detail (`ro`) — lihat `renderPreview` dan
 * `renderDetailBody`.
 */
function dataPengajuanContent(S, ro) {
  const hpk = hpkOf(S);
  const def = jenisDef(S.w.jenis);
  const perpanjangan = def?.menu === 'perpanjangan';
  const asal = perpanjangan
    ? rptkaTerbitPilihan().find((p) => p.id === S.w.rptkaAsalId) : null;
  const dkptka = state.data.company.dk && def?.dkptka &&
    !bebasDkptka(S.w.jenis, S.w.kegiatan) ? estimasiDkptka(S.w.jabatan) : 0;
  return html`${section('Jenis RPTKA', 'header', html`<dl class="grid
        gap-x-5 gap-y-4 text-[13px] md:grid-cols-3"><div><dt
        class="text-base-content/60">
        Jenis RPTKA</dt><dd class="font-semibold">${def?.judul ?? '—'}</dd>
        </div>${!perpanjangan && def?.kegiatan ? html`<div><dt
        class="text-base-content/60">Kegiatan</dt><dd
        class="font-semibold">${S.w.kegiatan ?? '—'}</dd></div>` : ''}
        ${perpanjangan ? html`<div><dt class="text-base-content/60">Nomor
        RPTKA</dt><dd class="font-mono font-bold">${asal ? nomorRptka(asal)
        : '—'}</dd></div>` : ''}<div><dt class="text-base-content/60">
        Nomor HPK</dt><dd class="font-mono font-bold">${def?.hpk === false
        ? 'Tanpa HPK' : hpk?.barcode ?? S.w.hpkBarcode ?? '—'}</dd></div>
      </dl>`, ro)}
    ${section('Jabatan TKA', 'jabatan', S.w.jabatan.length
    ? html`<ul class="grid gap-2 text-[13px]">${S.w.jabatan.map((j) => html`<li
        class="flex justify-between gap-3 rounded-field bg-base-200/50 px-3
        py-2"><b>${j.nama}</b><span>${j.jumlahTka} TKA ·
        ${j.jangkaWaktuBulan} bulan</span></li>`)}</ul>`
    : html`<p class="text-[13px] text-base-content/60">Belum ada jabatan.
      </p>`, ro)}
    ${section('Data TKA', 'data', S.w.tka.length
    ? html`<div class="grid gap-3">${S.w.tka.map((t, i) =>
      tkaSummary(S, t, i))}</div>`
    : html`<p class="text-[13px] text-base-content/60">Belum ada data TKA.
      </p>`, ro)}
    ${semuaDokumenPanel(S)}
    ${dkptka ? html`<p class="${CALLOUT_INFO}">Estimasi DKPTKA:
      <b>${rupiah(dkptka)}</b> (Rp1.500.000 × jumlah TKA × bulan). Kode
      billing terbit setelah Persetujuan Direktur; dibayar di muka dalam 5
      hari kerja.</p>` : ''}
    ${perpanjangan ? html`<div class="flex justify-end"><button type="button"
      class="${BTN_OUTLINE} btn-sm" data-action="rptka-preview-doc"
      data-testid="rptka-btn-preview-doc">Preview Dokumen</button></div>`
    : ''}`;
}

/** Tab "Preview" draft (belum submit / belum terbit) — tidak ada tab bar. */
export function renderPreview(S) {
  return html`${statusPanel(S, errorsByTab(S))}${dataPengajuanContent(S, false)}`;
}

/**
 * Tab bar halaman detail (`ro` mode): "Data Pengajuan RPTKA", "Dokumen
 * Administrasi" (SK + tagihan/bukti bayar DKPTKA, RV-14 — digabung dari dua
 * kartu terpisah) dan "Data ITAS & Lalu Lintas Keimigrasian" — masing-masing
 * tab cuma muncul kalau datanya memang ada (belum terbit SK/billing, atau
 * belum ada data keimigrasian, tidak perlu tab kosong). Tab bar sendiri cuma
 * tampil kalau ada lebih dari satu tab untuk dipilih.
 */
function roTabBar(S) {
  const tabs = [['data', 'Data Pengajuan RPTKA']];
  if (hasDokumenAdministrasi(S)) {
    tabs.push(['dokumen', 'Dokumen Administrasi']);
  }
  if (hasKeimigrasian(S)) {
    tabs.push(['imigrasi', 'Data ITAS & Lalu Lintas Keimigrasian']);
  }
  if (tabs.length < 2) {
    return '';
  }
  const active = tabs.some(([key]) => key === S.roTab) ? S.roTab : 'data';
  return html`<div role="tablist" aria-label="Bagian detail pengajuan"
      class="tabs tabs-border border-b border-base-300">
    ${tabs.map(([key, label]) => html`<button type="button" role="tab"
      id="rp-ro-tab-${key}" aria-selected="${active === key}"
      tabindex="${active === key ? '0' : '-1'}" aria-controls="rp-panel"
      data-action="rptka-ro-tab" data-tab="${key}"
      class="tab px-0 me-6 text-sm font-bold ${active === key
        ? 'tab-active text-base-content' : 'text-base-content/60'}">
      ${label}</button>`)}</div>`;
}

/** Konten tab aktif di halaman detail (`ro` mode), di dalam kartu `#rp-panel`. */
function roTabContent(S) {
  if (S.roTab === 'dokumen' && hasDokumenAdministrasi(S)) {
    return dokumenAdministrasiContent(S);
  }
  if (S.roTab === 'imigrasi' && hasKeimigrasian(S)) {
    return keimigrasianPanel(S);
  }
  return dataPengajuanContent(S, true);
}

/**
 * Bagian ATAS halaman detail (`ro` mode), DI LUAR kartu `#rp-panel`: tab
 * bar saja. "Dokumen Pengesahan RPTKA"/"Bukti pembayaran DKPTKA" TIDAK lagi
 * berdiri sendiri mengambang di sini (RV-10) — sudah digabung jadi satu tab
 * "Dokumen Administrasi" DI DALAM `#rp-panel` (RV-14). TIDAK ADA banner
 * status terpisah di sini (dihapus RV-12 — statusnya sudah terlihat sebagai
 * entri teratas kartu "Riwayat status" di sampingnya). Dipanggil dari
 * `rptka.js` `dynamic()`.
 */
export function renderDetailTop(S) {
  return roTabBar(S);
}

/** Konten DI DALAM kartu `#rp-panel` halaman detail (`ro` mode). */
export function renderDetailBody(S) {
  return roTabContent(S);
}

/**
 * Daftar "Riwayat status" — titik biru untuk entri terbaru, titik abu-abu
 * untuk yang lebih lama (urutan terbaru di atas); pola SAMA persis dengan
 * `js/pages/portal/hpk-hasil-detail.js` `riwayatList` (kartu "Riwayat
 * status" yang sudah ada untuk HPK), supaya konsisten. Data dari
 * `S.w.riwayat` — array nyata yang dicatat server tiap transisi
 * (`routes/pengesahan-verifikasi.js` `pushRptkaRiwayat`), BUKAN tanggal
 * interpolasi/fabrikasi seperti drawer "Riwayat status" lama
 * (`js/pages/portal/riwayat.js`).
 */
function riwayatList(riwayat) {
  return html`<ol class="grid gap-3" aria-label="Riwayat status">
    ${[...riwayat].reverse().map((r, i) => html`<li class="grid
        grid-cols-[20px_1fr] gap-3"><span class="mt-1 size-3 rounded-full
        ${i === 0 ? 'bg-secondary' : 'bg-base-300'}" aria-hidden="true">
      </span><div><p class="text-sm font-bold">${r.status}
        <span class="font-medium text-base-content/70">·
        ${tanggal(r.tgl)}</span></p>
        <p class="text-xs text-base-content/70">${r.oleh}</p>
        ${r.catatan ? html`<p class="mt-0.5 text-[13px]
          text-base-content/80">${r.catatan}</p>` : ''}</div></li>`)}</ol>`;
}

/**
 * Kartu "Riwayat status" di samping "Data pengajuan" (permintaan user,
 * dicontohkan dari kartu HPK yang sudah ada) — dipakai baik di tab
 * Preview draft maupun halaman detail (`ro`), lihat `rptka.js` `dynamic`.
 * Kosong (tidak render apa pun) untuk draft yang belum pernah disimpan
 * sama sekali (`S.w.riwayat` belum ada).
 */
export function riwayatCard(w) {
  if (!w.riwayat?.length) {
    return '';
  }
  return html`<section class="${CARD} grid gap-4 px-5 py-6">
    <h2 class="text-base font-bold">Riwayat status</h2>
    ${riwayatList(w.riwayat)}</section>`;
}

function hpkOption(h, S) {
  const label = `${h.barcode} · ${h.layanan} · berlaku s.d. ${h.berlakuSampai}`;
  return html`<option value="${h.id}" ${h.id === S.w.hpkId ? 'selected' : ''}
    ${h.bisaDipilih || h.id === S.w.hpkId ? '' : 'disabled'}>${label}</option>`;
}

/** Ringkasan data HPK terpilih. */
export function hpkSummary(hpk) {
  const items = [['No. permohonan', hpk.noPermohonan, 'font-mono'],
    ['HPK terbit', hpk.terbit, ''], ['Berlaku s.d.', hpk.berlakuSampai, ''],
    ['Lokasi kerja', hpk.lokasi, '']];
  return html`<dl class="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))]
      gap-px overflow-hidden rounded-box border border-base-300 bg-base-300
      text-[13px]" aria-label="Data HPK terpilih">${items.map(([l, v, c]) =>
    html`<div class="bg-base-100 px-4.5 py-4"><dt class="text-base-content/60">
    ${l}</dt><dd class="text-sm font-bold ${c}">${v}</dd></div>`)}</dl>`;
}
