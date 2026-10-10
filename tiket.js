/**
 * @fileoverview TKA Hotline routes. State machine:
 * Baru --take--> Diproses (locked by agen) --close--> Selesai
 * Selesai --reopen--> Diproses. Only the locking agent may reply/close.
 */

import {
  validateCreateTiket,
  validateHotlineProfile,
  validateTiketAction,
  validateTiketMessage,
} from '../../contracts/tiket.js';
import {
  created, fail, invalid, list, notFound, ok, route,
} from '../router.js';

const CLOSING_TEXT = 'Data telah kami tindak lanjuti. Tiket ini kami ' +
  'tutup; silakan buka kembali bila masih ada kendala.';
const TICKET_PREFIX = 'HT-2609-';
const STATUS = {
  BARU: { status: 'Baru', tone: 'amber' },
  DIPROSES: { status: 'Diproses', tone: 'blue' },
  SELESAI: { status: 'Selesai', tone: 'green' },
};
const ACTION_DOC = (summary, example) => ({
  tag: 'Hotline', summary, request: 'TiketActionRequest',
  example: { params: { no: example }, body: { agen: 'Fajar N.' } },
  responses: { 409: 'Transisi status tidak diizinkan / dikunci agen lain.' },
});

export const TIKET_ROUTES = [
  route('GET', '/tiket', listTiket, {
    tag: 'Hotline', summary: 'Daftar tiket; filter ?perusahaan= & ?status=.',
    query: { perusahaan: 'Nama perusahaan.', status: 'Baru|Diproses|Selesai' },
  }),
  route('GET', '/tiket/:no', getTiket, {
    tag: 'Hotline', summary: 'Detail tiket.',
    example: { params: { no: 'HT-2609-0418' } },
  }),
  route('GET', '/tiket/:no/messages', listMessages, {
    tag: 'Hotline', summary: 'Percakapan tiket.',
    example: { params: { no: 'HT-2609-0418' } },
  }),
  route('POST', '/tiket', createTiket, {
    tag: 'Hotline', summary: 'Buat tiket baru (status Baru).',
    request: 'CreateTiketRequest',
    example: { body: { kategori: 'Jabatan tidak tersedia',
      judul: 'Jabatan Welding Inspector tidak muncul',
      nomorTerkait: '26004518',
      rincian: 'Jabatan Welding Inspector tidak tersedia di pilihan.',
      perusahaan: 'PT Nusantara Baja Presisi' } },
  }),
  route('POST', '/tiket/:no/messages', postMessage, {
    tag: 'Hotline', summary: 'Kirim balasan pada tiket.',
    request: 'TiketMessageRequest',
    example: { params: { no: 'HT-2609-0431' }, body: { sender: 'pk',
      author: 'Rina Wulandari', text: 'Mohon dibantu.' } },
    responses: { 409: 'Tiket selesai / dikunci agen lain.' },
  }),
  route('POST', '/tiket/:no/take', takeTiket,
    ACTION_DOC('Agen mengambil tiket Baru (kunci).', 'HT-2609-0431')),
  route('POST', '/tiket/:no/close', closeTiket,
    ACTION_DOC('Agen pemegang kunci menutup tiket.', 'HT-2609-0418')),
  route('POST', '/tiket/:no/reopen', reopenTiket,
    ACTION_DOC('Buka kembali tiket Selesai.', 'HT-2609-0377')),
  route('GET', '/hotline-stats', ({ store }) => ok(store.hotlineStats), {
    tag: 'Hotline', summary: 'Dasbor kinerja hotline.',
  }),
  route('GET', '/hotline-profiles/:akun', getProfile, {
    tag: 'Hotline', summary: 'Profil hotline pemberi kerja (lengkap?).',
    example: { params: { akun: 'nbp.hrd' } },
  }),
  route('PUT', '/hotline-profiles/:akun', saveProfile, {
    tag: 'Hotline', summary: 'Simpan profil hotline (wajib sebelum tiket).',
    request: 'HotlineProfileRequest',
    example: { params: { akun: 'nbp.hrd' }, body: {
      penanggungJawab: 'Rina Wulandari', telepon: '081287654321',
      email: 'hrd@nusantarabaja.co.id' } },
  }),
];

function getProfile({ params, store }) {
  const profile = store.hotlineProfiles[params.akun];
  return profile ? ok(profile) : notFound('Profil hotline');
}

function saveProfile({ params, body, store }) {
  const result = validateHotlineProfile(body);
  if (!result.valid) {
    return invalid(result);
  }
  const profile = store.hotlineProfiles[params.akun];
  if (!profile) {
    return notFound('Profil hotline');
  }
  Object.assign(profile, {
    penanggungJawab: body.penanggungJawab.trim(),
    telepon: body.telepon.trim(), email: body.email.trim(), lengkap: true,
  });
  return ok(profile);
}

function listTiket({ query, store }) {
  const rows = store.tiket
    .filter((t) => !query.perusahaan || t.perusahaan === query.perusahaan)
    .filter((t) => !query.status || t.status === query.status);
  return list(rows);
}

function getTiket({ params, store }) {
  const found = findTiket(store, params.no);
  return found ? ok(found) : notFound('Tiket');
}

function listMessages({ params, store }) {
  return findTiket(store, params.no)
    ? list(store.tiketMessages[params.no])
    : notFound('Tiket');
}

function createTiket({ body, store }) {
  const result = validateCreateTiket(body);
  if (!result.valid) {
    return invalid(result);
  }
  const stamp = nowStamp(store.today);
  const tiket = {
    no: nextTicketNo(store.tiket), kategori: body.kategori,
    judul: body.judul.trim(), tgl: stamp.full, ...STATUS.BARU,
    perusahaan: body.perusahaan, nomorTerkait: body.nomorTerkait ?? null,
  };
  store.tiket.unshift(tiket);
  store.tiketMessages[tiket.no] = [{
    sender: 'pk', from: `${body.perusahaan}`, time: stamp.short,
    text: body.rincian.trim(),
  }];
  return created(tiket);
}

function postMessage({ params, body, store }) {
  const result = validateTiketMessage(body);
  if (!result.valid) {
    return invalid(result);
  }
  const tiket = findTiket(store, params.no);
  if (!tiket) {
    return notFound('Tiket');
  }
  const blocked = replyBlocker(tiket, body);
  if (blocked) {
    return blocked;
  }
  const message = buildMessage(tiket, body, store.today);
  store.tiketMessages[tiket.no].push(message);
  return created(message);
}

function takeTiket(ctx) {
  return withAction(ctx, (tiket, agen) => {
    if (tiket.status !== STATUS.BARU.status) {
      return lockedOrState(tiket, agen, 'Hanya tiket Baru yang dapat diambil.');
    }
    Object.assign(tiket, STATUS.DIPROSES, { agen, lock: agen });
    return ok(tiket);
  });
}

function closeTiket(ctx) {
  return withAction(ctx, (tiket, agen) => {
    if (tiket.status !== STATUS.DIPROSES.status || tiket.lock !== agen) {
      return lockedOrState(tiket, agen,
        'Hanya agen pemegang tiket Diproses yang dapat menutup.');
    }
    ctx.store.tiketMessages[tiket.no].push(buildMessage(tiket,
      { sender: 'agen', author: agen, text: CLOSING_TEXT }, ctx.store.today));
    Object.assign(tiket, STATUS.SELESAI, { lock: null });
    return ok(tiket);
  });
}

function reopenTiket(ctx) {
  return withAction(ctx, (tiket, agen) => {
    if (tiket.status !== STATUS.SELESAI.status) {
      return fail(409, 'INVALID_STATE', 'Hanya tiket Selesai yang dapat dibuka.');
    }
    Object.assign(tiket, STATUS.DIPROSES, { agen, lock: agen });
    return ok(tiket);
  });
}

function withAction({ params, body, store }, action) {
  const result = validateTiketAction(body);
  if (!result.valid) {
    return invalid(result);
  }
  const tiket = findTiket(store, params.no);
  return tiket ? action(tiket, body.agen.trim()) : notFound('Tiket');
}

function lockedOrState(tiket, agen, message) {
  if (tiket.lock && tiket.lock !== agen && tiket.status !== 'Selesai') {
    return fail(409, 'TIKET_LOCKED', `Tiket sedang ditangani ${tiket.lock}.`);
  }
  return fail(409, 'INVALID_STATE', message);
}

function replyBlocker(tiket, body) {
  if (tiket.status === STATUS.SELESAI.status) {
    return fail(409, 'INVALID_STATE',
      'Tiket sudah Selesai; buka kembali untuk membalas.');
  }
  if (body.sender === 'agen' && tiket.lock !== body.author.trim()) {
    return lockedOrState(tiket, body.author.trim(),
      'Ambil tiket terlebih dahulu sebelum membalas.');
  }
  return null;
}

function buildMessage(tiket, body, today) {
  const author = body.author.trim();
  const from = body.sender === 'agen'
    ? `${author} (Agen)`
    : `${author} (${tiket.perusahaan})`;
  return {
    sender: body.sender, from, time: nowStamp(today).short,
    text: body.text.trim(),
  };
}

function findTiket(store, no) {
  return store.tiket.find((t) => t.no === no) ?? null;
}

function nextTicketNo(tikets) {
  const max = Math.max(...tikets.map((t) => Number(t.no.split('-')[2])));
  return TICKET_PREFIX + String(max + 1).padStart(4, '0');
}

/** Reference date (30 September 2026) + current wall-clock time. */
function nowStamp(today) {
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}.` +
    String(now.getMinutes()).padStart(2, '0');
  const short = today.replace(/ (\w{3})\w* \d{4}$/, ' $1');
  return { full: `${today}, ${time}`, short: `${short}, ${time}` };
}
