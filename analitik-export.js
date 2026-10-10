/**
 * @fileoverview Analitik export (KAK Modul 6: ekspor Excel dan PDF).
 * POST /analitik/exports -> GET /analitik/exports/{id} -> rows. The
 * prototype builds the files in the browser: "Excel (CSV)" = UTF-8 CSV with
 * BOM (opens in Excel), "PDF" = print-friendly window (Simpan sebagai PDF).
 * Native .xlsx / server-side PDF are backend work.
 */

import {
  getAnalitikExport, requestAnalitikExport,
} from '../../api/analitik.js';
import { html, raw } from '../../components/dom.js';
import { number, periodLabel } from './analitik-charts.js';

/** [I] usulan: ';' matches the list separator of Excel id-ID. */
const CSV_SEPARATOR = ';';
const BOM = '﻿';
const COLUMN_LABELS = {
  periode: 'Periode', wilayah: 'Wilayah', sektor: 'Sektor',
  jabatan: 'Jabatan', tka: 'Jumlah TKA', pengesahan: 'Permohonan pengesahan',
};

/**
 * Run an export job and deliver the file.
 * @param {'xlsx'|'pdf'} format
 * @param {!Object} filter Active AnalitikQuery.
 * @param {!Object} data Loaded aggregates (for the PDF summary).
 * @return {!Promise<string>} Delivered file name.
 */
export async function runExport(format, filter, data) {
  const job = await requestAnalitikExport(format, filter);
  const result = await getAnalitikExport(job.exportId);
  if (result.status !== 'Selesai') {
    throw new Error('Ekspor masih diproses. Coba beberapa saat lagi.');
  }
  if (format === 'xlsx') {
    const fileName = result.fileName.replace(/\.xlsx$/, '.csv');
    downloadCsv(fileName, result.columns, result.rows);
    return fileName;
  }
  printReport(result, data);
  return result.fileName;
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[";\n,]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadCsv(fileName, columns, rows) {
  const lines = [columns.map((c) => csvCell(COLUMN_LABELS[c] ?? c))
    .join(CSV_SEPARATOR)];
  for (const row of rows) {
    lines.push(columns.map((c) => csvCell(row[c])).join(CSV_SEPARATOR));
  }
  const blob = new Blob([BOM + lines.join('\r\n')],
    { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function filterSummary(filter) {
  return [
    filter.provinsi ?? 'Semua provinsi',
    filter.kabupaten,
    filter.sektor ? `Sektor ${filter.sektor}` : 'Semua sektor',
    filter.jabatan ?? 'Semua jabatan',
  ].filter(Boolean).join(' · ');
}

/** Print stylesheet of the report window (no colors: prints in black). */
const PRINT_CSS = `body{font-family:'Plus Jakarta Sans',system-ui,sans-serif;
margin:24px;font-size:12px}h1{font-size:18px;margin:0 0 4px}
p{margin:0 0 12px}table{border-collapse:collapse;width:100%}
th,td{border:1px solid currentColor;padding:4px 6px;text-align:left}
td.num,th.num{text-align:right}dl{display:grid;grid-template-columns:
max-content 1fr;gap:2px 12px;margin:0 0 16px}dt{font-weight:700}
@page{size:A4;margin:14mm}`;

function printReport(result, data) {
  const popup = window.open('', '_blank');
  if (!popup) {
    throw new Error('Pop-up diblokir browser. Izinkan pop-up untuk ' +
      'mencetak PDF.');
  }
  const r = data.ringkasan;
  const page = html`<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8">
    <title>${result.fileName}</title><style>${raw(PRINT_CSS)}</style></head><body>
    <h1>Analitik Penggunaan TKA</h1>
    <p>${periodLabel(data)} · ${filterSummary(result.filter)}</p>
    <dl><dt>Jumlah TKA</dt><dd>${number.format(r.totalTka)}</dd>
      <dt>Permohonan pengesahan</dt><dd>${number.format(r.totalPengesahan)}</dd>
      <dt>PNBP DKPTKA (estimasi)</dt><dd>Rp${number.format(r.pnbpRupiah)}</dd>
      <dt>Pemberi kerja</dt><dd>${number.format(r.perusahaan)}</dd></dl>
    <table><thead><tr><th>Periode</th><th>Wilayah</th>
      <th class="num">Jumlah TKA</th><th class="num">Pengesahan</th></tr>
    </thead><tbody>${result.rows.map((row) => html`<tr>
      <td>${row.periode}</td><td>${row.wilayah}</td>
      <td class="num">${number.format(row.tka)}</td>
      <td class="num">${number.format(row.pengesahan)}</td></tr>`)}</tbody>
    </table>
    <p>Prototipe TKA Online — data contoh (mock), bukan statistik resmi.</p>
    </body></html>`;
  popup.document.open();
  popup.document.write(page.value);
  popup.document.close();
  popup.focus();
  popup.print();
}
