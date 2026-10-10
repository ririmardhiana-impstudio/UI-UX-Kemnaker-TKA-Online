/**
 * @fileoverview QR code placeholder (status: draft). Draws a deterministic
 * QR-looking SVG (three finder patterns + modules hashed from `value`) with
 * no external library. It is NOT scannable: BE replaces it with a real QR
 * of the same value. Use cases: jadwal ekspose HPK, barcode Pengesahan,
 * tiket hotline.
 */

import { html } from './dom.js';

const MODULES = 25;
const FINDER = 7;
const QUIET = 2;
const FNV_OFFSET = 2166136261;
const FNV_PRIME = 16777619;

/** xorshift32 stream seeded from an FNV-1a hash of the value. */
function stream(value) {
  let seed = FNV_OFFSET;
  for (const char of String(value)) {
    seed = Math.imul(seed ^ char.charCodeAt(0), FNV_PRIME) >>> 0;
  }
  return () => {
    seed ^= seed << 13;
    seed >>>= 0;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    seed >>>= 0;
    return seed;
  };
}

function inFinder(x, y) {
  const corners = [[0, 0], [MODULES - FINDER, 0], [0, MODULES - FINDER]];
  return corners.some(([cx, cy]) => x >= cx - 1 && x <= cx + FINDER &&
    y >= cy - 1 && y <= cy + FINDER);
}

function finderDark(x, y) {
  const lx = x % (MODULES - FINDER) % FINDER;
  const ly = y % (MODULES - FINDER) % FINDER;
  const ring = lx === 0 || ly === 0 || lx === FINDER - 1 || ly === FINDER - 1;
  const core = lx >= 2 && lx <= 4 && ly >= 2 && ly <= 4;
  return ring || core;
}

/** SVG path of every dark module (1x1 squares). */
function modulePath(value) {
  const next = stream(value);
  const cells = [];
  for (let y = 0; y < MODULES; y++) {
    for (let x = 0; x < MODULES; x++) {
      const dark = inFinder(x, y)
        ? (x < FINDER || x >= MODULES - FINDER) &&
          (y < FINDER || y >= MODULES - FINDER) && finderDark(x, y)
        : next() % 2 === 0;
      if (dark) {
        cells.push(`M${x + QUIET} ${y + QUIET}h1v1h-1z`);
      }
    }
  }
  return cells.join('');
}

/**
 * @param {{value: string, label: string, size: (string|undefined)}} options
 *     value = text the real QR would encode; label = accessible name;
 *     size = Tailwind size class (default 'size-40').
 * @return {!Object} SafeHtml
 */
export function qrCode({ value, label, size = 'size-40' }) {
  const box = MODULES + QUIET * 2;
  return html`<svg viewBox="0 0 ${box} ${box}" role="img"
      aria-label="${label}" data-qr-value="${value}"
      class="${size} rounded-field border border-base-300 bg-base-100
        text-base-content" shape-rendering="crispEdges">
    <path fill="currentColor" d="${modulePath(value)}"></path></svg>`;
}
