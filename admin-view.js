/**
 * @fileoverview Back Office "Validasi pembayaran" (pejabat pemda),
 * "Pendaftar" (verifikasi akun: POST /pendaftar/{npwp}/activate |
 * request-fix) and "Pengaturan" (admin, tabbed) screens.
 */

import { decidePemdaValidation } from '../../api/pemda.js';
import {
  activatePendaftar, requestPendaftarFix,
} from '../../api/pendaftar.js';
import { html, qs, setHtml } from '../../components/dom.js';
import { statusBadge } from '../../components/status-badge.js';
import { validatePendaftarFix } from '../../contracts/back-office.js';
import {
  ADMIN_TABS, DOCUMENT_CATEGORIES, ROLES, groupLabelOf,
} from './config.js';
import { CARD, THEAD, pageHeader, preserveFocus, showToast } from './ui.js';

const PEMDA_TONE = { Tervalidasi: 'green', Ditolak: 'red' };
const PEMDA_PENDING = 'Menunggu validasi';
const JABATAN_TONE = { Diperbolehkan: 'green', Dilarang: 'red' };

/**
 * @param {{state: !Object, setState: function(!Object)}} ctx
 * @return {{renderPemda: function(), renderAkun: function(),
 *     renderAdmin: function()}}
 */
export function createAdminViews(ctx) {
  const pemdaEl = qs('#page-pemda');
  const akunEl = qs('#page-akun');
  const adminEl = qs('#page-admin');

  pemdaEl.addEventListener('click', onPemdaClick);
  akunEl.addEventListener('click', onAkunClick);
  adminEl.addEventListener('click', onAdminClick);
  adminEl.addEventListener('keydown', onAdminKeydown);

  function renderPemda() {
    const rows = ctx.state.data.pemda;
    preserveFocus(pemdaEl, () => setHtml(pemdaEl, html`
      <div>
        <p class="text-sm text-base-content/70">
          Pejabat Pemda · Dinas Tenaga Kerja Kab. Bekasi</p>
        <h1 id="pemda-title" tabindex="-1" class="mb-1.5 mt-1 text-2xl
          font-extrabold tracking-tight focus:outline-none md:text-[26px]">
          Validasi pembayaran DKPTKA (retribusi daerah)</h1>
        <p class="max-w-[760px] text-sm leading-relaxed text-base-content/80">
          Perpanjangan dengan lokasi kerja dalam satu kabupaten/kota masuk
          pendapatan daerah. SK baru terbit setelah pembayaran divalidasi
          (Permenaker 8/2021 Ps. 36 ayat 7).</p>
      </div>
      <div class="${CARD} overflow-x-auto">
        <table class="table min-w-[900px] text-sm">
          <thead class="${THEAD}"><tr>
            <th scope="col">Pemberi kerja</th><th scope="col">TKA · jabatan</th>
            <th scope="col">Jumlah</th><th scope="col">Bukti setor</th>
            <th scope="col">Status</th>
            <th scope="col"><span class="sr-only">Aksi</span></th>
          </tr></thead>
          <tbody>${rows.map((p) => pemdaRow(p, ctx.state.pemdaBusy))}</tbody>
        </table>
      </div>`));
  }

  async function onPemdaClick(event) {
    const button = event.target.closest('button[data-decision]');
    if (!button) {
      return;
    }
    const { id, decision } = button.dataset;
    ctx.setState({ pemdaBusy: id });
    try {
      const updated = await decidePemdaValidation(id, decision);
      const rows = ctx.state.data.pemda
        .map((p) => (p.id === id ? updated : p));
      ctx.state.data.pemda = rows;
      showToast(`Pembayaran ${updated.tka} ${decision.toLowerCase()}.`,
        decision === 'Ditolak' ? 'info' : 'success');
    } catch (error) {
      showToast(error.message || 'Keputusan gagal disimpan.', 'error');
    } finally {
      ctx.setState({ pemdaBusy: null });
      qs(`[data-focus-key="status-${id}"]`, pemdaEl)?.focus();
    }
  }

  function renderAkun() {
    const { state } = ctx;
    const list = state.data.pendaftar;
    const ap = list[state.akunSel] ?? list[0];
    preserveFocus(akunEl, () => setHtml(akunEl, html`
      <div>
        <p class="text-sm text-base-content/70">Petugas verifikasi akun</p>
        <h1 id="akun-title" tabindex="-1" class="mt-1 text-2xl font-extrabold
          tracking-tight focus:outline-none md:text-[26px]">
          Pendaftar pemberi kerja</h1>
      </div>
      <div class="grid items-start gap-5 lg:grid-cols-2">
        <ul class="${CARD} overflow-auto" aria-label="Daftar pendaftar">
          ${list.map((p, i) => pendaftarItem(p, i, i === state.akunSel))}
        </ul>
        ${akunDetail(ap, state.akunSel)}
      </div>`));
  }

  function onAkunClick(event) {
    const button = event.target.closest('button[data-akun], button[data-action]');
    if (!button) {
      return;
    }
    if (button.dataset.akun !== undefined) {
      ctx.setState({ akunSel: Number(button.dataset.akun) });
      return;
    }
    submitAkunAction(button);
  }

  async function submitAkunAction(button) {
    const { akunSel } = ctx.state;
    const ap = ctx.state.data.pendaftar[akunSel];
    const isActivate = button.dataset.action === 'activate';
    const noteEl = qs('#akun-note');
    const catatan = noteEl.value.trim();
    if (!isActivate) {
      const check = validatePendaftarFix({ catatan });
      noteEl.setAttribute('aria-invalid', String(!check.valid));
      noteEl.classList.toggle('textarea-error', !check.valid);
      if (!check.valid) {
        showToast(`Catatan kekurangan: ${check.errors.catatan}`, 'error');
        noteEl.focus();
        return;
      }
    }
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    try {
      const updated = isActivate ? await activatePendaftar(ap.npwp)
        : await requestPendaftarFix(ap.npwp, catatan);
      ctx.state.data.pendaftar[akunSel] = updated;
      showToast(isActivate ? `Akun ${ap.nama} diaktifkan.`
        : `Permintaan perbaikan dikirim ke ${ap.nama}.`);
      ctx.setState({ akunSel });
    } catch (error) {
      showToast(error.message || 'Aksi gagal disimpan.', 'error');
      button.disabled = false;
      button.setAttribute('aria-busy', 'false');
    }
  }

  function adminTable(tab) {
    const { data } = ctx.state;
    if (tab === 0) {
      return { cols: ['Kode', 'Nama jabatan', 'Dasar', 'Status'],
        rows: data.jabatan.map((j) => ({ a: j.kode, b: j.nama, c: j.dasar,
          d: j.status, t: JABATAN_TONE[j.status] ?? 'amber' })) };
    }
    if (tab === 1) {
      return { cols: ['Dokumen', 'Layanan', 'Format / ukuran', 'Status'],
        rows: DOCUMENT_CATEGORIES.map(([a, b, c]) =>
          ({ a, b, c, d: 'Aktif', t: 'green' })) };
    }
    if (tab === 2) {
      return { cols: ['Judul', 'Tanggal', 'Jenis', 'Status'],
        rows: data.pengumuman.map((p) => ({ a: p.judul, b: p.tgl, c: p.tag,
          d: 'Wajib baca', t: 'amber' })) };
    }
    return { cols: ['Nama', 'Peran', 'Unit', 'Status'],
      rows: ROLES.filter((r) => r.k !== 'admin').map((r) => ({ a: r.nama,
        b: r.label, c: r.jab, d: 'Aktif', t: 'green' })) };
  }

  function renderAdmin() {
    const tab = ctx.state.adminTab;
    const { cols, rows } = adminTable(tab);
    preserveFocus(adminEl, () => setHtml(adminEl, html`
      ${pageHeader({ id: 'admin-title', eyebrow: 'Admin Pusat',
        title: 'Pengaturan sistem',
        actions: html`<button type="button" data-action="add"
          class="btn btn-primary h-auto rounded-[10px] px-4 py-2.75 text-sm
                 font-bold">+ Tambah</button>` })}
      <div role="tablist" aria-label="Pengaturan sistem"
           class="tabs tabs-border gap-6 border-b border-base-300">
        ${ADMIN_TABS.map((label, i) => html`
          <button type="button" role="tab" id="admin-tab-${i}"
            data-tab="${i}" data-focus-key="tab-${i}"
            aria-selected="${String(i === tab)}" aria-controls="admin-panel"
            tabindex="${i === tab ? '0' : '-1'}"
            class="tab -mb-px h-auto px-0 py-2.5 text-sm font-bold
              ${i === tab ? 'tab-active' : 'text-base-content/70'}">
            ${label}</button>`)}
      </div>
      ${tab === ADMIN_TABS.length - 1 ? html`<p class="flex flex-wrap
          items-center gap-2 rounded-box border border-info/20 bg-info/10
          px-4 py-3 text-[13px] text-base-content/80">Peran, status aktif,
          dan matriks izin pengguna internal dikelola di halaman Peran &amp;
          akses (tercatat di audit log).
        <button type="button" data-goto-page="akses"
          class="btn btn-sm btn-outline">Buka Peran &amp; akses</button></p>`
        : ''}
      <div id="admin-panel" role="tabpanel" aria-labelledby="admin-tab-${tab}"
           class="${CARD} overflow-x-auto">
        <table class="table min-w-[900px] text-sm">
          <thead class="${THEAD}"><tr>
            ${cols.map((h) => html`<th scope="col">${h}</th>`)}
            <th scope="col"><span class="sr-only">Aksi</span></th>
          </tr></thead>
          <tbody>${rows.map((r) => html`
            <tr class="border-base-200">
              <td class="font-semibold">${r.a}</td><td>${r.b}</td>
              <td>${r.c}</td><td>${statusBadge(r.d, r.t)}</td>
              <td class="w-22 text-right"><button type="button"
                data-action="edit" data-name="${r.a}"
                class="cursor-pointer text-xs font-bold text-secondary
                       hover:underline" aria-label="Ubah ${r.a}">Ubah</button>
              </td>
            </tr>`)}</tbody>
        </table>
      </div>`));
  }

  function onAdminClick(event) {
    const goto = event.target.closest('button[data-goto-page]');
    if (goto) {
      ctx.setState({ page: goto.dataset.gotoPage }, { focus: true });
      return;
    }
    const tabButton = event.target.closest('button[data-tab]');
    if (tabButton) {
      ctx.setState({ adminTab: Number(tabButton.dataset.tab) });
      return;
    }
    const button = event.target.closest('button[data-action]');
    if (!button) {
      return;
    }
    const tabLabel = ADMIN_TABS[ctx.state.adminTab];
    showToast(button.dataset.action === 'add'
      ? `Formulir tambah ${tabLabel.toLowerCase()} belum tersedia di prototipe.`
      : `Formulir ubah "${button.dataset.name}" belum tersedia di prototipe.`,
    'info');
  }

  function onAdminKeydown(event) {
    if (!event.target.matches('[role="tab"]')) {
      return;
    }
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    const jump = { Home: 0, End: ADMIN_TABS.length - 1 }[event.key];
    if (step === undefined && jump === undefined) {
      return;
    }
    event.preventDefault();
    const count = ADMIN_TABS.length;
    const next = jump ?? (ctx.state.adminTab + step + count) % count;
    ctx.setState({ adminTab: next });
    qs(`#admin-tab-${next}`, adminEl)?.focus();
  }

  return { renderPemda, renderAkun, renderAdmin };
}

function pemdaRow(p, busyId) {
  const isPending = p.status === PEMDA_PENDING;
  const isBusy = busyId === p.id;
  return html`
    <tr class="border-base-200">
      <td class="font-bold">${p.pk}</td>
      <td>${p.tka}<div class="text-xs text-base-content/70">${p.jab}</div></td>
      <td class="font-bold">${p.jml}</td>
      <td class="text-xs">${p.bukti}</td>
      <td tabindex="-1" data-focus-key="status-${p.id}">
        ${statusBadge(p.status, PEMDA_TONE[p.status] ?? 'amber')}</td>
      <td><div class="flex justify-end gap-1.5">${isPending ? html`
        <button type="button" data-id="${p.id}" data-decision="Ditolak"
          ${isBusy ? 'disabled' : ''} aria-label="Tolak pembayaran ${p.tka}"
          class="btn btn-sm border-error/30 bg-base-100 text-xs font-bold
                 text-error">Tolak</button>
        <button type="button" data-id="${p.id}" data-decision="Tervalidasi"
          ${isBusy ? 'disabled' : ''} aria-label="Validasi pembayaran ${p.tka}"
          class="btn btn-primary btn-sm text-xs font-bold">
          ${isBusy ? html`<span class="loading loading-spinner loading-xs"
            aria-hidden="true"></span>` : ''}Validasi</button>` : ''}
      </div></td>
    </tr>`;
}

function pendaftarItem(p, i, isSelected) {
  const cls = isSelected ? 'border-l-primary bg-base-200'
    : 'border-l-transparent hover:bg-base-200/50';
  return html`
    <li><button type="button" data-akun="${i}" data-focus-key="akun-${i}"
      aria-pressed="${String(isSelected)}"
      class="grid w-full cursor-pointer gap-1 border-b border-l-3
             border-b-base-200 px-4.5 py-3.5 text-left ${cls}">
      <span class="flex justify-between gap-2">
        <b class="text-sm">${p.nama}</b>${statusBadge(p.status, p.tone)}</span>
      <span class="text-xs text-base-content/70">
        ${p.kategori} · ${p.tgl} · SSO ${p.sso}</span>
    </button></li>`;
}

function akunDetail(ap, akunSel) {
  const docs = [['NPWP', true], ['WLKP', true], ['NIB', akunSel !== 2],
    ['Dokumen lainnya', true]];
  return html`
    <div class="${CARD} grid gap-3.5 p-5.5 text-sm">
      <h2 class="text-[17px] font-bold" aria-live="polite">${ap.nama}</h2>
      <dl class="grid grid-cols-[150px_1fr] gap-x-3 gap-y-1.5">
        <dt class="text-base-content/70">Jenis pemberi kerja</dt>
        <dd>${ap.jenisPemberiKerja ?? '—'}</dd>
        <dt class="text-base-content/70">Kategori</dt><dd>${ap.kategori}</dd>
        <dt class="text-base-content/70">NPWP</dt>
        <dd>${ap.npwp} <b class="text-success">✓ valid</b></dd>
        <dt class="text-base-content/70">Didaftarkan oleh</dt>
        <dd>${ap.sso} (SIAPkerja)</dd>
        <dt class="text-base-content/70">Tautan aktivasi</dt>
        <dd class="font-bold ${ap.email ? 'text-success' : 'text-base-content/60'}">
          ${ap.email ? 'Sudah dikirim' : 'Belum dikirim'}</dd>
      </dl>
      ${ap.catatan ? html`<p class="rounded-lg border border-error/30
        bg-error/10 px-3.5 py-2.5 text-[13px] leading-normal text-error">
        <b>Catatan perbaikan sebelumnya:</b> ${ap.catatan}</p>` : ''}
      <ul class="grid gap-1.5" aria-label="Hasil pemeriksaan dokumen">
        ${docs.map(([n, ok]) => html`
          <li class="flex justify-between rounded-lg border border-base-200
                     px-3 py-2.5"><span>${n}</span>
            <span class="font-bold ${ok ? 'text-success' : 'text-error'}">
              ${ok ? 'Sesuai' : 'Tidak terbaca'}</span></li>`)}
      </ul>
      <p class="rounded-lg bg-base-200 px-3 py-2.5 leading-normal
                text-base-content/80">Kelompok hasil kategori:
        <b>${groupLabelOf(ap.kategori)}</b> — menentukan menu, alur, dan
        kewajiban DKPTKA.</p>
      <label for="akun-note" class="sr-only">Catatan kekurangan</label>
      <textarea id="akun-note" rows="2" class="textarea w-full text-sm"
        placeholder="Catatan kekurangan (tampil saat pemohon login)"></textarea>
      <div class="grid grid-cols-2 gap-2">
        <button type="button" data-action="fix"
          class="btn h-auto border-error/30 bg-base-100 py-3 font-bold
                 text-error">Minta perbaikan</button>
        <button type="button" data-action="activate"
          class="btn btn-primary h-auto py-3 font-bold">Aktifkan akun</button>
      </div>
    </div>`;
}
