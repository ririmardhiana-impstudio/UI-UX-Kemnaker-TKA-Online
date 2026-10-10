/**
 * @fileoverview Back Office "Jadwal ekspos" (weekly telewicara calendar,
 * sesi daring + BAP, hasil ekspos, belum dijadwalkan) and "Tanda tangan"
 * (Direktur multi-select + electronic signature modal -> POST
 * /antrian/signatures; HPK & Pengesahan diteruskan ke Direktur Jenderal)
 * screens.
 */

import { signAntrian } from '../../api/antrian.js';
import { html, qs, setHtml } from '../../components/dom.js';
import { EKSPOS_HIGHLIGHT, EKSPOS_RESULT, ROLES } from './config.js';
import { createEksposBapView } from './ekspos-bap-view.js';
import {
  CARD, THEAD, choiceClass, pageHeader, preserveFocus, showToast,
} from './ui.js';

const DIRECTOR = ROLES.find((r) => r.k === 'dir');

/**
 * @param {{state: !Object, setState: function(!Object),
 *     queueOf: function(!Object): !Array}} ctx
 * @return {{renderEkspos: function(), renderTtd: function()}}
 */
export function createEksposTtdViews(ctx) {
  const eksposEl = qs('#page-ekspos');
  const ttdEl = qs('#page-ttd');
  const modal = qs('#sign-modal');
  const signForm = qs('#sign-form');
  const bapView = createEksposBapView(ctx);

  eksposEl.addEventListener('click', onEksposClick);
  eksposEl.addEventListener('input', (event) => {
    if (event.target.id === 'ekspos-note') {
      ctx.state.eksposNote = event.target.value;
    }
  });
  ttdEl.addEventListener('click', onTtdClick);
  ttdEl.addEventListener('change', (event) => {
    const id = event.target.dataset.ttd;
    if (id) {
      const { ttdSel } = ctx.state;
      ctx.setState({ ttdSel: { ...ttdSel, [id]: event.target.checked } });
    }
  });
  qs('#sign-cancel').addEventListener('click', () => modal.close());
  signForm.addEventListener('submit', onSign);

  function renderEkspos() {
    const { state } = ctx;
    const schedule = state.data.schedule;
    const unscheduled = state.data.antrian
      .filter((q) => q.tahap === 'Verifikasi Data dan Upload' &&
        q.jenis === 'HPK' && q.tone !== 'red')
      .slice(0, 2);
    preserveFocus(eksposEl, () => setHtml(eksposEl, html`
      ${pageHeader({ id: 'ekspos-title', eyebrow: 'Petugas Ekspos',
        title: 'Jadwal telewicara · 5–9 Oktober 2026',
        actions: html`<div class="flex gap-2">
          <button type="button" data-action="week" data-focus-key="prev"
            class="btn btn-sm h-9 bg-base-100 font-normal">‹ Minggu lalu
          </button>
          <button type="button" data-action="week" data-focus-key="next"
            class="btn btn-sm h-9 bg-base-100 font-normal">Minggu depan ›
          </button></div>` })}
      ${calendar(schedule)}
      ${bapView.sessionsCard()}
      <div class="grid items-start gap-5 lg:grid-cols-2">
        ${resultCard(state)}
        ${unscheduledCard(unscheduled)}
      </div>
      ${bapView.summaryCard()}`));
  }

  function onEksposClick(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) {
      return;
    }
    const { action } = button.dataset;
    if (action === 'result') {
      ctx.setState({ eksposResult: button.dataset.value });
    } else if (action === 'week') {
      showToast('Prototipe hanya memuat jadwal 5–9 Oktober 2026.', 'info');
    } else if (action === 'bap') {
      showToast(`BAP ekspos ${EKSPOS_RESULT.no} disiapkan untuk dicetak.`,
        'info');
    } else if (action === 'save') {
      showToast('Hasil ekspos disimpan; draft surat dibuat.');
    } else if (action === 'schedule') {
      showToast(`${button.dataset.name} masuk daftar penjadwalan.`, 'info');
    }
  }

  function ttdRows() {
    return ctx.queueOf(DIRECTOR).map((q) => {
      const isHpk = q.jenis === 'HPK';
      return { ...q,
        doc: isHpk ? 'Hasil Penilaian Kelayakan'
          : 'Persetujuan Pengesahan RPTKA',
        chain: isHpk ? 'Validator (Kasi) ✓ · Kasubdit ✓'
          : 'Validator (Subkoordinator) ✓ · Koordinator ✓',
        isOn: Boolean(ctx.state.ttdSel[q.id]) };
    });
  }

  function renderTtd() {
    const rows = ttdRows();
    const signN = rows.filter((t) => t.isOn).length;
    const { signed } = ctx.state;
    preserveFocus(ttdEl, () => setHtml(ttdEl, html`
      ${pageHeader({ id: 'ttd-title',
        eyebrow: 'Direktur PPTKA · diteruskan ke Direktur Jenderal',
        title: 'Persetujuan & tanda tangan elektronik',
        actions: html`<button type="button" data-action="open-sign"
          data-focus-key="open-sign" ${signN ? '' : 'disabled'}
          class="btn btn-primary h-auto rounded-[10px] px-4.5 py-3
                 text-sm font-bold">Tandatangani ${signN} dokumen</button>` })}
      ${signed ? html`<div role="status"
        class="alert alert-success alert-soft rounded-xl text-sm
               font-semibold">${signed}</div>` : ''}
      <div class="${CARD} overflow-x-auto">
        <table class="table min-w-[900px] text-sm">
          <thead class="${THEAD}"><tr>
            <th scope="col" class="w-10"><span class="sr-only">Pilih</span></th>
            <th scope="col">No.</th><th scope="col">Pemohon</th>
            <th scope="col">Dokumen</th><th scope="col">Diperiksa</th>
            <th scope="col"><span class="sr-only">Aksi</span></th>
          </tr></thead>
          <tbody>${rows.map(ttdRow)}</tbody>
        </table>
      </div>`));
  }

  function onTtdClick(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) {
      return;
    }
    if (button.dataset.action === 'open-sign') {
      qs('#sign-count').textContent =
        String(ttdRows().filter((t) => t.isOn).length);
      modal.showModal();
    } else if (button.dataset.action === 'preview') {
      ctx.setState({ page: 'review', sel: button.dataset.id, marks: {},
        notes: {}, docIdx: 0, docOverride: 'Draft surat',
        decisionNote: null }, { focus: true });
    }
  }

  function showPassphraseError(message) {
    const input = qs('#sign-passphrase');
    const error = qs('#sign-passphrase-error');
    input.setAttribute('aria-invalid', String(Boolean(message)));
    error.hidden = !message;
    error.textContent = message ?? '';
    if (message) {
      input.focus();
    }
  }

  async function onSign(event) {
    event.preventDefault();
    const input = qs('#sign-passphrase');
    if (!input.checkValidity()) {
      showPassphraseError('Passphrase wajib diisi (minimal 6 karakter).');
      return;
    }
    showPassphraseError(null);
    const ids = ttdRows().filter((t) => t.isOn).map((t) => t.id);
    const submit = qs('button[type="submit"]', signForm);
    submit.disabled = true;
    submit.setAttribute('aria-busy', 'true');
    try {
      const result = await signAntrian(ids, input.value);
      applySigned(result.rows);
      const forwarded = result.forwardedToDirjen
        ? ` ${result.forwardedToDirjen} diteruskan ke Direktur Jenderal ` +
          'untuk persetujuan akhir.'
        : '';
      const issued = result.signed - result.forwardedToDirjen;
      modal.close();
      ctx.setState({ signed: `${result.signed} dokumen ditandatangani.` +
        `${forwarded}${issued ? ` ${issued} diterbitkan.` : ''}` });
      qs('[data-focus-key="open-sign"]', ttdEl)?.focus();
    } catch (error) {
      if (error.field === 'passphrase') {
        showPassphraseError(error.message);
      } else {
        showToast(error.message || 'Tanda tangan gagal.', 'error');
      }
    } finally {
      submit.disabled = false;
      submit.setAttribute('aria-busy', 'false');
    }
  }

  /**
   * Signed rows left the director stage (now at the Dirjen stage or
   * issued); update them so the Dirjen queue picks them up.
   */
  function applySigned(rows) {
    const byId = new Map(rows.map((r) => [r.id, r]));
    for (const q of ctx.state.data.antrian) {
      if (byId.has(q.id)) {
        Object.assign(q, byId.get(q.id));
      }
    }
    ctx.state.ttdSel = Object.fromEntries(Object.entries(ctx.state.ttdSel)
      .filter(([id]) => !byId.has(id)));
  }

  return { renderEkspos, renderTtd };
}

function calendar({ days, times, events }) {
  return html`
    <div class="${CARD} overflow-x-auto">
      <table class="w-full min-w-[900px] table-fixed border-collapse">
        <caption class="sr-only">Jadwal telewicara per jam dan hari</caption>
        <thead class="${THEAD} text-left">
          <tr><th scope="col" class="w-20 p-2.5"><span class="sr-only">Jam
            </span></th>
            ${days.map((d) => html`<th scope="col"
              class="border-l border-base-200 p-2.5">${d}</th>`)}</tr>
        </thead>
        <tbody>${times.map((t) => html`
          <tr class="h-16 border-t border-base-200 align-top">
            <th scope="row" class="p-2.5 text-left text-xs font-normal
              text-base-content/70">${t}</th>
            ${days.map((_, i) => eventCell(events[`${t}-${i}`]))}
          </tr>`)}</tbody>
      </table>
    </div>`;
}

function eventCell(event) {
  if (!event) {
    return html`<td class="border-l border-base-200 p-1.5"></td>`;
  }
  const [who, what] = event;
  const tone = EKSPOS_HIGHLIGHT.test(who)
    ? 'border-secondary bg-info/10'
    : 'border-base-content/40 bg-base-200';
  return html`
    <td class="border-l border-base-200 p-1.5">
      <div class="rounded-lg border-l-3 px-2.5 py-2 text-xs leading-snug
                  ${tone}">
        <b class="block">${who}</b>
        <span class="text-base-content/80">${what}</span>
      </div>
    </td>`;
}

function resultCard(state) {
  const isLayak = state.eksposResult === 'layak';
  const note = state.eksposNote ?? EKSPOS_RESULT.note;
  return html`
    <div class="${CARD} grid gap-3 p-5 text-sm">
      <h2 class="text-[15px] font-bold">Hasil ekspos · ${EKSPOS_RESULT.no}</h2>
      <dl class="grid grid-cols-[130px_1fr] gap-x-3 gap-y-1.5">
        ${EKSPOS_RESULT.rows.map(([k, v], i) => html`
          <dt class="text-base-content/70">${k}</dt>
          <dd class="${i === 0 ? 'font-bold' : ''}">${v}</dd>`)}
      </dl>
      <div class="grid grid-cols-2 gap-2" role="group"
           aria-label="Hasil penilaian ekspos">
        <button type="button" data-action="result" data-value="layak"
          data-focus-key="layak" aria-pressed="${String(isLayak)}"
          class="${choiceClass(isLayak, 'success', 'text-sm')} border-2 py-3">
          Layak</button>
        <button type="button" data-action="result" data-value="tidak"
          data-focus-key="tidak" aria-pressed="${String(!isLayak)}"
          class="${choiceClass(!isLayak, 'error', 'text-sm')} border-2 py-3">
          Tidak layak</button>
      </div>
      <label for="ekspos-note" class="sr-only">Catatan hasil ekspos</label>
      <textarea id="ekspos-note" rows="4"
        class="textarea w-full resize-y text-sm">${note}</textarea>
      <div class="flex flex-wrap justify-end gap-2">
        <button type="button" data-action="bap" class="btn font-bold">
          Cetak BAP</button>
        <button type="button" data-action="save"
          class="btn btn-primary font-bold">Simpan &amp; buat draft surat
        </button>
      </div>
    </div>`;
}

function unscheduledCard(rows) {
  return html`
    <div class="${CARD} grid gap-2.5 p-5 text-sm">
      <h2 class="text-[15px] font-bold">Belum dijadwalkan</h2>
      <ul class="grid gap-2.5">${rows.map((u) => html`
        <li class="flex items-center justify-between gap-2.5 rounded-[10px]
                   border border-base-200 p-3">
          <div><b>${u.pemohon}</b>
            <div class="text-xs text-base-content/70">
              ${u.no} · ${u.layanan}</div></div>
          <button type="button" data-action="schedule"
            data-name="${u.pemohon}" data-focus-key="sched-${u.id}"
            class="btn btn-primary btn-sm text-xs font-bold"
            aria-label="Jadwalkan ${u.no}">Jadwalkan</button>
        </li>`)}</ul>
    </div>`;
}

function ttdRow(t) {
  return html`
    <tr class="border-base-200">
      <td><input type="checkbox" data-ttd="${t.id}"
        data-focus-key="ttd-${t.id}" class="checkbox checkbox-sm
        checkbox-primary" ${t.isOn ? 'checked' : ''}
        aria-label="Pilih ${t.no} untuk ditandatangani"></td>
      <td class="font-mono text-xs font-bold">${t.no}</td>
      <td><b>${t.pemohon}</b>
        <div class="text-xs text-base-content/70">${t.kategori}</div></td>
      <td>${t.doc}<div class="text-xs text-base-content/70">${t.tka}</div></td>
      <td class="text-xs text-base-content/80">${t.chain}</td>
      <td><button type="button" data-action="preview" data-id="${t.id}"
        class="cursor-pointer text-xs font-bold text-secondary
               hover:underline" aria-label="Pratinjau surat ${t.no}">
        Pratinjau surat</button></td>
    </tr>`;
}
