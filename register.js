/**
 * @fileoverview 5-step employer registration wizard (Status Penanam
 * Modal, Jenis Pemberi Kerja, Data Perusahaan, Data Operator, Dokumen) ->
 * POST /auth/register. Dipicu dari layar menu (bukan tombol terpisah di
 * halaman login) setelah login SIAPKerja mendeteksi akun belum
 * terverifikasi sebagai Pemberi Kerja — diagram "Registrasi Operator
 * TKA-Online" (usulan KAK Modul 1, AK-13/14/15/16,
 * docs/shared/business-rules.md). View-rendering helpers di
 * ./register-view.js; panel OSS & operator di ./register-company.js dan
 * ./register-operator.js.
 */

import { simpanBerkas } from '../../components/berkas-store.js';
import { register } from '../../api/auth.js';
import { ApiError } from '../../api/http.js';
import { resubmitPendaftar } from '../../api/pendaftar.js';
import { qs, qsa, setVisible } from '../../components/dom.js';
import {
  clearFieldErrors, formatFileSize, nativeErrors, setAlert, setButtonBusy,
  showFieldErrors,
} from '../../components/form-ui.js';
import {
  NON_OSS_DOCUMENT_TYPE, REGISTER_DOCUMENT_TYPE, REGISTER_STEP_CONTRACTS,
  REGISTER_STEP_LABELS, validateRegister, validateRegisterStep,
} from '../../contracts/registration.js';
import { createRegisterCompany } from './register-company.js';
import { createRegisterOperator } from './register-operator.js';
import {
  renderJenisOptions, renderStatusCards, renderStepper, renderSummary,
} from './register-view.js';

const TOTAL_STEPS = REGISTER_STEP_LABELS.length;
const COMPANY_STEP = 3;
const OPERATOR_STEP = 4;
const DOKUMEN_STEP = 5;
const DEFAULT_STATUS = 'Penanam Modal';
const ACCEPTED_MIME = /^(application\/pdf|image\/.+)$/;

/** field -> wizard step, derived from the step contracts. */
const STEP_OF_FIELD = Object.fromEntries(
  REGISTER_STEP_CONTRACTS.flatMap((contract, index) =>
    Object.keys(contract.fields).map((field) => [field, index + 1])),
);

/**
 * @param {{go: function(string), onRegistered: function(!Object, ?string),
 *     onResubmitted: function(!Object)}} deps `onResubmitted` fires after
 *     AK-15 loop-back (POST /pendaftar/{npwp}/resubmit).
 * @return {{setStep: function(number), enterFixMode: function(string)}}
 */
export function initRegister({ go, onRegistered, onResubmitted }) {
  const form = qs('#reg-form');
  const alertEl = qs('#reg-alert');
  const nextButton = qs('#reg-next');
  const state = {
    step: 1, doc: null,
    /** NPWP sedang diperbaiki (AK-15 loop-back), null = pendaftaran baru. */
    fixingNpwp: null,
  };
  const company = createRegisterCompany(form);
  const operator = createRegisterOperator(form);

  form.elements.statusPenanamModal.value = DEFAULT_STATUS;
  renderJenisOptions(form);
  bindEvents();
  render();

  /**
   * Urutan langkah sungguhan untuk metode saat ini — Non-OSS melewati
   * langkah 3 "Data Perusahaan" sepenuhnya (AK-18), jadi urutannya
   * [1, 2, 4, 5] (ditampilkan ulang sebagai 1-4 di stepper).
   * @return {!Array<number>}
   */
  function sequence() {
    return form.elements.metodePendaftaran.value === 'Non-OSS'
      ? [1, 2, 4, 5] : [1, 2, 3, 4, 5];
  }

  function nextStep(step) {
    const seq = sequence();
    return seq[Math.min(seq.indexOf(step) + 1, seq.length - 1)];
  }

  function prevStep(step) {
    const seq = sequence();
    return seq[Math.max(seq.indexOf(step) - 1, 0)];
  }

  function bindEvents() {
    qs('#reg-status-cards', form).addEventListener('change', () => {
      renderJenisOptions(form);
      renderStatusCards(form);
    });
    for (const radio of form.elements.metodePendaftaran) {
      // Stepper berubah jumlah langkah (AK-18: Non-OSS melewati langkah
      // 3) — re-render langsung supaya tidak menunggu navigasi berikutnya.
      radio.addEventListener('change', () => render());
    }
    qs('#reg-prev').addEventListener('click', () => {
      if (state.step > 1) {
        setStep(prevStep(state.step), true);
      } else {
        go('menu');
      }
    });
    qs('#reg-stepper').addEventListener('click', (event) => {
      const button = event.target.closest('[data-step]');
      if (button) {
        setStep(Number(button.dataset.step), true);
      }
    });
    qs('#reg-doc-input', form).addEventListener('change', (event) => {
      acceptFile(event.target.files[0]);
    });
    form.addEventListener('submit', onSubmit);
  }

  function setStep(step, moveFocus = false) {
    state.step = Math.min(Math.max(step, 1), TOTAL_STEPS);
    clearFieldErrors(form);
    setAlert(alertEl, null);
    render();
    if (moveFocus) {
      const fieldset = qs(`[data-reg-step="${state.step}"]`, form);
      qs('input:not([type="file"]), select, button', fieldset)?.focus();
    }
  }

  function render() {
    const seq = sequence();
    for (const fieldset of qsa('[data-reg-step]', form)) {
      setVisible(fieldset, Number(fieldset.dataset.regStep) === state.step);
    }
    qs('#reg-step-counter').textContent =
      `Langkah ${seq.indexOf(state.step) + 1} dari ${seq.length}`;
    nextButton.textContent = state.step < TOTAL_STEPS ? 'Validasi & lanjut →'
      : state.fixingNpwp ? 'Kirim perbaikan' : 'Submit Verifikasi';
    renderStepper(state.step, seq);
    renderStatusCards(form);
    renderDoc();
    if (state.step === COMPANY_STEP) {
      company.refresh();
    }
    if (state.step === OPERATOR_STEP) {
      operator.refresh();
    }
    if (state.step === TOTAL_STEPS) {
      renderSummary(form, collect(), company.result(), operator.collect());
    }
  }

  /** Dokumen Pendukung langkah 5 tergantung metode langkah 2 (AK-18). */
  function documentType() {
    return form.elements.metodePendaftaran.value === 'Non-OSS'
      ? NON_OSS_DOCUMENT_TYPE : REGISTER_DOCUMENT_TYPE;
  }

  function renderDoc() {
    const status = qs('#reg-doc-status', form);
    const action = qs('#reg-doc-action', form);
    qs('#reg-doc-label', form).textContent = documentType();
    if (state.doc) {
      // Re-tag in case metode berubah setelah berkas dipilih (kembali ke
      // langkah 2 lalu balik lagi) — tanpa perlu unggah ulang.
      state.doc.jenis = documentType();
      status.textContent =
        `${state.doc.fileName} · ${formatFileSize(state.doc.fileSize)}`;
      action.textContent = 'Ganti berkas';
    } else {
      status.textContent = 'Belum ada berkas dipilih.';
      action.textContent = 'Pilih berkas';
    }
  }

  function acceptFile(file) {
    if (!file) {
      return;
    }
    clearFieldErrors(form);
    if (!ACCEPTED_MIME.test(file.type)) {
      showFieldErrors(form, { documents: 'Hanya PDF atau gambar.' });
      return;
    }
    const doc = {
      jenis: documentType(), fileName: file.name,
      fileSize: file.size, mimeType: file.type || 'application/octet-stream',
    };
    state.doc = doc;
    renderDoc();
    // Simpan isi berkas agar Verifikator bisa memratinjau (berkas-store).
    simpanBerkas(file).then((berkasId) => {
      if (berkasId && state.doc === doc) {
        doc.berkasId = berkasId;
      }
    });
  }

  function collect() {
    const result = company.result();
    return {
      statusPenanamModal: form.elements.statusPenanamModal.value,
      jenisPemberiKerja: form.elements.jenisPemberiKerja.value,
      metodePendaftaran: form.elements.metodePendaftaran.value,
      kodeWlkp: form.elements.metodePendaftaran.value === 'OSS'
        ? qs('#reg-kode-wlkp', form).value.trim() : '',
      nib: result?.nib ?? '', npwp: result?.npwp ?? '',
      namaPemberiKerja: result?.namaPemberiKerja ?? '',
      operatorEmails: operator.collect(),
      documents: state.doc ? [state.doc] : [],
      documentName: state.doc?.fileName ?? '',
    };
  }

  function validateStep(step) {
    const fieldset = qs(`[data-reg-step="${step}"]`, form);
    const errors = {
      ...nativeErrors(fieldset.elements),
      ...validateRegisterStep(step, collect()).errors,
    };
    if (step === COMPANY_STEP && !Object.keys(errors).length &&
        !company.isGateOpen()) {
      errors.kodeWlkp =
        'Cek ke OSS terlebih dahulu (status harus "Ditemukan").';
    }
    if (step === OPERATOR_STEP && !Object.keys(errors).length &&
        !operator.isGateOpen()) {
      errors.operatorEmails =
        'Pastikan operator sudah dicek dan terdaftar di SIAPKerja.';
    }
    return errors;
  }

  async function onSubmit(event) {
    event.preventDefault();
    clearFieldErrors(form);
    setAlert(alertEl, null);
    if (state.step < TOTAL_STEPS) {
      const errors = validateStep(state.step);
      if (!showFieldErrors(form, errors)) {
        setStep(nextStep(state.step), true);
      }
      return;
    }
    const payload = collect();
    if (state.fixingNpwp) {
      await submitResubmit(payload);
      return;
    }
    const result = validateRegister(payload);
    if (!result.valid) {
      showErrorsAtStep(result.errors);
      return;
    }
    setButtonBusy(nextButton, true);
    let pendaftar;
    try {
      pendaftar = await register(payload);
    } catch (error) {
      // Un-busy first: the error may move the wizard to another step,
      // whose render sets the button label ("Validasi & lanjut →").
      setButtonBusy(nextButton, false);
      handleSubmitError(error);
      return;
    }
    setButtonBusy(nextButton, false);
    onRegistered(pendaftar, payload.operatorEmails[0]?.email ?? null);
  }

  /** AK-15 loop-back: only the document is re-sent, not the full wizard. */
  async function submitResubmit(payload) {
    const errors = validateStep(DOKUMEN_STEP);
    if (Object.keys(errors).length) {
      setStep(DOKUMEN_STEP);
      showFieldErrors(form, errors);
      return;
    }
    setButtonBusy(nextButton, true);
    try {
      const npwp = state.fixingNpwp;
      const updated = await resubmitPendaftar(npwp, payload.documents);
      setButtonBusy(nextButton, false);
      state.fixingNpwp = null;
      onResubmitted(updated);
    } catch (error) {
      setButtonBusy(nextButton, false);
      setAlert(alertEl,
        `${error.message ?? 'Pengiriman ulang gagal.'} Silakan coba lagi.`);
    }
  }

  function handleSubmitError(error) {
    if (error instanceof ApiError &&
        ['VALIDATION_ERROR', 'DUPLICATE'].includes(error.code)) {
      const fields = Object.keys(error.fields).length
        ? error.fields : { [error.detail.field]: error.message };
      showErrorsAtStep(fields);
      return;
    }
    setAlert(alertEl, `${error.message ?? 'Pendaftaran gagal dikirim.'} ` +
      'Silakan coba lagi.');
  }

  function showErrorsAtStep(errors) {
    const steps = Object.keys(errors).map((f) => STEP_OF_FIELD[f] ?? 1);
    setStep(Math.min(...steps));
    showFieldErrors(form, errors);
  }

  return {
    setStep,
    /** Jump to Dokumen step in "perbaiki" mode (AK-15 loop-back). */
    enterFixMode(npwp) {
      state.fixingNpwp = npwp;
      setStep(DOKUMEN_STEP, true);
    },
  };
}
