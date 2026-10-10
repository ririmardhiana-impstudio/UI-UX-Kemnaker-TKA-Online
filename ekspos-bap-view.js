/**
 * @fileoverview Back Office "Jadwal ekspos" — sesi ekspos daring (KAK
 * Modul 5: media ekspos seperti zoom meeting yang terdokumentasi sistem,
 * usulan [I]). Per session: "Buat tautan" dialog -> POST
 * /ekspos-schedule/{id}/meetings, "Isi BAP" dialog -> POST
 * /ekspos-schedule/{id}/bap, and a BAP summary card.
 */

import { createEksposBap, createEksposMeeting } from '../../api/ekspos.js';
import { html, qs, setHtml } from '../../components/dom.js';
import { emptyState } from '../../components/empty-state.js';
import {
  BAP_DURASI_MAX, BAP_DURASI_MIN, BAP_HASIL, BAP_RINGKASAN_MIN,
  EKSPOS_PLATFORMS, validateEksposBap, validateEksposMeeting,
} from '../../contracts/back-office.js';
import {
  bapDetail, bapItem, sessionRow,
} from './ekspos-bap-templates.js';
import {
  CARD, THEAD, ensureDialog, errorSlot, setButtonBusy, showFieldErrors,
  showToast,
} from './ui.js';

const WIB_OFFSET = ':00+07:00';
const DEFAULT_PESERTA = 'Bayu Kurniawan (Petugas Ekspos)';

/**
 * @param {{state: !Object, setState: function(!Object)}} ctx
 * @return {{sessionsCard: function(): !Object,
 *     summaryCard: function(): !Object}}
 */
export function createEksposBapView(ctx) {
  const eksposEl = qs('#page-ekspos');
  const meetingDialog = ensureDialog('ekspos-meeting-modal',
    'ekspos-meeting-title');
  const bapDialog = ensureDialog('ekspos-bap-modal', 'ekspos-bap-title');
  const viewDialog = ensureDialog('ekspos-bap-view-modal',
    'ekspos-bap-view-title');
  let active = null;

  eksposEl.addEventListener('click', onClick);
  for (const dialog of [meetingDialog, bapDialog, viewDialog]) {
    dialog.addEventListener('click', (event) => {
      if (event.target.closest('[data-dialog-cancel]')) {
        dialog.close();
      }
    });
  }
  meetingDialog.addEventListener('submit', onMeetingSubmit);
  bapDialog.addEventListener('submit', onBapSubmit);

  function sessions() {
    return ctx.state.data.schedule.sessions ?? [];
  }

  function sessionsCard() {
    return html`
      <section class="${CARD} overflow-x-auto" aria-labelledby="sesi-title">
        <div class="flex flex-wrap items-baseline justify-between gap-2
                    border-b border-base-200 px-5 py-4">
          <h2 id="sesi-title" class="text-[15px] font-bold">
            Sesi ekspos daring &amp; BAP</h2>
          <p class="text-xs text-base-content/70">Tautan tampil di Beranda
            portal pemberi kerja · usulan</p>
        </div>
        <table class="table min-w-[900px] text-sm">
          <thead class="${THEAD}"><tr>
            <th scope="col">Jadwal</th><th scope="col">Pemohon</th>
            <th scope="col">Mode</th><th scope="col">Tautan</th>
            <th scope="col">BAP</th>
          </tr></thead>
          <tbody>${sessions().map(sessionRow)}</tbody>
        </table>
      </section>`;
  }

  function summaryCard() {
    const filed = sessions().filter((s) => s.bap);
    return html`
      <section class="${CARD} grid gap-3 p-5 text-sm"
        aria-labelledby="bap-summary-title">
        <h2 id="bap-summary-title" tabindex="-1"
          class="text-[15px] font-bold focus:outline-none">
          Ringkasan BAP ekspos</h2>
        ${filed.length ? html`<ul class="grid gap-2.5">${filed.map(bapItem)}
          </ul>` : emptyState({ icon: '✎', title: 'Belum ada BAP',
          body: 'Isi BAP dari tabel sesi setelah ekspos selesai.' })}
      </section>`;
  }

  function onClick(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) {
      return;
    }
    const { action, id } = button.dataset;
    const session = sessions().find((s) => s.id === id);
    if (action === 'meeting-open' && session) {
      openMeeting(session);
    } else if (action === 'bap-open' && session) {
      openBap(session);
    } else if (action === 'bap-view' && session?.bap) {
      setHtml(viewDialog, bapDetail(session));
      viewDialog.showModal();
      qs('[data-dialog-cancel]', viewDialog).focus();
    }
  }

  function openMeeting(session) {
    active = session;
    setHtml(meetingDialog, html`
      <form id="meeting-form" novalidate
        class="modal-box grid max-w-md gap-3.5 p-7">
        <h2 id="ekspos-meeting-title" class="text-lg font-bold">
          Buat tautan ekspos daring</h2>
        <p class="text-sm text-base-content/80"><b>${session.pemohon}</b> ·
          ${session.hari} · ${session.jam} WIB · antrian ${session.antrian}</p>
        <div>
          <label for="meeting-platform" class="text-sm font-bold">
            Platform</label>
          <select id="meeting-platform" name="platform" required
            class="select mt-1 w-full"
            aria-describedby="meeting-platform-error">
            <option value="">Pilih platform</option>
            ${EKSPOS_PLATFORMS.map((p) => html`<option>${p}</option>`)}
          </select>
          ${errorSlot('meeting-platform-error', 'platform')}
        </div>
        <div>
          <label for="meeting-mulai" class="text-sm font-bold">
            Mulai (WIB)</label>
          <input id="meeting-mulai" name="mulai" type="datetime-local"
            required value="${session.mulai.slice(0, 16)}"
            class="input mt-1 w-full" aria-describedby="meeting-mulai-error">
          ${errorSlot('meeting-mulai-error', 'mulai')}
        </div>
        <p class="text-xs text-base-content/70">Tautan dikirim ke email akun
          pemberi kerja dan tampil di Beranda portal. Rekaman rapat wajib
          dilampirkan pada BAP.</p>
        ${formError()}
        <div class="modal-action mt-1">
          <button type="button" data-dialog-cancel class="btn">Batal</button>
          <button type="submit" class="btn btn-primary font-bold">
            Buat tautan</button>
        </div>
      </form>
      <form method="dialog" class="modal-backdrop">
        <button type="submit">Tutup</button></form>`);
    meetingDialog.showModal();
    qs('#meeting-platform', meetingDialog).focus();
  }

  async function onMeetingSubmit(event) {
    if (event.target.id !== 'meeting-form') {
      return;
    }
    event.preventDefault();
    const formEl = event.target;
    const mulai = formEl.elements.mulai.value;
    const body = { platform: formEl.elements.platform.value,
      mulai: mulai ? `${mulai}${WIB_OFFSET}` : '' };
    if (showFieldErrors(formEl, validateEksposMeeting(body).errors)) {
      return;
    }
    await submitDialog(formEl, meetingDialog,
      () => createEksposMeeting(active.id, body),
      (updated) => `Tautan ${updated.platform} untuk ${updated.pemohon} ` +
        'dibuat dan dikirim ke pemberi kerja.');
  }

  function openBap(session) {
    if (session.mode === 'Daring' && !session.meetingUrl) {
      return;
    }
    active = session;
    const isDaring = session.mode === 'Daring';
    setHtml(bapDialog, html`
      <form id="bap-form" novalidate
        class="modal-box grid max-w-xl gap-3.5 p-7">
        <h2 id="ekspos-bap-title" class="text-lg font-bold">
          Berita acara ekspos</h2>
        <p class="text-sm text-base-content/80"><b>${session.pemohon}</b> ·
          ${session.layanan} · ${session.hari} · ${session.jam} WIB ·
          ${session.mode}</p>
        <fieldset>
          <legend class="text-sm font-bold">Hasil penilaian</legend>
          <div class="mt-1 flex flex-wrap gap-4">${BAP_HASIL.map((h, i) =>
            html`<label class="flex cursor-pointer items-center gap-2 text-sm">
              <input type="radio" name="hasil" value="${h}" class="radio
                radio-sm radio-primary" ${i === 0 ? 'checked' : ''}
                aria-describedby="bap-hasil-error">${h}</label>`)}</div>
          ${errorSlot('bap-hasil-error', 'hasil')}
        </fieldset>
        <div>
          <label for="bap-ringkasan" class="text-sm font-bold">Ringkasan
            pemaparan &amp; penilaian</label>
          <textarea id="bap-ringkasan" name="ringkasan" rows="4" required
            minlength="${BAP_RINGKASAN_MIN}" class="textarea mt-1 w-full
            resize-y" aria-describedby="bap-ringkasan-hint bap-ringkasan-error"
            ></textarea>
          <p id="bap-ringkasan-hint" class="text-xs text-base-content/70">
            Minimal ${BAP_RINGKASAN_MIN} karakter.</p>
          ${errorSlot('bap-ringkasan-error', 'ringkasan')}
        </div>
        <div>
          <label for="bap-peserta" class="text-sm font-bold">Peserta</label>
          <textarea id="bap-peserta" name="peserta" rows="3" required
            class="textarea mt-1 w-full resize-y"
            aria-describedby="bap-peserta-hint bap-peserta-error"
            >${DEFAULT_PESERTA}</textarea>
          <p id="bap-peserta-hint" class="text-xs text-base-content/70">
            Satu orang per baris: nama (peran).</p>
          ${errorSlot('bap-peserta-error', 'peserta')}
        </div>
        <div class="grid gap-3.5 sm:grid-cols-[1fr_140px]">
          <div>
            <label for="bap-rekaman" class="text-sm font-bold">Tautan rekaman
              <span class="font-normal text-base-content/70">
                ${isDaring ? '(wajib untuk ekspos daring)' : '(opsional)'}
              </span></label>
            <input id="bap-rekaman" name="rekamanUrl" type="url"
              ${isDaring ? 'required' : ''} placeholder="https://"
              class="input mt-1 w-full" aria-describedby="bap-rekaman-error">
            ${errorSlot('bap-rekaman-error', 'rekamanUrl')}
          </div>
          <div>
            <label for="bap-durasi" class="text-sm font-bold">Durasi (menit)
            </label>
            <input id="bap-durasi" name="durasiMenit" type="number" required
              min="${BAP_DURASI_MIN}" max="${BAP_DURASI_MAX}" value="30"
              class="input mt-1 w-full" aria-describedby="bap-durasi-error">
            ${errorSlot('bap-durasi-error', 'durasiMenit')}
          </div>
        </div>
        ${formError()}
        <div class="modal-action mt-1">
          <button type="button" data-dialog-cancel class="btn">Batal</button>
          <button type="submit" class="btn btn-primary font-bold">
            Simpan BAP</button>
        </div>
      </form>
      <form method="dialog" class="modal-backdrop">
        <button type="submit">Tutup</button></form>`);
    bapDialog.showModal();
    qs('input[name="hasil"]', bapDialog).focus();
  }

  async function onBapSubmit(event) {
    if (event.target.id !== 'bap-form') {
      return;
    }
    event.preventDefault();
    const formEl = event.target;
    const { elements } = formEl;
    const rekamanUrl = elements.rekamanUrl.value.trim();
    const body = {
      hasil: elements.hasil.value,
      ringkasan: elements.ringkasan.value.trim(),
      peserta: elements.peserta.value.split('\n').map((p) => p.trim())
        .filter(Boolean),
      rekamanUrl: rekamanUrl || undefined,
      durasiMenit: elements.durasiMenit.value === '' ? undefined
        : Number(elements.durasiMenit.value),
    };
    const check = validateEksposBap(body, active.mode);
    if (showFieldErrors(formEl, check.errors)) {
      return;
    }
    await submitDialog(formEl, bapDialog,
      () => createEksposBap(active.id, body),
      (updated) => `BAP ${updated.bap.nomor} tersimpan.`,
      '#bap-summary-title');
  }

  /** Shared submit flow: busy button, merge session, toast, focus. */
  async function submitDialog(formEl, dialog, request, message, focusSel) {
    const submit = qs('button[type="submit"]', formEl);
    const formErrorEl = qs('[data-form-error]', formEl);
    formErrorEl.hidden = true;
    setButtonBusy(submit, true);
    try {
      const updated = await request();
      const list = sessions();
      list[list.findIndex((s) => s.id === updated.id)] = updated;
      dialog.close();
      showToast(message(updated));
      ctx.setState({});
      qs(focusSel ?? `[data-focus-key="bap-${updated.id}"]`, eksposEl)
        ?.focus();
    } catch (error) {
      setButtonBusy(submit, false);
      if (error.status === 400) {
        showFieldErrors(formEl, error.fields);
      } else {
        // The toast sits under the modal (inert); report inside the dialog.
        formErrorEl.textContent = `${error.message || 'Gagal menyimpan.'} ` +
          'Coba lagi.';
        formErrorEl.hidden = false;
        formErrorEl.focus();
      }
    }
  }

  return { sessionsCard, summaryCard };
}

/** Non-field error slot inside a dialog form (focused on failure). */
function formError() {
  return html`<p data-form-error role="alert" tabindex="-1"
    class="text-sm font-semibold text-error" hidden></p>`;
}
