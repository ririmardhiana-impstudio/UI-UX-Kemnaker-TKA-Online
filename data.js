/**
 * @fileoverview Data loading for the employer portal. Every read goes
 * through js/api/* (fetch /api/v1/..., intercepted by the mock when
 * USE_MOCK). Idempotent GETs are retried once on 5xx/network errors so a
 * single injected mock failure does not blank the whole portal; if it still
 * fails the caller shows an error state with "Coba lagi".
 */

import { listBilling } from '../../api/billing.js';
import { getCompany } from '../../api/companies.js';
import { listEkspos } from '../../api/ekspos.js';
import { listHpk } from '../../api/hpk.js';
import {
  getLaporan, listLaporanDef, listLaporanPenggunaan,
} from '../../api/laporan.js';
import { listLegacy } from '../../api/legacy.js';
import { listPencabutan } from '../../api/pencabutan.js';
import { listPengesahan } from '../../api/pengesahan.js';
import { listPerubahan } from '../../api/perubahan.js';
import { getSystemInfo, getWorkflowSteps } from '../../api/reference.js';
import { listTka } from '../../api/tka.js';
import { state } from './state.js';

const RETRY_ATTEMPTS = 3;

/** Role-independent reference data, loaded once per page load. */
let referenceCache = null;

/**
 * Retry fn on server/network errors (never on 4xx business errors).
 * @template T
 * @param {function(): !Promise<T>} fn
 * @param {number=} attempts
 * @return {!Promise<T>}
 */
export async function withRetry(fn, attempts = RETRY_ATTEMPTS) {
  try {
    return await fn();
  } catch (error) {
    const isClientError = error.status && error.status < 500;
    if (attempts <= 1 || isClientError) {
      throw error;
    }
    return withRetry(fn, attempts - 1);
  }
}

async function loadReference() {
  if (!referenceCache) {
    const [steps, system, laporanDef, pencabutan] = await Promise.all([
      withRetry(getWorkflowSteps),
      withRetry(getSystemInfo),
      withRetry(listLaporanDef),
      withRetry(listPencabutan),
    ]);
    referenceCache = { steps, today: system.today, laporanDef, pencabutan };
  }
  return referenceCache;
}

/**
 * Load everything the shell + role-scoped pages need into state.data.
 * @param {string} role
 */
export async function loadRoleData(role) {
  const [reference, company, tka, hpk, pengesahan, billing, ekspos,
    perubahan, laporan] = await Promise.all([
    loadReference(),
    withRetry(() => getCompany(role)),
    withRetry(() => listTka(role)),
    withRetry(() => listHpk(role)),
    withRetry(() => listPengesahan(role)),
    withRetry(() => listBilling(role)),
    withRetry(() => listEkspos(role)),
    withRetry(() => listPerubahan(role)),
    withRetry(() => getLaporan(role)),
  ]);
  if (role !== state.role) {
    return;
  }
  state.data = {
    ...reference, company, tka, hpk, pengesahan, billing, ekspos,
    perubahan, laporan,
  };
}

/** Re-fetch one role-scoped collection after a mutation. */
export async function reloadCollection(name) {
  const role = state.role;
  const loaders = {
    billing: () => listBilling(role),
    hpk: () => listHpk(role),
    pengesahan: () => listPengesahan(role),
    perubahan: () => listPerubahan(role),
    pencabutan: () => listPencabutan(),
    laporan: () => getLaporan(role),
  };
  const value = await withRetry(loaders[name]);
  if (name === 'pencabutan' && referenceCache) {
    referenceCache.pencabutan = value;
  }
  if (state.data && role === state.role) {
    state.data[name] = value;
  }
}

/** Rows for a legacy-regime service (cached per grp/layanan). */
export async function loadLegacyRows(grp, layanan) {
  const key = `legacy:${grp}:${layanan}`;
  if (!state.extra[key]) {
    state.extra[key] = await withRetry(() =>
      listLegacy({ grp, layanan, role: state.role }));
  }
  return state.extra[key];
}

/** Rows of "Laporan Pelaksanaan Penggunaan TKA" (cached). */
export async function loadLaporanPenggunaan() {
  if (!state.extra.laporanPenggunaan) {
    state.extra.laporanPenggunaan = await withRetry(listLaporanPenggunaan);
  }
  return state.extra.laporanPenggunaan;
}
