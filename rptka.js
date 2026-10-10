/**
 * @fileoverview Form RPTKA (page key "rptka"): pilih Nomor HPK aktif ->
 * tab Jenis RPTKA, Jabatan TKA, Unggah Dokumen, Data TKA, Preview ->
 * Simpan Draft atau Submit (Menunggu Verifikasi). Sumber: lembar kebutuhan
 * "Form RPTKA" + uploads/Pengesahan RPTKA.txt (11 jenis). RP-01..RP-12.
 */

import { ApiError } from '../../api/http.js';
import {
  createRptka, submitRptka, updateRptka,
} from '../../api/pengesahan-rptka.js';
import { html, qs, qsa, setHtml } from '../../components/dom.js';
import {
  RPTKA_STATUS, butuhHpk, jenisDef, validateRptkaDraft, validateRptkaSubmit,
} from '../../contracts/pengesahan-rptka.js';
import { reloadCollection } from './data.js';
import { renderData, renderDokumen } from './rptka-docs-view.js';
import {
  MODAL, PAGE, TABS, cache, hpkOf, invalidate, isPerpanjangan, jenisOf,
  listTarget, payload,
  pruneDokumen, rptkaTerbitPilihan, session, syncTka,
} from './rptka-data.js';
import { confirmDialog } from './rptka-confirm.js';
import { applyErrors, errorId } from './rptka-errors.js';
import { confirmDeleteJabatan, saveJabatan } from './rptka-jabatan.js';
import { HEADER, STEP_LABEL, blocker, groupErrors, tabOfError } from './rptka-gate.js';
import { footer, syncTabs, tabBar } from './rptka-nav.js';
import { revisiActions, revisiBanner } from './rptka-revisi.js';
import {
  hpkSummary, previewDokumen, renderDetailBody, renderDetailTop, renderHeader,
  renderJabatan, renderPreview, riwayatCard,
} from './rptka-panels.js';
import { pickDocument, previewDialog } from './rptka-upload.js';
import { go, state } from './state.js';
import {
  CARD, LINK, closeDialog, navAttrs, pageTitle, showErrors,
  toast,
} from './ui.js';

export { load } from './rptka-data.js';
const isRo = (S) => S.w.status !== RPTKA_STATUS.DRAF && !S.w.perluRevisi;
const tabIndex = (S) => TABS.findIndex((t) => t.key === S.tab);

function backLink(S) {
  const attrs = navAttrs(...listTarget(S.w.jenis ?? state.p.jenis));
  return html`<button type="button" class="${LINK} text-[13px]" ${attrs}>
    ← Daftar ${isPerpanjangan(S.w.jenis ?? state.p.jenis) ? 'Perpanjangan'
    : 'Pengesahan RPTKA'}</button>`;
}

const PANELS = { jabatan: renderJabatan,
  dokumen: renderDokumen, data: renderData, preview: renderPreview };

/**
 * Kolom kiri: isi utama halaman (status/kartu/tab aktif) — sama seperti
 * sebelumnya, tanpa Riwayat status.
 */
function mainColumn(S, ro) {
  if (ro) {
    // "Dokumen Pengesahan RPTKA"/"Bukti pembayaran DKPTKA" + tab bar di
    // luar kartu data pengajuan (bukan ditumpuk jadi satu) — lihat
    // rptka-panels.js `renderDetailTop`/`renderDetailBody`.
    return html`${renderDetailTop(S)}<section id="rp-panel"
      class="${CARD} grid gap-6 p-5 md:p-7">${renderDetailBody(S)}</section>`;
  }
  return html`${revisiBanner(S)}${tabBar(S, groupErrors(S))}
    <section id="rp-panel" role="tabpanel" tabindex="0"
      aria-labelledby="rp-tab-${S.tab}" class="${CARD} grid gap-4 p-5
      md:p-7">${PANELS[S.tab](S, S.tab === 'jabatan' &&
      Boolean(S.w.perluRevisi))}</section>${footer(S)}`;
}

/**
 * "Riwayat status" di samping data pengajuan (permintaan user) — dua
 * kolom mulai breakpoint `lg`, satu kolom (riwayat di bawah) di layar
 * sempit; hanya untuk pengajuan yang sudah diajukan (bukan Draf). Kolom
 * kanan sengaja LEBIH SEMPIT (`2fr`:`1fr`, bukan `1.4fr`:`1fr` seperti
 * pola serupa di halaman lain — hpk-hasil-detail.js, surat-keterangan.js)
 * atas permintaan eksplisit user: kartu "Riwayat status" bersifat info
 * pendukung, bukan sorotan utama, jadi tidak perlu selebar kartu data
 * pengajuan di sampingnya.
 */
function dynamic(S, ro) {
  const hpk = hpkOf(S);
  const head = html`${renderHeader(S, ro)}${hpk ? hpkSummary(hpk) : ''}`;
  // Draf masih form: tanpa Riwayat status; muncul setelah diajukan.
  if (S.w.status === RPTKA_STATUS.DRAF) {
    return html`${head}<div class="grid gap-5">${mainColumn(S, ro)}</div>`;
  }
  return html`${head}<div class="grid items-start gap-5
      lg:grid-cols-[minmax(0,2fr)_1fr]">
    <div class="grid gap-5">${mainColumn(S, ro)}</div>
    ${riwayatCard(S.w)}</div>`;
}

/** Page view. */
export function render() {
  const S = session();
  const ro = isRo(S);
  return html`${pageTitle({ back: backLink(S), eyebrow: isPerpanjangan(S.w.jenis) ? 'Perpanjangan'
      : 'Pengesahan RPTKA',
    title: jenisOf(S)?.judul ?? 'Form RPTKA',
    desc: ro ? `Pengajuan ${S.w.noAjuan} sudah dikirim ke Verifikator.`
      : 'Lengkapi tiap tahap secara berurutan, lalu simpan sebagai draft ' +
        'atau submit ke Verifikator.' })}
    <form id="rptka-form" novalidate class="grid gap-5">
      <div id="rptka-dyn" class="grid gap-5">${dynamic(S, ro)}</div></form>`;
}

/** Re-render the dynamic region; keep focus on `focusId` when given. */
function paint(focusId) {
  const S = session();
  setHtml(qs('#rptka-dyn'), dynamic(S, isRo(S)));
  applyErrors(S);
  if (focusId) {
    qs(`#${CSS.escape(focusId)}`)?.focus();
  }
}

/** Tampilkan error `errors` pada tahap `key` dan fokus ke yang pertama. */
function jumpTo(key, errors, focus = true) {
  const S = session();
  S.errors = { ...errors };
  if (key !== HEADER) {
    S.tab = key;
  }
  paint();
  const first = Object.keys(errors)[0];
  const target = key === HEADER
    ? errorId(S, first ?? 'jenis') : `rp-tab-${key}`;
  if (focus) {
    qs(`#${CSS.escape(target)}`)?.focus();
  }
}

/** Pindah tahap; maju hanya bila semua tahap sebelumnya lengkap. */
function setTab(tab, focus = true) {
  const S = session();
  const groups = groupErrors(S);
  const blocked = tab === HEADER ? null : blocker(S, tab, groups);
  if (tab === HEADER || blocked) {
    const key = blocked ?? HEADER;
    jumpTo(key, groups[key] ?? {}, focus);
    if (blocked) {
      toast(`Lengkapi ${STEP_LABEL[blocked]} terlebih dahulu sebelum melanjutkan.`, 'warning');
    }
    return;
  }
  S.tab = tab;
  paint(focus ? `rp-tab-${tab}` : '');
}

function showFormError(message) {
  const el = qs('#rptka-error');
  if (el) {
    el.textContent = message;
    el.hidden = !message;
  }
}

function setBusy(busy) {
  for (const button of qsa('[data-rp-busy]')) {
    button.disabled = busy;
    button.setAttribute('aria-busy', String(busy));
  }
}

function syncUrl(id) {
  state.p = { id };
  const params = new URLSearchParams({ role: state.role, page: PAGE, id });
  window.history.replaceState(null, '', `${window.location.pathname}?${params}`);
}

/** Simpan Draft (create / update). @return {!Promise<boolean>} sukses. */
async function persist() {
  const S = session();
  const hpk = hpkOf(S);
  const body = payload(S.w);
  if (butuhHpk(S.w.jenis) && !S.w.hpkId) {
    const perpanjangan = isPerpanjangan(S.w.jenis);
    const message = perpanjangan ? 'Pilih Nomor RPTKA.' : 'Pilih Nomor HPK.';
    S.errors = { hpkId: message };
    applyErrors(S);
    showErrors(qs('#rptka-form'),
      { [perpanjangan ? 'rp-rptka-asal' : 'rp-hpk']: message });
    return false;
  }
  const check = validateRptkaDraft(body, hpk);
  if (!check.valid) {
    S.errors = check.errors;
    const key = tabOfError(Object.keys(check.errors)[0]);
    jumpTo(key, groupErrors(S)[key] ?? check.errors, false);
    showFormError('Ada isian yang belum valid. Periksa bagian yang ditandai.');
    return false;
  }
  setBusy(true);
  showFormError('');
  try {
    const saved = S.w.id ? await updateRptka(state.role, S.w.id, body)
      : await createRptka(state.role, body);
    Object.assign(S.w, { id: saved.id, noAjuan: saved.noAjuan,
      status: saved.status, tone: saved.tone, hpkBarcode: saved.hpkBarcode });
    invalidate();
    syncUrl(saved.id);
    return true;
  } catch (error) {
    setBusy(false);
    S.errors = error instanceof ApiError ? error.fields : {};
    paint();
    showFormError(`Gagal menyimpan: ${error.message}. Coba lagi.`);
    return false;
  }
}

async function saveDraft() {
  if (await persist()) {
    toast('Draft Form RPTKA tersimpan.');
    paint();
  }
}

function confirmSubmit() {
  const S = session();
  const { errors } = validateRptkaSubmit(payload(S.w), hpkOf(S));
  S.errors = errors;
  if (Object.keys(errors).length) {
    paint();
    qs('#rp-panel [role="alert"]')?.focus();
    toast('Pengajuan belum lengkap. Lengkapi bagian yang ditandai.', 'warning');
    return;
  }
  confirmDialog({ judul: 'Submit ke Verifikator?',
    isi: `${S.w.tka.length} TKA pada ${S.w.jabatan.length} jabatan akan dikirim ` +
      'dengan status Menunggu Verifikasi. Data tidak dapat diubah kecuali ' +
      'dikembalikan Verifikator.', ok: 'Ya, Submit',
    action: 'rptka-submit-ok', testid: 'rptka-btn-submit-ok' });
}

async function doSubmit(button) {
  const S = session();
  button.disabled = true;
  if (!await persist()) {
    closeDialog(MODAL);
    return;
  }
  try {
    const done = await submitRptka(state.role, S.w.id);
    closeDialog(MODAL);
    invalidate();
    await Promise.all([reloadCollection('pengesahan'),
      reloadCollection('hpk')]);
    toast(`Form RPTKA ${done.noAjuan} dikirim ke Verifikator.`);
    go(...listTarget(S.w.jenis));
  } catch (error) {
    button.disabled = false;
    closeDialog(MODAL);
    S.errors = error instanceof ApiError ? error.fields : {};
    paint();
    showFormError(`Gagal submit: ${error.message}. Coba lagi.`);
  }
}

function applyHpk(id) {
  const S = session();
  Object.assign(S.w, { hpkId: id, jabatan: [], tka: [], dokumenJabatan: {} });
  Object.assign(S, { errors: {}, ocr: {}, editJab: -1 });
  S.files.clear();
  paint('rp-hpk');
}

/** Jenis berganti: sesuaikan kegiatan, HPK (bila tak cocok), dokumen. */
function applyJenis(value) {
  const S = session();
  const def = jenisDef(value);
  const hpk = cache().hpk.find((h) => h.id === S.w.hpkId);
  S.w.jenis = value || null;
  S.w.kegiatan = def?.kegiatan ? S.w.kegiatan : null;
  delete S.errors.jenis;
  const cocok = def && def.hpk !== false && (!def.hpkLayanan || !hpk ||
    hpk.layanan === def.hpkLayanan);
  if (S.w.hpkId && !cocok) {
    applyHpk('');
    toast('Nomor HPK direset karena tidak sesuai jenis yang dipilih.', 'info');
  }
  pruneDokumen(S.w);
  paint('rp-jenis');
}

function onHpkChange(select) {
  const S = session();
  if (select.value === S.w.hpkId) {
    return;
  }
  if (!S.w.jabatan.length) {
    applyHpk(select.value);
    return;
  }
  const next = select.value;
  select.value = S.w.hpkId;
  confirmDialog({ judul: 'Ganti Nomor HPK?', ok: 'Ya, ganti',
    isi: 'Jabatan, dokumen, dan Data TKA yang sudah diisi akan direset ' +
      'karena mengikuti HPK sebelumnya.', action: 'rptka-hpk-ok',
    data: { hpk: next } });
}

/**
 * Pemilih "Nomor RPTKA" dipilih (Perpanjangan) — isi otomatis Nomor HPK
 * dan identitas TKA dari baris terpilih (`revisi akun pemberi kerja, poin
 * 5`). `p.identitas` (15 kolom Form RPTKA, RP-15) dipakai bila ada; baris
 * lama (seed, tanpa `identitas`) cuma dapat nama/kebangsaan/paspor —
 * kolom lain tetap bisa diisi manual di tab Data TKA.
 */
function applyRptkaAsal(id) {
  const S = session();
  const row = rptkaTerbitPilihan().find((p) => p.id === id);
  if (!row) {
    Object.assign(S.w, { rptkaAsalId: id || null });
    paint('rp-rptka-asal');
    return;
  }
  Object.assign(S.w, { rptkaAsalId: row.id, hpkId: row.hpk ?? '',
    jabatan: [{ nama: row.jabatan, jumlahTka: 1, jangkaWaktuBulan: 12 }],
    tka: [], dokumenJabatan: {} });
  syncTka(S.w);
  if (S.w.tka[0]) {
    S.w.tka[0].data = { nama: row.nama, kebangsaan: row.negara,
      nomorPaspor: row.paspor, ...(row.identitas ?? {}) };
  }
  Object.assign(S, { errors: {}, ocr: {}, editJab: -1 });
  S.files.clear();
  paint('rp-rptka-asal');
}

function onRptkaAsalChange(select) {
  const S = session();
  if (select.value === S.w.rptkaAsalId) {
    return;
  }
  if (!S.w.jabatan.length) {
    applyRptkaAsal(select.value);
    return;
  }
  const next = select.value;
  select.value = S.w.rptkaAsalId;
  confirmDialog({ judul: 'Ganti Nomor RPTKA?', ok: 'Ya, ganti',
    isi: 'Jabatan, dokumen, dan Data TKA yang sudah diisi akan direset ' +
      'karena mengikuti RPTKA sebelumnya.', action: 'rptka-asal-ok',
    data: { asal: next } });
}

function onKeydown(event) {
  const tab = event.target.closest?.('[role="tab"]');
  const move = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
  if (!tab || !move) {
    return;
  }
  const keys = TABS.filter((t) => !document.getElementById(`rp-tab-${t.key}`)
    .disabled).map((t) => t.key);
  const next = keys[(keys.indexOf(tab.dataset.tab) + move + keys.length) %
    keys.length];
  event.preventDefault();
  setTab(next);
}

/** @param {!Element} root */
export function mount(root) {
  const form = qs('#rptka-form', root);
  const S = session();
  form.addEventListener('change', (event) => {
    const t = event.target;
    if (t.id === 'rp-hpk') {
      onHpkChange(t);
    } else if (t.id === 'rp-rptka-asal') {
      onRptkaAsalChange(t);
    } else if (t.matches('[data-rp-jenis]')) {
      applyJenis(t.value);
    } else if (t.matches('[data-rp-kegiatan]')) {
      S.w.kegiatan = t.value || null;
      delete S.errors.kegiatan;
      pruneDokumen(S.w);
      paint('rp-kegiatan');
    } else if (t.matches('[data-rp-doc]')) {
      pickDocument(S, t, paint);
    }
  });
  form.addEventListener('input', (event) => {
    const t = event.target;
    if (t.dataset.tka === undefined) {
      return;
    }
    const i = Number(t.dataset.tka);
    S.w.tka[i].data[t.dataset.fkey] = t.value;
    delete S.w.tka[i].ocr?.[t.dataset.fkey];
    delete S.errors[`tka.${i}.data.${t.dataset.fkey}`];
    syncTabs(S);
    const slot = qs(`#${t.id}-error`);
    if (slot && t.value !== '') {
      slot.hidden = true;
      t.removeAttribute('aria-invalid');
    }
  });
  form.addEventListener('toggle', (event) => {
    const key = event.target.dataset?.openKey;
    if (key) {
      S.open[event.target.open ? 'add' : 'delete'](key);
    }
  }, true);
  form.addEventListener('keydown', onKeydown);
}

export const actions = {
  ...revisiActions({ session, paint, showError: showFormError }),
  'rptka-tab'(el) {
    setTab(el.dataset.tab);
  },
  /** Tab bar halaman detail (ro mode): "Data Pengajuan RPTKA" / "Data ITAS & Lalu Lintas Keimigrasian". */
  'rptka-ro-tab'(el) {
    const S = session();
    S.roTab = el.dataset.tab;
    paint(`rp-ro-tab-${el.dataset.tab}`);
  },
  'rptka-prev'() {
    const S = session();
    setTab(TABS[Math.max(0, tabIndex(S) - 1)].key);
  },
  'rptka-next'() {
    const S = session();
    setTab(TABS[Math.min(TABS.length - 1, tabIndex(S) + 1)].key);
  },
  'rptka-save'() {
    saveDraft();
  },
  'rptka-submit'() {
    confirmSubmit();
  },
  'rptka-submit-ok'(el) {
    doSubmit(el);
  },
  'rptka-hpk-ok'(el) {
    closeDialog(MODAL);
    applyHpk(el.dataset.hpk);
  },
  'rptka-asal-ok'(el) {
    closeDialog(MODAL);
    applyRptkaAsal(el.dataset.asal);
  },
  'rptka-jab-save'() {
    saveJabatan(paint);
  },
  'rptka-jab-edit'(el) {
    session().editJab = Number(el.dataset.idx);
    paint('rp-jab-nama');
  },
  'rptka-jab-cancel'() {
    session().editJab = -1;
    paint('rp-jab-nama');
  },
  'rptka-jab-del'(el) {
    confirmDeleteJabatan(Number(el.dataset.idx));
  },
  'rptka-jab-del-ok'(el) {
    const S = session();
    S.w.jabatan.splice(Number(el.dataset.idx), 1);
    syncTka(S.w);
    Object.assign(S, { editJab: -1, errors: {} });
    closeDialog(MODAL);
    toast('Jabatan dihapus.', 'info');
    paint('rp-jab-nama');
  },
  'rptka-preview'(el) {
    previewDialog(session(), el.dataset.scope, el.dataset.kunci);
  },
  'rptka-preview-doc'() {
    previewDokumen(session());
  },
  'rptka-ganti'(el) {
    qs(`#${CSS.escape(el.dataset.input)}`).click();
  },
  'rptka-ocr-retry'(el) {
    pickDocument(session(), qs(`#${CSS.escape(el.dataset.input)}`), paint);
  },
};
