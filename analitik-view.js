/**
 * @fileoverview Back Office "Analitik" (KAK Modul 6): dasbor penggunaan TKA
 * nasional / provinsi / kab-kota / sektor / jabatan / periode with
 * multi-dimension filter, stat cards, Chart.js panels (fallback tables) and
 * export (Excel CSV / PDF print). Page key "analitik" (admin, dir, dirjen).
 * The view loads its own data (PAGE_NEEDS.analitik = []) and renders once;
 * later shell renders only refresh the eyebrow.
 */

import { getAnalitikDimensi, getPenggunaanTka } from '../../api/analitik.js';
import { ApiError } from '../../api/http.js';
import { isChartAvailable } from '../../components/chart-panel.js';
import { html, qs, setBusy, setHtml } from '../../components/dom.js';
import { emptyState } from '../../components/empty-state.js';
import { validateAnalitikQuery } from '../../contracts/analitik.js';
import { chartGrid, renderCharts, statCards } from './analitik-charts.js';
import { runExport } from './analitik-export.js';
import {
  CARD, errorSlot, pageHeader, showFieldErrors, showToast,
} from './ui.js';

const FILTER_FIELDS = ['provinsi', 'kabupaten', 'sektor', 'jabatan', 'dari',
  'sampai'];
const LABEL = 'text-xs font-bold text-base-content/80';

/**
 * @param {{role: function(): !Object}} ctx
 * @return {{renderAnalitik: function()}}
 */
export function createAnalitikViews(ctx) {
  const root = qs('#page-analitik');
  const view = {
    mounted: false, dims: null, dimsError: '', filter: {}, data: null,
    status: 'idle', error: '', exporting: null,
  };

  root.addEventListener('submit', onSubmit);
  root.addEventListener('click', onClick);
  root.addEventListener('change', onChange);
  root.addEventListener('keydown', onExportKeydown);
  root.addEventListener('focusout', onExportFocusout);

  function renderAnalitik() {
    if (view.mounted) {
      qs('#analitik-title', root).previousElementSibling.textContent =
        eyebrow();
      return;
    }
    view.mounted = true;
    setHtml(root, html`
      ${pageHeader({ id: 'analitik-title', eyebrow: eyebrow(),
        title: 'Analitik penggunaan TKA',
        actions: html`<div id="an-export-host">${exportMenu()}</div>` })}
      <p class="-mt-2 text-xs text-base-content/70">[I] Angka contoh dari
        mock (deterministik), bukan statistik resmi. PNBP, permohonan, dan
        pemberi kerja adalah estimasi prototipe.</p>
      <p id="an-status" role="status" class="sr-only"></p>
      <div id="an-filter-host"></div>
      <div id="an-results" class="grid gap-5" aria-busy="false"></div>`);
    loadDimensi();
  }

  function eyebrow() {
    return `${ctx.role().label} · Modul analitik dan pelaporan`;
  }

  function exportMenu() {
    const busy = Boolean(view.exporting);
    return html`<details id="an-export" class="dropdown dropdown-end">
      <summary class="btn btn-outline h-auto rounded-[10px] px-4 py-2.75
          text-sm font-bold" aria-busy="${busy}"
          data-testid="analitik-btn-ekspor">
        ${busy ? html`<span class="loading loading-spinner loading-xs"
          aria-hidden="true"></span> Menyiapkan…` : 'Ekspor ▾'}</summary>
      <ul class="dropdown-content menu z-sticky mt-2 w-52 rounded-box border
          border-base-300 bg-base-100 p-1.5 text-sm shadow-lg">
        <li><button type="button" data-export="xlsx" ${busy ? 'disabled'
          : ''}>Excel (CSV)</button></li>
        <li><button type="button" data-export="pdf" ${busy ? 'disabled'
          : ''}>PDF (cetak)</button></li>
      </ul></details>`;
  }

  async function loadDimensi() {
    const host = qs('#an-filter-host', root);
    view.dimsError = '';
    setBusy(host, true);
    setHtml(host, html`<div class="skeleton h-28 w-full"></div>`);
    try {
      view.dims = await getAnalitikDimensi();
      view.filter = { dari: view.dims.periode.defaultDari,
        sampai: view.dims.periode.sampai };
      renderFilter();
      loadData();
    } catch (error) {
      view.dimsError = error.message;
      setHtml(host, errorAlert(`Pilihan filter gagal dimuat: ${error.message}`,
        'retry-dims'));
    } finally {
      setBusy(host, false);
    }
  }

  function select(field, label, options, value, attrs = '') {
    return html`<div class="grid content-start gap-1.5">
      <label for="an-${field}" class="${LABEL}">${label}</label>
      <select id="an-${field}" name="${field}" class="select select-sm w-full"
        aria-describedby="an-${field}-error" ${attrs}>
        ${options.map(([v, text]) => html`<option value="${v}"
          ${v === (value ?? '') ? 'selected' : ''}>${text}</option>`)}
      </select>
      ${errorSlot(`an-${field}-error`, field)}</div>`;
  }

  function monthInput(field, label) {
    const { periode } = view.dims;
    return html`<div class="grid content-start gap-1.5">
      <label for="an-${field}" class="${LABEL}">${label}</label>
      <input id="an-${field}" name="${field}" type="month"
        value="${view.filter[field] ?? ''}" min="${periode.dari}"
        max="${periode.sampai}" placeholder="YYYY-MM" required
        class="input input-sm w-full" aria-describedby="an-${field}-error">
      ${errorSlot(`an-${field}-error`, field)}</div>`;
  }

  function kabOptions(provinsi) {
    const list = provinsi ? view.dims.kabupaten[provinsi] ?? [] : [];
    return [['', provinsi ? 'Semua kab/kota' : 'Pilih provinsi dulu'],
      ...list.map((k) => [k, k])];
  }

  function renderFilter() {
    const { dims, filter } = view;
    setHtml(qs('#an-filter-host', root), html`<form id="an-filter" novalidate
        class="${CARD} grid gap-3.5 p-4 md:grid-cols-3 xl:grid-cols-6"
        aria-label="Filter analitik">
      ${select('provinsi', 'Provinsi', [['', 'Semua provinsi'],
        ...dims.provinsi.map((p) => [p, p])], filter.provinsi)}
      ${select('kabupaten', 'Kabupaten/kota', kabOptions(filter.provinsi),
        filter.kabupaten, filter.provinsi ? '' : 'disabled')}
      ${select('sektor', 'Sektor (KBLI)', [['', 'Semua sektor'],
        ...dims.sektor.map((s) => [s.kode, `${s.kode} · ${s.nama}`])],
      filter.sektor)}
      ${select('jabatan', 'Jabatan', [['', 'Semua jabatan'],
        ...dims.jabatan.map((j) => [j, j])], filter.jabatan)}
      ${monthInput('dari', 'Dari (bulan)')}
      ${monthInput('sampai', 'Sampai (bulan)')}
      <div class="flex flex-wrap justify-end gap-2 md:col-span-3
          xl:col-span-6">
        <button type="button" class="btn btn-sm" data-action="reset"
          data-testid="analitik-btn-reset">Reset</button>
        <button type="submit" class="btn btn-sm btn-primary"
          data-testid="analitik-btn-terapkan">Terapkan</button>
      </div></form>`);
  }

  function collect() {
    const form = qs('#an-filter', root);
    return Object.fromEntries(FILTER_FIELDS
      .map((f) => [f, form.elements[f].value.trim()])
      .filter(([, v]) => v));
  }

  function filterErrors(errors) {
    const form = qs('#an-filter', root);
    return form ? showFieldErrors(form, errors) : false;
  }

  function onExportKeydown(event) {
    const menu = event.target.closest('#an-export');
    if (event.key === 'Escape' && menu?.open) {
      menu.open = false;
      qs('summary', menu).focus();
    }
  }

  function onExportFocusout(event) {
    const menu = event.target.closest('#an-export');
    if (menu?.open && !menu.contains(event.relatedTarget)) {
      menu.open = false;
    }
  }

  function onSubmit(event) {
    event.preventDefault();
    const query = collect();
    if (filterErrors(validateAnalitikQuery(query).errors)) {
      return;
    }
    view.filter = query;
    loadData();
  }

  function onChange(event) {
    if (event.target.id !== 'an-provinsi') {
      return;
    }
    const kab = qs('#an-kabupaten', root);
    const provinsi = event.target.value;
    setHtml(kab, html`${kabOptions(provinsi).map(([v, text]) =>
      html`<option value="${v}">${text}</option>`)}`);
    kab.disabled = !provinsi;
  }

  function onClick(event) {
    const exportBtn = event.target.closest('[data-export]');
    if (exportBtn) {
      startExport(exportBtn.dataset.export);
      return;
    }
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'reset') {
      view.filter = { dari: view.dims.periode.defaultDari,
        sampai: view.dims.periode.sampai };
      renderFilter();
      loadData();
    } else if (action === 'retry-dims') {
      loadDimensi();
    } else if (action === 'retry-data') {
      loadData();
    }
  }

  async function loadData() {
    const results = qs('#an-results', root);
    view.status = 'loading';
    setBusy(results, true);
    setHtml(results, html`<span class="sr-only" role="status">Memuat
        analitik…</span>
      <div class="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        ${[1, 2, 3, 4].map(() => html`<div class="skeleton h-24"></div>`)}
      </div>
      <div class="grid gap-5 xl:grid-cols-2">
        ${[1, 2, 3, 4].map(() => html`<div class="skeleton h-80"></div>`)}
      </div>`);
    const filter = view.filter;
    try {
      const data = await getPenggunaanTka(filter);
      if (filter !== view.filter) {
        return;
      }
      view.data = data;
      view.status = 'ok';
      renderResults();
    } catch (error) {
      if (filter !== view.filter) {
        return;
      }
      view.status = 'error';
      if (error instanceof ApiError && error.status === 400) {
        filterErrors(Object.keys(error.fields).length ? error.fields
          : { [error.field ?? 'dari']: error.message });
      }
      setHtml(results, errorAlert(`Data analitik gagal dimuat: ${error.message}`,
        'retry-data'));
    } finally {
      setBusy(results, false);
    }
  }

  function renderResults() {
    const { data } = view;
    const results = qs('#an-results', root);
    if (!data.ringkasan.totalTka) {
      setHtml(results, emptyState({ title: 'Belum ada data untuk filter ini',
        body: 'Ubah atau reset filter untuk melihat data lain.',
        action: { label: 'Reset filter', attrs: html`data-action="reset"` } }));
      announce('Analitik diperbarui: tidak ada data untuk filter ini.');
      return;
    }
    setHtml(results, html`
      ${isChartAvailable() ? '' : html`<p role="note" class="alert
        alert-info alert-soft text-sm">Pustaka grafik tidak termuat; data
        ditampilkan sebagai tabel.</p>`}
      ${statCards(data)}
      ${chartGrid(data)}`);
    renderCharts(data);
    announce(`Analitik diperbarui: ${view.filter.dari ?? ''}–` +
      `${view.filter.sampai ?? ''}, ${data.ringkasan.totalTka} TKA.`);
  }

  function announce(message) {
    qs('#an-status', root).textContent = message;
  }

  async function startExport(format) {
    const menu = qs('#an-export', root);
    menu.open = false;
    if (view.status !== 'ok' || view.exporting) {
      showToast('Tunggu data analitik selesai dimuat.', 'info');
      return;
    }
    view.exporting = format;
    renderExportMenu();
    try {
      const fileName = await runExport(format, view.filter, view.data);
      showToast(format === 'xlsx' ? `${fileName} diunduh.`
        : 'Dokumen siap dicetak atau disimpan sebagai PDF.');
    } catch (error) {
      showToast(`Ekspor gagal: ${error.message}`, 'error');
    } finally {
      view.exporting = null;
      renderExportMenu();
      qs('#an-export summary', root).focus();
    }
  }

  function renderExportMenu() {
    setHtml(qs('#an-export-host', root), exportMenu());
  }

  return { renderAnalitik };
}

function errorAlert(message, action) {
  return html`<div role="alert" class="alert alert-error alert-soft">
    <span>${message}</span>
    <button type="button" class="btn btn-sm btn-error"
      data-action="${action}">Coba lagi</button></div>`;
}
