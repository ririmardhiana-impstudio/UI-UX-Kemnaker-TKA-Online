/**
 * @fileoverview Pure formatting helpers for the employer portal (Indonesian
 * dates, rupiah, tone-driven classes). Ported from the legacy component
 * (addDays, stepTone, tone) without hex values.
 */

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli',
  'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const DATE_RE = /(\d+) (\w+) (\d{4})/;

/**
 * Parse "30 September 2026" (anything containing that pattern).
 * @param {string} text
 * @return {?Date}
 */
export function parseIndoDate(text) {
  const match = DATE_RE.exec(text ?? '');
  if (!match) {
    return null;
  }
  const month = MONTHS.indexOf(match[2]);
  if (month < 0) {
    return null;
  }
  return new Date(Number(match[3]), month, Number(match[1]));
}

/** Date -> "7 Oktober 2026". */
export function formatIndoDate(date) {
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** Legacy addDays(str, n): '—' when the input has no date. */
export function addDays(text, days) {
  const date = parseIndoDate(text);
  if (!date) {
    return '—';
  }
  date.setDate(date.getDate() + days);
  return formatIndoDate(date);
}

/** "30 September 2026" -> "Rabu, 30 September 2026". */
export function withWeekday(text) {
  const date = parseIndoDate(text);
  return date ? `${DAYS[date.getDay()]}, ${text}` : text;
}

/** "Rabu, 7 Oktober 2026" -> {day: '7', month: 'OKT'}. */
export function calendarChip(text) {
  const date = parseIndoDate(text);
  if (!date) {
    return { day: '—', month: '' };
  }
  return {
    day: String(date.getDate()),
    month: MONTHS[date.getMonth()].slice(0, 3).toUpperCase(),
  };
}

/** 18000000 -> "Rp18.000.000". */
export function rupiah(amount) {
  return `Rp${Number(amount).toLocaleString('id-ID')}`;
}

/** File-name friendly slug. */
export function slug(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Tone for "sisa hari" chips (legacy: <=30 red, <=60 amber, else blue). */
export function sisaTone(sisa) {
  if (sisa <= 30) {
    return 'red';
  }
  return sisa <= 60 ? 'amber' : 'blue';
}

const STEP_DOT = {
  err: 'bg-error border-error',
  done: 'bg-success border-success',
  cur: 'bg-secondary border-secondary',
  todo: 'bg-base-100 border-base-content/20',
};
const STEP_TAG = {
  err: ['Perlu tindakan', 'text-error'],
  cur: ['Sedang diproses', 'text-secondary'],
  done: ['Selesai', 'text-success'],
  todo: ['', ''],
};

/**
 * Timeline step presentation (legacy stepTone).
 * @param {number} i Step index.
 * @param {number} at Current step index.
 * @param {string} tone Record tone (green = current step finished).
 * @return {{dot: string, label: string, tag: string, tagClass: string}}
 */
export function stepTone(i, at, tone) {
  const done = i < at || (i === at && tone === 'green');
  const cur = i === at && !done;
  let kind = 'todo';
  if (cur && tone === 'red') {
    kind = 'err';
  } else if (done) {
    kind = 'done';
  } else if (cur) {
    kind = 'cur';
  }
  const [tag, tagClass] = STEP_TAG[kind];
  return {
    dot: STEP_DOT[kind],
    label: i > at ? 'text-base-content/50' : 'text-base-content',
    tag,
    tagClass,
  };
}
