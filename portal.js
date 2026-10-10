/**
 * @fileoverview Employer portal routes scoped by ?role=:
 * tka, hpk, pengesahan, billing (+ reissue), ekspos (+ mode / platform /
 * meetingUrl dari sesi ekspos back office, KAK Modul 5 [I]).
 */

import { validateBillingKonfirmasi } from '../../contracts/billing.js';
import { REISSUED_BILLING } from '../fixtures.js';
import {
  checkRole, fail, invalid, list, notFound, ok, route,
} from '../router.js';
import { antrianOf } from './back-office.js';
import { lunasiBilling, tanggalPanjang } from './billing-dkptka.js';
import { snapshotFor as keimigrasianFor } from './imigrasi.js';
import { eksposSessionsOf } from './reference.js';

const ROLE_QUERY = { role: 'swasta | lembaga | pemerintah (wajib)' };
const ROLE_EXAMPLE = { query: { role: 'swasta' } };

export const PORTAL_ROUTES = [
  route('GET', '/tka', listTka, {
    tag: 'Pemberi Kerja', summary: 'TKA aktif; filter ?barcode= (lookup).',
    query: { ...ROLE_QUERY, barcode: 'Barcode SK (maks. 8 digit).' },
    example: ROLE_EXAMPLE,
  }),
  route('GET', '/hpk', listHpk, {
    tag: 'Pemberi Kerja', summary: 'Permohonan HPK; filter ?layanan=.',
    query: { ...ROLE_QUERY, layanan: 'Nama layanan.' }, example: ROLE_EXAMPLE,
  }),
  route('GET', '/hpk/:id', getHpk, {
    tag: 'Pemberi Kerja', summary: 'Detail HPK (jabatan + kuota).',
    query: ROLE_QUERY,
    example: { params: { id: 'h1' }, query: { role: 'swasta' } },
  }),
  route('GET', '/pengesahan', listPengesahan, {
    tag: 'Pemberi Kerja',
    summary: 'Pengesahan RPTKA; filter ?hpk= dan ?layanan=.',
    query: { ...ROLE_QUERY, hpk: 'ID HPK.', layanan: 'Awalan layanan.' },
    example: ROLE_EXAMPLE,
  }),
  route('GET', '/billing', scoped('billing'), {
    tag: 'Pembayaran', summary: 'Kode billing DKPTKA.', query: ROLE_QUERY,
    example: ROLE_EXAMPLE,
  }),
  route('POST', '/billing/:id/reissue', reissueBilling, {
    tag: 'Pembayaran',
    summary: 'Terbitkan ulang kode billing yang kedaluwarsa (Proses lagi).',
    query: ROLE_QUERY,
    example: { params: { id: 'b2' }, query: { role: 'swasta' } },
    responses: { 409: 'Billing tidak berstatus Kedaluwarsa.' },
  }),
  route('POST', '/billing/:id/confirm-bayar', confirmBayarEmployer, {
    tag: 'Pembayaran', request: 'BillingKonfirmasiRequest',
    summary: 'Pemberi kerja mengonfirmasi sudah membayar tagihan ini ' +
      '(`konfirmasi: true`) — PNBP di bank persepsi, atau SKRD di Kas ' +
      'Daerah (`buktiBayar` WAJIB, bukti pembayaran dari bank daerah, ' +
      'diteruskan ke Disnaker setempat): tagihan berkode sama menjadi ' +
      'Lunas, SK Pengesahan otomatis disetujui Direktur dan masuk daftar ' +
      'Menunggu TTE (belum turun ke pemberi kerja). Hanya dari status ' +
      'Belum dibayar.',
    query: ROLE_QUERY,
    example: { params: { id: 'b1' }, query: { role: 'swasta' },
      body: { konfirmasi: true } },
    responses: { 400: 'Pernyataan konfirmasi belum true, atau tagihan ' +
      'SKRD tanpa buktiBayar.',
      409: 'Status bukan Belum dibayar (INVALID_STATE).' },
  }),
  route('GET', '/ekspos', listEkspos, {
    tag: 'Pemberi Kerja',
    summary: 'Jadwal ekspos pemberi kerja (+ mode, platform, meetingUrl).',
    query: ROLE_QUERY, example: ROLE_EXAMPLE,
  }),
];

/** Build a handler that lists store[collection][role]. */
function scoped(collection) {
  return ({ query, store }) => {
    const roleError = checkRole(query.role);
    return roleError ?? list(store[collection][query.role]);
  };
}

function listTka({ query, store }) {
  const roleError = checkRole(query.role);
  if (roleError) {
    return roleError;
  }
  const rows = store.tka[query.role]
    .filter((t) => !query.barcode || t.barcode === query.barcode);
  return list(rows);
}

function listHpk({ query, store }) {
  const roleError = checkRole(query.role);
  if (roleError) {
    return roleError;
  }
  const rows = store.hpk[query.role]
    .filter((h) => !query.layanan || h.layanan === query.layanan);
  return list(rows);
}

function getHpk({ params, query, store }) {
  const roleError = checkRole(query.role);
  if (roleError) {
    return roleError;
  }
  const found = store.hpk[query.role].find((h) => h.id === params.id);
  return found ? ok(found) : notFound('HPK');
}

function listPengesahan({ query, store }) {
  const roleError = checkRole(query.role);
  if (roleError) {
    return roleError;
  }
  const prefix = query.layanan ? query.layanan.split(' (')[0] : null;
  const rows = store.pengesahan[query.role]
    .filter((p) => !query.hpk || p.hpk === query.hpk)
    .filter((p) => !prefix || (p.layanan ?? '').startsWith(prefix))
    // Data ITAS & lalu lintas keimigrasian (usulan, "Tampilkan data ITAS
    // per TKA") — null sebelum Pengesahan terbit; tidak mengubah `p`
    // aslinya di store, cuma ditambahkan ke respons.
    .map((p) => ({ ...p,
      keimigrasian: keimigrasianFor(store, query.role, p) }));
  return list(rows);
}

function reissueBilling({ params, query, store }) {
  const roleError = checkRole(query.role);
  if (roleError) {
    return roleError;
  }
  const bill = store.billing[query.role].find((b) => b.id === params.id);
  if (!bill) {
    return notFound('Kode billing');
  }
  if (bill.status !== 'Kedaluwarsa') {
    return fail(409, 'INVALID_STATE',
      'Hanya kode billing kedaluwarsa yang dapat diterbitkan ulang.');
  }
  Object.assign(bill, REISSUED_BILLING);
  return ok(bill);
}

const LUNAS_PENG = 'DKPTKA lunas';

/**
 * Pemberi kerja mengonfirmasi sudah membayar kode billing — PNBP di bank
 * persepsi, atau SKRD di Kas Daerah lewat bank daerah (keduanya di luar TKA
 * Online): semua baris tagihan berkode sama menjadi Lunas, lalu SK
 * Pengesahan otomatis disetujui Direktur dan masuk daftar "Menunggu TTE"
 * (routes/billing-dkptka.js `lunasiBilling`). Tagihan SKRD (`jenis: 'SKRD'`)
 * WAJIB menyertakan `buktiBayar` (bukti pembayaran dari bank daerah) —
 * diteruskan ke Disnaker setempat lewat `row.billing.buktiBayar`, dibaca
 * `routes/skrd-disnaker.js` `view`.
 */
function confirmBayarEmployer({ params, query, body, store }) {
  const roleError = checkRole(query.role);
  if (roleError) {
    return roleError;
  }
  const bills = store.billing[query.role];
  const bill = bills.find((b) => b.id === params.id);
  if (!bill) {
    return notFound('Kode billing');
  }
  if (bill.status !== 'Belum dibayar') {
    return fail(409, 'INVALID_STATE', `Status "${bill.status}" tidak bisa ` +
      'dikonfirmasi sudah dibayar; hanya dari Belum dibayar.');
  }
  const result = validateBillingKonfirmasi(body);
  if (!result.valid) {
    return invalid(result);
  }
  const skrd = bill.jenis === 'SKRD';
  if (skrd && !body.buktiBayar?.namaBerkas) {
    return fail(400, 'VALIDATION_ERROR', 'Unggah bukti pembayaran dari ' +
      'bank daerah terlebih dahulu.', { field: 'buktiBayar' });
  }
  const bayarTgl = tanggalPanjang(new Date());
  const bank = skrd ? 'Bank Pembangunan Daerah (Kas Daerah)'
    : 'Bank persepsi';
  const paid = bills.filter((b) => b.kode === bill.kode);
  for (const b of paid) {
    Object.assign(b, { status: 'Lunas', tone: 'green', bayar: bayarTgl,
      bank, ntpn: '—', ...(skrd ? { buktiBayar: body.buktiBayar } : {}) });
  }
  const row = antrianOf(store).find((r) => r.billing?.kode === bill.kode);
  if (row) {
    lunasiBilling(store, row, bayarTgl,
      { bank, buktiBayar: skrd ? body.buktiBayar : null });
    return ok(bill);
  }
  // Tagihan seed/demo tanpa baris antrian: cukup sinkronkan daftar pengesahan.
  const ids = paid.map((b) => b.id);
  for (const p of store.pengesahan[query.role] ?? []) {
    if (ids.includes(p.billing)) {
      Object.assign(p, { status: LUNAS_PENG, tone: 'green' });
    }
  }
  return ok(bill);
}

/** Employer ekspos rows joined with the back-office session (by antrian). */
function listEkspos({ query, store }) {
  const roleError = checkRole(query.role);
  if (roleError) {
    return roleError;
  }
  const sessions = eksposSessionsOf(store);
  return list(store.ekspos[query.role].map((row) => {
    const session = sessions.find((s) => s.antrian === row.antrian);
    return { ...row, mode: session?.mode ?? 'Daring',
      platform: session?.platform ?? null,
      meetingUrl: session?.meetingUrl ?? null };
  }));
}
