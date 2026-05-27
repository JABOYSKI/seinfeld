// Toast notifications + date helpers

const TOAST_DURATION_MS = 2400;

export function toast(msg, kind = 'info') {
  const host = document.getElementById('toastHost') || (() => {
    const el = document.createElement('div');
    el.id = 'toastHost';
    document.body.appendChild(el);
    return el;
  })();
  const t = document.createElement('div');
  t.className = `toast toast-${kind}`;
  t.textContent = msg;
  host.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 250);
  }, TOAST_DURATION_MS);
}

// --- Date helpers ---------------------------------------------------------
// Everything is done in local time. ISO strings here are 'YYYY-MM-DD' (no
// time component) so the user's local "today" is what Supabase stores.

export function pad2(n) { return String(n).padStart(2, '0'); }

export function toISO(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function fromISO(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO() { return toISO(new Date()); }

export function daysAgoISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toISO(d);
}

// Days between two ISO strings (b - a). Positive if b is later.
export function daysBetween(aISO, bISO) {
  const a = fromISO(aISO), b = fromISO(bISO);
  return Math.round((b - a) / 86_400_000);
}

export const BACKFILL_DAYS = 3;

// A day is editable iff it's within the last BACKFILL_DAYS (today counts as 0
// days ago), not in the future, and not before the habit's creation date.
export function canEditDay(dayISO, habitCreatedISO) {
  const today = todayISO();
  const fromToday = daysBetween(dayISO, today); // positive = day is in past
  if (fromToday < 0) return false;                          // future
  if (fromToday > BACKFILL_DAYS) return false;              // out of window
  if (daysBetween(habitCreatedISO, dayISO) < 0) return false; // before habit existed
  return true;
}

// --- Month layout helpers -------------------------------------------------
// We render with Sunday as the first column (classic US wall calendar).

export const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
export const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const WEEKDAY_LETTERS = ['S','M','T','W','T','F','S'];

export function daysInMonth(year, month /* 0-11 */) {
  return new Date(year, month + 1, 0).getDate();
}

// 0 = Sunday, 6 = Saturday
export function firstWeekdayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}
