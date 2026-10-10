/**
 * @fileoverview window.fetch override for the prototype. When
 * window.USE_MOCK is true, requests whose URL starts with
 * window.API_BASE_URL (default /api/v1) are answered by the mock route
 * table in js/mocks/handlers.js; everything else hits the network.
 *
 * Toggle in <head>: <meta name="use-mock" content="true|false">.
 * Optional: <meta name="mock-error-rate" content="0.05"> (0 disables the
 * random 500 injection used to exercise error/retry states).
 *
 * The mock graph is imported lazily (top-level await) so production
 * (USE_MOCK = false) never downloads js/mocks/*. js/api/http.js imports
 * this module, which guarantees the override is installed before any
 * helper issues a request.
 */

const MOCK_LATENCY_MS = 200;
const MOCK_JITTER_MS = 120;
const DEFAULT_ERROR_RATE = 0.05;

const baseUrl = window.API_BASE_URL ?? '/api/v1';

if (window.USE_MOCK && !window.__tkaMockInstalled) {
  const { createMockApi } = await import('../mocks/handlers.js');
  installMockFetch(createMockApi(), readErrorRate());
  window.__tkaMockInstalled = true;
}

function installMockFetch(mockApi, errorRate) {
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async function mockAwareFetch(input, init = {}) {
    const request = new Request(input, init);
    const url = new URL(request.url, window.location.origin);
    if (!window.USE_MOCK || !url.pathname.startsWith(baseUrl)) {
      return nativeFetch(input, init);
    }
    return respondFromMock({ mockApi, errorRate, request, url });
  };
}

async function respondFromMock({ mockApi, errorRate, request, url }) {
  const method = request.method.toUpperCase();
  const path = url.pathname.slice(baseUrl.length) || '/';
  const body = await readJsonBody(request);
  console.info('[MOCK]', method, url.pathname + url.search, body ?? '');
  await delay(MOCK_LATENCY_MS + Math.random() * MOCK_JITTER_MS);
  if (Math.random() < errorRate) {
    return jsonResponse(500, {
      error: { code: 'SERVER_ERROR', message: 'Gangguan server (simulasi).' },
    });
  }
  const query = Object.fromEntries(url.searchParams.entries());
  const result = mockApi({ method, path, query, body });
  return jsonResponse(result.status, result.body);
}

async function readJsonBody(request) {
  if (request.method === 'GET' || request.method === 'HEAD') {
    return null;
  }
  const text = await request.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    console.warn('[MOCK] body is not JSON', error);
    return null;
  }
}

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function readErrorRate() {
  const meta = document.querySelector('meta[name="mock-error-rate"]');
  const value = Number.parseFloat(meta?.content ?? '');
  return Number.isFinite(value) ? value : DEFAULT_ERROR_RATE;
}
