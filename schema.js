/**
 * @fileoverview Tiny vanilla contract engine shared by browser forms, the
 * mock handlers, and scripts/generate-openapi.js.
 *
 * A contract is a plain object:
 *   { name, description, fields: { <field>: FieldSpec } }
 * FieldSpec keys: type, required, minLength, maxLength, pattern, enum,
 * format ('email'), minimum, maximum, const, maxItems, items, description,
 * example, message (custom error text).
 *
 * validateContract() returns { valid, errors } where errors maps a field
 * name to a human readable (Bahasa Indonesia) message.
 */

/** Employer role keys (kelompok A/B/C). */
export const ROLE_KEYS = ['swasta', 'lembaga', 'pemerintah'];

export const EMAIL_PATTERN = '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$';

/**
 * Validate a payload against a contract.
 * @param {!Object} contract Contract definition.
 * @param {?Object} payload Request body.
 * @return {{valid: boolean, errors: !Object<string, string>}}
 */
export function validateContract(contract, payload) {
  const body = payload ?? {};
  const errors = {};
  for (const [field, spec] of Object.entries(contract.fields)) {
    const message = checkField(spec, body[field]);
    if (message) {
      errors[field] = spec.message ?? message;
    }
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * Merge extra (cross-field) errors into a validation result.
 * @param {{valid: boolean, errors: !Object}} result
 * @param {!Object<string, string>} extra
 * @return {{valid: boolean, errors: !Object<string, string>}}
 */
export function mergeErrors(result, extra) {
  const errors = { ...extra, ...result.errors };
  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * Build the error envelope used by every non-2xx response.
 * @param {!Object<string, string>} errors Field -> message map.
 * @return {{error: {code: string, message: string, field: string,
 *     fields: !Object<string, string>}}}
 */
export function toValidationError(errors) {
  const [field] = Object.keys(errors);
  return {
    error: {
      code: 'VALIDATION_ERROR',
      message: errors[field],
      field,
      fields: errors,
    },
  };
}

function isEmpty(value) {
  return value === undefined || value === null || value === '';
}

function checkField(spec, value) {
  if (isEmpty(value)) {
    return spec.required ? 'Wajib diisi.' : null;
  }
  if (spec.const !== undefined && value !== spec.const) {
    return 'Nilai tidak sesuai ketentuan.';
  }
  if (spec.enum && !spec.enum.includes(value)) {
    return 'Pilihan tidak valid.';
  }
  return checkType(spec, value);
}

function checkType(spec, value) {
  switch (spec.type) {
    case 'string':
      return checkString(spec, value);
    case 'integer':
    case 'number':
      return checkNumber(spec, value);
    case 'boolean':
      return typeof value === 'boolean' ? null : 'Harus bernilai ya/tidak.';
    case 'array':
      return checkArray(spec, value);
    default:
      return null;
  }
}

function checkString(spec, value) {
  if (typeof value !== 'string') {
    return 'Harus berupa teks.';
  }
  const text = value.trim();
  if (spec.minLength && text.length < spec.minLength) {
    return `Minimal ${spec.minLength} karakter.`;
  }
  if (spec.maxLength && text.length > spec.maxLength) {
    return `Maksimal ${spec.maxLength} karakter.`;
  }
  if (spec.format === 'email' && !new RegExp(EMAIL_PATTERN).test(text)) {
    return 'Format email tidak valid.';
  }
  if (spec.pattern && !new RegExp(spec.pattern).test(text)) {
    return 'Format tidak valid.';
  }
  return null;
}

function checkNumber(spec, value) {
  const isInt = spec.type === 'integer';
  if (typeof value !== 'number' || (isInt && !Number.isInteger(value))) {
    return 'Harus berupa angka.';
  }
  if (spec.minimum !== undefined && value < spec.minimum) {
    return `Minimal ${spec.minimum}.`;
  }
  if (spec.maximum !== undefined && value > spec.maximum) {
    return `Maksimal ${spec.maximum}.`;
  }
  return null;
}

function checkArray(spec, value) {
  if (!Array.isArray(value)) {
    return 'Harus berupa daftar.';
  }
  if (spec.required && value.length === 0) {
    return 'Wajib diisi.';
  }
  if (spec.maxItems && value.length > spec.maxItems) {
    return `Maksimal ${spec.maxItems} item.`;
  }
  return null;
}
