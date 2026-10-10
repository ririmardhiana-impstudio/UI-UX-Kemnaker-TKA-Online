/**
 * @fileoverview "Data Operator" panel of the register wizard (langkah 4):
 * sampai 2 email operator, masing-masing dicocokkan ke SIAPKerja (AK-16,
 * usulan KAK Modul 1). Tombol lanjut terkunci sampai operator 1 (wajib)
 * "Terdaftar"; operator 2 opsional tapi wajib "Terdaftar" bila diisi.
 * Pesan hasil cek berbeda teks untuk metode Non-OSS ("Data Ditemukan" /
 * "Tidak Ditemukan", AK-18) — pengecekan & gating tetap sama.
 */

import { checkOperatorEmail } from '../../api/auth.js';
import { ApiError } from '../../api/http.js';
import { html, qs, setHtml, setVisible } from '../../components/dom.js';
import { EMAIL_PATTERN } from '../../contracts/schema.js';

const SLOTS = [1, 2];
const INTRO_TEXT = {
  OSS: 'Email operator yang akan mengelola TKA Online untuk perusahaan ' +
    'ini. Maksimal 2 operator; setiap email dicocokkan ke SIAPKerja.',
  'Non-OSS': 'Email operator yang akan mengelola TKA Online untuk ' +
    'perusahaan/instansi ini. Maksimal 2 operator; setiap email dicek ' +
    'datanya.',
};

/**
 * @param {!HTMLFormElement} form Wizard form (`#reg-form`).
 * @return {{refresh: function(), isGateOpen: function(): boolean,
 *     collect: function(): !Array<!Object>}}
 */
export function createRegisterOperator(form) {
  const row2 = qs('#reg-operator-2-row', form);
  const addButton = qs('#reg-operator-add', form);
  const removeButton = qs('#reg-operator-remove', form);
  const intro = qs('#reg-operator-intro', form);
  const slot = Object.fromEntries(SLOTS.map((n) => [n, {
    input: qs(`#reg-operator-${n}`, form),
    result: qs(`#reg-operator-${n}-result`, form),
    check: null,
  }]));

  function metode() {
    return form.elements.metodePendaftaran.value;
  }

  addButton.addEventListener('click', () => {
    setVisible(row2, true);
    addButton.hidden = true;
    slot[2].input.focus();
  });
  removeButton.addEventListener('click', () => {
    setVisible(row2, false);
    addButton.hidden = false;
    slot[2].input.value = '';
    slot[2].check = null;
    draw(2);
  });
  form.addEventListener('click', (event) => {
    const button = event.target.closest('[data-operator-check]');
    if (button) {
      run(Number(button.dataset.operatorCheck));
    }
  });
  for (const n of SLOTS) {
    slot[n].input.addEventListener('input', () => {
      if (slot[n].check) {
        slot[n].check = null;
        draw(n);
      }
    });
  }

  async function run(n) {
    const email = slot[n].input.value.trim();
    if (!new RegExp(EMAIL_PATTERN).test(email)) {
      slot[n].check = { status: 'error', message: 'Format email tidak valid.' };
      draw(n);
      return;
    }
    slot[n].check = { status: 'loading' };
    draw(n);
    try {
      slot[n].check = { status: 'done', result: await checkOperatorEmail(email) };
    } catch (error) {
      slot[n].check = { status: 'error', message: error instanceof ApiError
        ? error.message : (metode() === 'Non-OSS'
          ? 'Pengecekan data gagal. Coba lagi.'
          : 'Pengecekan SIAPKerja gagal. Coba lagi.') };
    }
    draw(n);
  }

  function draw(n) {
    const busy = slot[n].check?.status === 'loading';
    slot[n].result.setAttribute('aria-busy', String(busy));
    setHtml(slot[n].result, renderResult(n));
  }

  function renderResult(n) {
    const check = slot[n].check;
    if (!check) {
      return html``;
    }
    if (check.status === 'loading') {
      const label = metode() === 'Non-OSS' ? 'Memeriksa data…'
        : 'Memeriksa SIAPKerja…';
      return html`<p class="flex items-center gap-2 text-xs
        text-base-content/70"><span class="loading loading-spinner
        loading-xs" aria-hidden="true"></span>${label}</p>`;
    }
    if (check.status === 'error') {
      return html`<p class="text-xs text-error">${check.message}</p>`;
    }
    const { terdaftar, nama } = check.result;
    if (metode() === 'Non-OSS') {
      return terdaftar
        ? html`<p class="text-xs font-bold text-success">✓ Data
            Ditemukan${nama ? html` — ${nama}` : ''}</p>`
        : html`<p class="text-xs font-bold text-error">Tidak Ditemukan.</p>`;
    }
    return terdaftar
      ? html`<p class="text-xs font-bold text-success">✓ Terdaftar di
          SIAPKerja${nama ? html` — ${nama}` : ''}</p>`
      : html`<p class="text-xs font-bold text-error">Tidak ditemukan di
          SIAPKerja.</p>`;
  }

  function isGateOpen() {
    const op1 = slot[1].check;
    if (op1?.status !== 'done' || !op1.result.terdaftar) {
      return false;
    }
    if (!row2.hidden && slot[2].input.value.trim()) {
      const op2 = slot[2].check;
      if (op2?.status !== 'done' || !op2.result.terdaftar) {
        return false;
      }
    }
    return true;
  }

  function collect() {
    const list = [];
    for (const n of SLOTS) {
      const email = slot[n].input.value.trim();
      if (!email) {
        continue;
      }
      const check = slot[n].check;
      list.push({
        email, nama: check?.result?.nama ?? null,
        terdaftar: Boolean(check?.status === 'done' && check.result.terdaftar),
      });
    }
    return list;
  }

  function refresh() {
    intro.textContent = INTRO_TEXT[metode()] ?? INTRO_TEXT.OSS;
    SLOTS.forEach(draw);
  }

  return { refresh, isGateOpen, collect };
}
