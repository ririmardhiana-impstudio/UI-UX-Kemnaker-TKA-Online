/**
 * @fileoverview Shared HTTP helper for js/api/* resource modules.
 * Importing ./client.js first guarantees the mock fetch override is ready
 * (when USE_MOCK = true) before the first request.
 */

import './client.js';

/** Error thrown for every non-2xx response. */
export class ApiError extends Error {
  /**
   * @param {number} status HTTP status.
   * @param {{code: string, message: string, field: (string|undefined),
   *     fields: (!Object<string, string>|undefined)}} detail
   */
  constructor(status, detail) {
    super(detail.message ?? `HTTP ${status}`);
    this.name = 'ApiError';
    /** @const {number} */
    this.status = status;
    /** @const {string} */
    this.code = detail.code ?? 'HTTP_ERROR';
    /** @const {?string} */
    this.field = detail.field ?? null;
    /** @const {!Object<string, string>} */
    this.fields = detail.fields ?? {};
    /** @const {!Object} */
    this.detail = detail;
  }
}

/**
 * Perform a JSON request against window.API_BASE_URL.
 * @param {string} method
 * @param {string} path Path after /api/v1, e.g. '/tiket'.
 * @param {{query: (!Object|undefined), body: (*|undefined)}=} options
 * @return {!Promise<{data: *, meta: (!Object|undefined)}>} Parsed body.
 */
export async function apiRequest(method, path, options = {}) {
  const response = await fetch(buildUrl(path, options.query), {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: options.body === undefined ? undefined
      : JSON.stringify(options.body),
  });
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new ApiError(response.status, payload?.error ?? {});
  }
  return payload ?? { data: null };
}

/** GET and unwrap `data`. */
export async function apiGet(path, query) {
  const { data } = await apiRequest('GET', path, { query });
  return data;
}

/** POST and unwrap `data`. */
export async function apiPost(path, body, query) {
  const { data } = await apiRequest('POST', path, { body, query });
  return data;
}

/** PUT (full replace) and unwrap `data`. */
export async function apiPut(path, body, query) {
  const { data } = await apiRequest('PUT', path, { body, query });
  return data;
}

/** PATCH (partial update) and unwrap `data`. */
export async function apiPatch(path, body, query) {
  const { data } = await apiRequest('PATCH', path, { body, query });
  return data;
}

/** DELETE and unwrap `data`. */
export async function apiDelete(path, query) {
  const { data } = await apiRequest('DELETE', path, { query });
  return data;
}

function buildUrl(path, query = {}) {
  const base = window.API_BASE_URL ?? '/api/v1';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, Array.isArray(value) ? value.join(',') : value);
    }
  }
  const search = params.toString();
  return `${base}${path}${search ? `?${search}` : ''}`;
}

async function parseJson(response) {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new ApiError(response.status, {
      code: 'BAD_RESPONSE', message: 'Respons server bukan JSON.',
    });
  }
}
