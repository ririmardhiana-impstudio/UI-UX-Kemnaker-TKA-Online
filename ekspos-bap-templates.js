/**
 * @fileoverview Markup of the ekspos sessions table, BAP summary items and
 * the read-only BAP dialog (split from ekspos-bap-view.js).
 */

import { html } from '../../components/dom.js';
import { statusBadge } from '../../components/status-badge.js';

export const HASIL_TONE = { 'Layak': 'green', 'Tidak layak': 'red',
  'Ditunda': 'amber' };
export const SAFE_URL = /^https:\/\//;

export function sessionRow(s) {
  return html`
    <tr class="border-base-200 align-top">
      <td class="whitespace-nowrap"><b>${s.hari}</b>
        <div class="text-xs text-base-content/70">${s.jam} WIB</div></td>
      <td><b>${s.pemohon}</b>
        <div class="text-xs text-base-content/70">
          ${s.layanan} · antrian ${s.antrian}</div></td>
      <td>${modeBadge(s)}
        ${s.platform ? html`<div class="mt-1 text-xs text-base-content/70">
          ${s.platform}</div>` : ''}</td>
      <td>${linkCell(s)}</td>
      <td>${s.bap ? html`<span class="font-mono text-xs font-bold">
          ${s.bap.nomor}</span>
        <div class="mt-1">${statusBadge(s.bap.hasil, HASIL_TONE[s.bap.hasil])}
        </div>` : bapButton(s)}</td>
    </tr>`;
}

/** "Isi BAP" — disabled until a daring session has its meeting link. */
function bapButton(s) {
  const needsLink = s.mode === 'Daring' && !s.meetingUrl;
  return html`<button type="button" data-action="bap-open"
      data-id="${s.id}" data-focus-key="bap-${s.id}"
      class="btn btn-sm text-xs font-bold"
      aria-label="Isi BAP ${s.pemohon} antrian ${s.antrian}"
      ${needsLink ? html`disabled aria-describedby="bap-hint-${s.id}"` : ''}>
      Isi BAP</button>
    ${needsLink ? html`<p id="bap-hint-${s.id}" class="mt-1 text-xs
      text-base-content/70">Buat tautan dulu</p>` : ''}`;
}

function modeBadge(s) {
  const tone = s.mode === 'Daring' ? 'badge-info' : 'badge-neutral';
  return html`<span class="badge badge-soft badge-sm ${tone} font-bold">
    ${s.mode}</span>`;
}

function linkCell(s) {
  if (s.mode !== 'Daring') {
    return html`<span class="text-xs text-base-content/70">
      ${s.lokasi ?? 'Tatap muka'}</span>`;
  }
  if (s.meetingUrl && SAFE_URL.test(s.meetingUrl)) {
    return html`<a href="${s.meetingUrl}" target="_blank"
      rel="noopener noreferrer" data-focus-key="link-${s.id}"
      class="link link-secondary text-xs font-bold">Buka tautan
      <span class="sr-only">ekspos ${s.pemohon} (tab baru)</span> ↗</a>`;
  }
  return html`<button type="button" data-action="meeting-open"
    data-id="${s.id}" data-focus-key="bap-${s.id}-link"
    class="btn btn-primary btn-sm text-xs font-bold"
    aria-label="Buat tautan ekspos ${s.pemohon} antrian ${s.antrian}">
    Buat tautan</button>`;
}

export function bapItem(s) {
  const { bap } = s;
  return html`
    <li class="grid gap-1.5 rounded-[10px] border border-base-200 p-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <button type="button" data-action="bap-view" data-id="${s.id}"
          data-focus-key="bap-view-${s.id}"
          class="link link-secondary font-mono text-xs font-bold"
          aria-label="Lihat BAP ${bap.nomor} ${s.pemohon}">${bap.nomor}
          · Lihat BAP</button>
        ${statusBadge(bap.hasil, HASIL_TONE[bap.hasil])}
      </div>
      <p class="font-bold">${s.pemohon}
        <span class="font-normal text-base-content/70">· ${s.hari}
          · ${bap.durasiMenit} menit · ${bap.peserta.length} peserta</span></p>
      <p class="line-clamp-3 text-base-content/80">${bap.ringkasan}</p>
      ${bap.rekamanUrl && SAFE_URL.test(bap.rekamanUrl) ? html`<a
        href="${bap.rekamanUrl}" target="_blank" rel="noopener noreferrer"
        class="link link-secondary justify-self-start text-xs font-bold">
        Rekaman ekspos<span class="sr-only"> ${s.pemohon} (tab baru)</span>
        ↗</a>` : ''}
    </li>`;
}

/** Read-only BAP dialog content (full ringkasan, peserta, rekaman). */
export function bapDetail(s) {
  const { bap } = s;
  return html`<div class="modal-box grid max-w-xl gap-3.5 p-7">
      <h2 id="ekspos-bap-view-title" class="text-lg font-bold">BAP
        ${bap.nomor}</h2>
      <p class="text-sm text-base-content/80"><b>${s.pemohon}</b> ·
        ${s.layanan} · ${s.hari} · ${s.jam} WIB · ${s.mode}</p>
      <dl class="grid gap-x-3 gap-y-1.5 text-sm sm:grid-cols-[140px_1fr]">
        <dt class="text-base-content/70">Hasil</dt>
        <dd>${statusBadge(bap.hasil, HASIL_TONE[bap.hasil])}</dd>
        <dt class="text-base-content/70">Durasi</dt>
        <dd>${bap.durasiMenit} menit</dd>
        <dt class="text-base-content/70">Ringkasan</dt>
        <dd class="whitespace-pre-line">${bap.ringkasan}</dd>
        <dt class="text-base-content/70">Peserta</dt>
        <dd><ul class="list-inside list-disc">${bap.peserta.map((p) =>
          html`<li>${p}</li>`)}</ul></dd>
        <dt class="text-base-content/70">Rekaman</dt>
        <dd>${bap.rekamanUrl && SAFE_URL.test(bap.rekamanUrl) ? html`<a
          href="${bap.rekamanUrl}" target="_blank" rel="noopener noreferrer"
          class="link link-secondary">Buka rekaman<span class="sr-only">
          (tab baru)</span> ↗</a>` : '—'}</dd></dl>
      <div class="modal-action mt-1">
        <button type="button" data-dialog-cancel class="btn">Tutup</button>
      </div></div>
    <form method="dialog" class="modal-backdrop">
      <button type="submit">Tutup</button></form>`;
}
