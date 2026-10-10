/**
 * @fileoverview Minimal route table + response helpers for the mock API.
 * A route handler receives { params, query, body, store } and returns
 * { status, body } — never a Response, so the same handlers run in the
 * browser (via js/api/client.js) and in Node (contract tests, OpenAPI).
 */

import { ROLE_KEYS, toValidationError } from '../contracts/schema.js';

/**
 * Define a mock route.
 * @param {string} method HTTP verb.
 * @param {string} path Path relative to /api/v1, e.g. '/tiket/:no'.
 * @param {function(!Object): {status: number, body: *}} handler
 * @param {!Object=} doc OpenAPI metadata: summary, tag, request, query,
 *     example ({params, query, body, before: [setup requests]}),
 *     responses (extra status codes).
 * @return {!Object} Route record.
 */
export function route(method, path, handler, doc = {}) {
  const keys = [];
  const source = path.replace(/:([a-zA-Z]+)/g, (_, key) => {
    keys.push(key);
    return '([^/]+)';
  });
  return {
    method, path, handler, doc, keys,
    regex: new RegExp(`^${source}$`),
  };
}

/**
 * Find the route matching method + path.
 * @param {!Array<!Object>} routes
 * @param {string} method
 * @param {string} path Path relative to /api/v1.
 * @return {?{route: !Object, params: !Object<string, string>}}
 */
export function matchRoute(routes, method, path) {
  for (const candidate of routes) {
    if (candidate.method !== method) {
      continue;
    }
    const found = candidate.regex.exec(path);
    if (found) {
      const params = {};
      candidate.keys.forEach((key, i) => {
        params[key] = decodeURIComponent(found[i + 1]);
      });
      return { route: candidate, params };
    }
  }
  return null;
}

/** @return {{status: number, body: !Object}} 200 envelope. */
export function ok(data, meta) {
  return { status: 200, body: meta ? { data, meta } : { data } };
}

/** @return {{status: number, body: !Object}} 201 envelope. */
export function created(data) {
  return { status: 201, body: { data } };
}

/** @return {{status: number, body: !Object}} 202 envelope. */
export function accepted(data) {
  return { status: 202, body: { data } };
}

/** List envelope with meta.total. */
export function list(items) {
  return ok(items, { total: items.length });
}

/**
 * Error envelope { error: { code, message, field?, ...extra } }.
 * @param {number} status
 * @param {string} code
 * @param {string} message
 * @param {!Object=} extra Additional error properties (field, etc.).
 * @return {{status: number, body: !Object}}
 */
export function fail(status, code, message, extra = {}) {
  return { status, body: { error: { code, message, ...extra } } };
}

/** 400 VALIDATION_ERROR from a validator result. */
export function invalid(result) {
  return { status: 400, body: toValidationError(result.errors) };
}

/** 404 envelope for a missing resource. */
export function notFound(what) {
  return fail(404, 'NOT_FOUND', `${what} tidak ditemukan.`);
}

/**
 * Validate the ?role= (or body.role) employer key.
 * @param {?string} role
 * @return {?{status: number, body: !Object}} Error response or null.
 */
export function checkRole(role) {
  if (ROLE_KEYS.includes(role)) {
    return null;
  }
  return fail(400, 'VALIDATION_ERROR',
    'Parameter role wajib: swasta, lembaga, atau pemerintah.',
    { field: 'role' });
}
