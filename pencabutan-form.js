/**
 * @fileoverview Form Pencabutan RPTKA per TKA (lembar kebutuhan Pencabutan):
 * pilih jenis pencabutan (a–f) di kartu atas, tab Data Isian (nomor RPTKA
 * terbit + filter cari, identitas pemberi kerja, identitas TKA, alasan),
 * Unggah Dokumen, Preview; Simpan Draft atau Submit -> Verifikator
 * ("Menunggu Verifikasi"). Sesi kerja: pencabutan-data.js.
 */

import { createPencabutan, updatePencabutan } from '../../api/pencabutan.js';
import { simpanBerkas } from '../../components/berkas-store.js';
import { bukaPratinjau } from '../../components/doc-preview.js';
import { html, qs, qsa, setHtml } from '../../components/dom.js';
import {
  PENCABUTAN_FILE, PENCABUTAN_JENIS, pencabutanDokumen,
  validatePencabutanSubmit,
} from '../../contracts/pengajuan-verifikasi.js';
import { validateRptkaFile } from '../../contracts/pengesahan-rptka.js';
import { reloadCollection } from './data.js';
import { openRingkasanDoc } from './documents.js';
import {
  TABS, barcodeTerblokir, cabut, editable, tkaOf, toBody,
} from './pencabutan-data.js';
import { panelPreview, ringkasanRows } from './pencabutan-preview.js';
import { adaRelasi, relasiTka } from './rptka-data.js';
import { go, refreshView, state } from './state.js';
import {
  BTN, BTN_OUTLINE, CALLOUT_INFO, CARD, LINK, fieldError, navAttrs,
  pageTitle, riwayatTerkaitRingkas, showErrors, textareaField, toast,
} from './ui.js';

const ID = { barcode: 'cabut-rptka', jenis: 'cabut-jenis',
  alasan: 'cabut-alasan', dokumen: 'cabut-dokumen' };
const LABEL_JENIS = 'abcdef';
const sizeKb = (file) => Math.max(1, Math.ceil(file.size / 1024));

function jenisCard(S) {
  const ro = !editable(S);
  return html`<fieldset id="cabut-jenis" tabindex="-1" ${ro ? 'disabled' : ''}
      class="${CARD} grid gap-2.5 px-5 py-5 md:grid-cols-3"
      aria-describedby="cabut-jenis-error">
    <legend class="sr-only">Jenis pencabutan</legend>
    <h2 class="text-[15px] font-bold md:col-span-3">Jenis pencabutan</h2>
    ${PENCABUTAN_JENIS.map((jenis, i) => html`<label class="flex cursor-pointer
      items-center gap-2.5 rounded-field border-2 border-base-content/20
      px-3.5 py-3 text-sm font-semibold has-checked:border-secondary
      has-checked:bg-info/10"><input type="radio" name="cabut-jenis"
      value="${jenis}" class="radio radio-secondary radio-sm" data-cabut-jenis
      ${S.w.jenis === jenis ? 'checked' : ''}><span><span
      class="me-1.5 text-base-content/60">${LABEL_JENIS[i]}.</span>${jenis}
      </span></label>`)}
    <div class="md:col-span-3">${fieldError('cabut-jenis')}</div></fieldset>`;
}

function tabBar(S) {
  return html`<div role="tablist" aria-label="Form Pencabutan RPTKA"
      class="tabs tabs-border overflow-x-auto">${TABS.map((t) => html`<button
    type="button" role="tab" id="cabut-tab-${t.key}"
    aria-selected="${S.tab === t.key}" aria-controls="cabut-panel"
    tabindex="${S.tab === t.key ? 0 : -1}"
    class="tab whitespace-nowrap ${S.tab === t.key ? 'tab-active' : ''}"
    data-action="cabut-tab" data-tab="${t.key}">${t.label}</button>`)}</div>`;
}

/** Opsi Nomor RPTKA terbit, disaring `cari`; yang sudah dicabut dinonaktifkan. */
export function opsiRptka(S) {
  const q = S.cari.trim().toLowerCase();
  const blok = barcodeTerblokir(S.w.id);
  const cocok = (t) => t.barcode === S.w.barcode || !q ||
    [t.skNo, t.nama, t.paspor, t.barcode].some((v) => String(v ?? '')
      .toLowerCase().includes(q));
  const rows = state.data.tka.filter(cocok);
  return html`<option value="">${rows.length ? 'Pilih Nomor RPTKA…'
    : 'Tidak ada Nomor RPTKA yang cocok'}</option>${rows.map((t) => html`
    <option value="${t.barcode}" ${t.barcode === S.w.barcode ? 'selected' : ''}
    ${blok.has(t.barcode) ? 'disabled' : ''}>${t.skNo} · ${t.nama}
    (${t.jabatan})${blok.has(t.barcode) ? ' — sudah ada pencabutan' : ''}
    </option>`)}`;
}

/** Identitas TKA (satu kolom per TKA terpilih) + Riwayat Terkait. */
export function blokTka(S) {
  const t = tkaOf(S.w.barcode);
  if (!t) {
    return html`<p class="text-[13px] text-base-content/60">Pilih Nomor RPTKA
      untuk menampilkan identitas TKA.</p>`;
  }
  const relasi = relasiTka(t, S.w.id);
  relasi.pencabutan = relasi.pencabutan.filter((x) => x.id !== S.w.id);
  const rows = [['Nama TKA', t.nama], ['Kebangsaan', t.negara],
    ['Nomor paspor', t.paspor], ['Jabatan', t.jabatan],
    ['Nomor RPTKA', t.skNo], ['Masa berlaku', `${t.mulai} s.d. ${t.akhir}`],
    ['Lokasi kerja', t.lokasi]];
  return html`<article class="rounded-field bg-base-200/50 px-4 py-3.5">
      <dl class="grid gap-x-5 gap-y-1.5 text-[13px] md:grid-cols-[170px_1fr]">
        ${rows.map(([k, v]) => html`<dt class="text-base-content/70">${k}</dt>
        <dd class="font-semibold">${v ?? '—'}</dd>`)}</dl></article>
    ${adaRelasi(relasi) ? riwayatTerkaitRingkas(relasi) : ''}`;
}

function pemberiKerja() {
  const c = state.data.company;
  const alamat = [c.jalan, c.kel, c.kec, c.kab, c.prov, c.kodepos]
    .filter((v) => v && v !== '—').join(', ');
  return html`<dl class="grid gap-x-5 gap-y-1.5 rounded-field bg-base-200/50
      px-4 py-3.5 text-[13px] md:grid-cols-[170px_1fr]">
    ${[['Nama pemberi kerja', c.nama], ['NPWP', c.npwp], ['NIB', c.nib],
    ['Alamat', alamat], ['Email', c.email], ['Telepon', c.telp]]
    .map(([k, v]) => html`<dt class="text-base-content/70">${k}</dt>
      <dd class="font-semibold">${v ?? '—'}</dd>`)}</dl>`;
}

function panelData(S) {
  return html`<section class="grid gap-2.5">
      <h3 class="text-sm font-bold">Nomor Pengesahan RPTKA yang dicabut</h3>
      <div class="grid gap-1.5"><label for="cabut-cari"
        class="text-[13px] font-semibold">Cari Nomor RPTKA yang sudah
        diterbitkan</label>
        <input id="cabut-cari" type="search" class="input h-11 w-full"
          value="${S.cari}" placeholder="Nomor RPTKA, nama TKA, atau paspor"
          autocomplete="off"></div>
      <div class="grid gap-1.5"><label for="cabut-rptka"
        class="text-[13px] font-semibold">Nomor RPTKA</label>
        <select id="cabut-rptka" class="select h-11 w-full"
          aria-describedby="cabut-rptka-error"
          data-testid="pencabutan-select-rptka">${opsiRptka(S)}</select>
        ${fieldError('cabut-rptka')}</div></section>
    <section class="grid gap-2.5"><h3 class="text-sm font-bold">Identitas
      pemberi kerja</h3>${pemberiKerja()}</section>
    <section class="grid gap-2.5"><h3 class="text-sm font-bold">Identitas TKA
      </h3><div id="cabut-tka" aria-live="polite">${blokTka(S)}</div></section>
    ${textareaField({ id: 'cabut-alasan', label: 'Alasan pencabutan ' +
      'Pengesahan RPTKA', value: S.w.alasan, rows: 4, max: 500, min: 10,
    placeholder: 'Jelaskan alasan pencabutan (min. 10 karakter)' })}`;
}

function dokRow(S, nama, i) {
  const d = S.w.dokumen[nama];
  const id = `cabut-dok-${i}`;
  return html`<li class="grid gap-2.5 rounded-box border border-base-300 px-4
      py-3 md:grid-cols-[minmax(180px,1fr)_minmax(220px,auto)] md:items-center">
    <div><p class="text-sm font-semibold">${nama}</p>
      <p class="text-xs ${d ? 'text-success' : 'text-base-content/60'}">${d
    ? html`✓ ${d.namaBerkas} · ${d.ukuranKb} KB` : 'Belum diunggah'}</p>
      <p id="${id}-error" class="text-xs font-semibold text-error"
        aria-live="polite" hidden></p></div>
    <div class="flex flex-wrap items-center gap-2">
      <input id="${id}" type="file" class="file-input file-input-sm w-full
        md:w-56" accept=".pdf,.jpg,.jpeg,.png" data-cabut-file="${nama}"
        aria-label="${d ? 'Ganti' : 'Unggah'} ${nama}"
        aria-describedby="${id}-error">
      ${d ? html`<button type="button" class="btn btn-sm btn-outline"
        data-action="cabut-preview-dok" data-dok="${nama}">Pratinjau
        </button>` : ''}</div></li>`;
}

function panelDokumen(S) {
  if (!S.w.jenis) {
    return html`<p class="${CALLOUT_INFO}">Pilih jenis pencabutan terlebih
      dahulu; daftar dokumen mengikuti jenis yang dipilih.</p>`;
  }
  return html`<p class="text-[13px] text-base-content/70">Format PDF maks.
      2 MB; JPG/JPEG/PNG maks. 150 KB. Dokumen mengikuti jenis
      <b>${S.w.jenis}</b> [usulan; lembar kebutuhan merujuk Probis
      Perpanjangan RPTKA].</p>
    <ul id="cabut-dokumen" tabindex="-1" class="grid gap-2.5"
      aria-describedby="cabut-dokumen-error">${pencabutanDokumen(S.w.jenis)
    .map((nama, i) => dokRow(S, nama, i))}</ul>${fieldError('cabut-dokumen')}`;
}

function footer(S) {
  const first = S.tab === TABS[0].key;
  const last = S.tab === 'preview';
  return html`<div class="flex flex-wrap items-center justify-between gap-2.5
      border-t border-base-200 pt-3">
    <button type="button" class="${BTN_OUTLINE}" data-action="cabut-prev"
      ${first ? 'disabled' : ''}>← Sebelumnya</button>
    <div class="flex flex-wrap gap-2.5"><button type="button"
      class="${BTN_OUTLINE}" data-action="cabut-save" data-cabut-busy
      data-testid="pencabutan-btn-simpan">Simpan Draft</button>
      ${last ? html`<button type="button" class="${BTN}"
        data-action="cabut-submit" data-cabut-busy
        data-testid="pencabutan-btn-submit">Submit Pengajuan</button>`
    : html`<button type="button" class="${BTN}" data-action="cabut-next"
        data-testid="pencabutan-btn-lanjut">Lanjut →</button>`}</div></div>
    <p id="cabut-form-error" role="alert" class="text-sm font-semibold
      text-error" hidden></p>
    <p class="text-xs text-base-content/70">Draft dapat disimpan kapan saja
      dan dilanjutkan dari daftar. Setelah disubmit, permohonan dikirim ke
      Verifikator dengan status Menunggu Verifikasi dan tidak dapat diubah.</p>`;
}

/** Halaman form (baru / Draf / lihat). */
export function renderForm() {
  const S = cabut();
  const back = html`<button type="button" class="${LINK} text-sm"
    ${navAttrs('pencabutan', {})}>← Daftar Pencabutan</button>`;
  const title = pageTitle({ back, title: S.w.noPermohonan
    ? `Pencabutan ${S.w.noPermohonan}` : 'Ajukan Pencabutan RPTKA per TKA',
  desc: 'Pilih jenis pencabutan, lengkapi data isian dan dokumen, lalu ' +
    'submit ke Verifikator atau simpan sebagai draft.' });
  if (!editable(S)) {
    return html`${title}${panelPreview(S)}`;
  }
  const body = { data: panelData, dokumen: panelDokumen,
    preview: panelPreview }[S.tab](S);
  return html`${title}${jenisCard(S)}<section class="${CARD} grid gap-4 px-5
      py-5 md:px-7" aria-label="Form Pencabutan RPTKA">${tabBar(S)}
    <div id="cabut-panel" role="tabpanel" aria-labelledby="cabut-tab-${S.tab}"
      class="grid gap-4">${body}</div>${footer(S)}</section>`;
}

/** Hapus pesan error satu field saat diedit. */
function clearError(S, root, id) {
  delete S.errors[id];
  const slot = qs(`#${id}-error`, root);
  if (slot) {
    slot.hidden = true;
    slot.textContent = '';
  }
  qs(`#${id}`, root)?.removeAttribute('aria-invalid');
}

async function pickFile(S, input, root) {
  const file = input.files?.[0];
  if (!file) {
    return;
  }
  const problem = validateRptkaFile({ namaBerkas: file.name,
    ukuranKb: sizeKb(file) }, { maxKb: PENCABUTAN_FILE.pdfKb,
    gambarKb: PENCABUTAN_FILE.gambarKb });
  if (problem) {
    input.value = '';
    showErrors(root, { [input.id]: problem });
    return;
  }
  const berkasId = await simpanBerkas(file);
  S.w.dokumen[input.dataset.cabutFile] = { namaBerkas: file.name,
    ukuranKb: sizeKb(file), berkasId };
  delete S.errors[ID.dokumen];
  toast(`${input.dataset.cabutFile}: berkas diunggah.`);
  refreshView(input.id);
}

/** Pasang listener isian pada wrapper view (mati bersama wrapper). */
export function mountForm(root) {
  const S = cabut();
  if (!editable(S)) {
    return;
  }
  if (Object.keys(S.errors).length) {
    showErrors(root, S.errors);
  }
  root.addEventListener('input', (event) => {
    const el = event.target;
    if (el.id === 'cabut-alasan') {
      S.w.alasan = el.value;
      clearError(S, root, ID.alasan);
    } else if (el.id === 'cabut-cari') {
      S.cari = el.value;
      setHtml(qs('#cabut-rptka', root), opsiRptka(S));
    }
  });
  root.addEventListener('change', (event) => {
    const el = event.target;
    if (el.id === 'cabut-rptka') {
      S.w.barcode = el.value;
      clearError(S, root, ID.barcode);
      setHtml(qs('#cabut-tka', root), blokTka(S));
    } else if (el.matches('[data-cabut-jenis]')) {
      S.w.jenis = el.value;
      clearError(S, root, ID.jenis);
    } else if (el.matches('[data-cabut-file]')) {
      pickFile(S, el, root);
    }
  });
}

function busy(on) {
  for (const b of qsa('[data-cabut-busy]')) {
    b.disabled = on;
    b.setAttribute('aria-busy', String(on));
  }
}

/** Petakan error kontrak ke id field, buka tab yang memuat error pertama. */
function tampilkanError(S, fields) {
  S.errors = {};
  for (const [key, message] of Object.entries(fields)) {
    S.errors[ID[key] ?? 'cabut-form'] = message;
  }
  const diData = ['barcode', 'jenis', 'alasan'].some((k) => fields[k]);
  if (diData) {
    S.tab = 'data';
  } else if (fields.dokumen) {
    S.tab = 'dokumen';
  }
  refreshView();
}

async function kirim(S, draft) {
  const body = toBody(S, draft);
  const check = validatePencabutanSubmit(body);
  if (!check.valid) {
    tampilkanError(S, check.errors);
    return;
  }
  busy(true);
  try {
    const row = S.w.id ? await updatePencabutan(S.w.id, body)
      : await createPencabutan(body);
    await reloadCollection('pencabutan');
    toast(draft ? `Draft ${row.noPermohonan} disimpan.`
      : `Pencabutan ${row.noPermohonan} diajukan ke Verifikator.`);
    go('pencabutan', {});
  } catch (error) {
    busy(false);
    tampilkanError(S, error.fields ?? { form: error.message });
  }
}

function geser(delta) {
  const S = cabut();
  const i = TABS.findIndex((t) => t.key === S.tab) + delta;
  S.tab = TABS[Math.min(TABS.length - 1, Math.max(0, i))].key;
  refreshView();
}

export const formActions = {
  'cabut-tab'(el) {
    cabut().tab = el.dataset.tab;
    refreshView(`cabut-tab-${el.dataset.tab}`);
  },
  'cabut-prev': () => geser(-1),
  'cabut-next': () => geser(1),
  'cabut-save'() {
    kirim(cabut(), true);
  },
  'cabut-submit'() {
    kirim(cabut(), false);
  },
  'cabut-preview-dok'(el) {
    const d = cabut().w.dokumen[el.dataset.dok];
    bukaPratinjau({ judul: el.dataset.dok, namaBerkas: d.namaBerkas,
      ukuranKb: d.ukuranKb, berkasId: d.berkasId ?? null });
  },
  'cabut-preview-ringkasan'() {
    openRingkasanDoc('Pencabutan RPTKA', ringkasanRows(cabut()));
  },
};
