/**
 * @fileoverview Mutable mock database. Built from TKA_DATA and the page
 * fixtures. Persisted to `localStorage` (browser only) so that data
 * submitted on one page — pendaftaran, keputusan verifikator, permohonan
 * HPK/pengesahan, dsb. — is still there when another page loads, instead
 * of resetting to the dummy baseline on every navigation. The dummy
 * seed data is only ever used as the STARTING point (first load, or
 * after the persisted shape goes stale) — see `createStore()`.
 *
 * Node (contract tests) has no `localStorage`, so persistence is a no-op
 * there and every test still starts from a fresh, isolated store — see
 * `test/contract/client.js`.
 */

import { TKA_DATA } from './data.js';
import {
  EKSPOS_SCHEDULE,
  HOTLINE_PROFILES,
  HOTLINE_STATS,
  LEGACY_FIXTURES,
  MOCK_ACCOUNTS,
  PEMDA_VALIDATIONS,
  PK_LABEL,
  TIKET_BASE_MESSAGES,
  WILAYAH,
} from './fixtures.js';

/** Bump whenever the seeded shape changes (new collection, renamed
 * field, ...) so a persisted snapshot from an older session is
 * discarded instead of merged into an incompatible store. */
const STORE_VERSION = 3;
const STORAGE_KEY = 'tka:mock-store';

const hasLocalStorage = typeof localStorage !== 'undefined';

/**
 * Load the store — from `localStorage` if a compatible snapshot exists,
 * otherwise freshly seeded from TKA_DATA/fixtures (and persisted right
 * away, so the very first load already has a baseline to build on).
 * @return {!Object} Mutable store.
 */
export function createStore() {
  const persisted = loadPersisted();
  const db = persisted ?? seedFresh();
  db.genLegacy = TKA_DATA.genLegacy; // function value, never persisted
  if (!persisted) {
    persistStore(db);
  }
  return db;
}

/** Fresh mock database from TKA_DATA + fixtures (legacy seeding). */
function seedFresh() {
  const { genLegacy, ...collections } = TKA_DATA;
  const db = structuredClone(collections);
  return {
    ...db,
    legacyFixtures: structuredClone(LEGACY_FIXTURES),
    tiketMessages: seedTiketMessages(db.tiket),
    hotlineStats: structuredClone(HOTLINE_STATS),
    pemdaValidations: structuredClone(PEMDA_VALIDATIONS),
    eksposSchedule: structuredClone(EKSPOS_SCHEDULE),
    accounts: structuredClone(MOCK_ACCOUNTS),
    loginFailures: {},
    passwordResets: {},
    issuedResetTokens: new Set(['mock-reset-token']),
    verificationResends: {},
    hotlineProfiles: structuredClone(HOTLINE_PROFILES),
    wilayah: WILAYAH,
  };
}

/**
 * Persist the store to `localStorage` (no-op outside the browser, or if
 * storage is unavailable/full — the prototype just falls back to
 * in-memory-only for that write, it never throws into a route handler).
 * @param {!Object} store
 */
export function persistStore(store) {
  if (!hasLocalStorage) {
    return;
  }
  try {
    const { genLegacy, ...persistable } = store;
    const payload = { __version: STORE_VERSION, ...persistable };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload, replaceSet));
  } catch (error) {
    console.warn('[MOCK] gagal menyimpan store ke localStorage', error);
  }
}

/**
 * Keep `store` in sync with changes written by OTHER tabs/windows of the
 * same origin (e.g. a back-office page — Verifikator/Validator/Simponi —
 * verifying a request while the employer's portal tab is already open).
 * `createStore()` only loads `localStorage` once per page load; without
 * this, an already-open tab would never see another tab's mutations
 * until it is hard-reloaded. The native `storage` event fires only in
 * OTHER documents, never the one that made the write, which is exactly
 * the gap here — the writing tab's own in-memory `store` is already
 * current. Mutates `store` in place so route handlers that captured the
 * object reference keep seeing live data.
 * @param {!Object} store
 */
export function watchExternalChanges(store) {
  if (typeof window === 'undefined' || !hasLocalStorage) {
    return;
  }
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY || !event.newValue) {
      return;
    }
    const fresh = loadPersisted();
    if (fresh) {
      // Only overwrite persisted collections — never touch `genLegacy`
      // (a function value, deliberately excluded from persistence).
      Object.assign(store, fresh);
    }
  });
}

/** @return {?Object} Persisted store, or null if absent/stale/corrupt. */
function loadPersisted() {
  if (!hasLocalStorage) {
    return null;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const { __version, ...db } = JSON.parse(raw, reviveSet);
    return __version === STORE_VERSION ? db : null;
  } catch (error) {
    console.warn('[MOCK] gagal memuat store dari localStorage', error);
    return null;
  }
}

/** JSON.stringify replacer: Set -> tagged plain array. */
function replaceSet(key, value) {
  return value instanceof Set ? { __isSet: true, values: [...value] } : value;
}

/** JSON.parse reviver: tagged plain array -> Set. */
function reviveSet(key, value) {
  return value && typeof value === 'object' && value.__isSet
    ? new Set(value.values) : value;
}

/**
 * Seed conversation per ticket — same fallback message as legacy
 * TKA Hotline baseMsgs(): "<judul>. Mohon bantuan tindak lanjut."
 */
function seedTiketMessages(tikets) {
  const byNo = {};
  for (const t of tikets) {
    const seed = TIKET_BASE_MESSAGES[t.no] ?? [fallbackMessage(t)];
    byNo[t.no] = seed.map(toApiMessage);
  }
  return byNo;
}

/** Legacy `me: 1` = employer side; API exposes `sender`. */
function toApiMessage({ me, ...rest }) {
  return { sender: me ? 'pk' : 'agen', ...structuredClone(rest) };
}

function fallbackMessage(t) {
  const [day, time] = t.tgl.split(', ');
  return {
    me: 1,
    from: t.perusahaan,
    time: `${day.replace(' September 2026', ' Sep')}, ${time ?? ''}`,
    text: `${t.judul}. Mohon bantuan tindak lanjut.`,
  };
}

export { PK_LABEL };
