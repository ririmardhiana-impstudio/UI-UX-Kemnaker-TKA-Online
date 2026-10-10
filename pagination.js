/**
 * @fileoverview Client-side pagination (port of legacy `pager(key, arr)`
 * from Portal Pemberi Kerja & Back Office): page numbers with ellipsis
 * (first, last, current ±1), prev/next, optional first/last, and page size
 * 10/25/50. Rendered as a DaisyUI `join`.
 *
 * Usage:
 *   const pager = createPager(footerEl, { onChange: renderTable });
 *   function renderTable() {
 *     const rows = pager.update(allRows);   // slices + re-renders footer
 *     ...render rows...
 *   }
 */

import { html, raw, setHtml } from './dom.js';

export const PAGE_SIZES = [10, 25, 50];
export const ELLIPSIS = '…';

/**
 * Slice items for the requested page (page is clamped to range).
 * @param {!Array<*>} items
 * @param {{page: number, size: number}} state
 * @return {{rows: !Array<*>, page: number, pages: number, size: number,
 *     from: number, to: number, total: number}}
 */
export function paginate(items, { page, size }) {
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, page), pages);
  const start = (current - 1) * size;
  return {
    rows: items.slice(start, start + size),
    page: current, pages, size, total,
    from: total ? start + 1 : 0,
    to: Math.min(current * size, total),
  };
}

/**
 * Page number list: 1, last, and current ±1; gaps collapse to '…'.
 * @param {number} page
 * @param {number} pages
 * @return {!Array<(number|string)>}
 */
export function pageNumbers(page, pages) {
  const nums = [];
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - page) <= 1) {
      nums.push(i);
    } else if (nums[nums.length - 1] !== ELLIPSIS) {
      nums.push(ELLIPSIS);
    }
  }
  return nums;
}

/**
 * Stateful pager bound to a footer container.
 * @param {!Element} container Footer element to render into.
 * @param {{onChange: function(), size: (number|undefined),
 *     showFirstLast: (boolean|undefined), totalSuffix: (string|undefined),
 *     label: (string|undefined)}} options
 * @return {{update: function(!Array<*>): !Array<*>, reset: function()}}
 */
export function createPager(container, options) {
  const state = { page: 1, size: options.size ?? PAGE_SIZES[0] };
  container.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-page], button[data-size]');
    if (!button || button.disabled) {
      return;
    }
    if (button.dataset.size) {
      state.size = Number(button.dataset.size);
      state.page = 1;
    } else {
      state.page = Number(button.dataset.page);
    }
    options.onChange();
  });
  return {
    update(items) {
      const result = paginate(items, state);
      state.page = result.page;
      renderPagination(container, result, options);
      return result.rows;
    },
    reset() {
      state.page = 1;
    },
  };
}

/**
 * Render footer markup for a paginate() result. Hidden when total = 0.
 * @param {!Element} container
 * @param {!Object} result paginate() output.
 * @param {!Object=} options showFirstLast (default true), totalSuffix
 *     (default ' data'), label (aria-label of the nav).
 */
export function renderPagination(container, result, options = {}) {
  container.hidden = result.total === 0;
  if (result.total === 0) {
    return;
  }
  const suffix = options.totalSuffix ?? ' data';
  setHtml(container, html`
    <div class="flex flex-wrap items-center justify-between gap-3 px-5 py-3
                text-sm text-base-content/70">
      <p aria-live="polite">Menampilkan
        <b class="text-base-content">${result.from}–${result.to}</b> dari
        <b class="text-base-content">${result.total}</b>${suffix}</p>
      <nav aria-label="${options.label ?? 'Navigasi halaman'}">
        <div class="join">${pageButtons(result, options)}</div>
      </nav>
      <div class="flex items-center gap-1" role="group"
           aria-label="Jumlah baris per halaman">
        <span>Baris</span>${sizeButtons(result.size)}
      </div>
    </div>`);
}

function pageButtons({ page, pages }, options) {
  const showFirstLast = options.showFirstLast ?? true;
  const isFirst = page <= 1;
  const isLast = page >= pages;
  return [
    showFirstLast && navButton('«', 1, isFirst, 'Halaman pertama'),
    navButton('‹', page - 1, isFirst, 'Halaman sebelumnya'),
    pageNumbers(page, pages).map((n) => numberButton(n, page)),
    navButton('›', page + 1, isLast, 'Halaman berikutnya'),
    showFirstLast && navButton('»', pages, isLast, 'Halaman terakhir'),
  ];
}

function navButton(symbol, target, isDisabled, label) {
  return html`<button type="button" class="join-item btn btn-sm btn-square"
    data-page="${target}" aria-label="${label}"
    ${isDisabled ? 'disabled' : ''}>${symbol}</button>`;
}

function numberButton(n, page) {
  if (n === ELLIPSIS) {
    return html`<span class="join-item btn btn-sm btn-disabled"
      aria-hidden="true">${ELLIPSIS}</span>`;
  }
  const isCurrent = n === page;
  return html`<button type="button"
    class="join-item btn btn-sm ${isCurrent ? 'btn-primary' : ''}"
    data-page="${n}" aria-label="Halaman ${n}"
    ${isCurrent ? raw('aria-current="page"') : ''}>${n}</button>`;
}

function sizeButtons(size) {
  return PAGE_SIZES.map((z) => {
    const isActive = z === size;
    const cls = isActive ? 'bg-primary/10 text-primary' : '';
    return html`<button type="button" class="btn btn-ghost btn-xs ${cls}"
      data-size="${z}" aria-pressed="${isActive}">${z}</button>`;
  });
}
