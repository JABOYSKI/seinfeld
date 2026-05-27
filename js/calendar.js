// Renders the 12-month wall calendar grid for one habit + one year.
import {
  MONTH_SHORT, WEEKDAY_LETTERS,
  daysInMonth, firstWeekdayOfMonth,
  toISO, todayISO, canEditDay, daysBetween,
} from './utils.js';

// Build the full year grid as a single string of HTML, then inject. Cheaper
// than 365+ DOM appends.
export function renderCalendar(container, habit, completions, year) {
  const today = todayISO();
  const habitCreated = habit.created_at; // 'YYYY-MM-DD'

  let html = '';
  for (let m = 0; m < 12; m++) {
    html += renderMonth(m, year, habit, completions, today, habitCreated);
  }

  container.innerHTML = html;
  container.style.setProperty('--habit-color', habit.color);
}

function renderMonth(month, year, habit, completions, today, habitCreated) {
  const dim = daysInMonth(year, month);
  const first = firstWeekdayOfMonth(year, month); // 0=Sun

  let cells = '';

  // Blank leading cells so day-1 lines up under the correct weekday column.
  for (let i = 0; i < first; i++) cells += `<div class="day day-blank"></div>`;

  for (let d = 1; d <= dim; d++) {
    const iso = `${year}-${String(month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    cells += renderDay(iso, d, habit, completions, today, habitCreated);
  }

  // Tail blanks to fill the last row so the next month's grid lines align.
  const used = first + dim;
  const tail = (7 - (used % 7)) % 7;
  for (let i = 0; i < tail; i++) cells += `<div class="day day-blank"></div>`;

  return `
    <div class="month">
      <div class="month-name">${MONTH_SHORT[month]}</div>
      <div class="month-weekdays">
        ${WEEKDAY_LETTERS.map(l => `<div class="wd">${l}</div>`).join('')}
      </div>
      <div class="month-grid">${cells}</div>
    </div>
  `;
}

function renderDay(iso, dayNum, habit, completions, today, habitCreated) {
  const done = completions.has(iso);
  const future = daysBetween(today, iso) > 0;
  const preCreation = daysBetween(habitCreated, iso) < 0;
  const editable = canEditDay(iso, habitCreated);
  const isToday = iso === today;

  const classes = ['day'];
  if (done) classes.push('day-done');
  if (future) classes.push('day-future');
  if (preCreation) classes.push('day-pre');
  if (editable) classes.push('day-clickable');
  if (isToday) classes.push('day-today');
  if (!done && !editable && !future && !preCreation) classes.push('day-locked');

  let title = iso;
  if (preCreation) title = `${iso} — habit didn't exist yet`;
  else if (future) title = `${iso} — in the future`;
  else if (!editable && !done) title = `${iso} — can only backfill the last 3 days`;
  else if (!editable && done) title = `${iso} — locked (older than 3 days)`;

  return `<button type="button" class="${classes.join(' ')}" data-day="${iso}" title="${title}"${editable ? '' : ' disabled'}>
    <span class="day-num">${dayNum}</span>
  </button>`;
}
