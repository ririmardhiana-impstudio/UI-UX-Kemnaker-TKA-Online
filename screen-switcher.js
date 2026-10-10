/**
 * @fileoverview Sticky dark demo bar ("Layar akun: ...") that lets
 * reviewers jump between screens / roles of a prototype page. Port of the
 * legacy Akun & Login top bar; reused by Hotline, Back Office and Portal.
 *
 * Usage:
 *   const bar = renderScreenSwitcher(qs('#screen-switcher'), {
 *     label: 'Layar akun:',
 *     items: [{ key: 'login', label: 'Login' }, ...],
 *     activeKey: 'login',
 *     onSelect: (key) => showScreen(key),
 *   });
 *   bar.setActive('daftar');
 */

import { html, setHtml } from './dom.js';

const ACTIVE_CLASS = ['bg-base-100', 'text-base-content', 'font-semibold'];
const IDLE_CLASS = ['bg-neutral-content/10', 'text-neutral-content/80'];

/**
 * @param {!Element} container Usually an empty <div> at top of <body>.
 * @param {{label: string, items: !Array<{key: string, label: string}>,
 *     activeKey: string, onSelect: function(string),
 *     backHref: (string|undefined), backLabel: (string|undefined),
 *     ariaLabel: (string|undefined)}} options
 * @return {{setActive: function(string)}}
 */
export function renderScreenSwitcher(container, options) {
  const backHref = options.backHref ?? 'index.html';
  const backLabel = options.backLabel ?? '← Semua prototipe';
  setHtml(container, html`
    <nav aria-label="${options.ariaLabel ?? 'Pilih layar demo'}"
         class="sticky top-0 z-sticky flex flex-nowrap items-center gap-2
                overflow-x-auto bg-neutral px-5 py-2 text-xs
                text-neutral-content/80 md:flex-wrap md:overflow-visible">
      <b class="mr-1.5 shrink-0 whitespace-nowrap text-neutral-content">
        ${options.label}</b>
      ${options.items.map((item) => html`
        <button type="button" data-screen="${item.key}"
          class="shrink-0 cursor-pointer whitespace-nowrap rounded-full
                 px-2.5 py-1.5">
          ${item.label}</button>`)}
      <a href="${backHref}"
         class="ml-auto shrink-0 whitespace-nowrap font-semibold
                text-info-bright hover:underline">
        ${backLabel}</a>
    </nav>`);

  const buttons = [...container.querySelectorAll('[data-screen]')];
  const setActive = (key) => {
    for (const button of buttons) {
      const isActive = button.dataset.screen === key;
      button.classList.remove(...ACTIVE_CLASS, ...IDLE_CLASS);
      button.classList.add(...(isActive ? ACTIVE_CLASS : IDLE_CLASS));
      button.setAttribute('aria-pressed', String(isActive));
    }
  };
  container.addEventListener('click', (event) => {
    const button = event.target.closest('[data-screen]');
    if (!button) {
      return;
    }
    setActive(button.dataset.screen);
    options.onSelect(button.dataset.screen);
  });
  setActive(options.activeKey);
  return { setActive };
}
