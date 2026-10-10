/**
 * @fileoverview Detail Perubahan (legacy "perubahanDetail") with tabs
 * Data / Upload Dokumen / Pengurus / Ringkasan, plus the "Surat Pernyataan
 * Penyangkalan" (submit) and "Batalkan pengajuan" (cancel) dialogs.
 * Rules PR-01..PR-03 are enforced by the API (409/422); the UI mirrors them.
 */

import {
  cancelPerubahan, submitPerubahan, uploadPerubahanDocument,
} from '../../api/perubahan.js';
import { html, qs, raw } from '../../components/dom.js';
import { statusBadge } from '../../components/status-badge.js';
import {
  JENIS_PENDAMPING, validateCancelPerubahan,
} from '../../contracts/perubahan.js';
import { reloadCollection } from './data.js';
import { openRingkasanDoc } from './documents.js';
import { slug } from './format.js';
import { refreshView, setUi, state } from './state.js';
import { resubmitPengajuan } from '../../api/pengajuan-verifikasi.js';
import { backToList } from './perubahan.js';
import {
  BTN, BTN_OUTLINE, CARD, agreeCheck, closeDialog, docRow, field,
  noopAttrs, openDialog, selectField, showErrors, textareaField, toast,
} from './ui.js';

const TABS = ['Data Perubahan', 'Upload Dokumen', 'Pengurus', 'Ringkasan'];
const CANCEL_MAX = 1000;
const MODAL = 'portal-modal';

/** Current perubahan record (legacy cd). */
export function currentPerubahan() {
  const list = state.data.perubahan;
  return list.find((c) => c.id === (state.p.id ?? 'c1')) ?? list[0] ?? null;
}

function docs(cd) {
  let third = 'Paspor baru (berwarna)';
  if (cd.jenis === 'Lokasi Kerja') {
    third = 'Domisili / kontrak lokasi kerja';
  } else if (cd.jenis === 'Alamat Pemberi Kerja') {
    third = 'NIB / akta perubahan alamat';
  } else if (cd.jenis === JENIS_PENDAMPING) {
    third = 'Surat penunjukan Tenaga Kerja Pendamping';
  }
  return [
    { n: 'Surat permohonan perubahan', f: 'PDF, maks. 2 MB', up: true },
    { n: 'Surat tugas / kuasa', f: 'PDF, maks. 2 MB', up: true },
    { n: third, f: cd.jenis === 'Data Tenaga Kerja Asing'
      ? 'JPG, maks. 250 KB' : 'PDF, maks. 2 MB', up: Boolean(cd.dok) },
  ];
}

function tabData(cd) {
  return html`<dl class="grid gap-x-5 gap-y-2.5 text-sm
      md:grid-cols-[200px_1fr]">
    <dt class="text-base-content/60">No. surat permohonan</dt>
    <dd class="font-bold">${cd.surat}</dd>
    <dt class="text-base-content/60">Tanggal surat</dt>
    <dd class="font-bold">${cd.suratTgl}</dd>
    <dt class="text-base-content/60">Jenis perubahan</dt>
    <dd class="font-bold">${cd.jenis} — ${cd.detail}</dd>
    ${cd.pendampingNama ? html`<dt class="text-base-content/60">Tenaga
      Kerja Pendamping baru</dt><dd class="font-bold">${cd.pendampingNama} ·
      ${cd.pendampingJabatan}</dd>` : ''}</dl>
  <div class="grid gap-3 md:grid-cols-2">
    <div class="rounded-box bg-base-200/50 p-4"><p class="mb-1.5 text-xs
      font-extrabold tracking-wider text-base-content/60">SEMULA TERTULIS</p>
      <p class="text-sm leading-normal">${cd.semula}</p></div>
    <div class="rounded-box border border-info/20 bg-info/10 p-4"><p
      class="mb-1.5 text-xs font-extrabold tracking-wider text-secondary">
      MENJADI</p><p class="text-sm font-semibold leading-normal">
      ${cd.menjadi}</p></div></div>`;
}

function tabDocs(cd) {
  const isDraft = cd.statusId === 1;
  return html`<h2 class="text-base font-bold">Upload Dokumen Perubahan</h2>
    <ul class="grid gap-2">${docs(cd).map((d) => docRow({
      nama: d.n, sub: d.f,
      badge: statusBadge(d.up ? 'Diterima sistem' : 'Belum diunggah',
        d.up ? 'green' : 'gray'),
      actions: html`<button type="button" class="${BTN_OUTLINE} btn-sm"
          ${noopAttrs(`Pratinjau ${d.n}`)}>Pratinjau</button>
        <button type="button" class="${BTN} btn-sm" data-action="chg-upload"
          data-nama="${d.n}" ${isDraft ? '' : raw('disabled title="Hanya draf yang dapat diubah"')}>
          Unggah</button>`,
    }))}</ul>
    <button type="button" class="rounded-box border border-dashed
        border-base-content/20 px-4 py-3.5 text-left text-[13px] font-bold
        text-secondary" ${noopAttrs('Tambah Upload Baru')}>+ Tambah Upload
      Baru (Optional) <span class="font-medium text-base-content/60">— dengan
      keterangan</span></button>`;
}

function tabPengurus() {
  const pg = state.data.company.pengurus ?? {};
  return html`<h2 class="text-base font-bold">Pengurus</h2>
    <div class="grid gap-3.5 md:grid-cols-2">
      ${selectField({ id: 'cd-pg-jenis', label: 'Jenis pengurus',
        options: ['Karyawan Pemberi Kerja', 'Pihak Ketiga / Agent'],
        selected: pg.jenis })}
      ${field({ id: 'cd-pg-nama', label: 'Nama lengkap', value: pg.nama })}
      ${field({ id: 'cd-pg-kontak', label: 'Nomor kontak (angka saja)',
        value: pg.kontak, type: 'tel',
        attrs: raw('pattern="[0-9]+" inputmode="numeric"') })}
      ${field({ id: 'cd-pg-perusahaan', label: 'Nama perusahaan',
        value: pg.perusahaan })}
      <div class="grid gap-1.5 md:col-span-2"><p class="text-sm font-bold">
        Scan identitas (maks. 2 MB)</p><p class="flex h-11 items-center
        justify-between rounded-field border border-base-content/20 px-3.5
        text-sm"><span>id-pegawai-rina.jpg · 640 KB</span><span
        class="font-bold text-success">✓ Terunggah</span></p></div></div>`;
}

function tabRingkasan(cd) {
  return html`<h2 class="text-base font-bold">Ringkasan</h2>
    <div class="grid gap-2.5 text-[13px] font-bold md:grid-cols-3">
      <p class="rounded-field bg-success/10 p-3.5 text-success">✓ Data
        perubahan</p>
      <p class="rounded-field bg-base-200/50 p-3.5 ${cd.dok ? 'text-success'
        : 'text-error'}">${cd.dok ? '✓' : '✗'} Dokumen lengkap</p>
      <p class="rounded-field bg-success/10 p-3.5 text-success">✓ Pengurus
        terisi</p></div>
    ${cd.statusId === 1 ? '' : html`<p class="rounded-box bg-info/10 px-4
      py-3.5 text-sm leading-relaxed text-primary">Permohonan sudah diajukan.
      Petugas memeriksa data dan kelengkapan; SK Perubahan terbit ≤ 2 hari.
    </p>`}`;
}

/** perubahanDetail view. */
export function render() {
  const cd = currentPerubahan();
  if (!cd) {
    return html`${backToList()}<p class="text-sm text-base-content/60">
      Permohonan perubahan tidak ditemukan.</p>`;
  }
  const tab = state.ui.chgTab;
  const canProses = cd.dok && cd.pengurus && cd.statusId === 1;
  const body = [tabData, tabDocs, tabPengurus, tabRingkasan][tab](cd);
  return html`
    <div class="flex flex-wrap items-end justify-between gap-4"><div>
      ${backToList()}
      <h1 class="mb-1 mt-2 text-[26px] font-extrabold tracking-tight">
        Perubahan ${cd.barcode} · ${cd.nama}</h1>
      <p class="text-[13px] text-base-content/70">${cd.jenis} (${cd.detail})
        · SK asal ${cd.skNo}</p></div>
      <div class="flex items-center gap-2.5">
        <button type="button" class="${BTN_OUTLINE} btn-sm"
          data-action="chg-preview-doc"
          data-testid="perubahan-btn-preview-doc">Preview Dokumen</button>
        ${statusBadge(cd.status, cd.tone)}</div></div>
    <div role="tablist" aria-label="Bagian perubahan"
        class="tabs tabs-border border-b border-base-300">
      ${TABS.map((label, i) => html`<button type="button" role="tab"
        id="chg-tab-${i}" aria-controls="chg-panel"
        aria-selected="${i === tab}" tabindex="${i === tab ? '0' : '-1'}"
        data-action="chg-tab" data-tab="${i}"
        class="tab px-0 me-6 text-sm font-bold ${i === tab
          ? 'tab-active text-base-content' : 'text-base-content/60'}">
        ${label}${i === 1 && !cd.dok ? html`<span class="text-error">
          •<span class="sr-only"> belum lengkap</span></span>` : ''}
      </button>`)}</div>
    <div id="chg-panel" role="tabpanel" aria-labelledby="chg-tab-${tab}"
        class="${CARD} grid gap-4 px-5 py-6 md:px-7">
      ${body}
      <div class="flex justify-between gap-2.5 border-t border-base-200 pt-3">
        ${cd.statusId === 1 ? html`<button type="button"
            class="btn btn-outline btn-error" data-action="chg-open-batal">
            Batalkan Pengajuan</button>
          <button type="button" class="${BTN}"
            data-action="chg-open-pernyataan"
            data-testid="perubahan-btn-proses"
            ${canProses ? '' : raw('disabled title="Lengkapi dokumen dan pengurus"')}>
            Proses</button>` : ''}</div></div>`;
}

function pernyataanDialog(cd) {
  return html`<div class="grid gap-4 px-6 py-7 md:px-8">
    <h2 class="text-[19px] font-bold">Surat Pernyataan Penyangkalan</h2>
    <p class="rounded-box bg-base-200/50 p-4 text-sm leading-7
      text-base-content/80">Saya menyatakan bahwa data perubahan atas
      Pengesahan RPTKA ${cd.skBarcode} (${cd.nama}) beserta dokumen
      pendukungnya benar dan sesuai aslinya, dan bersedia menanggung akibat
      hukum apabila terdapat ketidaksesuaian.</p>
    ${agreeCheck('Saya setuju', false)}
    <p id="pernyataan-error" class="text-sm font-semibold text-error"
      aria-live="polite" hidden></p>
    <div class="flex justify-end gap-2.5">
      <form method="dialog"><button class="${BTN_OUTLINE}">Batal</button>
      </form>
      <button type="button" class="${BTN}" data-action="chg-submit"
        data-requires-agree disabled data-testid="perubahan-btn-ajukan">
        Ajukan</button></div></div>`;
}

function batalDialog(cd) {
  return html`<form id="batal-form" novalidate class="grid gap-3.5 px-6 py-7
      md:px-8">
    <h2 class="text-[19px] font-bold">Batalkan pengajuan perubahan?</h2>
    <p class="text-sm text-base-content/70">Permohonan ${cd.barcode} akan
      dibatalkan dan tidak dapat diajukan kembali.</p>
    ${textareaField({ id: 'batal-alasan', label: 'Alasan pembatalan',
      rows: 4, max: CANCEL_MAX, placeholder: 'Tuliskan alasan pembatalan' })}
    <div class="flex justify-end gap-2.5">
      <button type="button" class="${BTN_OUTLINE}"
        data-action="close-modal">Kembali</button>
      <button type="submit" class="btn btn-error"
        data-testid="perubahan-btn-batalkan">Batalkan pengajuan</button></div>
  </form>`;
}

async function runMutation(el, fn, onError) {
  el.disabled = true;
  el.setAttribute('aria-busy', 'true');
  try {
    await fn();
    await reloadCollection('perubahan');
    return true;
  } catch (error) {
    el.disabled = false;
    el.removeAttribute('aria-busy');
    onError(error);
    return false;
  }
}

/** Submit handler for the cancel form (bound once in main). */
export async function submitBatal(form) {
  const cd = currentPerubahan();
  const alasan = qs('#batal-alasan', form).value;
  const result = validateCancelPerubahan({ role: state.role, alasan });
  const errors = result.valid ? {} : { 'batal-alasan': result.errors.alasan };
  if (!alasan.trim()) {
    errors['batal-alasan'] = 'Alasan pembatalan wajib diisi.';
  }
  if (showErrors(form, errors)) {
    return;
  }
  const button = qs('[type="submit"]', form);
  const ok = await runMutation(button,
    () => cancelPerubahan(cd.id, { role: state.role, alasan: alasan.trim() }),
    (error) => showErrors(form, { 'batal-alasan': error.message }));
  if (ok) {
    closeDialog(MODAL);
    toast(`Permohonan ${cd.barcode} dibatalkan.`);
    refreshView();
  }
}

/** Activate a tab and keep keyboard focus on it after the re-render. */
function selectTab(index) {
  setUi({ chgTab: index });
  qs(`#chg-tab-${index}`)?.focus();
}

/** WAI-ARIA tabs: Left/Right (wrapping), Home/End move between tabs. */
function onTabKeydown(event) {
  const tab = event.target.closest?.('[data-action="chg-tab"]');
  if (!tab) {
    return;
  }
  const current = Number(tab.dataset.tab);
  const last = TABS.length - 1;
  const next = {
    ArrowRight: current === last ? 0 : current + 1,
    ArrowLeft: current === 0 ? last : current - 1,
    Home: 0,
    End: last,
  }[event.key];
  if (next === undefined) {
    return;
  }
  event.preventDefault();
  selectTab(next);
}

document.addEventListener('keydown', onTabKeydown);

export const actions = {
  /** AK-24: ajukan kembali pengajuan yang ditolak Verifikator. */
  async 'chg-resubmit'(el) {
    el.disabled = true;
    try {
      await resubmitPengajuan('perubahan', `${state.role}.${el.dataset.id}`);
      await reloadCollection('perubahan');
      toast('Pengajuan perubahan diajukan kembali ke Verifikator.');
    } catch (error) {
      el.disabled = false;
      toast(error.message, 'error');
    }
    refreshView();
  },
  'chg-tab'(el) {
    selectTab(Number(el.dataset.tab));
  },
  /**
   * "Preview Dokumen" (revisi akun pemberi kerja, poin 6) — BELUM ada
   * contoh dokumen resmi (SK Perubahan) untuk dibandingkan, jadi
   * ringkasan data, bukan dokumen sah (lihat `openRingkasanDoc`).
   */
  'chg-preview-doc'() {
    const cd = currentPerubahan();
    openRingkasanDoc(`Perubahan RPTKA — ${cd.jenis}`, [
      ['Nomor RPTKA', cd.skNo], ['Nama TKA', cd.nama],
      ['Paspor', cd.paspor], ['Jabatan', cd.jabatan],
      ['Jenis perubahan', `${cd.jenis} (${cd.detail})`],
      ['Semula', cd.semula], ['Menjadi', cd.menjadi],
      ['No. surat permohonan', cd.surat],
      ['Tanggal surat permohonan', cd.suratTgl],
      ['Keterangan', cd.keterangan || '—'],
      ['Status', cd.status],
    ]);
  },
  async 'chg-upload'(el) {
    const cd = currentPerubahan();
    const nama = el.dataset.nama;
    const ok = await runMutation(el, () => uploadPerubahanDocument(cd.id, {
      role: state.role, nama, fileName: `${slug(nama)}.pdf`,
    }), (error) => toast(error.message, 'error'));
    if (ok) {
      toast(`${nama} diterima sistem.`);
      refreshView();
    }
  },
  'chg-open-pernyataan'() {
    state.ui.agree = false;
    openDialog(MODAL, pernyataanDialog(currentPerubahan()), 'max-w-xl');
  },
  'chg-open-batal'() {
    openDialog(MODAL, batalDialog(currentPerubahan()), 'max-w-lg');
  },
  async 'chg-submit'(el) {
    if (!state.ui.agree) {
      return;
    }
    const cd = currentPerubahan();
    const ok = await runMutation(el, () => submitPerubahan(cd.id,
      { role: state.role, agree: true }), (error) => {
      const slot = qs('#pernyataan-error');
      slot.textContent = error.message;
      slot.hidden = false;
    });
    if (ok) {
      closeDialog(MODAL);
      toast(`Permohonan ${cd.barcode} diajukan.`);
      setUi({ chgTab: 3 });
    }
  },
};
