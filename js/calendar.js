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
import { normalizeTexture } from './textures.js';

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
  container.style.setProperty('--habit-text-color', habit.text_color || '#ffffff');
  container.classList.remove('calendar-all', 'calendar-continuous');
}

// ----- Continuous strip view ----------------------------------------------
//
// 7 rows (one per weekday) × ~53 columns (one per week). The entire year
// renders as one connected grid with no month-card boundaries. Month names
// appear as subtle labels above the columns where each month starts.
//
// Uses grid-auto-flow: column so day cells flow top-to-bottom then
// left-to-right; leading and trailing blank cells pad the first and last
// weeks so day 1 of the year lands on the right weekday row.

function applyHabitCSSVars(container, habit) {
  container.style.setProperty('--habit-color', habit.color);
  container.style.setProperty('--habit-text-color', habit.text_color || '#ffffff');
}

// Continuous-strip renders YEARS_TO_SHOW years ending at the viewed year, so
// the user gets a long-range look at their consistency. completions must
// cover the whole range — loadCompletionsInRange in completions.js.
export const CONTINUOUS_YEARS = 5;

export function renderContinuousCalendar(container, habit, completions, year) {
  const today = todayISO();
  const habitCreated = habit.created_at;
  const startYear = year - (CONTINUOUS_YEARS - 1);
  const endYear   = year;

  let allCells = '';
  let allMonthLabels = '';
  let allYearLabels = '';
  let runningCol = 0;

  for (let yr = startYear; yr <= endYear; yr++) {
    const ys = buildYearStrip(yr, habit, completions, today, habitCreated);
    allCells += ys.cells;

    // Month labels with absolute (cross-year) grid-column positions.
    for (let i = 0; i < ys.monthStarts.length; i++) {
      const { col, month } = ys.monthStarts[i];
      const nextCol = ys.monthStarts[i + 1]?.col ?? ys.cols;
      const span = Math.max(1, nextCol - col);
      const cls = `strip-month-label${month === 0 ? ' is-year-start' : ''}`;
      allMonthLabels += `<span class="${cls}" style="grid-column: ${runningCol + col + 1} / span ${span};">${MONTH_SHORT[month]}</span>`;
    }

    allYearLabels += `<span class="strip-year-label" style="grid-column: ${runningCol + 1} / span ${ys.cols};">${yr}</span>`;
    runningCol += ys.cols;
  }

  const totalCols = runningCol;
  const weekdays = WEEKDAY_LETTERS.map(l => `<span class="strip-weekday">${l}</span>`).join('');

  container.innerHTML = `
    <div class="strip-years"  style="grid-template-columns: repeat(${totalCols}, var(--strip-cell));">${allYearLabels}</div>
    <div class="strip-months" style="grid-template-columns: repeat(${totalCols}, var(--strip-cell));">${allMonthLabels}</div>
    <div class="strip-body">
      <div class="strip-weekdays">${weekdays}</div>
      <div class="strip-grid">${allCells}</div>
    </div>
  `;
  applyHabitCSSVars(container, habit);
  container.classList.add('calendar-continuous');
  container.classList.remove('calendar-all');
}

// Builds the day cells + month-start col positions for one year. Used by the
// continuous renderer to stitch together a multi-year strip.
function buildYearStrip(year, habit, completions, today, habitCreated) {
  const jan1 = new Date(year, 0, 1);
  const jan1Weekday = jan1.getDay(); // 0 = Sun
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  const daysInYear = isLeap ? 366 : 365;

  let cells = '';
  // Leading blanks so day 1 lands in the correct weekday row of column 1.
  for (let i = 0; i < jan1Weekday; i++) cells += `<div class="day day-blank"></div>`;

  const monthStarts = [];
  let weekCol = 0;
  let dayInWeek = jan1Weekday;

  for (let dayOfYear = 0; dayOfYear < daysInYear; dayOfYear++) {
    const d = new Date(year, 0, 1 + dayOfYear);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (d.getDate() === 1) monthStarts.push({ col: weekCol, month: d.getMonth() });
    cells += renderDay(iso, d.getDate(), habit, completions, today, habitCreated);
    dayInWeek++;
    if (dayInWeek === 7) { dayInWeek = 0; weekCol++; }
  }

  if (dayInWeek > 0) {
    for (let i = dayInWeek; i < 7; i++) cells += `<div class="day day-blank"></div>`;
    weekCol++;
  }

  return { cells, monthStarts, cols: weekCol };
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
  if (done) {
    classes.push('day-done');
    classes.push(`tx-${normalizeTexture(habit.texture)}`);
  }
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
  if (doneCount > 0) classes.push('has-fill');
  // Note: no day-pre or empty-cell styling — empty cells render invisibly.

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

  const slicesHTML = slices.map(s => {
    const txClass = s.done ? ` tx-${normalizeTexture(s.habit.texture)}` : '';
    return `<span class="day-slice${s.done ? ' day-slice-done' : ''}${s.existed ? '' : ' day-slice-pre'}${txClass}" style="--c:${s.habit.color}"></span>`;
  }).join('');

  return `<div class="${classes.join(' ')}" data-day="${iso}" title="${title}">
    <span class="day-slices">${slicesHTML}</span>
    <span class="day-num">${dayNum}</span>
  </div>`;
}
