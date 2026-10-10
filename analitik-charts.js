/**
 * @fileoverview Markup + Chart.js configs of the Analitik dashboard: stat
 * cards, four chart panels (tren periode, wilayah, sektor, jabatan) with
 * fallback tables. Colors come from chart-panel (theme tokens).
 */

import {
  baseOptions, chartPanel, destroyCharts, isChartAvailable, renderChart,
} from '../../components/chart-panel.js';
import { html } from '../../components/dom.js';
import { CARD } from './ui.js';

export const CHART_PREFIX = 'an-chart-';
const TOP_WILAYAH = 10;
const MAX_LABEL = 26;

export const number = new Intl.NumberFormat('id-ID');
const rupiahCompact = new Intl.NumberFormat('id-ID', { style: 'currency',
  currency: 'IDR', notation: 'compact', maximumFractionDigits: 2 });
const rupiahFull = new Intl.NumberFormat('id-ID', { style: 'currency',
  currency: 'IDR', maximumFractionDigits: 0 });

const shortLabel = (text) => (text.length > MAX_LABEL
  ? `${text.slice(0, MAX_LABEL - 1)}…` : text);

/** "Okt 2025 – Sep 2026" for the loaded data. */
export function periodLabel(data) {
  const first = data.perPeriode[0]?.label ?? '';
  const last = data.perPeriode.at(-1)?.label ?? '';
  return first === last ? first : `${first} – ${last}`;
}

function wilayahOf(data) {
  return data.perKabupaten
    ? { title: `Per kabupaten/kota · ${data.filter.provinsi}`,
      rows: data.perKabupaten, noun: 'kabupaten/kota' }
    : { title: 'Per provinsi', rows: data.perProvinsi, noun: 'provinsi' };
}

/** Four stat cards. */
export function statCards(data) {
  const r = data.ringkasan;
  const items = [
    ['Jumlah TKA disahkan', number.format(r.totalTka), 'orang'],
    ['Permohonan pengesahan', number.format(r.totalPengesahan),
      'permohonan [I] estimasi'],
    ['PNBP DKPTKA', rupiahCompact.format(r.pnbpRupiah),
      `${rupiahFull.format(r.pnbpRupiah)} · [I] estimasi`],
    ['Pemberi kerja', number.format(r.perusahaan), 'perusahaan [I] estimasi'],
  ];
  return html`<ul class="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4"
      aria-label="Ringkasan ${periodLabel(data)}">
    ${items.map(([label, value, sub]) => html`<li class="${CARD} grid gap-1
        p-4.5">
      <span class="text-xs font-bold text-base-content/70">${label}</span>
      <span class="text-2xl font-extrabold tracking-tight">${value}</span>
      <span class="text-xs text-base-content/70">${sub}</span></li>`)}
  </ul>`;
}

/** Grid of four chart panels (with fallback tables). */
export function chartGrid(data) {
  const period = periodLabel(data);
  const wilayah = wilayahOf(data);
  const topNote = wilayah.rows.length > TOP_WILAYAH
    ? `Grafik: ${TOP_WILAYAH} terbesar · tabel: semua ${wilayah.noun}` : '';
  return html`<div class="grid gap-5 xl:grid-cols-2">
    ${chartPanel({ id: `${CHART_PREFIX}tren`, title: 'Tren per periode',
      height: 'h-80',
      label: `Grafik garis jumlah TKA dan permohonan pengesahan per bulan, ${period}. Data lengkap ada pada tabel.`,
      columns: ['Periode', 'TKA', 'Pengesahan'],
      rows: data.perPeriode.map((x) => [x.label, number.format(x.tka),
        number.format(x.pengesahan)]) })}
    ${chartPanel({ id: `${CHART_PREFIX}wilayah`, title: wilayah.title,
      note: topNote, height: 'h-80',
      label: `Grafik batang jumlah TKA ${wilayah.title.toLowerCase()}, ${period}. Data lengkap ada pada tabel.`,
      columns: [wilayah.noun === 'provinsi' ? 'Provinsi' : 'Kab/kota', 'TKA'],
      rows: wilayah.rows.map((x) => [x.nama, number.format(x.tka)]) })}
    ${chartPanel({ id: `${CHART_PREFIX}sektor`,
      title: 'Per sektor (kategori KBLI)', height: 'h-80',
      label: `Grafik batang jumlah TKA per sektor KBLI, ${period}. Data lengkap ada pada tabel.`,
      columns: ['Sektor', 'TKA'],
      rows: data.perSektor.map((x) => [`${x.kode} · ${x.nama}`,
        number.format(x.tka)]) })}
    ${chartPanel({ id: `${CHART_PREFIX}jabatan`, title: 'Per jabatan',
      height: 'h-80',
      label: `Grafik batang jumlah TKA per jabatan, ${period}. Data lengkap ada pada tabel.`,
      columns: ['Jabatan', 'TKA'],
      rows: data.perJabatan.map((x) => [x.nama, number.format(x.tka)]) })}
  </div>`;
}

function barConfig(labels, values, color, label) {
  return (palette) => ({
    type: 'bar',
    data: { labels, datasets: [{ label, data: values,
      backgroundColor: palette.series[color],
      hoverBackgroundColor: palette.series[color],
      borderRadius: 4, maxBarThickness: 22 }] },
    options: baseOptions(palette, { indexAxis: 'y' }),
  });
}

/**
 * Render (or re-render) the four charts. No-op without Chart.js.
 * @param {!Object} data GET /analitik/penggunaan-tka payload.
 */
export function renderCharts(data) {
  destroyCharts(CHART_PREFIX);
  if (!isChartAvailable()) {
    return;
  }
  renderChart(`${CHART_PREFIX}tren`, (palette) => ({
    type: 'line',
    data: {
      labels: data.perPeriode.map((x) => x.label),
      datasets: [
        { label: 'TKA', data: data.perPeriode.map((x) => x.tka),
          borderColor: palette.series[0], backgroundColor: palette.seriesSoft[0],
          pointBackgroundColor: palette.series[0], pointStyle: 'circle',
          fill: true, tension: 0.3, pointRadius: 3 },
        { label: 'Pengesahan', data: data.perPeriode.map((x) => x.pengesahan),
          borderColor: palette.series[5], backgroundColor: palette.series[5],
          pointBackgroundColor: palette.series[5], pointStyle: 'rectRot',
          borderDash: [6, 4], tension: 0.3, pointRadius: 3 },
      ],
    },
    options: { ...baseOptions(palette, { legend: true }),
      interaction: { mode: 'index', intersect: false } },
  }));
  const wilayah = wilayahOf(data).rows.slice(0, TOP_WILAYAH);
  renderChart(`${CHART_PREFIX}wilayah`, barConfig(
    wilayah.map((x) => shortLabel(x.nama)), wilayah.map((x) => x.tka), 0,
    'TKA'));
  renderChart(`${CHART_PREFIX}sektor`, barConfig(
    data.perSektor.map((x) => shortLabel(`${x.kode} · ${x.nama}`)),
    data.perSektor.map((x) => x.tka), 1, 'TKA'));
  renderChart(`${CHART_PREFIX}jabatan`, barConfig(
    data.perJabatan.map((x) => shortLabel(x.nama)),
    data.perJabatan.map((x) => x.tka), 4, 'TKA'));
}
