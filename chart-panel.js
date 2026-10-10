/**
 * @fileoverview Chart.js v4 wrapper (status: draft). Chart.js comes from the
 * UMD CDN build (window.Chart) loaded ONLY on pages with charts. Contract:
 *   - chartPanel() renders <figure> + canvas (role="img", descriptive
 *     aria-label) + a fallback data table behind "Lihat tabel" (always
 *     present; opened automatically when Chart.js is unavailable).
 *   - renderChart() destroys the previous instance first, reads colors from
 *     the active DaisyUI theme tokens (no color literals), disables
 *     animation under prefers-reduced-motion, and re-renders on theme
 *     change (data-theme attribute).
 */

import { html } from './dom.js';

const charts = new Map();
const builders = new Map();
let themeObserver = null;

/** Series token order (CSS custom properties of the active theme). */
const SERIES_TOKENS = ['--color-secondary', '--color-success',
  '--color-warning', '--color-error', '--color-special', '--color-primary',
  '--color-info-bright', '--color-success-bright', '--color-warning-bright',
  '--color-highlight'];

/** @return {boolean} Chart.js global is available. */
export function isChartAvailable() {
  return typeof window !== 'undefined' && typeof window.Chart === 'function';
}

/**
 * Chart card with canvas + fallback table.
 * @param {{id: string, title: string, label: string,
 *     columns: !Array<string>, rows: !Array<!Array<*>>,
 *     height: (string|undefined), note: (string|undefined)}} options
 *     label = aria-label (type + measure + period). rows = display values.
 * @return {!Object} SafeHtml
 */
export function chartPanel({ id, title, label, columns, rows, height = 'h-64',
  note = '' }) {
  const hasChart = isChartAvailable();
  return html`<figure class="grid min-w-0 content-start gap-3 rounded-box
      border border-base-300 bg-base-100 p-4 md:p-5"
      aria-labelledby="${id}-title">
    <figcaption id="${id}-title" class="text-[15px] font-bold">${title}
      ${note ? html`<span class="block text-xs font-medium
        text-base-content/70">${note}</span>` : ''}</figcaption>
    ${hasChart ? html`<div class="relative ${height}">
      <canvas id="${id}" role="img" aria-label="${label}"></canvas>
    </div>` : ''}
    <details class="group text-sm" ${hasChart ? '' : 'open'}>
      <summary class="cursor-pointer text-[13px] font-bold text-secondary
        hover:underline">Lihat tabel</summary>
      <div class="mt-2 max-h-72 overflow-auto rounded-field border
          border-base-200">
        <table class="table table-sm table-pin-rows text-[13px]">
          <caption class="sr-only">${title}</caption>
          <thead><tr class="bg-base-200/50 text-xs font-bold
            text-base-content/70">${columns.map((c, i) => html`<th
            scope="col" class="${i ? 'text-right' : ''}">${c}</th>`)}</tr>
          </thead>
          <tbody>${rows.map((r) => html`<tr>${r.map((v, i) => i
            ? html`<td class="text-right tabular-nums">${v}</td>`
            : html`<th scope="row" class="font-medium">${v}</th>`)}</tr>`)}
          </tbody>
        </table>
      </div>
    </details>
  </figure>`;
}

/**
 * Resolve a CSS custom property of the active theme to an `rgb()` string
 * (canvas round-trip so Chart.js color helpers understand oklch tokens).
 * @param {string} token e.g. '--color-secondary'
 * @param {number=} alpha 0–1
 * @return {string}
 */
export function tokenColor(token, alpha = 1) {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(token).trim();
  if (!value) {
    console.warn(`[chart] token ${token} tidak ada di tema aktif`);
    return 'currentColor';
  }
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.fillStyle = value;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return `rgb(${r} ${g} ${b} / ${alpha})`;
}

/** Palette read from the active theme. */
export function chartPalette() {
  return {
    series: SERIES_TOKENS.map((t) => tokenColor(t)),
    seriesSoft: SERIES_TOKENS.map((t) => tokenColor(t, 0.15)),
    text: tokenColor('--color-base-content', 0.75),
    grid: tokenColor('--color-base-300'),
    surface: tokenColor('--color-base-100'),
  };
}

const numberFormat = new Intl.NumberFormat('id-ID');

/** Base options: responsive, token colors, id-ID ticks, reduced motion. */
export function baseOptions(palette, { indexAxis = 'x', legend = false } = {}) {
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    .matches;
  const valueAxis = indexAxis === 'y' ? 'x' : 'y';
  const scaleOf = (isValue) => ({
    beginAtZero: isValue,
    ticks: {
      color: palette.text,
      font: { family: 'Plus Jakarta Sans', size: 11 },
      ...(isValue ? { callback: (v) => numberFormat.format(v) } : {}),
    },
    grid: { color: palette.grid, display: isValue },
    border: { color: palette.grid },
  });
  return {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis,
    animation: reduced ? false : { duration: 250 },
    plugins: {
      legend: { display: legend, labels: { color: palette.text,
        usePointStyle: true, font: { family: 'Plus Jakarta Sans' } } },
      tooltip: { callbacks: { label: (item) =>
        `${item.dataset.label}: ${numberFormat.format(item.parsed[valueAxis])}` } },
    },
    scales: { [valueAxis]: scaleOf(true),
      [indexAxis === 'y' ? 'y' : 'x']: scaleOf(false) },
  };
}

/**
 * (Re)render a chart on canvas #id. Destroys the previous instance first.
 * @param {string} id Canvas id.
 * @param {function(!Object): !Object} buildConfig palette -> Chart config.
 * @return {boolean} false when Chart.js or the canvas is missing.
 */
export function renderChart(id, buildConfig) {
  destroyChart(id);
  const canvas = document.getElementById(id);
  if (!isChartAvailable() || !canvas) {
    return false;
  }
  charts.set(id, new window.Chart(canvas, buildConfig(chartPalette())));
  builders.set(id, buildConfig);
  watchTheme();
  return true;
}

/** Destroy one chart instance (call before removing its canvas). */
export function destroyChart(id) {
  charts.get(id)?.destroy();
  charts.delete(id);
  builders.delete(id);
}

/** Destroy every chart whose id starts with prefix. */
export function destroyCharts(prefix = '') {
  for (const id of [...charts.keys()]) {
    if (id.startsWith(prefix)) {
      destroyChart(id);
    }
  }
}

function watchTheme() {
  if (themeObserver || typeof MutationObserver === 'undefined') {
    return;
  }
  themeObserver = new MutationObserver(() => {
    for (const [id, build] of [...builders]) {
      if (document.getElementById(id)) {
        renderChart(id, build);
      } else {
        destroyChart(id);
      }
    }
  });
  themeObserver.observe(document.documentElement,
    { attributes: true, attributeFilter: ['data-theme'] });
}
