/**
 * @fileoverview Multi-operator routes per pemberi kerja (KAK Modul 1)
 * and NIB verification against the OSS stub.
 *
 * Rules (docs/shared/business-rules.md §OP):
 *   OP-01 level ∈ admin | operator | lihat
 *   OP-02 only actorLevel = admin may invite / update (403 FORBIDDEN)
 *   OP-03 email unique per employer (409 DUPLICATE_EMAIL)
 *   OP-04 the last active admin cannot be demoted / deactivated (409)
 *   OP-06 NIB check: own NIB -> Sesuai, other company -> Tidak sesuai,
 *         unknown -> 422, OSS down -> 503, kelompok C -> 422
 */

import {
  OPERATOR_STATUS, validateInviteOperator, validateNibVerification,
  validateUpdateOperator,
} from '../../contracts/operator.js';
import {
  OPERATORS, OSS_REGISTRY, OSS_UNAVAILABLE_NIB,
} from '../fixtures/operator.js';
import {
  checkRole, created, fail, invalid, list, notFound, ok, route,
} from '../router.js';
import { appendAudit } from './security.js';

const ROLE_QUERY = { role: 'swasta | lembaga | pemerintah (wajib)' };
const PORTAL_IP = '182.253.71.40';

export const OPERATOR_ROUTES = [
  route('GET', '/operators', listOperators, {
    tag: 'Operator', summary: 'Operator akun pemberi kerja + level akses.',
    query: ROLE_QUERY, example: { query: { role: 'swasta' } },
  }),
  route('POST', '/operators', inviteOperator, {
    tag: 'Operator',
    summary: 'Undang operator (hanya admin perusahaan); status ' +
      '"Undangan terkirim".',
    query: ROLE_QUERY, request: 'InviteOperatorRequest',
    example: { query: { role: 'swasta' } },
    responses: {
      403: 'Pelaku bukan admin perusahaan (FORBIDDEN).',
      409: 'Email sudah terdaftar di perusahaan ini (DUPLICATE_EMAIL).',
    },
  }),
  route('PATCH', '/operators/:id', updateOperator, {
    tag: 'Operator',
    summary: 'Ubah level / status aktif operator (hanya admin perusahaan).',
    query: ROLE_QUERY, request: 'UpdateOperatorRequest',
    example: { params: { id: 'op-s2' }, query: { role: 'swasta' },
      body: { level: 'lihat', actorLevel: 'admin' } },
    responses: {
      403: 'Pelaku bukan admin perusahaan (FORBIDDEN).',
      409: 'Admin aktif terakhir tidak boleh diturunkan / dinonaktifkan ' +
        '(LAST_ADMIN).',
    },
  }),
  route('POST', '/companies/:role/nib-verifications', verifyNib, {
    tag: 'Pemberi Kerja',
    summary: 'Cocokkan NIB dengan OSS (Sesuai / Tidak sesuai + data OSS). ' +
      `NIB demo ${OSS_UNAVAILABLE_NIB} = OSS tidak tersedia.`,
    request: 'NibVerificationRequest',
    example: { params: { role: 'swasta' }, body: { nib: '9120301234567' } },
    responses: {
      422: 'NIB tidak terdaftar di OSS (NIB_NOT_FOUND) / kelompok C ' +
        'tanpa NIB (NIB_NOT_APPLICABLE).',
      503: 'Layanan OSS tidak tersedia (OSS_UNAVAILABLE).',
    },
  }),
];

function operatorsOf(store, role) {
  store.operators ??= structuredClone(OPERATORS);
  return store.operators[role];
}

function forbidden() {
  return fail(403, 'FORBIDDEN',
    'Hanya admin perusahaan yang dapat mengatur operator.');
}

function isActiveAdmin(operator) {
  return operator.level === 'admin' &&
    operator.status !== OPERATOR_STATUS.INACTIVE;
}

function listOperators({ query, store }) {
  return checkRole(query.role) ?? list(operatorsOf(store, query.role));
}

function inviteOperator({ query, body, store }) {
  const roleError = checkRole(query.role);
  if (roleError) {
    return roleError;
  }
  const result = validateInviteOperator(body);
  if (!result.valid) {
    return invalid(result);
  }
  if (body.actorLevel !== 'admin') {
    return forbidden();
  }
  const rows = operatorsOf(store, query.role);
  const email = body.email.trim();
  if (rows.some((o) => o.email.toLowerCase() === email.toLowerCase())) {
    return fail(409, 'DUPLICATE_EMAIL',
      'Email sudah terdaftar sebagai operator perusahaan ini.',
      { field: 'email' });
  }
  const operator = {
    id: `op-${query.role[0]}${rows.length + 1}`,
    nama: body.nama.trim(), email, level: body.level,
    status: OPERATOR_STATUS.INVITED, aktif: true,
    diundangPada: shortToday(store), loginTerakhir: '—',
  };
  rows.push(operator);
  audit(store, query.role, 'Buat', `Operator ${operator.nama}`,
    [{ field: 'level', sebelum: '—', sesudah: operator.level }]);
  return created(operator);
}

function updateOperator({ params, query, body, store }) {
  const roleError = checkRole(query.role);
  if (roleError) {
    return roleError;
  }
  const result = validateUpdateOperator(body);
  if (!result.valid) {
    return invalid(result);
  }
  if (body.actorLevel !== 'admin') {
    return forbidden();
  }
  const rows = operatorsOf(store, query.role);
  const operator = rows.find((o) => o.id === params.id);
  if (!operator) {
    return notFound('Operator');
  }
  const demotes = body.level !== undefined && body.level !== 'admin';
  const deactivates = body.aktif === false;
  if (isActiveAdmin(operator) && (demotes || deactivates) &&
      rows.filter(isActiveAdmin).length === 1) {
    return fail(409, 'LAST_ADMIN',
      'Perusahaan wajib memiliki minimal satu admin aktif. Jadikan ' +
      'operator lain admin terlebih dahulu.');
  }
  const perubahan = applyUpdate(operator, body);
  audit(store, query.role, deactivates ? 'Nonaktifkan' : 'Ubah',
    `Operator ${operator.nama}`, perubahan);
  return ok(operator);
}

function applyUpdate(operator, body) {
  const perubahan = [];
  if (body.level !== undefined && body.level !== operator.level) {
    perubahan.push({ field: 'level', sebelum: operator.level,
      sesudah: body.level });
    operator.level = body.level;
  }
  if (body.aktif !== undefined && body.aktif !== operator.aktif) {
    const status = body.aktif ? OPERATOR_STATUS.ACTIVE
      : OPERATOR_STATUS.INACTIVE;
    perubahan.push({ field: 'status', sebelum: operator.status,
      sesudah: status });
    operator.aktif = body.aktif;
    operator.status = status;
  }
  return perubahan;
}

function verifyNib({ params, body, store }) {
  const roleError = checkRole(params.role);
  if (roleError) {
    return roleError;
  }
  const result = validateNibVerification(body);
  if (!result.valid) {
    return invalid(result);
  }
  const company = store.companies[params.role];
  if (company.grup === 'C') {
    return fail(422, 'NIB_NOT_APPLICABLE',
      'Instansi pemerintah / badan internasional tidak memerlukan NIB.',
      { field: 'nib' });
  }
  const nib = body.nib.trim();
  if (nib === OSS_UNAVAILABLE_NIB) {
    return fail(503, 'OSS_UNAVAILABLE',
      'Layanan OSS sedang tidak tersedia. Coba lagi beberapa saat.');
  }
  const ossData = OSS_REGISTRY[nib];
  if (!ossData) {
    return fail(422, 'NIB_NOT_FOUND', 'NIB tidak terdaftar di OSS.',
      { field: 'nib' });
  }
  const matches = company.nib === nib ||
    ossData.namaPerusahaan.toLowerCase() === company.nama.toLowerCase();
  const verification = {
    nib, status: matches ? 'Sesuai' : 'Tidak sesuai',
    ossData: { ...ossData }, checkedAt: new Date().toISOString(),
    catatan: matches ? 'Data OSS sesuai dengan profil pemberi kerja.'
      : `NIB terdaftar atas nama ${ossData.namaPerusahaan}, bukan ` +
        `${company.nama}.`,
  };
  if (matches) {
    company.nib = nib;
    company.nibVerification = verification;
  }
  return ok(verification);
}

function audit(store, role, aksi, objek, perubahan) {
  const company = store.companies[role];
  appendAudit(store, {
    pengguna: company.pengurus?.nama ?? company.nama,
    peran: `Admin perusahaan · ${company.nama}`,
    aksi, modul: 'Operator', objek, perubahan, ip: PORTAL_IP,
  });
}

function shortToday(store) {
  const [day, month, year] = String(store.today ?? '').split(' ');
  return month ? `${day} ${month.slice(0, 3)} ${year}` : '—';
}
