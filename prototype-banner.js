/**
 * @fileoverview "PROTOTYPE" status indicator: corner triangle (top-left)
 * that toggles a label with a 4s auto-hide countdown. Rendered only when
 * window.USE_MOCK is true. Colors = DaisyUI semantic classes.
 */

import { resolvePageStatus } from './config/page-status.js';

const AUTO_HIDE_MS = 4000;
const STATUS_META = {
  progress: { label: 'In Progress', cls: 'bg-warning text-warning-content' },
  ready: { label: 'Ready for Development', cls: 'bg-info text-info-content' },
  done: { label: 'Selesai Develop', cls: 'bg-success text-success-content' },
};
const LABEL_SHOW = 'Tampilkan status prototype';
const LABEL_HIDE = 'Sembunyikan status prototype';

function renderBanner() {
  if (!window.USE_MOCK) {
    return;
  }
  const status = resolvePageStatus(window.location.pathname);
  if (!status) {
    return;
  }
  const meta = STATUS_META[status];
  const container = buildBanner(meta);
  document.body.appendChild(container);
  bindToggle(container);
}

function buildBanner(meta) {
  const container = document.createElement('div');
  container.className =
    'fixed left-0 top-0 z-banner flex items-start print:hidden';
  container.innerHTML = `
    <button type="button" data-banner-toggle aria-expanded="false"
            aria-controls="prototype-banner-label"
            aria-label="${LABEL_SHOW}" title="Prototype — ${meta.label}"
            class="prototype-banner-corner relative h-11 w-11 cursor-pointer
                   transition-transform hover:scale-105 ${meta.cls}">
      <span class="absolute left-1 top-0.5 text-sm" aria-hidden="true">🧪</span>
    </button>
    <div id="prototype-banner-label"
         class="animate-fade-in relative ml-2 mt-2 hidden overflow-hidden
                rounded-md shadow-md ${meta.cls}">
      <span role="status" class="block px-3 py-1 text-xs font-semibold">
        🧪 PROTOTYPE — ${meta.label}
      </span>
      <span aria-hidden="true" data-banner-countdown
            class="absolute bottom-0 left-0 h-0.5 w-full origin-left
                   bg-base-content/30"></span>
    </div>`;
  return container;
}

function bindToggle(container) {
  const button = container.querySelector('[data-banner-toggle]');
  const label = container.querySelector('#prototype-banner-label');
  const countdown = container.querySelector('[data-banner-countdown]');
  let timer = null;

  const setOpen = (isOpen) => {
    label.classList.toggle('hidden', !isOpen);
    button.setAttribute('aria-expanded', String(isOpen));
    button.setAttribute('aria-label', isOpen ? LABEL_HIDE : LABEL_SHOW);
    window.clearTimeout(timer);
    countdown.classList.remove('prototype-banner-countdown-run');
    if (isOpen) {
      void countdown.offsetWidth; // Restart the CSS countdown animation.
      countdown.classList.add('prototype-banner-countdown-run');
      timer = window.setTimeout(() => setOpen(false), AUTO_HIDE_MS);
    }
  };

  button.addEventListener('click', () => {
    setOpen(label.classList.contains('hidden'));
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', renderBanner);
} else {
  renderBanner();
}
