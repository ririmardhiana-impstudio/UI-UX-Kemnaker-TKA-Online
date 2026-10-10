#!/usr/bin/env node
/**
 * @fileoverview Generate docs/shared/openapi.yaml from the mock route table
 * (js/mocks/handlers.js) and the request contracts (js/contracts/*.js).
 * Response schemas are inferred by executing each route's example against
 * a fresh mock store, so the spec always matches mock behaviour.
 *
 * Usage: node scripts/generate-openapi.js   (no dependencies)
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as analitikContracts from '../js/contracts/analitik.js';
import * as authContracts from '../js/contracts/auth.js';
import * as backOfficeContracts from '../js/contracts/back-office.js';
import * as eksposHpkContracts from '../js/contracts/ekspos-hpk.js';
import * as imigrasiContracts from '../js/contracts/imigrasi.js';
import * as skrdContracts from '../js/contracts/skrd.js';
import * as laporanContracts from '../js/contracts/laporan.js';
import * as notifikasiContracts from '../js/contracts/notifikasi.js';
import * as operatorContracts from '../js/contracts/operator.js';
import * as pengesahanValidasiContracts from '../js/contracts/pengesahan-validasi.js';
import * as penilaianContracts from '../js/contracts/penilaian-kelayakan.js';
import * as pengesahanRptkaContracts from '../js/contracts/pengesahan-rptka.js';
import * as perubahanContracts from '../js/contracts/perubahan.js';
import * as referenceContracts from '../js/contracts/reference.js';
import * as registrationContracts from '../js/contracts/registration.js';
import * as securityContracts from '../js/contracts/security.js';
import * as siklusContracts from '../js/contracts/siklus.js';
import * as tiketContracts from '../js/contracts/tiket.js';
import * as validasiHpkContracts from '../js/contracts/validasi-hpk.js';
import * as penerbitanHpkContracts from '../js/contracts/penerbitan-hpk.js';
import * as pengesahanDirekturContracts from '../js/contracts/pengesahan-direktur.js';
import { ROUTES, createMockApi } from '../js/mocks/handlers.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = resolve(ROOT, 'docs/shared/openapi.yaml');
const CONTRACT_MODULES = [
  authContracts, backOfficeContracts, laporanContracts,
  perubahanContracts, referenceContracts, tiketContracts,
  analitikContracts, notifikasiContracts, operatorContracts,
  securityContracts, siklusContracts, registrationContracts,
  penilaianContracts, eksposHpkContracts, validasiHpkContracts,
  pengesahanValidasiContracts,
  penerbitanHpkContracts, pengesahanRptkaContracts,
  pengesahanDirekturContracts, imigrasiContracts, skrdContracts,
];
const MAX_SAMPLE_ITEMS = 25;

const contracts = collectContracts();
const spec = buildSpec();
mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, `${toYaml(spec).trimStart()}\n`);
console.info(`OpenAPI written: ${OUTPUT} ` +
  `(${Object.keys(spec.paths).length} paths, ` +
  `${Object.keys(spec.components.schemas).length} schemas)`);

function collectContracts() {
  const byName = {};
  for (const mod of CONTRACT_MODULES) {
    for (const value of Object.values(mod)) {
      if (value && typeof value === 'object' && value.name && value.fields) {
        byName[value.name] = value;
      }
    }
  }
  return byName;
}

function buildSpec() {
  const schemas = {
    Error: errorSchema(),
    ...Object.fromEntries(Object.values(contracts)
      .map((c) => [c.name, contractSchema(c)])),
  };
  const paths = {};
  for (const route of ROUTES) {
    const oaPath = route.path.replace(/:([a-zA-Z]+)/g, '{$1}');
    paths[oaPath] ??= {};
    paths[oaPath][route.method.toLowerCase()] = operation(route);
  }
  return {
    openapi: '3.0.3',
    info: {
      title: 'TKA Online API (prototype contract)',
      version: '0.1.0',
      description: 'Source of truth untuk backend. Dihasilkan dari ' +
        'js/mocks/handlers.js + js/contracts/*.js oleh ' +
        'scripts/generate-openapi.js. Aturan bisnis: ' +
        'docs/shared/business-rules.md.',
    },
    servers: [{ url: '/api/v1' }],
    paths,
    components: { schemas },
  };
}

function operation(route) {
  const doc = route.doc;
  const op = {
    tags: [doc.tag ?? 'Umum'],
    summary: doc.summary ?? `${route.method} ${route.path}`,
    operationId: operationId(route),
  };
  const parameters = [
    ...route.keys.map((key) => ({
      name: key, in: 'path', required: true, schema: { type: 'string' },
    })),
    ...Object.entries(doc.query ?? {}).map(([name, description]) => ({
      name, in: 'query', required: /wajib/.test(description),
      description, schema: { type: 'string' },
    })),
  ];
  if (parameters.length) {
    op.parameters = parameters;
  }
  if (doc.request) {
    op.requestBody = {
      required: true,
      content: { 'application/json': {
        schema: { $ref: `#/components/schemas/${doc.request}` },
      } },
    };
  }
  op.responses = responses(route);
  return op;
}

function responses(route) {
  const sample = runExample(route);
  const out = {
    [sample.status]: {
      description: 'Berhasil',
      content: { 'application/json': { schema: inferSchema(sample.body) } },
    },
  };
  const errorRef = { 'application/json': {
    schema: { $ref: '#/components/schemas/Error' },
  } };
  const extras = { ...defaultErrors(route), ...(route.doc.responses ?? {}) };
  for (const [status, description] of Object.entries(extras)) {
    out[status] = { description, content: errorRef };
  }
  out[500] = { description: 'Gangguan server.', content: errorRef };
  return out;
}

function defaultErrors(route) {
  const errors = {};
  if (route.doc.request || /wajib/.test(JSON.stringify(route.doc.query))) {
    errors[400] = 'Validasi gagal (VALIDATION_ERROR, field, fields).';
  }
  if (route.keys.length) {
    errors[404] = 'Resource tidak ditemukan (NOT_FOUND).';
  }
  return errors;
}

function runExample(route) {
  const example = route.doc.example ?? {};
  const body = example.body ?? (route.doc.request
    ? exampleBody(contracts[route.doc.request]) : null);
  const path = route.path.replace(/:([a-zA-Z]+)/g,
    (_, key) => encodeURIComponent(example.params?.[key] ?? 'x'));
  const api = createMockApi();
  for (const step of example.before ?? []) {
    api({ query: {}, body: null, ...step });
  }
  const result = api({
    method: route.method, path, query: example.query ?? {}, body,
  });
  if (result.status >= 400) {
    throw new Error(`Example for ${route.method} ${route.path} failed: ` +
      JSON.stringify(result.body));
  }
  return result;
}

function exampleBody(contract) {
  return Object.fromEntries(Object.entries(contract.fields)
    .filter(([, spec]) => spec.example !== undefined)
    .map(([name, spec]) => [name, spec.example]));
}

function contractSchema(contract) {
  const properties = {};
  const required = [];
  for (const [name, spec] of Object.entries(contract.fields)) {
    properties[name] = fieldSchema(spec);
    if (spec.required) {
      required.push(name);
    }
  }
  const schema = { type: 'object', description: contract.description,
    properties };
  if (required.length) {
    schema.required = required;
  }
  return schema;
}

function fieldSchema(spec) {
  const out = { type: spec.type };
  const copy = ['minLength', 'maxLength', 'pattern', 'enum', 'format',
    'minimum', 'maximum', 'maxItems', 'description', 'example'];
  for (const key of copy) {
    if (spec[key] !== undefined) {
      out[key] = spec[key];
    }
  }
  if (spec.const !== undefined) {
    out.enum = [spec.const];
  }
  if (spec.type === 'array') {
    out.items = spec.items && contracts[spec.items]
      ? { $ref: `#/components/schemas/${spec.items}` }
      : { type: 'string' };
  }
  if (spec.message) {
    out['x-error-message'] = spec.message;
  }
  return out;
}

function errorSchema() {
  return {
    type: 'object',
    required: ['error'],
    properties: {
      error: {
        type: 'object',
        required: ['code', 'message'],
        properties: {
          code: { type: 'string', example: 'VALIDATION_ERROR' },
          message: { type: 'string' },
          field: { type: 'string' },
          fields: { type: 'object',
            additionalProperties: { type: 'string' } },
          loginStatusId: { type: 'integer' },
          attemptsLeft: { type: 'integer' },
          retryAfterSeconds: { type: 'integer' },
        },
      },
    },
  };
}

function inferSchema(value) {
  if (value === null || value === undefined) {
    return { nullable: true };
  }
  if (Array.isArray(value)) {
    const samples = value.slice(0, MAX_SAMPLE_ITEMS).map(inferSchema);
    return { type: 'array',
      items: samples.length ? samples.reduce(mergeSchemas) : {} };
  }
  if (typeof value === 'object') {
    return { type: 'object', properties: Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, inferSchema(v)])) };
  }
  if (typeof value === 'number') {
    return { type: Number.isInteger(value) ? 'integer' : 'number' };
  }
  return { type: typeof value };
}

function mergeSchemas(a, b) {
  if (a.type === 'object' && b.type === 'object') {
    const properties = { ...b.properties };
    for (const [key, schema] of Object.entries(a.properties)) {
      properties[key] = b.properties[key]
        ? mergeSchemas(schema, b.properties[key]) : schema;
    }
    return { type: 'object', properties };
  }
  if (a.nullable && b.type) {
    return { ...b, nullable: true };
  }
  if (b.nullable && a.type) {
    return { ...a, nullable: true };
  }
  return a.type ? a : b;
}

function operationId(route) {
  const words = route.path.split(/[/-]/).filter(Boolean)
    .map((w) => w.replace(/^:/, 'by-'));
  const camel = words.join('-').replace(/-([a-z])/g, (_, c) =>
    c.toUpperCase());
  return route.method.toLowerCase() + camel.charAt(0).toUpperCase() +
    camel.slice(1);
}

function toYaml(value, indent = 0) {
  const pad = ' '.repeat(indent);
  if (Array.isArray(value)) {
    if (!value.length) {
      return '[]';
    }
    return value.map((item) => `\n${pad}- ${yamlNested(item, indent + 2)}`)
      .join('');
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value);
    if (!entries.length) {
      return '{}';
    }
    return entries.map(([key, v]) =>
      `\n${pad}${yamlKey(key)}:${yamlValueSuffix(v, indent + 2)}`).join('');
  }
  return JSON.stringify(value);
}

function yamlNested(item, indent) {
  const text = toYaml(item, indent);
  return text.startsWith('\n') ? text.trimStart() : text;
}

function yamlValueSuffix(value, indent) {
  const text = toYaml(value, indent);
  return text.startsWith('\n') ? text : ` ${text}`;
}

function yamlKey(key) {
  return /^[A-Za-z0-9_$./{}-]+$/.test(key) && !/^\d/.test(key)
    ? key : JSON.stringify(key);
}
