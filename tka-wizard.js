/**
 * @fileoverview Data calon TKA wizard (legacy "tkaWizard"): mode 'hpk'
 * (Tambah TKA from HPK detail: Baru / Pemegang Izin Tinggal) and mode
 * 'nonhpk' (group C one-step pengesahan, incl. Perpanjangan).
 */

import { html, raw } from '../../components/dom.js';
import { statusBadge } from '../../components/status-badge.js';
import { go, setUi, state } from './state.js';
import { ocrActions, ocrBlock, withOcrValues } from './tka-ocr.js';
import {
  BTN, BTN_OUTLINE, CALLOUT_INFO, CALLOUT_WARN, CARD, EYEBROW, H1, LINK,
  agreeCheck, docRow, field, noopAttrs, readonlyField, selectField,
  showErrors, stepNav, validityMessage,
} from './ui.js';

const STEP_LABELS = ['Data calon TKA', 'Dokumen TKA', 'Data pengurus',
  'Pernyataan & proses'];
const LAST_STEP = STEP_LABELS.length - 1;
const DOCS_NONHPK = ['Surat permohonan dan alasan penggunaan TKA',
  'Surat tugas / kuasa', 'Perjanjian kerja',
  'Surat persetujuan instansi berwenang', 'Paspor (berwarna)',
  'Pas foto 4x6 latar merah'];
const DOCS_PERP = ['Perjanjian kerja', 'Paspor (berwarna)',
  'Pas foto 4x6 latar merah', 'Izin tinggal yang masih berlaku',
  'BPJS Ketenagakerjaan dan BPJS Kesehatan TKA', 'NPWP TKA',
  'Laporan pelaksanaan pendampingan'];
const DOCS_BARU = ['Ijazah',
  'Sertifikat kompetensi / pengalaman kerja (min. 5 tahun)',
  'Perjanjian kerja', 'Paspor (berwarna)', 'Pas foto 4x6 latar merah',
  'Surat permohonan visa kerja kepada Dirjen Imigrasi',
  'Rekening koran/tabungan', 'Surat penunjukan Tenaga Kerja Pendamping',
  'Surat pernyataan penjamin TKA'];
const UPLOADED_COUNT = 3;

/** Prefilled candidate per mode/jenis (legacy `tf`). */
function candidate() {
  const { mode = 'hpk', jenis = 'Baru', nama, jabatan } = state.p;
  if (mode === 'nonhpk') {
    const pre = nama ? state.data.tka.find((t) => t.nama === nama) : null;
    return pre
      ? { nama: pre.nama, negara: pre.negara, paspor: pre.paspor,
        jabatan: pre.jabatan, lahir: 'Osaka, 12 Mei 1979', jk: 'Laki-laki',
        pend: 'S2 Teknik Sipil — Kyoto University', exp: '14 tahun',
        bulan: '12' }
      : { nama: 'Tomás Herrera', negara: 'Chili', paspor: 'F20981736',
        jabatan: 'Konsultan Pengelolaan Air',
        lahir: 'Santiago, 3 Februari 1984', jk: 'Laki-laki',
        pend: 'S2 Hidrologi — Universidad de Chile', exp: '11 tahun',
        bulan: '3' };
  }
  if (jenis === 'Pemegang Izin Tinggal') {
    return { nama: 'Sato Kenji', negara: 'Jepang', paspor: 'TZ0038871',
      jabatan, lahir: 'Nagoya, 8 Agustus 1986', jk: 'Laki-laki',
      pend: 'S1 Teknik Kimia — Nagoya University', exp: '9 tahun',
      bulan: '12' };
  }
  return { nama: 'Ravi Shankar', negara: 'India', paspor: 'U7740219',
    jabatan: jabatan || 'Welding Inspector',
    lahir: 'Chennai, 21 Januari 1985', jk: 'Laki-laki',
    pend: 'S1 Teknik Metalurgi — Anna University', exp: '12 tahun',
    bulan: '12' };
}

function title() {
  const { mode = 'hpk', jenis = 'Baru', layanan, hpk } = state.p;
  if (mode === 'nonhpk') {
    return `Pengesahan RPTKA Tanpa Penilaian Kelayakan — ${layanan || 'Baru'}`;
  }
  const barcode = state.data.hpk.find((h) => h.id === hpk)?.barcode ?? '';
  return `Tambah TKA · ${jenis} · HPK ${barcode}`;
}

function stepData(tf) {
  const co = state.data.company;
  const isIzin = state.p.jenis === 'Pemegang Izin Tinggal';
  const approval = co.persetujuan;
  return html`<div><h2 class="text-lg font-bold">Data calon TKA</h2>
      <p class="mt-1 text-[13px] text-base-content/70">Syarat: pendidikan
      sesuai jabatan, pengalaman min. 5 tahun, bersedia mengalihkan keahlian.
      </p></div>
    ${ocrBlock()}
    ${isIzin ? html`<div class="grid items-end gap-3 rounded-box border
        border-info/20 bg-info/10 p-4 md:grid-cols-[1fr_auto]">
      ${field({ id: 't-permit',
        label: 'Nomor Registrasi Izin Tinggal (Permit Number)',
        value: '2C21JE0041-AR', inputClass: 'border-success bg-base-100',
        hint: '✓ Cocok dengan data Imigrasi untuk paspor TZ0038871',
        attrs: raw('required') })}
      <button type="button" class="${BTN_OUTLINE}"
        ${noopAttrs('Cek ke Imigrasi')}>Cek ke Imigrasi</button></div>` : ''}
    <div class="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3.5">
      ${field({ id: 't-nama', label: 'Nama lengkap sesuai paspor',
        value: tf.nama, span: 'md:col-span-2', attrs: raw('required') })}
      ${selectField({ id: 't-jk', label: 'Jenis kelamin',
        options: ['Laki-laki', 'Perempuan'], selected: tf.jk })}
      ${field({ id: 't-lahir', label: 'Tempat, tanggal lahir',
        value: tf.lahir, attrs: raw('required') })}
      ${field({ id: 't-negara', label: 'Kewarganegaraan', value: tf.negara,
        attrs: raw('required') })}
      ${field({ id: 't-paspor', label: 'No. paspor', value: tf.paspor,
        attrs: raw('required') })}
      ${field({ id: 't-paspor-exp', label: 'Paspor berlaku s.d.',
        value: tf.pasporExp })}
      ${field({ id: 't-pend', label: 'Pendidikan terakhir', value: tf.pend,
        span: 'md:col-span-2' })}
      ${readonlyField({ id: 't-jabatan', label: 'Jabatan',
        value: tf.jabatan })}
      ${field({ id: 't-exp', label: 'Pengalaman kerja', value: tf.exp })}
      ${field({ id: 't-bulan', label: 'Jangka waktu (bulan)',
        value: tf.bulan, type: 'number',
        attrs: raw('required min="1" max="24"') })}
      ${readonlyField({ id: 't-lokasi', label: 'Lokasi kerja',
        value: co.kab })}
      ${field({ id: 't-sertifikat',
        label: 'Sertifikat kompetensi / keterangan jabatan',
        value: 'Certified Welding Inspector (AWS CWI) No. 21084417 — berlaku s.d. 2028',
        span: 'md:col-span-3', hint: 'Maks. 250 karakter.',
        attrs: raw('maxlength="250"') })}</div>
    ${state.p.mode === 'nonhpk' && approval ? html`<p
      class="${CALLOUT_INFO}">Dasar penugasan: surat persetujuan
      <b>${approval.instansi}</b> No. ${approval.no} tanggal ${approval.tgl}.
    </p>` : ''}`;
}

function docList() {
  const perp = state.p.jenis === 'Perpanjangan';
  if (state.p.mode === 'nonhpk' && !perp) {
    return DOCS_NONHPK;
  }
  return perp ? DOCS_PERP : DOCS_BARU;
}

function stepDok() {
  return html`<div><h2 class="text-lg font-bold">Dokumen calon TKA</h2>
      <p class="mt-1 text-[13px] text-base-content/70">Pas foto, paspor, dan
      surat pernyataan hanya JPG berwarna, maks. 250 KB.</p></div>
    <ul class="grid gap-2">${docList().map((nama, i) => docRow({
      nama,
      sub: /foto|Paspor/.test(nama) ? 'JPG berwarna, maks. 250 KB'
        : 'PDF/JPG berwarna, maks. 2 MB',
      badge: statusBadge(i < UPLOADED_COUNT ? 'Terunggah' : 'Belum diunggah',
        i < UPLOADED_COUNT ? 'green' : 'gray'),
      actions: html`<button type="button" class="${BTN} btn-sm"
        ${noopAttrs(`Unggah ${nama}`)}>Unggah</button>`,
    }))}</ul>`;
}

function stepPengurus() {
  const pg = state.data.company.pengurus ?? {};
  return html`<div><h2 class="text-lg font-bold">Data pegawai / pengurus</h2>
      <p class="mt-1 text-[13px] text-base-content/70">Terisi dari permohonan
      sebelumnya.</p></div>
    <dl class="grid grid-cols-2 gap-x-5 gap-y-2.5 rounded-box border
        border-base-300 p-4.5 text-sm">
      <dt class="text-base-content/60">Jenis pengurus</dt>
      <dd class="font-bold">${pg.jenis}</dd>
      <dt class="text-base-content/60">Nama lengkap</dt>
      <dd class="font-bold">${pg.nama}</dd>
      <dt class="text-base-content/60">Nomor kontak</dt>
      <dd class="font-bold">${pg.kontak}</dd>
      <dt class="text-base-content/60">Perusahaan</dt>
      <dd class="font-bold">${pg.perusahaan}</dd></dl>
    <button type="button" class="${LINK} justify-self-start text-[13px]"
      ${noopAttrs('Ganti pengurus')}>Ganti pengurus</button>`;
}

function stepPernyataan(tf) {
  const co = state.data.company;
  return html`<h2 class="text-lg font-bold">Surat Pernyataan Penyangkalan</h2>
    <p class="rounded-box border border-base-300 bg-base-200/50 px-5 py-4.5
      text-sm leading-7 text-base-content/80">Saya menyatakan data calon TKA
      <b>${tf.nama}</b> beserta dokumennya benar dan sesuai aslinya. Setelah
      Pengesahan terbit, data akan dikirim otomatis ke Direktorat Jenderal
      Imigrasi.</p>
    ${agreeCheck('Saya menyetujui Surat Pernyataan Penyangkalan',
      state.ui.agree)}
    ${co.dk ? html`<p class="${CALLOUT_WARN}">Setelah Persetujuan Direktur,
      kode billing DKPTKA terbit: <b>Rp1.500.000 × ${tf.bulan} bulan</b>, dibayar
      di muka dalam 5 hari kerja.</p>` : ''}`;
}

/** tkaWizard view. */
export function render() {
  const tf = withOcrValues(candidate());
  const step = state.ui.tkaStep;
  const steps = STEP_LABELS.map((label, i) => {
    let kind = 'todo';
    if (i < step) {
      kind = 'done';
    } else if (i === step) {
      kind = 'cur';
    }
    return { label, kind, dot: i < step ? '✓' : String(i + 1) };
  });
  const body = [stepData, stepDok, stepPengurus, stepPernyataan][step](tf);
  return html`
    <div><p class="${EYEBROW}">Form data calon TKA</p>
      <h1 class="${H1} mt-1">${title()}</h1></div>
    <div class="grid items-start gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
      ${stepNav(steps, step, 'tka-step')}
      <form id="tka-form" novalidate class="${CARD} grid gap-5 px-5 py-6
          md:px-8 md:py-7" aria-label="${STEP_LABELS[step]}">
        ${body}
        <div class="flex justify-between gap-2.5 border-t border-base-200
            pt-3">
          <button type="button" class="${BTN_OUTLINE}" data-action="tka-prev">
            ← Kembali</button>
          ${step === LAST_STEP ? html`<button type="button" class="${BTN}"
              data-action="tka-proses" data-requires-agree
              data-testid="tka-wizard-btn-proses"
              ${state.ui.agree ? '' : 'disabled'}>Proses</button>`
            : html`<button type="button" class="${BTN}" data-action="tka-next"
              data-testid="tka-wizard-btn-next">Simpan &amp; lanjut →
              </button>`}</div></form></div>`;
}

function exitWizard() {
  if ((state.p.mode ?? 'hpk') === 'hpk') {
    go('hpkDetail', { hpk: state.p.hpk });
  } else {
    go('hpkList', { layanan: state.p.layanan });
  }
}

function validateData(form) {
  const errors = {};
  for (const input of form.querySelectorAll('input:not([readonly])')) {
    const missing = input.required && !input.value.trim();
    if (missing) {
      errors[input.id] = 'Wajib diisi.';
    } else if (!input.checkValidity()) {
      errors[input.id] = validityMessage(input);
    }
  }
  return !showErrors(form, errors);
}

export const actions = {
  ...ocrActions,
  'tka-step'(el) {
    setUi({ tkaStep: Number(el.dataset.step) });
  },
  'tka-next'(el) {
    if (state.ui.tkaStep === 0 && !validateData(el.closest('form'))) {
      return;
    }
    setUi({ tkaStep: Math.min(state.ui.tkaStep + 1, LAST_STEP) });
  },
  'tka-prev'() {
    if (state.ui.tkaStep) {
      setUi({ tkaStep: state.ui.tkaStep - 1 });
    } else {
      exitWizard();
    }
  },
  'tka-proses'() {
    if (state.ui.agree) {
      exitWizard();
    }
  },
};
