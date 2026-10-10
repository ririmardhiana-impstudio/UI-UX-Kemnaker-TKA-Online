/**
 * @fileoverview Portable contract-test client. Without BASE_URL it runs
 * against the in-process mock (fresh store per client => independent
 * tests). With BASE_URL=http://host/api/v1 the same tests hit the real
 * backend via fetch — that is how BE verifies it matches the prototype.
 */

import { createMockApi } from '../../js/mocks/handlers.js';

export const BASE_URL = process.env.BASE_URL ?? null;

/**
 * @return {function(string, string, {query: (!Object|undefined),
 *     body: (*|undefined)}=): !Promise<{status: number, body: *}>}
 */
export function createClient() {
  if (!BASE_URL) {
    const api = createMockApi();
    return async (method, path, { query = {}, body = null } = {}) =>
      api({ method, path, query, body });
  }
  return async (method, path, { query = {}, body } = {}) => {
    const search = new URLSearchParams(query).toString();
    const res = await fetch(`${BASE_URL}${path}${search ? `?${search}` : ''}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };
}
