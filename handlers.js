/**
 * @fileoverview Mock API route table for /api/v1/*. Single source for:
 *   - js/api/client.js (browser fetch override when USE_MOCK = true)
 *   - scripts/generate-openapi.js (docs/shared/openapi.yaml)
 *   - test/contract/*.test.js (behavioural spec for the real backend)
 *
 * Every response body is { data, meta? } or { error: { code, message } }.
 */

import { matchRoute, fail } from './router.js';
import { createStore, persistStore, watchExternalChanges } from './store.js';
import { ACCOUNT_ROUTES } from './routes/account.js';
import { AUTH_ROUTES } from './routes/auth.js';
import { BACK_OFFICE_ROUTES } from './routes/back-office.js';
import { LAPORAN_ROUTES } from './routes/laporan.js';
import { PERUBAHAN_ROUTES } from './routes/perubahan.js';
import { PORTAL_ROUTES } from './routes/portal.js';
import { PUBLIC_ROUTES } from './routes/public.js';
import { REFERENCE_ROUTES } from './routes/reference.js';
import { TIKET_ROUTES } from './routes/tiket.js';
import { ANALITIK_ROUTES } from './routes/analitik.js';
import { NOTIFIKASI_ROUTES } from './routes/notifikasi.js';
import { OPERATOR_ROUTES } from './routes/operator.js';
import { SECURITY_ROUTES } from './routes/security.js';
import { HPK_VERIFIKASI_ROUTES } from './routes/hpk-verifikasi.js';
import {
  PENGAJUAN_VERIFIKASI_ROUTES,
} from './routes/pengajuan-verifikasi.js';
import {
  PENGESAHAN_VERIFIKASI_ROUTES,
} from './routes/pengesahan-verifikasi.js';
import { KEPUTUSAN_PENCABUTAN_ROUTES } from './routes/keputusan-pencabutan.js';
import { PENCABUTAN_ROUTES } from './routes/pencabutan.js';
import { PENDAFTAR_ROUTES } from './routes/pendaftar.js';
import { SIKLUS_ROUTES } from './routes/siklus.js';
import { PENILAIAN_KELAYAKAN_ROUTES } from './routes/penilaian-kelayakan.js';
import { PENGESAHAN_RPTKA_ROUTES } from './routes/pengesahan-rptka.js';
import { EKSPOS_HPK_ROUTES } from './routes/ekspos-hpk.js';
import { VALIDASI_HPK_ROUTES } from './routes/validasi-hpk.js';
import { PENGESAHAN_VALIDASI_ROUTES } from './routes/pengesahan-validasi.js';
import { PENCABUTAN_VALIDASI_ROUTES } from './routes/pencabutan-validasi.js';
import { PENCABUTAN_DIREKTUR_ROUTES } from './routes/pencabutan-direktur.js';
import { SKRD_DISNAKER_ROUTES } from './routes/skrd-disnaker.js';
import { PENERBITAN_HPK_ROUTES } from './routes/penerbitan-hpk.js';
import { IMIGRASI_ROUTES } from './routes/imigrasi.js';
import { PENGESAHAN_DIREKTUR_ROUTES } from './routes/pengesahan-direktur.js';

export const ROUTES = [
  ...REFERENCE_ROUTES,
  ...PUBLIC_ROUTES,
  ...PORTAL_ROUTES,
  ...PERUBAHAN_ROUTES,
  ...LAPORAN_ROUTES,
  ...TIKET_ROUTES,
  ...AUTH_ROUTES,
  ...ACCOUNT_ROUTES,
  ...BACK_OFFICE_ROUTES,
  ...PENDAFTAR_ROUTES,
  ...HPK_VERIFIKASI_ROUTES,
  ...PENGAJUAN_VERIFIKASI_ROUTES,
  ...PENCABUTAN_ROUTES,
  ...PENGESAHAN_VERIFIKASI_ROUTES,
  ...OPERATOR_ROUTES,
  ...SECURITY_ROUTES,
  ...SIKLUS_ROUTES,
  ...PENILAIAN_KELAYAKAN_ROUTES,
  ...PENGESAHAN_RPTKA_ROUTES,
  ...EKSPOS_HPK_ROUTES,
  ...VALIDASI_HPK_ROUTES,
  ...PENGESAHAN_VALIDASI_ROUTES,
  ...PENCABUTAN_VALIDASI_ROUTES,
  ...PENCABUTAN_DIREKTUR_ROUTES,
  ...SKRD_DISNAKER_ROUTES,
  ...PENERBITAN_HPK_ROUTES,
  ...IMIGRASI_ROUTES,
  ...PENGESAHAN_DIREKTUR_ROUTES,
  ...KEPUTUSAN_PENCABUTAN_ROUTES,
  ...ANALITIK_ROUTES,
  ...NOTIFIKASI_ROUTES,
];

/**
 * Create a request handler bound to its own store (persisted to
 * `localStorage` in the browser — see store.js — so mutations from
 * pendaftaran/verifikasi/permohonan survive navigation to another page;
 * in Node/tests, `createStore()` never finds a persisted snapshot, so
 * each test still gets its own fresh, isolated store). `watchExternalChanges`
 * keeps this store live if ANOTHER already-open tab/window writes to the
 * same `localStorage` key — e.g. a Verifikator/Validator/Direktur page
 * approving a request while the employer's portal tab is sitting open —
 * so a GET right after no longer serves the stale snapshot this tab
 * started with.
 * @return {function({method: string, path: string, query: !Object,
 *     body: *}): {status: number, body: *}}
 */
export function createMockApi() {
  const store = createStore();
  watchExternalChanges(store);
  return ({ method, path, query = {}, body = null }) => {
    const match = matchRoute(ROUTES, method.toUpperCase(), path);
    if (!match) {
      return fail(404, 'ROUTE_NOT_FOUND', `${method} ${path} tidak dikenal.`);
    }
    const result = match.route.handler({
      params: match.params, query, body, store,
    });
    if (method.toUpperCase() !== 'GET') {
      persistStore(store);
    }
    return result;
  };
}
