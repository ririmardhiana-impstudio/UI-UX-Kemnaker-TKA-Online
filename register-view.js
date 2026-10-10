/**
 * @fileoverview Pure(ish) rendering helpers for the register wizard
 * (register.js): stepper, Status Penanam Modal cards, Jenis Pemberi Kerja
 * options (AK-13), and the ringkasan summary. Split out to keep
 * register.js under the file size guideline.
 */

import { qs, qsa, renderList, setVisible } from '../../components/dom.js';
import {
  jenisForStatus, REGISTER_STEP_LABELS,
} from '../../contracts/registration.js';

/**
 * `#reg-stepper` and `#reg-step-template` are siblings of `#reg-form`
 * (not descendants), so they are looked up unscoped. `sequence` is the
 * list of actual step numbers to show, in order (register.js
 * `sequence()`) — metode Non-OSS skips step 3 "Data Perusahaan" (AK-18),
 * so the stepper only renders [1, 2, 4, 5] and renumbers them 1-4.
 * @param {number} step Current (actual) step number.
 * @param {!Array<number>} sequence
 */
export function renderStepper(step, sequence) {
  renderList(qs('#reg-stepper'), qs('#reg-step-template'),
    sequence, (node, stepNo, index) => {
      const position = index + 1;
      const label = REGISTER_STEP_LABELS[stepNo - 1];
      const button = qs('button', node);
      button.dataset.step = String(stepNo);
      if (stepNo === step) {
        button.setAttribute('aria-current', 'step');
      }
      qs('[data-role="bar"]', node).classList.add(
        stepNo <= step ? 'bg-secondary' : 'bg-base-300');
      const labelEl = qs('[data-role="label"]', node);
      labelEl.textContent = `${position}. ${label}`;
      labelEl.classList.add(stepNo === step ? 'text-secondary'
        : stepNo < step ? 'text-base-content' : 'text-base-content/50');
    });
}

/** Visual selected state of the two "Status Penanam Modal" cards. */
export function renderStatusCards(form) {
  const selected = form.elements.statusPenanamModal.value;
  for (const card of qsa('[data-status-card]', form)) {
    const active = card.dataset.statusCard === selected;
    card.classList.toggle('border-secondary', active);
    card.classList.toggle('bg-base-200', active);
    card.classList.toggle('border-base-300', !active);
    card.toggleAttribute('aria-current', active);
    qs('[data-role="desc"]', card).classList.toggle('text-base-content/70', !active);
    qs('[data-role="desc"]', card).classList.toggle('text-base-content/80', active);
  }
}

/** Jenis Pemberi Kerja options filtered by status penanam modal (AK-13). */
export function renderJenisOptions(form) {
  const select = form.elements.jenisPemberiKerja;
  const previous = select.value;
  const allowed = jenisForStatus(form.elements.statusPenanamModal.value);
  select.replaceChildren(
    new Option('Pilih jenis pemberi kerja…', ''),
    ...allowed.map((jenis) => new Option(jenis, jenis)),
  );
  select.value = allowed.includes(previous) ? previous : '';
}

/**
 * @param {!HTMLFormElement} form
 * @param {!Object} data Collected wizard payload (register.js `collect()`).
 * @param {?Object} companyResult Hasil company-lookup (register-company.js).
 * @param {!Array<!Object>} operatorList Hasil register-operator.js `collect()`.
 */
export function renderSummary(form, data, companyResult, operatorList) {
  const values = {
    statusPenanamModal: data.statusPenanamModal,
    jenisPemberiKerja: data.jenisPemberiKerja,
    metodePendaftaran: data.metodePendaftaran,
    namaPemberiKerja: companyResult?.namaPemberiKerja ?? '—',
    npwpNibWlkp: companyResult
      ? [companyResult.npwp, companyResult.nib, companyResult.wlkp]
        .filter(Boolean).join(' · ')
      : '—',
  };
  for (const el of qsa('[data-summary]', form)) {
    el.textContent = values[el.dataset.summary] || '—';
  }
  // Non-OSS melewati langkah 3 "Data Perusahaan" sepenuhnya (AK-18) —
  // baris nama/NPWP tidak relevan, disembunyikan daripada menampilkan "—".
  setVisible(qs('[data-company-summary]', form),
    data.metodePendaftaran !== 'Non-OSS');
  const operatorEl = qs('#reg-summary-operators', form);
  operatorEl.replaceChildren(...operatorList.map((op) => {
    const li = document.createElement('li');
    li.className = 'badge badge-soft rounded-full font-bold ' +
      (op.terdaftar ? 'badge-success' : 'badge-error');
    li.textContent = `${op.terdaftar ? '✓' : '✕'} ${op.email}`;
    return li;
  }));
  if (!operatorList.length) {
    operatorEl.textContent = 'Belum ada operator.';
  }
}
