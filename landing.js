/**
 * @fileoverview Landing TKA Online (publik): tab Masuk/Cek status di hero,
 * daftar jenis pelayanan + alur interaktif per layanan, dan pengumuman
 * dari GET /api/v1/pengumuman. FAQ memakai DaisyUI collapse (<details>)
 * sehingga tidak butuh JS.
 */

import {
  fillSlots, html, qs, qsa, renderList, setBusy, setHtml, setVisible,
} from '../components/dom.js';
import { statusBadge } from '../components/status-badge.js';
import { ApiError } from '../api/http.js';
import { listPengumuman } from '../api/pengumuman.js';
import { getStatusPermohonan } from '../api/status-permohonan.js';
import { validateStatusQuery } from '../contracts/reference.js';

/** Jenis pelayanan (konfigurasi UI, port dari SERVICES legacy). */
const SERVICES = [
  { code: 'R6', name: 'Pengesahan RPTKA > 6 bulan', short: 'RPTKA > 6 bulan', desc: 'Untuk pekerjaan dengan jangka waktu lebih dari enam bulan.', tag: 'DKPTKA', dk: true, pk: true },
  { code: 'PP', name: 'Perpanjangan Pengesahan RPTKA', short: 'Perpanjangan', desc: 'Perpanjang pengesahan sebelum masa berlaku berakhir.', tag: 'DKPTKA', dk: true, pk: true },
  { code: 'DK', name: 'RPTKA Jabatan Direktur/Komisaris', short: 'Direktur/Komisaris', desc: 'Untuk TKA yang menduduki jabatan direksi atau komisaris.', tag: 'Khusus', dk: true, pk: true },
  { code: 'SM', name: 'RPTKA Pekerjaan Sementara', short: 'Pekerjaan sementara', desc: 'Untuk pekerjaan yang bersifat sementara.', tag: 'DKPTKA', dk: true, pk: true },
  { code: 'ND', name: 'Pengesahan RPTKA Non-DKPTKA', short: 'Non-DKPTKA', desc: 'Pemberi kerja yang dikecualikan dari kewajiban DKPTKA.', tag: 'Non-DKPTKA', dk: false, pk: true },
  { code: 'NK', name: 'Non-DKPTKA tanpa Penilaian Kelayakan', short: 'Non-DKPTKA (tanpa penilaian)', desc: 'Dikecualikan dari DKPTKA dan penilaian kelayakan.', tag: 'Non-DKPTKA', dk: false, pk: false },
  { code: 'PR', name: 'Perubahan Pengesahan RPTKA', short: 'Perubahan', desc: 'Ubah data pada pengesahan RPTKA yang sudah terbit.', tag: 'Perubahan', dk: false, pk: true },
];

/** Kelas badge per tag layanan (legacy tagStyle). */
const SERVICE_TAG_CLASS = {
  'DKPTKA': 'badge-info',
  'Non-DKPTKA': 'badge-success',
  'Khusus': 'badge-special',
  'Perubahan': 'badge-warning',
};

/** Kelas badge per tag pengumuman; tag lain jatuh ke info. */
const PENGUMUMAN_TAG_CLASS = {
  Penting: 'badge-warning',
  Pemeliharaan: 'badge-error',
  Pengingat: 'badge-warning',
};


const PENGUMUMAN_INITIAL = 2;
const HEADER_OFFSET_PX = 70;

const CHIP_ACTIVE = ['bg-base-100', 'border-base-100', 'text-primary'];
const CHIP_IDLE = ['border-primary-content/20', 'text-primary-content/80',
  'hover:bg-primary-content/10'];
const TAB_ACTIVE = ['border-primary', 'text-base-content'];
const TAB_IDLE = ['border-transparent', 'text-base-content/60'];

const state = {
  tab: 'login',
  active: 0,
  pengumuman: [],
  showAllPengumuman: false,
};

/**
 * Tahapan alur untuk satu layanan (legacy steps()).
 * @param {{dk: boolean, pk: boolean}} service
 * @return {!Array<{no: string, title: string, desc: string}>}
 */
function buildSteps(service) {
  const all = [
    { title: 'Registrasi akun', desc: 'Pemberi kerja memperoleh akun dan melengkapi profil perusahaan.' },
    { title: 'Pengajuan RPTKA', desc: 'Isi data jabatan, jangka waktu, lokasi kerja, dan unggah dokumen TKA.' },
    service.pk && { title: 'Penilaian kelayakan', desc: 'Verifikasi dokumen dan penjadwalan ekspose oleh petugas.' },
    service.dk && { title: 'Notifikasi & DKPTKA', desc: 'Kode billing terbit; bayar DKPTKA sesuai jumlah bulan dan TKA.' },
    { title: 'Pengesahan terbit', desc: 'Dokumen pengesahan RPTKA elektronik dapat diunduh.' },
  ].filter(Boolean);
  return all.map((step, i) => ({
    ...step, no: String(i + 1).padStart(2, '0'),
  }));
}

/** Catatan di bawah alur (legacy activeNote). */
function buildNote(service) {
  if (service.dk) {
    return 'Layanan ini dikenakan DKPTKA sebesar Rp1.500.000 per bulan, per jabatan, per orang.';
  }
  if (service.pk) {
    return 'Layanan ini tidak dikenakan DKPTKA; tahap pembayaran dilewati.';
  }
  return 'Layanan ini dikecualikan dari DKPTKA dan penilaian kelayakan, sehingga prosesnya lebih singkat.';
}

// ---------------------------------------------------------------------------
// Tab Masuk / Cek status
// ---------------------------------------------------------------------------

function renderTabs() {
  for (const tab of qsa('[role="tab"][data-tab]')) {
    const isActive = tab.dataset.tab === state.tab;
    tab.setAttribute('aria-selected', String(isActive));
    tab.tabIndex = isActive ? 0 : -1;
    tab.classList.remove(...TAB_ACTIVE, ...TAB_IDLE);
    tab.classList.add(...(isActive ? TAB_ACTIVE : TAB_IDLE));
  }
  setVisible(qs('#panel-login'), state.tab === 'login');
  setVisible(qs('#panel-status'), state.tab === 'status');
}

function selectTab(tabKey, shouldFocus = false) {
  state.tab = tabKey;
  renderTabs();
  if (shouldFocus) {
    qs(`[role="tab"][data-tab="${tabKey}"]`).focus();
  }
}

function bindTabs() {
  const tabs = qsa('[role="tab"][data-tab]');
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectTab(tab.dataset.tab));
    tab.addEventListener('keydown', (event) => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
      if (!step) {
        return;
      }
      event.preventDefault();
      const next = tabs[(index + step + tabs.length) % tabs.length];
      selectTab(next.dataset.tab, true);
    });
  });
}

/** Label + placeholder nomor per jenis (pendaftaran dicek by NPWP). */
const NOMOR_FIELD = {
  rptka: { label: 'Nomor permohonan', placeholder: 'Masukkan nomor' },
  hpk: { label: 'Nomor permohonan', placeholder: 'Masukkan nomor' },
  billing: { label: 'Nomor permohonan', placeholder: 'Masukkan nomor' },
  pendaftaran: { label: 'NPWP pemberi kerja',
    placeholder: 'Masukkan 15-16 digit NPWP' },
};

function bindStatusForm() {
  const form = qs('#panel-status');
  const input = qs('#status-nomor');
  const label = qs('#status-nomor-label');
  const error = qs('#status-nomor-error');
  const result = qs('#status-result');
  const button = qs('button[type="submit"]', form);

  const showFieldError = (message) => {
    input.setAttribute('aria-invalid', 'true');
    error.textContent = message;
    setVisible(error, true);
    input.focus();
  };

  const syncNomorField = () => {
    const field = NOMOR_FIELD[form.elements.jenis.value];
    label.textContent = field.label;
    input.placeholder = field.placeholder;
  };

  input.addEventListener('input', () => {
    input.removeAttribute('aria-invalid');
    setVisible(error, false);
  });
  for (const radio of form.elements.jenis) {
    radio.addEventListener('change', () => {
      syncNomorField();
      setVisible(result, false);
    });
  }
  if (window.location.hash === '#cek-status') {
    form.elements.jenis.value = 'pendaftaran';
  }
  syncNomorField();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setVisible(result, false);
    input.value = input.value.trim();
    if (!form.checkValidity()) {
      showFieldError('Nomor permohonan wajib diisi.');
      return;
    }
    const query = { jenis: form.elements.jenis.value, nomor: input.value };
    const check = validateStatusQuery(query);
    if (!check.valid) {
      showFieldError(check.errors.nomor ?? check.errors.jenis);
      return;
    }
    setBusy(button, true);
    button.disabled = true;
    try {
      showStatusResult(result, await getStatusPermohonan(query.jenis,
        query.nomor));
    } catch (err) {
      if (err instanceof ApiError && err.field === 'nomor') {
        showFieldError(err.message);
      } else {
        showStatusError(result, err);
      }
    } finally {
      setBusy(button, false);
      button.disabled = false;
    }
  });
}

/** Aksi lanjutan per status pendaftaran (AK-17 — tegaskan keputusan
 * Verifikator, bukan cuma repaint kartu tahap). */
const PENDAFTARAN_FOLLOWUP = {
  'Aktif': { tone: 'alert-success', message: 'Selamat, pendaftaran sudah ' +
    'diterima oleh Verifikator. Operator dapat masuk dengan akun SIAPkerja.',
    cta: 'Masuk dengan SIAPkerja →' },
  'Perlu perbaikan': { tone: 'alert-warning', message: 'Verifikator meminta' +
    ' perbaikan dokumen. Masuk dengan SIAPkerja untuk mengunggah ulang.',
    cta: 'Masuk untuk perbaiki dokumen →' },
  'Menunggu verifikasi': { tone: 'alert-info', message: 'Berkas masih ' +
    'dalam antrean pemeriksaan Verifikator Akun.', cta: null },
};

function showStatusResult(result, status) {
  result.classList.remove('alert-error', 'alert-info', 'alert-success',
      'alert-warning');
  const followup = status.jenis === 'pendaftaran'
    ? PENDAFTARAN_FOLLOWUP[status.status]
    : null;
  result.classList.add(followup?.tone ?? 'alert-info');
  setHtml(result, html`
    <div class="grid gap-1.5">
      <p class="flex flex-wrap items-center gap-2 font-bold">
        ${status.layanan} ${statusBadge(status.status, status.tone)}</p>
      <p>No. <b>${status.nomor}</b> · Tahap: ${status.tahap}
        · ${status.tanggal}${status.batas ? ` · batas ${status.batas}` : ''}</p>
      ${status.catatan ? html`<p>Catatan Verifikator: ${status.catatan}</p>` : ''}
      ${followup ? html`<p>${followup.message}</p>` : ''}
      ${followup?.cta ? html`
        <a href="akun-login.html" class="btn btn-sm mt-1 w-fit">${followup.cta}</a>` : ''}
    </div>`);
  setVisible(result, true);
}

function showStatusError(result, err) {
  console.error('[landing] cek status', err);
  result.classList.replace('alert-info', 'alert-error');
  result.textContent = 'Status gagal dimuat. Silakan coba lagi; kendala data'
    + ' hubungi WhatsApp 0811 1380 1443.';
  setVisible(result, true);
}

// ---------------------------------------------------------------------------
// Jenis pelayanan + alur
// ---------------------------------------------------------------------------

function pickService(index, shouldScroll) {
  state.active = index;
  renderAlur();
  if (!shouldScroll) {
    // Chip di-render ulang; kembalikan fokus keyboard ke chip terpilih.
    qsa('#service-chips button')[index].focus();
    return;
  }
  const target = qs('#alur');
  const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({
    top: target.getBoundingClientRect().top + window.scrollY
      - HEADER_OFFSET_PX,
    behavior: reduceMotion ? 'auto' : 'smooth',
  });
}

function renderServiceCards() {
  renderList(qs('#service-list'), qs('#service-card-template'), SERVICES,
      (node, service, index) => {
        fillSlots(node, service);
        const tag = qs('[data-slot="tag"]', node);
        tag.classList.add(SERVICE_TAG_CLASS[service.tag]);
        if (service.tag === 'Khusus') {
          tag.classList.remove('badge-soft');
        }
        const button = qs('button', node);
        button.dataset.testid = `landing-btn-service-${service.code}`;
        button.addEventListener('click', () => pickService(index, true));
      });
}

function renderChips() {
  renderList(qs('#service-chips'), qs('#service-chip-template'), SERVICES,
      (node, service, index) => {
        const button = qs('button', node);
        const isActive = index === state.active;
        button.textContent = service.short;
        button.dataset.testid = `landing-btn-chip-${service.code}`;
        button.setAttribute('aria-pressed', String(isActive));
        button.classList.add(...(isActive ? CHIP_ACTIVE : CHIP_IDLE));
        button.addEventListener('click', () => pickService(index, false));
      });
}

function renderAlur() {
  const service = SERVICES[state.active];
  qs('#alur-active-name').textContent = service.short;
  renderChips();
  renderList(qs('#alur-steps'), qs('#alur-step-template'),
      buildSteps(service), (node, step, index) => {
        fillSlots(node, step);
        node.classList.add(index === 0
          ? 'border-(--color-info-bright)'
          : 'border-primary-content/30');
      });
  qs('#alur-note').textContent = buildNote(service);
}

// ---------------------------------------------------------------------------
// Pengumuman
// ---------------------------------------------------------------------------

function renderPengumuman() {
  const items = state.showAllPengumuman
    ? state.pengumuman
    : state.pengumuman.slice(0, PENGUMUMAN_INITIAL);
  renderList(qs('#pengumuman-list'), qs('#pengumuman-template'), items,
      (node, item) => {
        fillSlots(node, item);
        qs('[data-slot="tag"]', node).classList.add(
            PENGUMUMAN_TAG_CLASS[item.tag] ?? 'badge-info');
        setVisible(qs('[data-hotline-link]', node),
            /TKA Hotline/.test(item.judul));
      });
  const toggle = qs('#pengumuman-toggle');
  setVisible(toggle, state.pengumuman.length > PENGUMUMAN_INITIAL);
  toggle.setAttribute('aria-expanded', String(state.showAllPengumuman));
  toggle.textContent = state.showAllPengumuman
    ? 'Tampilkan lebih sedikit ↑'
    : 'Semua pengumuman →';
}

async function loadPengumuman() {
  const region = qs('#pengumuman-region');
  setBusy(region, true);
  setVisible(qs('#pengumuman-loading'), true);
  setVisible(qs('#pengumuman-error'), false);
  try {
    state.pengumuman = await listPengumuman();
    renderPengumuman();
  } catch (error) {
    console.error('[landing] gagal memuat pengumuman', error);
    setVisible(qs('#pengumuman-error'), true);
  } finally {
    setVisible(qs('#pengumuman-loading'), false);
    setBusy(region, false);
  }
}

function bindPengumuman() {
  qs('#pengumuman-retry').addEventListener('click', loadPengumuman);
  qs('#pengumuman-toggle').addEventListener('click', () => {
    state.showAllPengumuman = !state.showAllPengumuman;
    renderPengumuman();
  });
}

function init() {
  bindTabs();
  if (window.location.hash === '#cek-status') {
    state.tab = 'status';
  }
  renderTabs();
  bindStatusForm();
  renderServiceCards();
  renderAlur();
  bindPengumuman();
  loadPengumuman();
}

init();
