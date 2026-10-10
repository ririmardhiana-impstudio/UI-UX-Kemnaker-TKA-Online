/**
 * @fileoverview Permohonan Penilaian Kelayakan (legacy "hpkWizard"):
 * steps form → jabatan → dokumen → uraian → (pendamping) → (tkaData) →
 * pengurus → pernyataan, including the "Perbaiki & Proses Kembali" mode for
 * rejected HPK (P.edit).
 */

import { html, qsa, raw } from '../../components/dom.js';
import { statusBadge } from '../../components/status-badge.js';
import { go, setUi, state } from './state.js';
import {
  BTN, BTN_OUTLINE, CALLOUT_INFO, CARD, EYEBROW, H1, THEAD, agreeCheck,
  docRow, field, noopAttrs, readonlyField, selectField, showErrors, stepNav,
  textareaField,
} from './ui.js';

const STEP_NAMES = {
  form: 'Form permohonan', jabatan: 'Jabatan & lokasi',
  dokumen: 'Dokumen perusahaan', uraian: 'Uraian jabatan TKA',
  pendamping: 'TKI pendamping', tkaData: 'Data & dokumen TKA',
  pengurus: 'Data pengurus', pernyataan: 'Pernyataan & proses',
};
const DEFAULT_JABATAN = [
  { nama: 'Welding Inspector', kuota: 1, bulan: 12 },
  { nama: 'Quality Control Engineer', kuota: 2, bulan: 12 },
];
/** [nama, Sementara, >6 bulan, Non DKPTKA, Perpanjangan] */
const DOC_MATRIX = [
  ['Surat permohonan', 1, 1, 1, 1],
  ['Surat tugas / kuasa (+ identitas pemberi & penerima kuasa)', 1, 1, 1, 1],
  ['NIB dan/atau izin usaha', 1, 1, 1, 0],
  ['Akta + SK pengesahan pendirian/perubahan', 1, 1, 1, 0],
  ['Bukti WLKP', 1, 1, 1, 1], ['Domisili pemberi kerja', 1, 1, 1, 1],
  ['Rancangan perjanjian kerja', 1, 1, 1, 0],
  ['Bagan struktur organisasi', 0, 1, 1, 0],
  ['Surat persetujuan pembebasan DKPTKA dari K/L terkait', 0, 0, 1, 0],
  ['Laporan realisasi diklat bagi tenaga kerja Indonesia', 0, 0, 0, 1],
];
const URAIAN_TEXT = 'Melaksanakan pemeriksaan mutu hasil produksi sesuai standar ISO 9001 dan spesifikasi pelanggan; menyusun rencana inspeksi dan prosedur uji; menganalisis ketidaksesuaian produk serta menetapkan tindakan korektif; melatih Tenaga Kerja Pendamping dalam metode pengujian, kalibrasi alat ukur, dan dokumentasi mutu; berkoordinasi dengan bagian produksi dan pemeliharaan.';
const PENDAMPING_TEXT = 'Mendampingi Quality Control Engineer dalam pelaksanaan inspeksi harian, pencatatan hasil uji, dan kalibrasi alat ukur; mempelajari analisis akar masalah; menyusun laporan mutu mingguan; menyiapkan diri mengambil alih fungsi inspeksi setelah masa penggunaan TKA berakhir. Mengikuti pelatihan sertifikasi mutu internal serta evaluasi kompetensi berkala bersama para TKA.';
const URAIAN_MIN = 350;
const URAIAN_MAX = 800;

/** Legacy wizSteps(lay). */
function stepKeys(lay) {
  let keys = ['form', 'jabatan', 'dokumen', 'uraian', 'pendamping',
    'pengurus', 'pernyataan'];
  if (/Sementara|Perpanjangan Non/.test(lay)) {
    keys = keys.filter((k) => k !== 'pendamping');
  }
  if (/Direktur/.test(lay)) {
    keys.splice(4, 0, 'tkaData');
  }
  return keys;
}

function context() {
  const lay = state.p.layanan || 'Pekerjaan Lebih dari 6 bulan';
  const hpk = state.data.hpk;
  const edit = state.p.edit ? hpk.find((h) => h.id === state.p.edit) : null;
  const perpJabatan = /Perpanjangan/.test(lay)
    ? hpk.find((h) => h.id === 'h2')?.jabatan : null;
  const jabatan = (edit ? edit.jabatan : perpJabatan) ?? DEFAULT_JABATAN;
  return {
    lay, edit, keys: stepKeys(lay), jabatan,
    rejected: edit?.tone === 'red',
  };
}

function stepList(ctx) {
  const current = state.ui.step;
  return ctx.keys.map((k, i) => {
    const flag = ctx.rejected ? (k === 'dokumen' || k === 'uraian'
      ? 'err' : 'ok') : null;
    const done = i < current || flag === 'ok';
    let kind = 'todo';
    if (flag === 'err') {
      kind = 'err';
    } else if (done && i !== current) {
      kind = 'done';
    } else if (i === current) {
      kind = done ? 'done' : 'cur';
    }
    let dot = String(i + 1);
    if (flag === 'err') {
      dot = '!';
    } else if (done && i !== current) {
      dot = '✓';
    }
    return { label: STEP_NAMES[k], kind, dot,
      note: flag === 'err' ? 'Perlu perbaikan' : '' };
  });
}

function stepForm(ctx) {
  const co = state.data.company;
  const pembebasan = co.pembebasan ?? {};
  return html`<div><h2 class="text-lg font-bold">Form permohonan penilaian
      kelayakan</h2><p class="mt-1 text-[13px] text-base-content/70">Data
      pemberi kerja terisi dari profil. Periksa sebelum melanjutkan.</p></div>
    <div class="grid gap-4 md:grid-cols-2">
      ${readonlyField({ id: 'w-nama', label: 'Nama pemberi kerja',
        value: co.nama })}
      ${readonlyField({ id: 'w-npwp', label: 'NPWP', value: co.npwp })}
      ${field({ id: 'w-surat', label: 'No. surat permohonan',
        value: '047/NBP-HRD/IX/2026', attrs: raw('required') })}
      ${field({ id: 'w-tgl', label: 'Tanggal surat permohonan',
        value: '24 September 2026', attrs: raw('required') })}
      ${textareaField({ id: 'w-alasan', label: 'Alasan penggunaan TKA',
        span: 'md:col-span-2', value: 'Pemasangan dan commissioning lini produksi baja presisi baru di Karawang yang memerlukan keahlian khusus pabrikan mesin.' })}
    </div>
    ${/Non DKPTKA/.test(ctx.lay) ? html`<div class="grid gap-4 rounded-box
        border border-info/20 bg-info/10 p-4 md:grid-cols-2">
      <p class="text-[13px] font-extrabold text-primary md:col-span-2">Surat
        persetujuan pembebasan DKPTKA</p>
      ${field({ id: 'w-bebas-no', label: 'Nomor surat',
        value: pembebasan.no ?? 'B-1127/DJ.V/KS.01.1/03/2026',
        inputClass: 'bg-base-100' })}
      ${field({ id: 'w-bebas-tgl', label: 'Tanggal surat',
        value: pembebasan.tgl ?? '18 Maret 2026',
        inputClass: 'bg-base-100' })}</div>` : ''}
    ${/Perpanjangan/.test(ctx.lay) ? html`<p class="${CALLOUT_INFO}">Data
      terisi dari pengesahan sebelumnya: <b>HPK 26004518</b> dan TKA yang Anda
      pilih di langkah perpanjangan.</p>` : ''}`;
}

function stepJabatan(ctx) {
  return html`<div class="flex flex-wrap items-end justify-between gap-3">
      <div><h2 class="text-lg font-bold">Jabatan, lokasi &amp;
        kewarganegaraan</h2><p class="mt-1 text-[13px] text-base-content/70">
        Jabatan mengacu Kepmenaker 228/2019. Tidak ada di daftar? Laporkan via
        Hotline.</p></div>
      <button type="button" class="${BTN_OUTLINE} btn-sm"
        ${noopAttrs('Tambah jabatan')}>+ Tambah jabatan</button></div>
    <div class="overflow-x-auto rounded-box border border-base-300">
      <table class="table min-w-[520px] text-sm"><thead><tr class="${THEAD}">
        <th class="w-10">No</th><th>Jabatan</th><th class="w-[100px]">Jumlah
        TKA</th><th class="w-[120px]">Jangka waktu</th>
        <th class="w-20"><span class="sr-only">Aksi</span></th></tr></thead>
      <tbody>${ctx.jabatan.map((j, i) => html`<tr>
        <td class="text-base-content/60">${i + 1}</td>
        <td class="font-semibold">${j.nama}</td><td>${j.kuota} orang</td>
        <td>${j.bulan} bulan</td><td class="text-right"><button type="button"
          class="link link-hover link-secondary text-xs font-bold"
          ${noopAttrs(`Ubah ${j.nama}`)}>Ubah</button></td></tr>`)}
      </tbody></table></div>
    <div class="grid gap-4 md:grid-cols-2">
      ${selectField({ id: 'w-lokasi', label: 'Lokasi penempatan',
        options: ['KAB. BEKASI, JAWA BARAT'],
        selected: 'KAB. BEKASI, JAWA BARAT' })}
      <div class="grid content-start gap-1.5"><p class="text-sm font-bold">
        Kewarganegaraan TKA</p>
        <p class="flex min-h-11 flex-wrap items-center gap-1.5 rounded-field
          border border-base-content/20 px-2.5 py-2">${['India', 'Jepang']
          .map((n) => html`<span class="badge h-auto border-0 bg-info/10 py-1
            text-[13px] font-semibold text-primary">${n}
            <span aria-hidden="true">×</span></span>`)}</p></div></div>
    <p class="rounded-field bg-base-200 px-3.5 py-3 text-xs
      text-base-content/60">Penambahan lokasi hanya diperbolehkan bila tidak
      mengubah jenis pembayaran (PNBP ↔ pendapatan daerah).</p>`;
}

function stepDokumen(ctx) {
  let col = 2;
  if (/Perpanjangan/.test(ctx.lay)) {
    col = 4;
  } else if (/Non DKPTKA/.test(ctx.lay)) {
    col = 3;
  } else if (/Sementara/.test(ctx.lay)) {
    col = 1;
  }
  const docs = DOC_MATRIX.filter((d) => d[col]).map((d, i) => {
    const rej = ctx.rejected && d[0] === 'Rancangan perjanjian kerja';
    const up = !rej && i < 6;
    return docRow({
      nama: d[0],
      sub: rej ? 'perjanjian-kerja-draft.pdf · 820 KB'
        : (up ? 'Dari Upload Dokumen Pengguna' : 'PDF/JPG berwarna, maks. 2 MB'),
      badge: statusBadge(rej ? 'Ditolak petugas'
        : (up ? 'Terunggah' : 'Belum diunggah'),
      rej ? 'red' : (up ? 'green' : 'gray')),
      note: rej ? 'Belum ditandatangani kedua pihak.' : '',
      actions: html`<button type="button" class="${BTN_OUTLINE} btn-sm"
          ${noopAttrs(`Lihat ${d[0]}`)}>Lihat</button>
        <button type="button" class="${BTN} btn-sm"
          ${noopAttrs(`Unggah ${d[0]}`)}>Unggah</button>`,
    });
  });
  return html`<div><h2 class="text-lg font-bold">Upload softcopy dokumen
      perusahaan</h2><p class="mt-1 text-[13px] text-base-content/70">Dokumen
      dari Upload Dokumen Pengguna dipakai otomatis. Pindai berwarna dari asli;
      PDF/JPG, maks. 2 MB.</p></div>
    <ul class="grid gap-2">${docs}</ul>
    <div class="flex justify-end"><button type="button"
      class="btn btn-outline btn-primary btn-sm"
      ${noopAttrs('Simpan Dokumen')}>Simpan Dokumen</button></div>`;
}

function stepUraian(ctx) {
  return html`<div><h2 class="text-lg font-bold">Uraian jabatan TKA</h2>
      <p class="mt-1 text-[13px] text-base-content/70">350–800 karakter per
      jabatan.</p></div>
    ${ctx.jabatan.map((j, i) => textareaField({ id: `w-uraian-${i}`,
      label: j.nama, value: URAIAN_TEXT, rows: 4, min: URAIAN_MIN,
      max: URAIAN_MAX }))}`;
}

function stepPendamping() {
  return html`<div><h2 class="text-lg font-bold">Data Tenaga Kerja Pendamping
      (TKI)</h2><p class="mt-1 text-[13px] text-base-content/70">Penerima
      alih keahlian dari TKA. Pas foto 122 × 144 px (bmp/png/jpg/gif).</p>
    </div>
    <div class="grid items-start gap-5 md:grid-cols-[122px_minmax(0,1fr)]">
      <div class="grid h-36 w-[122px] place-items-center rounded-field border
        border-base-300 bg-base-200 text-center text-[11px]
        text-base-content/60">Foto<br>122×144</div>
      <div class="grid gap-3.5 md:grid-cols-2">
        ${field({ id: 'w-tki-nama', label: 'Nama TKI pendamping',
          value: 'Dimas Prasetyo', attrs: raw('required') })}
        ${field({ id: 'w-tki-jabatan', label: 'Jabatan', value: 'QC Staff',
          attrs: raw('required') })}
        ${textareaField({ id: 'w-tki-uraian',
          label: 'Uraian jabatan pendamping', value: PENDAMPING_TEXT,
          span: 'md:col-span-2', min: URAIAN_MIN, max: URAIAN_MAX })}
      </div></div>`;
}

function stepTkaData() {
  const chip = (ok, label) => html`<span class="rounded-full px-2.5 py-1.5
    ${ok ? 'bg-success/10 text-success'
      : 'bg-base-200 text-base-content/70'}">${ok ? '✓' : '○'} ${label}</span>`;
  return html`<div><h2 class="text-lg font-bold">Data &amp; dokumen TKA</h2>
      <p class="mt-1 text-[13px] text-base-content/70">Untuk
      Direktur/Komisaris, data TKA diisi sekaligus. Nama harus tercantum di
      akta.</p></div>
    <div class="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3.5">
      ${field({ id: 'w-tka-nama', label: 'Nama sesuai paspor',
        value: 'Lukas Becker' })}
      ${field({ id: 'w-tka-paspor', label: 'No. paspor',
        value: 'C4F7K92LT' })}
      ${field({ id: 'w-tka-negara', label: 'Kewarganegaraan',
        value: 'Jerman' })}</div>
    <p class="flex flex-wrap gap-2 text-xs font-bold">
      ${chip(true, 'Paspor')}${chip(true, 'Pas foto')}
      ${chip(true, 'Akta (nama tercantum)')}${chip(false, 'Perjanjian kerja')}
    </p>`;
}

/** Pengurus radio cards + fields (shared with nothing else). */
function stepPengurus() {
  const pg = state.data.company.pengurus ?? {};
  const radio = (value, checked) => html`<label class="flex cursor-pointer
      items-center gap-2.5 rounded-box border px-3.5 py-3.5 text-sm ${checked
        ? 'border-2 border-secondary bg-info/10 font-bold text-primary'
        : 'border-base-content/20 font-semibold text-base-content/70'}">
    <input type="radio" name="w-pengurus-jenis" value="${value}"
      class="radio radio-secondary radio-sm" ${checked ? 'checked' : ''}>
    ${value}</label>`;
  return html`<div><h2 class="text-lg font-bold">Data pegawai / pengurus</h2>
      <p class="mt-1 text-[13px] text-base-content/70">Orang yang mengurus
      permohonan ini dan hadir saat ekspos.</p></div>
    <fieldset class="grid gap-2.5 md:grid-cols-2"><legend class="sr-only">
      Jenis pengurus</legend>${radio('Karyawan Pemberi Kerja', true)}
      ${radio('Pihak Ketiga / Agent', false)}</fieldset>
    <div class="grid gap-3.5 md:grid-cols-2">
      ${field({ id: 'w-pg-nama', label: 'Nama lengkap', value: pg.nama,
        attrs: raw('required') })}
      ${field({ id: 'w-pg-kontak', label: 'Nomor kontak', value: pg.kontak,
        type: 'tel', attrs: raw('required pattern="[0-9]+" inputmode="numeric"') })}
      ${field({ id: 'w-pg-perusahaan', label: 'Nama perusahaan',
        value: pg.perusahaan })}
      <div class="grid content-start gap-1.5"><p class="text-sm font-bold">
        Kartu identitas pegawai (bukan KTP)</p>
        <p class="flex h-11 items-center justify-between rounded-field border
          border-base-content/20 px-3.5 text-sm"><span>id-pegawai.jpg · 640
          KB</span><span class="font-bold text-success">✓</span></p></div>
    </div>`;
}

function stepPernyataan() {
  const co = state.data.company;
  return html`<div><h2 class="text-lg font-bold">Surat Pernyataan
      Penyangkalan</h2><p class="mt-1 text-[13px] text-base-content/70">Wajib
      disetujui sebelum permohonan diproses.</p></div>
    <p class="max-h-56 overflow-auto rounded-box border border-base-300
      bg-base-200/50 px-5 py-4.5 text-sm leading-7 text-base-content/80">
      Dengan ini saya, <b>${co.pengurus?.nama}</b>, selaku pengurus yang
      ditunjuk oleh <b>${co.nama}</b>, menyatakan bahwa seluruh data dan
      dokumen yang disampaikan adalah benar dan sesuai dengan aslinya. Apabila
      di kemudian hari ditemukan ketidaksesuaian, saya bersedia menerima sanksi
      sesuai ketentuan peraturan perundang-undangan, termasuk pencabutan
      Pengesahan RPTKA, dan membebaskan Kementerian Ketenagakerjaan dari
      segala tuntutan.</p>
    ${agreeCheck('Saya telah membaca dan menyetujui Surat Pernyataan Penyangkalan', state.ui.agree)}
    <div class="grid gap-2.5 text-[13px] font-bold md:grid-cols-3">
      <p class="rounded-field bg-success/10 px-3.5 py-3 text-success">✓
        Dokumen lengkap</p>
      <p class="rounded-field bg-success/10 px-3.5 py-3 text-success">✓
        Pengurus terisi</p>
      <p class="rounded-field bg-info/10 px-3.5 py-3 text-secondary">HPK ≤ 2
        hari kerja setelah layak</p></div>`;
}

const STEP_RENDER = {
  form: stepForm, jabatan: stepJabatan, dokumen: stepDokumen,
  uraian: stepUraian, pendamping: stepPendamping, tkaData: stepTkaData,
  pengurus: stepPengurus, pernyataan: stepPernyataan,
};

/** hpkWizard view. */
export function render() {
  const ctx = context();
  const step = Math.min(state.ui.step, ctx.keys.length - 1);
  const isLast = step === ctx.keys.length - 1;
  return html`
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div><p class="${EYEBROW}">Tahap 1 · Hasil Penilaian Kelayakan</p>
        <h1 class="${H1} mt-1">Permohonan ${ctx.lay}</h1></div>
      <p class="text-[13px] text-base-content/70">Langkah ${step + 1} dari
        ${ctx.keys.length} · tersimpan otomatis</p></div>
    ${ctx.edit?.catatan ? html`<div role="note" class="rounded-box border
        border-error/30 bg-error/10 px-4.5 py-4 text-sm leading-relaxed
        text-error"><b>Catatan petugas verifikasi (26 Sep 2026):</b>
      ${ctx.edit.catatan} Perbaiki bagian bertanda merah, lalu klik
      <b>Proses Kembali</b>.</div>` : ''}
    <div class="grid items-start gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
      ${stepNav(stepList(ctx), step, 'wiz-step')}
      <form id="wiz-form" novalidate class="${CARD} grid gap-5 px-5 py-6
          md:px-8 md:py-7" aria-label="${STEP_NAMES[ctx.keys[step]]}">
        ${STEP_RENDER[ctx.keys[step]](ctx)}
        <div class="flex justify-between gap-2.5 border-t border-base-200
            pt-3">
          <button type="button" class="${BTN_OUTLINE}" data-action="wiz-prev">
            ← Kembali</button>
          ${isLast ? html`<button type="button" class="${BTN}"
              data-action="wiz-proses" data-requires-agree
              data-testid="hpk-wizard-btn-proses"
              ${state.ui.agree ? '' : 'disabled'}>Proses Kembali</button>`
            : html`<button type="button" class="${BTN}" data-action="wiz-next"
              data-testid="hpk-wizard-btn-next">Simpan &amp; lanjut →</button>`}
        </div></form></div>`;
}

/** Validate the current step (HTML5 + uraian length VR-11). */
function validateStep(form) {
  const errors = {};
  for (const input of qsa('input[required]', form)) {
    if (!input.value.trim()) {
      errors[input.id] = 'Wajib diisi.';
    } else if (!input.checkValidity()) {
      errors[input.id] = 'Format tidak valid (angka saja).';
    }
  }
  for (const area of qsa('textarea[minlength]', form)) {
    const n = area.value.trim().length;
    if (n < URAIAN_MIN || n > URAIAN_MAX) {
      errors[area.id] = `Uraian harus ${URAIAN_MIN}–${URAIAN_MAX} karakter ` +
        `(saat ini ${n}).`;
    }
  }
  return !showErrors(form, errors);
}

export const actions = {
  'wiz-step'(el) {
    setUi({ step: Number(el.dataset.step) });
  },
  'wiz-next'(el) {
    const form = el.closest('form');
    if (!validateStep(form)) {
      return;
    }
    const total = context().keys.length;
    setUi({ step: Math.min(state.ui.step + 1, total - 1) });
  },
  'wiz-prev'() {
    if (state.ui.step) {
      setUi({ step: state.ui.step - 1 });
    } else {
      go('hpkList', { layanan: context().lay });
    }
  },
  'wiz-proses'() {
    if (state.ui.agree) {
      go('hpkList', { layanan: context().lay });
    }
  },
};
