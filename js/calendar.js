// Renders the 12-month wall calendar grid.
//   - renderCalendar(): single-habit view (one color).
//   - renderAllCalendar(): conglomerate view, each day cell split into N
//     slices (one per habit). Read-only — to mark a day, switch to that
//     habit's tab.
import {
  MONTH_SHORT, WEEKDAY_LETTERS,
  daysInMonth, firstWeekdayOfMonth,
  todayISO, canEditDay, daysBetween,
} from './utils.js';

// ----- Single-habit (existing) view ---------------------------------------

export function renderCalendar(container, habit, completions, year) {
  const today = todayISO();
  const habitCreated = habit.created_at;

  let html = '';
  for (let m = 0; m < 12; m++) {
    html += renderMonth(m, year, (cells) => cells.map(({ iso, dayNum }) =>
      renderDay(iso, dayNum, habit, completions, today, habitCreated)
    ).join(''));
  }

  container.innerHTML = html;
  container.style.setProperty('--habit-color', habit.color);
  container.classList.remove('calendar-all');
}

// ----- Conglomerate view --------------------------------------------------
//
// habits: array of habit objects
// completionsByHabit: Map<habitId, Set<'YYYY-MM-DD'>>
export function renderAllCalendar(container, habits, completionsByHabit, year) {
  const today = todayISO();

  let html = '';
  for (let m = 0; m < 12; m++) {
    html += renderMonth(m, year, (cells) => cells.map(({ iso, dayNum }) =>
      renderAllDay(iso, dayNum, habits, completionsByHabit, today)
    ).join(''));
  }

  container.innerHTML = html;
  // Use the first habit's color as the --habit-color fallback (for hover etc).
  container.style.setProperty('--habit-color', habits[0]?.color || 'var(--accent)');
  container.classList.add('calendar-all');
}

// ----- Shared month scaffolding -------------------------------------------

// `renderCells` is a function that takes an array of { iso, dayNum } and
// returns the joined HTML string for the day buttons. Lets us reuse the
// month chrome (header, weekdays, blank leaders/tails) across both views.
function renderMonth(month, year, renderCells) {
  const dim = daysInMonth(year, month);
  const first = firstWeekdayOfMonth(year, month);

  let leading = '';
  for (let i = 0; i < first; i++) leading += `<div class="day day-blank"></div>`;

  const cellData = [];
  for (let d = 1; d <= dim; d++) {
    const iso = `${year}-${String(month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    cellData.push({ iso, dayNum: d });
  }
  const cells = renderCells(cellData);

  const used = first + dim;
  const tail = (7 - (used % 7)) % 7;
  let trailing = '';
  for (let i = 0; i < tail; i++) trailing += `<div class="day day-blank"></div>`;

  return `
    <div class="month">
      <div class="month-name">${MONTH_SHORT[month]}</div>
      <div class="month-weekdays">
        ${WEEKDAY_LETTERS.map(l => `<div class="wd">${l}</div>`).join('')}
      </div>
      <div class="month-grid">${leading}${cells}${trailing}</div>
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

// In conglomerate mode each cell is a stack of N vertical slices. A slice is
// either filled with its habit color (done that day) or empty. We also dim
// slices for habits that didn't exist yet on that day, so the user can see
// at a glance "this day is half empty because half my habits are newer".
function renderAllDay(iso, dayNum, habits, completionsByHabit, today) {
  const future = daysBetween(today, iso) > 0;
  const isToday = iso === today;

  // Count fills + count habits that existed → drives the "perfect day" outline
  let doneCount = 0;
  let existingCount = 0;
  const slices = habits.map(h => {
    const existed = daysBetween(h.created_at, iso) >= 0;
    const done = !future && existed && completionsByHabit.get(h.id)?.has(iso);
    if (existed) existingCount++;
    if (done) doneCount++;
    return { habit: h, existed, done };
  });

  const perfect = existingCount > 0 && doneCount === existingCount;

  const classes = ['day', 'day-all'];
  if (future) classes.push('day-future');
  if (isToday) classes.push('day-today');
  if (perfect) classes.push('day-perfect');
  if (existingCount === 0) classes.push('day-pre');

  let title;
  if (future) {
    title = `${iso} — in the future`;
  } else if (existingCount === 0) {
    title = `${iso} — no habits existed yet`;
  } else {
    const doneNames = slices.filter(s => s.done).map(s => s.habit.name);
    title = `${iso} — ${doneCount}/${existingCount} habits`;
    if (doneNames.length) title += `\n${doneNames.join(', ')}`;
  }

  const slicesHTML = slices.map(s =>
    `<span class="day-slice${s.done ? ' day-slice-done' : ''}${s.existed ? '' : ' day-slice-pre'}" style="--c:${s.habit.color}"></span>`
  ).join('');

  return `<div class="${classes.join(' ')}" data-day="${iso}" title="${title}">
    <span class="day-slices">${slicesHTML}</span>
    <span class="day-num">${dayNum}</span>
  </div>`;
}
