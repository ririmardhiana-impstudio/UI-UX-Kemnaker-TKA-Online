/**
 * @fileoverview Notification routes (KAK Modul 7): in-app inbox per
 * employer role (list, mark read, mark all) and admin configuration of
 * notification events. Rules NT-01..NT-07 (docs/shared/business-rules.md).
 *
 * pushNotifikasi() is the hook other routes call when a status changes so
 * the employer inbox receives the message (lazy-seeded collection).
 */

import {
  NOTIFIKASI_KATEGORI, checkTemplateVariables, validateNotificationSetting,
} from '../../contracts/notifikasi.js';
import {
  NOTIFICATION_SETTINGS_FIXTURE, NOTIFIKASI_FIXTURES,
} from '../fixtures/notifikasi.js';
import {
  checkRole, fail, invalid, notFound, ok, route,
} from '../router.js';

const STATUS_FILTERS = ['unread', 'all'];

export const NOTIFIKASI_ROUTES = [
  route('GET', '/notifikasi', listNotifikasi, {
    tag: 'Notifikasi',
    summary: 'Kotak notifikasi pemberi kerja (terbaru dulu); meta.unread.',
    query: { role: 'swasta | lembaga | pemerintah (wajib)',
      status: 'unread | all (opsional)' },
    example: { query: { role: 'swasta' } },
  }),
  route('POST', '/notifikasi/read-all', readAll, {
    tag: 'Notifikasi', summary: 'Tandai semua notifikasi role dibaca.',
    query: { role: 'swasta | lembaga | pemerintah (wajib)' },
    example: { query: { role: 'swasta' } },
  }),
  route('POST', '/notifikasi/:id/read', readOne, {
    tag: 'Notifikasi', summary: 'Tandai satu notifikasi dibaca (idempoten).',
    query: { role: 'swasta | lembaga | pemerintah (wajib)' },
    example: { params: { id: 'NT-SW-01' }, query: { role: 'swasta' } },
  }),
  route('GET', '/notification-settings', listSettings, {
    tag: 'Notifikasi',
    summary: 'Konfigurasi event notifikasi (kanal, template, pengingat).',
  }),
  route('PUT', '/notification-settings/:event', updateSetting, {
    tag: 'Notifikasi',
    summary: 'Ubah konfigurasi satu event notifikasi (admin pusat).',
    request: 'NotificationSettingRequest',
    example: { params: { event: 'permohonan-diajukan' } },
    responses: { 400: 'Validasi gagal, termasuk {variabel} yang tidak ' +
      'terdaftar untuk event ini.', 404: 'Event tidak dikenal.' },
  }),
];

function inbox(store, role) {
  store.notifikasi ??= structuredClone(NOTIFIKASI_FIXTURES);
  return store.notifikasi[role];
}

function settings(store) {
  store.notificationSettings ??=
    structuredClone(NOTIFICATION_SETTINGS_FIXTURE);
  return store.notificationSettings;
}

const unreadOf = (items) => items.filter((x) => !x.dibaca).length;

function listNotifikasi({ query, store }) {
  const roleError = checkRole(query.role);
  if (roleError) {
    return roleError;
  }
  if (query.status && !STATUS_FILTERS.includes(query.status)) {
    return fail(400, 'VALIDATION_ERROR', 'Status hanya unread atau all.',
      { field: 'status' });
  }
  const items = inbox(store, query.role);
  const rows = (query.status === 'unread' ? items.filter((x) => !x.dibaca)
    : [...items]).sort((a, b) => Date.parse(b.waktu) - Date.parse(a.waktu));
  return ok(rows, { total: rows.length, unread: unreadOf(items) });
}

function readOne({ params, query, store }) {
  const roleError = checkRole(query.role);
  if (roleError) {
    return roleError;
  }
  const item = inbox(store, query.role).find((x) => x.id === params.id);
  if (!item) {
    return notFound('Notifikasi');
  }
  item.dibaca = true;
  return ok(item);
}

function readAll({ query, store }) {
  const roleError = checkRole(query.role);
  if (roleError) {
    return roleError;
  }
  const unread = inbox(store, query.role).filter((x) => !x.dibaca);
  unread.forEach((x) => {
    x.dibaca = true;
  });
  return ok({ updated: unread.length });
}

function listSettings({ store }) {
  const rows = settings(store);
  return ok(rows, { total: rows.length });
}

function updateSetting({ params, body, store }) {
  const current = settings(store).find((x) => x.event === params.event);
  if (!current) {
    return notFound('Event notifikasi');
  }
  const result = validateNotificationSetting(body);
  if (!result.valid) {
    return invalid(result);
  }
  const vars = checkTemplateVariables(body.template, current.variabel);
  if (vars.error) {
    return fail(400, 'VALIDATION_ERROR', vars.error,
      { field: 'template', fields: { template: vars.error } });
  }
  const hasReminder = body.pengingatHari !== undefined &&
    body.pengingatHari !== null;
  if (hasReminder && !current.dapatPengingat) {
    return fail(400, 'VALIDATION_ERROR',
      'Event ini tidak memakai pengingat hari.', { field: 'pengingatHari',
        fields: { pengingatHari: 'Event ini tidak memakai pengingat hari.' } });
  }
  if (current.dapatPengingat && !hasReminder) {
    return fail(400, 'VALIDATION_ERROR', 'Pengingat hari wajib diisi.',
      { field: 'pengingatHari',
        fields: { pengingatHari: 'Pengingat hari wajib diisi.' } });
  }
  Object.assign(current, {
    aktif: body.aktif,
    kanal: { email: body.kanal.email, sms: body.kanal.sms, push: false },
    template: body.template.trim(),
    pengingatHari: current.dapatPengingat ? body.pengingatHari : null,
  });
  return ok(current);
}

/**
 * Append a notification to an employer role's inbox (newest first).
 * Called by other mock routes on status changes (integrator wiring).
 * @param {!Object} store Mock store.
 * @param {string} role swasta | lembaga | pemerintah.
 * @param {{judul: string, isi: string, kategori: string,
 *     tautan: ({page: string, params: (!Object|undefined)}|undefined)}} item
 * @return {?Object} The created notification (null for an unknown role).
 */
export function pushNotifikasi(store, role, { judul, isi, kategori, tautan }) {
  if (checkRole(role)) {
    return null;
  }
  store.notifikasiSeq = (store.notifikasiSeq ?? 0) + 1;
  const item = {
    id: `NT-${role.slice(0, 2).toUpperCase()}-N${store.notifikasiSeq}`,
    kategori: NOTIFIKASI_KATEGORI.includes(kategori) ? kategori : 'Sistem',
    judul,
    isi,
    waktu: new Date().toISOString(),
    dibaca: false,
    tautan: tautan ? { page: tautan.page, params: tautan.params ?? {} }
      : { page: 'dashboard', params: {} },
  };
  inbox(store, role).unshift(item);
  return item;
}
