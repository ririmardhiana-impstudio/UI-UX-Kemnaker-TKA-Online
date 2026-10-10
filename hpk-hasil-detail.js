/**
 * @fileoverview Detail pengajuan HPK (params {id}): tab Ringkasan (data,
 * dokumen, riwayat), Jadwal Ekspose (no. antrian, slot 15 menit, link, QR,
 * hasil ekspose; tidak ada untuk HPK Direksi/Komisaris) dan BAP & Surat HPK
 * (setujui BAP dengan nama + jabatan penyetuju, cetak surat HPK). Kotak
 * "Simulasi" hanya peraga tindakan verifikator/sistem [I].
 */

import { pratinjauAttrs } from '../../components/doc-preview.js';
import {
  approveBapPenilaian, transitionPenilaianKelayakan,
} from '../../api/penilaian-kelayakan.js';
import { html, qs, raw } from '../../components/dom.js';
import { qrCode } from '../../components/qr-code.js';
import { statusBadge } from '../../components/status-badge.js';
import {
  PK_HASIL_EKSPOSE as HASIL, PK_STATUS as S, PK_SUMBER_DOKUMEN as SD,
  PK_SUMBER_ISIAN, ringkasJabatan, validatePenilaianKelayakanBap,
} from '../../contracts/penilaian-kelayakan.js';
import {
  MODAL, PAGE, cache, hari, invalidate, tanggal,
} from './hpk-hasil-data.js';
import { letter } from './hpk-hasil-surat.js';
import { refreshView, state } from './state.js';
import {
  BTN, BTN_OUTLINE, CALLOUT_INFO, CALLOUT_WARN, CARD, LINK, field, navAttrs,
  openDialog, pageTitle, showErrors, textareaField, toast,
} from './ui.js';

const DT = 'text-base-content/70';
const DL = 'grid gap-x-5 gap-y-2.5 text-sm md:grid-cols-[190px_1fr]';
const BAP_STEPS = [S.MENUNGGU_VALIDASI, S.TERVALIDASI, S.TERBIT];
const DOK_TONE = { 'Tersedia di OSS': 'blue', Terunggah: 'green',
  'Belum diunggah': 'gray' };
const TABS = [
  { key: 'ringkasan', label: 'Ringkasan' },
  { key: 'ekspose', label: 'Jadwal Ekspose' },
  { key: 'bap', label: 'BAP & Surat HPK' },
];

function defaultTab(item) {
  if (item.bap) {
    return 'bap';
  }
  const hasSlot = item.ekspose || [S.MENUNGGU_JADWAL, S.TERJADWAL]
    .includes(item.status);
  return item.adaEkspose && hasSlot ? 'ekspose' : 'ringkasan';
}

function visibleTabs(item) {
  return TABS.filter((t) => t.key !== 'ekspose' || item.adaEkspose);
}

function valueText(f) {
  if (f.tipe === 'tanggal') {
    return tanggal(f.nilai);
  }
  if (f.tipe === 'daftar-jabatan') {
    return ringkasJabatan(f.nilai) || '—';
  }
  return f.nilai === null || f.nilai === undefined ? '—' : String(f.nilai);
}

function riwayatList(riwayat) {
  return html`<ol class="grid gap-3" aria-label="Riwayat status">
    ${[...riwayat].reverse().map((r, i) => html`<li class="grid
        grid-cols-[20px_1fr] gap-3"><span class="mt-1 size-3 rounded-full
        ${i === 0 ? 'bg-secondary' : 'bg-base-300'}" aria-hidden="true">
      </span><div><p class="text-sm font-bold">${r.status}
        <span class="font-medium ${DT}">· ${tanggal(r.tgl)}</span></p>
        <p class="text-xs ${DT}">${r.oleh}</p>
        ${r.catatan ? html`<p class="mt-0.5 text-[13px]
          text-base-content/80">${r.catatan}</p>` : ''}</div></li>`)}</ol>`;
}

function dokumenRow(d) {
  const detail = d.sumber === SD.OSS_DATA ? d.nilai : d.namaBerkas;
  return html`<li class="flex flex-wrap items-center justify-between gap-2
      rounded-box border border-base-300 px-4 py-3"><div>
    <p class="text-sm font-semibold">${d.label}</p>
    <p class="text-xs ${d.sumber === SD.OSS_DATA ? 'text-error' : DT}">
      ${detail ?? 'Belum ada berkas'}</p></div>
    <div class="flex items-center gap-3">
      ${statusBadge(d.status, DOK_TONE[d.status])}
      ${d.sumber !== SD.OSS_DATA && d.namaBerkas ? html`<button type="button"
        class="${LINK} text-xs" ${pratinjauAttrs({ judul: d.label,
    namaBerkas: d.namaBerkas, ukuranKb: d.ukuranKb, berkasId: d.berkasId })}
        aria-label="Lihat file ${d.label}">Lihat file</button>` : ''}
    </div></li>`;
}

function panelRingkasan(item) {
  const { fields, dokumen } = item.formulir;
  return html`<div class="grid items-start gap-5
      lg:grid-cols-[minmax(0,1.4fr)_1fr]"><div class="grid gap-5">
    <section class="${CARD} grid gap-4 px-5 py-6 md:px-7">
      <h2 class="text-base font-bold">Data pengajuan</h2>
      <dl class="${DL}">${fields.map((f) => html`<dt class="${DT}">
        ${f.label}</dt><dd class="font-semibold ${f.sumber ===
          PK_SUMBER_ISIAN.OSS ? 'text-error' : ''}">${valueText(f)}</dd>`)}
      </dl></section>
    <section class="${CARD} grid gap-4 px-5 py-6 md:px-7">
      <h2 class="text-base font-bold">Dokumen</h2>
      <ul class="grid gap-2.5">${dokumen.map(dokumenRow)}</ul></section></div>
    <section class="${CARD} grid gap-4 px-5 py-6">
      <h2 class="text-base font-bold">Riwayat status</h2>
      ${riwayatList(item.riwayat)}</section></div>`;
}

function hasilEkspose(item) {
  const hasil = item.ekspose.hasil;
  const view = {
    [HASIL.RESCHEDULE]: ['amber', 'Jadwal dibuat ulang otomatis oleh ' +
      'sistem. Gunakan jadwal terbaru di atas.'],
    [HASIL.PERBAIKAN]: ['red', 'Perbaiki data atau dokumen HPK, lalu ' +
      'submit ulang.'],
    [HASIL.LAYAK]: ['green', 'Penilaian ekspose selesai. BAP HPK siap ' +
      'disetujui di tab BAP & Surat HPK.'],
  }[hasil];
  return html`<section class="${CARD} grid gap-3 px-5 py-6 md:px-7">
    <h2 class="text-base font-bold">Hasil ekspose</h2>
    ${view ? html`<p class="flex flex-wrap items-center gap-3 text-sm">
      ${statusBadge(hasil, view[0])}<span class="text-base-content/80">
      ${view[1]}</span></p>`
    : html`<p class="text-sm ${DT}">Menunggu pelaksanaan ekspose. Hasil
      (reschedule, perbaikan data/dokumen, atau selesai dan layak) tampil
      di sini setelah ekspose.</p>`}
    ${item.ekspose.riwayatJadwal.length ? html`<div><h3 class="mb-1.5
      text-xs font-bold ${DT}">Jadwal sebelumnya</h3><ul class="grid gap-1
      text-[13px]">${item.ekspose.riwayatJadwal.map((j) => html`<li>
        <span class="font-mono font-bold">${j.noAntrian}</span> ·
        ${tanggal(j.tanggal)}, ${j.jam} WIB — ${j.keterangan}</li>`)}</ul>
      </div>` : ''}</section>`;
}

function panelEkspose(item) {
  const e = item.ekspose;
  if (!e) {
    const text = item.status === S.MENUNGGU_JADWAL
      ? 'Jadwal sedang dibuat otomatis berdasarkan nomor antrian dan slot ' +
        'yang tersedia.'
      : 'Jadwal ekspose dibuat otomatis oleh sistem setelah pengajuan ' +
        'terverifikasi. Anda akan menerima notifikasi.';
    return html`<p class="${CALLOUT_INFO}">${text}</p>`;
  }
  return html`<section class="${CARD} grid gap-6 px-5 py-6 md:px-7
      md:grid-cols-[1fr_auto]"><div class="grid content-start gap-4">
      <div><p class="text-xs font-bold ${DT}">Nomor antrian</p>
        <p class="font-mono text-4xl font-extrabold" data-testid="hpk-antrian">
          ${e.noAntrian}</p></div>
      <dl class="${DL}"><dt class="${DT}">Hari</dt><dd class="font-semibold">
        ${hari(e.tanggal)}</dd><dt class="${DT}">Tanggal</dt>
        <dd class="font-semibold">${tanggal(e.tanggal)}</dd>
        <dt class="${DT}">Waktu</dt><dd class="font-semibold">${e.jam}–
        ${e.jamSelesai} WIB (15 menit)</dd><dt class="${DT}">Link ekspose</dt>
        <dd class="break-all"><a class="link link-secondary font-semibold"
          href="${e.link}" target="_blank" rel="noopener noreferrer">
          ${e.link}</a></dd></dl>
      <p class="text-xs ${DT}">Link ekspose dapat diakses langsung pada waktu
        yang telah ditentukan.</p></div>
    <figure class="grid justify-items-center gap-2 self-start">
      ${qrCode({ value: e.link,
        label: `QR code jadwal ekspose ${e.noAntrian}` })}
      <figcaption class="max-w-40 text-center text-xs ${DT}">Pindai untuk
        membuka jadwal / link ekspose. Peraga prototipe, belum dapat
        dipindai.</figcaption></figure></section>${hasilEkspose(item)}`;
}

function bapSteps(status) {
  const at = BAP_STEPS.indexOf(status);
  return html`<ul class="steps w-full" aria-label="Tahap setelah BAP
      disetujui">${BAP_STEPS.map((s, i) => html`<li class="step
      ${i <= at ? 'step-primary' : ''}" ${i === at ? raw('aria-current="step"')
      : ''}>${s}</li>`)}</ul>`;
}

function approvalForm() {
  return html`<form id="hpk-bap-form" novalidate class="grid gap-4
      md:grid-cols-2"><h3 class="text-sm font-bold md:col-span-2">Persetujuan
      BAP</h3>
    ${field({ id: 'bap-nama', label: 'Nama penyetuju',
      attrs: raw('required minlength="3" maxlength="100"') })}
    ${field({ id: 'bap-jabatan', label: 'Jabatan penyetuju',
      attrs: raw('required minlength="3" maxlength="100"') })}
    <p id="bap-form-error" role="alert" class="text-sm font-semibold
      text-error md:col-span-2" hidden></p>
    <div class="md:col-span-2"><button type="submit" class="${BTN}"
      data-testid="hpk-btn-setujui-bap">Setujui BAP HPK</button></div></form>`;
}

function panelBap(item) {
  if (!item.bap) {
    return html`<p class="${CALLOUT_INFO}">BAP tersedia setelah ekspose
      selesai dan dinyatakan layak${item.adaEkspose ? ''
      : ' (HPK Direksi/Komisaris: setelah terverifikasi)'}.</p>`;
  }
  const { bap } = item;
  const jabatan = item.formulir.fields.find((f) => f.kunci === 'jabatanTka');
  const co = state.data.company;
  return html`<section class="${CARD} grid gap-4 px-5 py-6 md:px-7">
      <h2 class="text-base font-bold">Berita Acara Hasil Penilaian
        Kelayakan</h2>
      <dl class="${DL}"><dt class="${DT}">Nomor BAP</dt><dd class="font-mono
        font-bold">${bap.nomor}</dd><dt class="${DT}">Tanggal BAP</dt>
        <dd>${tanggal(bap.tglBap)}</dd><dt class="${DT}">Pemberi kerja</dt>
        <dd class="font-semibold">${co.nama}</dd><dt class="${DT}">Jenis HPK
        </dt><dd>${item.jenis}</dd><dt class="${DT}">Jabatan TKA</dt>
        <dd>${ringkasJabatan(jabatan?.nilai) || '—'}</dd><dt class="${DT}">Hasil penilaian
        </dt><dd>${statusBadge(bap.hasil, 'green')}</dd></dl></section>
    <section class="${CARD} grid gap-4 px-5 py-6 md:px-7">
      ${item.bisaSetujuiBap ? approvalForm() : html`<div class="grid gap-4">
        <h3 class="text-sm font-bold">BAP disetujui</h3>
        <p class="text-sm">Disetujui oleh <b>${bap.penyetuju.nama}</b>
          (${bap.penyetuju.jabatan}) pada ${tanggal(bap.tglSetuju)}.</p>
        ${bapSteps(item.status)}</div>`}</section>
    <section class="${CARD} flex flex-wrap items-center justify-between
        gap-3 px-5 py-5 md:px-7"><div><h3 class="text-sm font-bold">Surat
        Hasil Penilaian Kelayakan</h3><p class="text-xs ${DT}">${item.surat
        ? `Nomor ${item.surat.nomor}`
        : 'Tersedia setelah HPK Terbit (setelah BAP disetujui dan divalidasi).'}
      </p></div><button type="button" class="${BTN}" ${item.surat
        ? raw('data-action="hpk-cetak"') : 'disabled'}
      data-testid="hpk-btn-cetak">Cetak Surat HPK</button></section>`;
}

const DEMO_LABEL = {
  [S.TERJADWAL]: 'Reschedule (jadwal ulang otomatis)',
  [S.PERBAIKAN]: 'Perbaiki data atau dokumen',
  [S.SELESAI]: 'Ekspose selesai dan layak',
};

function demoBox(item) {
  const next = item.transisiTersedia;
  const label = (s) => item.status === S.TERJADWAL ? DEMO_LABEL[s] ?? s : s;
  return html`<section class="grid gap-3 rounded-box border border-dashed
      border-base-300 bg-base-200/50 px-5 py-4"
      aria-labelledby="hpk-demo-title">
    <div><h2 id="hpk-demo-title" class="text-sm font-bold">Simulasi tahap
      verifikator / sistem</h2><p class="text-xs ${DT}">Peraga prototipe.
      Pada produksi tahap ini dijalankan verifikator atau sistem.</p></div>
    ${next.length ? html`<form id="hpk-demo-form" novalidate class="flex flex-wrap
        items-end gap-3"><div class="grid w-full gap-1.5 md:w-80"><label for="hpk-demo-status" class="text-sm
        font-bold">Ubah status menjadi</label><select id="hpk-demo-status"
        class="select h-10 w-full">${next.map((s) => html`<option
        value="${s}">${label(s)}</option>`)}</select></div>
      <div id="hpk-demo-catatan" class="grid min-w-64 flex-1 gap-1.5" hidden>
        ${textareaField({ id: 'demo-catatan', label: 'Catatan perbaikan',
          rows: 2, max: 500, min: 10 })}</div>
      <button type="submit" class="btn btn-outline h-10 min-h-10">Terapkan
      </button></form>`
    : html`<p class="text-sm ${DT}">Tahap berikutnya menunggu tindakan Anda
      (ubah/submit atau setujui BAP) atau sudah selesai.</p>`}</section>`;
}

function backLink() {
  return html`<button type="button" class="${LINK} text-[13px]"
    ${navAttrs(PAGE)}>← Daftar HPK</button>`;
}

function tabs(item, active) {
  return html`<div role="tablist" aria-label="Bagian detail HPK"
      class="tabs tabs-border overflow-x-auto">${visibleTabs(item)
    .map((t) => html`<button type="button" role="tab" id="hpk-tab-${t.key}"
      aria-controls="hpk-panel" aria-selected="${t.key === active}"
      tabindex="${t.key === active ? 0 : -1}" data-action="hpk-tab"
      data-tab="${t.key}" data-focus-key="hpk-tab-${t.key}"
      class="tab whitespace-nowrap ${t.key === active
        ? 'tab-active font-bold' : ''}">${t.label}</button>`)}</div>`;
}

const PANELS = { ringkasan: panelRingkasan, ekspose: panelEkspose,
  bap: panelBap };

function currentTab(item) {
  const wanted = state.ui.hpkTab ?? defaultTab(item);
  return visibleTabs(item).some((t) => t.key === wanted) ? wanted
    : 'ringkasan';
}

/** hpkHasil view when params carry {id}. */
export function render() {
  const item = cache().detail;
  const tab = currentTab(item);
  const edit = item.bisaDiubah ? html`<button type="button"
    class="${BTN_OUTLINE}" ${navAttrs(PAGE, { edit: item.id })}
    data-testid="hpk-btn-ubah">${item.status === S.PERBAIKAN
    ? 'Perbaiki & submit ulang' : 'Ubah'}</button>` : '';
  return html`${pageTitle({ back: backLink(), title: item.noHpk,
    desc: item.jenis, actions: html`<div class="flex flex-wrap items-center
      gap-3">${statusBadge(item.status, item.tone)}${edit}</div>` })}
    ${item.status === S.PERBAIKAN && item.catatan ? html`<p role="note"
      class="${CALLOUT_WARN}"><b>Perlu perbaikan:</b> ${item.catatan}</p>`
      : ''}
    ${tabs(item, tab)}
    <div id="hpk-panel" role="tabpanel" aria-labelledby="hpk-tab-${tab}"
      tabindex="0" class="grid gap-5">${PANELS[tab](item)}</div>
    ${demoBox(item)}`;
}

async function submitBap(form) {
  const body = { namaPenyetuju: qs('#bap-nama', form).value.trim(),
    jabatanPenyetuju: qs('#bap-jabatan', form).value.trim() };
  const check = validatePenilaianKelayakanBap(body);
  const ids = { namaPenyetuju: 'bap-nama', jabatanPenyetuju: 'bap-jabatan' };
  if (showErrors(form, Object.fromEntries(Object.entries(check.errors)
    .map(([key, message]) => [ids[key], message])))) {
    return;
  }
  const button = qs('[type="submit"]', form);
  button.disabled = true;
  form.setAttribute('aria-busy', 'true');
  try {
    await approveBapPenilaian(state.role, cache().detail.id, body);
    invalidate();
    toast('BAP disetujui. Status: Menunggu Divalidasi.');
    state.ui.hpkTab = 'bap';
    refreshView();
  } catch (error) {
    button.disabled = false;
    form.removeAttribute('aria-busy');
    showErrors(form, { 'bap-form': error.message });
  }
}

async function submitDemo(form) {
  const status = qs('#hpk-demo-status', form).value;
  const catatan = qs('#demo-catatan', form).value.trim();
  if (status === S.PERBAIKAN && catatan.length < 10) {
    showErrors(form, { 'demo-catatan': 'Catatan wajib (min. 10 karakter).' });
    return;
  }
  const button = qs('[type="submit"]', form);
  button.disabled = true;
  try {
    await transitionPenilaianKelayakan(state.role, cache().detail.id,
      { status, catatan: catatan || undefined });
    invalidate();
    toast(`Status diubah (simulasi): ${status}.`);
    state.ui.hpkTab = undefined;
    refreshView();
  } catch (error) {
    button.disabled = false;
    toast(error.message, 'error');
  }
}

/** @param {!Element} root */
export function mount(root) {
  qs('#hpk-bap-form', root)?.addEventListener('submit', (event) => {
    event.preventDefault();
    submitBap(event.target);
  });
  const demo = qs('#hpk-demo-form', root);
  demo?.addEventListener('submit', (event) => {
    event.preventDefault();
    submitDemo(demo);
  });
  if (demo) {
    qs('#hpk-demo-catatan', demo).hidden =
      qs('#hpk-demo-status', demo).value !== S.PERBAIKAN;
  }
  demo?.addEventListener('change', (event) => {
    if (event.target.id === 'hpk-demo-status') {
      qs('#hpk-demo-catatan', demo).hidden =
        event.target.value !== S.PERBAIKAN;
    }
  });
  qs('[role="tablist"]', root)?.addEventListener('keydown', (event) => {
    const keys = [...root.querySelectorAll('[role="tab"]')]
      .map((t) => t.dataset.tab);
    const at = keys.indexOf(event.target.dataset.tab);
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    const next = event.key === 'Home' ? 0 : event.key === 'End'
      ? keys.length - 1 : (at + step + keys.length) % keys.length;
    if (at < 0 || (!step && !['Home', 'End'].includes(event.key))) {
      return;
    }
    event.preventDefault();
    state.ui.hpkTab = keys[next];
    refreshView(`hpk-tab-${keys[next]}`);
  });
}

export const actions = {
  'hpk-tab'(el) {
    state.ui.hpkTab = el.dataset.tab;
    refreshView(`hpk-tab-${el.dataset.tab}`);
  },
  'hpk-cetak'() {
    const item = cache().detail;
    if (item?.surat) {
      openDialog(MODAL, letter(item), 'max-w-3xl');
    }
  },
};
