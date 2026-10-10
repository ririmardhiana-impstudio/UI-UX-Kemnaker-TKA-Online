/**
 * @fileoverview Pembayaran DKPTKA (legacy "pembayaran"): active bills with
 * "Proses lagi" (POST /billing/{id}/reissue, only Kedaluwarsa — DK-03),
 * payment history (paged) and side info cards. Groups B/C are exempt.
 */

import { confirmBayar, reissueBilling } from '../../api/billing.js';
import { simpanBerkas } from '../../components/berkas-store.js';
import { html, qs } from '../../components/dom.js';
import { pratinjauAttrs } from '../../components/doc-preview.js';
import { statusBadge } from '../../components/status-badge.js';
import { validateRptkaFile } from '../../contracts/pengesahan-rptka.js';
import { reloadCollection } from './data.js';
import { rupiah } from './format.js';
import { confirmDialog } from './rptka-confirm.js';
import { refreshView, state } from './state.js';
import {
  BTN, BTN_OUTLINE, CARD, LINK, THEAD, cardHeader, closeDialog, emptyText,
  mountPaged, openDialog, pageTitle, pagerSlot, toast,
} from './ui.js';

const SMALL_BTN = 'btn btn-sm h-auto min-h-8 py-1.5 text-xs font-bold';
const MODAL = 'portal-modal';
/** PDF/JPG, maks 2 MB — bukti pembayaran bank daerah (SKRD). */
const BUKTI_BAYAR_RULE = { maxKb: 2048 };
const sizeKb = (file) => Math.max(1, Math.ceil(file.size / 1024));

function activeRow(b) {
  const actions = [];
  if (b.status === 'Kedaluwarsa') {
    actions.push(html`<button type="button" class="${SMALL_BTN} btn-error"
      data-action="reissue-billing" data-id="${b.id}"
      data-testid="billing-btn-proses-lagi">Proses lagi</button>`);
  }
  if (b.status === 'Belum dibayar') {
    actions.push(html`<button type="button" class="${SMALL_BTN} btn-primary"
      data-action="open-billing" data-id="${b.id}">Lihat surat tagihan
      </button>`);
  }
  if (b.status === 'Belum dibayar') {
    actions.push(html`<button type="button"
      class="${SMALL_BTN} ${BTN_OUTLINE}" data-action="confirm-bayar-open"
      data-id="${b.id}" data-testid="billing-btn-konfirmasi-bayar">
      Konfirmasi Sudah Bayar</button>`);
  }
  return html`<li class="grid min-w-[900px] items-center gap-3.5 border-t
      border-base-200 px-5 py-4 text-[13px]
      grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_110px_130px_170px]">
    <div><b class="text-sm">${b.tka}</b><p class="text-xs
      text-base-content/60">${b.jabatan} · ${b.bulan} bulan</p></div>
    <div><p class="font-mono font-bold">${b.kode}</p><p class="text-xs
      text-base-content/60">terbit ${b.terbit} · batas ${b.batas}</p></div>
    <b class="text-[15px]">${rupiah(b.rupiah)}</b>
    <div>${statusBadge(b.status, b.tone)}</div>
    <div class="flex justify-end gap-1.5">${actions}</div></li>`;
}

function paidRow(b) {
  return html`<tr>
    <td><b>${b.tka}</b><p class="text-xs text-base-content/60">${b.jabatan}
      </p></td>
    <td class="font-mono text-xs">${b.kode}</td>
    <td class="font-bold">${rupiah(b.rupiah)}</td>
    <td>${b.bayar}<p class="text-xs text-base-content/60">${b.bank}</p></td>
    <td class="text-right"><div class="flex justify-end gap-3">
      ${b.buktiBayar ? html`<button type="button" class="${LINK} text-xs"
        ${pratinjauAttrs({ judul: 'Bukti pembayaran (bank daerah)',
      namaBerkas: b.buktiBayar.namaBerkas, ukuranKb: b.buktiBayar.ukuranKb,
      berkasId: b.buktiBayar.berkasId ?? null })}>Bukti pembayaran</button>`
    : ''}
      <button type="button" class="${LINK} text-xs"
        data-action="open-billing" data-id="${b.id}">Surat tagihan</button>
    </div></td>
  </tr>`;
}

function exemptCard() {
  const co = state.data.company;
  return html`<div class="rounded-box border border-dashed
      border-base-content/20 bg-base-100 p-12 text-center">
    <p class="mb-1.5 text-[17px] font-extrabold">${co.nama} dibebaskan dari
      DKPTKA</p>
    <p class="text-sm text-base-content/70">Kategori ${co.kategori} (Kelompok
      ${co.grup}) tidak dikenakan dana kompensasi.</p></div>`;
}

function billingBody() {
  const bills = state.data.billing;
  const active = bills.filter((b) => b.status !== 'Lunas');
  const reissued = state.extra.reissued;
  return html`<div class="grid grid-cols-1 gap-5">
    <div class="grid grid-cols-1 gap-5">
      <section class="${CARD} overflow-hidden">
        ${cardHeader('Tagihan aktif')}
        <div class="overflow-x-auto"><ul>${active.map(activeRow)}</ul></div>
        ${active.length ? '' : emptyText('Tidak ada tagihan aktif.')}
        ${reissued ? html`<p role="status" class="mx-5 mb-4 rounded-field
          bg-success/10 px-3.5 py-3 text-[13px] font-semibold text-success">
          Kode billing baru untuk ${reissued} telah diterbitkan. Kode
          lama tidak berlaku.</p>` : ''}</section>
      <section class="${CARD} overflow-hidden">
        ${cardHeader('Riwayat pembayaran')}
        <div class="overflow-x-auto"><table class="table min-w-[900px]
            text-[13px]"><thead><tr class="${THEAD}"><th>TKA</th>
            <th>Kode billing</th><th class="w-[110px]">Jumlah</th>
            <th class="w-[150px]">Dibayar</th>
            <th class="w-[120px]"><span class="sr-only">Aksi</span></th>
          </tr></thead><tbody id="bill-body"></tbody></table></div>
        ${pagerSlot('bill-pager')}</section></div>
    <aside class="grid gap-3.5 lg:grid-cols-3"
        aria-label="Informasi pembayaran">
      <div class="rounded-box bg-primary p-5.5 text-primary-content">
        <p class="text-xs font-bold tracking-wider text-info-bright">CARA
          MEMBAYAR</p>
        <ol class="mt-3 list-decimal ps-4.5 text-[13px] leading-7
            text-primary-content/80">
          <li>Periksa data TKA pada surat tagihan.</li>
          <li>Bayar di bank persepsi (BNI, Mandiri, BRI) dengan menunjukkan
            kode billing.</li>
          <li>Klik <b>Konfirmasi Sudah Bayar</b>; SK Pengesahan otomatis
            disetujui Direktur dan terbit setelah Direktur menandatangani
            TTE.</li></ol></div>
      <p class="rounded-box border border-warning/30 bg-warning/10 p-4.5
        text-[13px] leading-relaxed text-base-content/80"><b>Data TKA salah
        di surat tagihan?</b> Koreksi melalui Hotline <b>sebelum</b> membayar.
        Pembayaran atas data yang salah menjadi tanggung jawab pemberi kerja.
      </p>
      <p class="${CARD} p-4.5 text-[13px] leading-relaxed
        text-base-content/80"><b>Kode billing kedaluwarsa?</b> Setelah sistem
        mengirim notifikasi kedaluwarsa, klik <b>Proses lagi</b> untuk
        menerbitkan kode baru.</p></aside></div>`;
}

/**
 * Dialog Konfirmasi Sudah Bayar khusus tagihan SKRD (`b.jenis === 'SKRD'`):
 * retribusi daerah dibayar lewat bank daerah (bukan bank persepsi seperti
 * DKPTKA), jadi pemberi kerja WAJIB mengunggah bukti pembayarannya di sini —
 * bukti itu diteruskan ke Disnaker setempat (`routes/skrd-disnaker.js`
 * `view`, panel SKRD di akun Disnaker) sekaligus tampil di sini dan di
 * kartu "Dokumen Administrasi" (`rptka-panels.js` `billingPanel`).
 */
function skrdBayarDialog(b) {
  openDialog(MODAL, html`<div class="grid gap-3.5 px-6 py-6">
    <h2 class="text-base font-bold">Konfirmasi Sudah Bayar SKRD</h2>
    <p class="text-sm text-base-content/80">Tandai SKRD kode <b>${b.kode}
      </b> (${rupiah(b.rupiah)}) untuk <b>${b.tka}</b> sebagai sudah
      dibayar. Unggah bukti pembayaran dari bank daerah (Kas Daerah) —
      bukti ini akan diteruskan ke Dinas Ketenagakerjaan setempat.</p>
    <div class="grid gap-1.5">
      <label for="skrd-bukti-bayar" class="text-sm font-bold">Bukti
        pembayaran (bank daerah)</label>
      <input type="file" id="skrd-bukti-bayar" accept=".pdf,.jpg,.jpeg"
        class="file-input w-full" aria-describedby="skrd-bukti-bayar-error"
        data-testid="billing-input-bukti-bayar" />
      <p class="text-xs text-base-content/60">PDF atau JPG, maks. 2 MB.</p>
      <p id="skrd-bukti-bayar-error" role="alert" class="text-xs
        font-semibold text-error" hidden></p>
    </div>
    <div class="flex justify-end gap-2.5"><button type="button"
      class="${BTN_OUTLINE}" data-action="close-modal">Batal</button>
      <button type="button" class="${BTN}" data-action="confirm-bayar-skrd-ok"
        data-id="${b.id}" data-testid="billing-btn-konfirmasi-bayar-ok">
        Ya, Sudah Dibayar</button></div></div>`, 'max-w-md');
}

/** pembayaran view. */
export function render() {
  const co = state.data.company;
  return html`${pageTitle({ title: 'Pembayaran DKPTKA',
    desc: 'Rp1.500.000 per jabatan per orang per bulan, dibayar di muka untuk seluruh jangka waktu. Kurang dari 1 bulan dihitung 1 bulan penuh. Kode billing berlaku 5 hari kerja.' })}
    ${co.dk ? billingBody() : exemptCard()}`;
}

/** @param {!Element} root */
export function mount(root) {
  if (!state.data.company.dk) {
    return;
  }
  mountPaged(root, {
    body: '#bill-body', footer: '#bill-pager',
    items: state.data.billing.filter((b) => b.status === 'Lunas'),
    row: paidRow,
  });
}

export const actions = {
  async 'reissue-billing'(el) {
    el.disabled = true;
    el.setAttribute('aria-busy', 'true');
    try {
      const bill = await reissueBilling(state.role, el.dataset.id);
      state.extra.reissued = bill.tka;
      await reloadCollection('billing');
      refreshView();
    } catch (error) {
      el.disabled = false;
      el.removeAttribute('aria-busy');
      toast(error.message || 'Gagal menerbitkan ulang kode billing.',
        'error');
    }
  },
  'confirm-bayar-open'(el) {
    const b = state.data.billing.find((x) => x.id === el.dataset.id);
    if (!b) {
      return;
    }
    if (b.jenis === 'SKRD') {
      skrdBayarDialog(b);
      return;
    }
    confirmDialog({ judul: 'Konfirmasi Sudah Bayar',
      isi: `Tandai tagihan kode ${b.kode} (${rupiah(b.rupiah)}) untuk ` +
        `${b.tka} sebagai sudah dibayar? SK Pengesahan RPTKA ` +
        'akan otomatis disetujui Direktur dan terbit setelah Direktur ' +
        'menandatangani TTE.',
      ok: 'Ya, Sudah Dibayar', action: 'confirm-bayar-ok', data: { id: b.id },
      testid: 'billing-btn-konfirmasi-bayar-ok' });
  },
  async 'confirm-bayar-skrd-ok'(el) {
    const input = qs('#skrd-bukti-bayar');
    const file = input.files?.[0];
    const errorSlot = qs('#skrd-bukti-bayar-error');
    if (!file) {
      errorSlot.textContent = 'Unggah bukti pembayaran terlebih dahulu.';
      errorSlot.hidden = false;
      input.setAttribute('aria-invalid', 'true');
      return;
    }
    const problem = validateRptkaFile({ namaBerkas: file.name,
      ukuranKb: sizeKb(file) }, BUKTI_BAYAR_RULE);
    if (problem) {
      errorSlot.textContent = problem;
      errorSlot.hidden = false;
      input.setAttribute('aria-invalid', 'true');
      return;
    }
    errorSlot.hidden = true;
    input.removeAttribute('aria-invalid');
    el.disabled = true;
    el.setAttribute('aria-busy', 'true');
    try {
      const berkasId = await simpanBerkas(file);
      const buktiBayar = { namaBerkas: file.name, ukuranKb: sizeKb(file),
        ...(berkasId ? { berkasId } : {}) };
      await confirmBayar(state.role, el.dataset.id, buktiBayar);
      closeDialog(MODAL);
      await Promise.all([
        reloadCollection('billing'), reloadCollection('pengesahan'),
      ]);
      refreshView();
      toast('Bukti pembayaran tersimpan dan diteruskan ke Dinas ' +
        'Ketenagakerjaan setempat.', 'success');
    } catch (error) {
      el.disabled = false;
      el.removeAttribute('aria-busy');
      toast(error.message || 'Gagal menyimpan konfirmasi.', 'error');
    }
  },
  async 'confirm-bayar-ok'(el) {
    el.disabled = true;
    el.setAttribute('aria-busy', 'true');
    try {
      await confirmBayar(state.role, el.dataset.id);
      closeDialog(MODAL);
      await Promise.all([
        reloadCollection('billing'), reloadCollection('pengesahan'),
      ]);
      refreshView();
      toast('Konfirmasi pembayaran tersimpan.', 'success');
    } catch (error) {
      el.disabled = false;
      el.removeAttribute('aria-busy');
      toast(error.message || 'Gagal menyimpan konfirmasi.', 'error');
    }
  },
};
