// Renders the 12-month wall calendar grid.
//   - renderCalendar(): single-habit view (one color).
//   - renderAllCalendar(): conglomerate view, each day cell split into N
//     slices (one per habit). Read-only — to mark a day, switch to that
//     habit's tab.
import {
  MONTH_SHORT, WEEKDAY_LETTERS,
  daysInMonth, firstWeekdayOfMonth, ordinalWeekOfYear,
  todayISO, canEditDay, daysBetween,
} from './utils.js';
import { normalizeTexture } from './textures.js';

// ----- Single-habit (existing) view ---------------------------------------

// Sets exactly the layout-mode classes the active renderer needs, stripping
// the others. Avoids leftover classes when toggling between views.
function setCalendarLayout(container, classes) {
  ['calendar-all', 'calendar-continuous'].forEach(c => container.classList.remove(c));
  classes.forEach(c => container.classList.add(c));
  // Signal to CSS that this renderer emits the week-num + wd-corner cells,
  // so the 8-col grid template applies. Without this marker, old cached JS
  // (which doesn't emit those cells) wouldn't trip the 8-col rule and the
  // grid stays at the legacy 7 cols — no misalignment during cache rollover.
  container.classList.add('has-week-num-cells');
}

export function renderCalendar(container, habit, completions, year) {
  const today = todayISO();
  const habitCreated = habit.created_at;

  let html = '';
  for (let m = 0; m < 12; m++) {
    html += renderMonth(m, year, (iso, dayNum) =>
      renderDay(iso, dayNum, habit, completions, today, habitCreated)
    );
  }

  container.innerHTML = html;
  applyHabitCSSVars(container, habit);
  setCalendarLayout(container, []);
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
  // `year` is the START of the window — the same year you'd see in months
  // mode. Toggle between views preserves the focused year that way.
  const startYear = year;
  const endYear   = year + (CONTINUOUS_YEARS - 1);

  let blocks = '';
  for (let yr = startYear; yr <= endYear; yr++) {
    blocks += renderYearBlock(yr, habit, completions, today, habitCreated);
  }

  container.innerHTML = blocks;
  applyHabitCSSVars(container, habit);
  setCalendarLayout(container, ['calendar-continuous']);
}

// One self-contained year strip — header + month labels + weekday gutter +
// 7-row day grid. CONTINUOUS_YEARS of these stack vertically in the container.
function renderYearBlock(yr, habit, completions, today, habitCreated) {
  const ys = buildYearStrip(yr, (iso, dayNum) =>
    renderDay(iso, dayNum, habit, completions, today, habitCreated)
  );
  return wrapYearBlock(yr, ys);
}

function renderYearBlockAll(yr, habits, completionsByHabit, today) {
  const ys = buildYearStrip(yr, (iso, dayNum) =>
    renderAllDay(iso, dayNum, habits, completionsByHabit, today)
  );
  return wrapYearBlock(yr, ys);
}

function wrapYearBlock(yr, ys) {
  let labels = '';
  for (let i = 0; i < ys.monthStarts.length; i++) {
    const { col, month } = ys.monthStarts[i];
    const nextCol = ys.monthStarts[i + 1]?.col ?? ys.cols;
    const span = Math.max(1, nextCol - col);
    labels += `<span class="strip-month-label" style="grid-column: ${col + 1} / span ${span};">${MONTH_SHORT[month]}</span>`;
  }
  const weekdays = WEEKDAY_LETTERS.map(l => `<span class="strip-weekday">${l}</span>`).join('');
  // Week numbers: ordinal 1..cols, one cell per column. Visibility is
  // controlled by the .with-week-numbers class on the calendar container.
  let weekNumbers = '';
  for (let c = 0; c < ys.cols; c++) weekNumbers += `<span>${c + 1}</span>`;
  return `
    <div class="strip-year-block">
      <div class="strip-year-header">${yr}</div>
      <div class="strip-months" style="grid-template-columns: repeat(${ys.cols}, var(--strip-cell));">${labels}</div>
      <div class="strip-body">
        <div class="strip-weekdays">${weekdays}</div>
        <div class="strip-grid">${ys.cells}</div>
      </div>
      <div class="strip-week-numbers" style="grid-template-columns: repeat(${ys.cols}, var(--strip-cell));">${weekNumbers}</div>
    </div>
  `;
}

// Builds the day cells + month-start col positions for one year. Takes a
// per-cell renderer callback so the same scaffolding works for single-habit
// (renderDay) and all-habits (renderAllDay) cells.
function buildYearStrip(year, renderCell) {
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
    cells += renderCell(iso, d.getDate());
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
    html += renderMonth(m, year, (iso, dayNum) =>
      renderAllDay(iso, dayNum, habits, completionsByHabit, today)
    );
  }

  container.innerHTML = html;
  // Use the first habit's color as the --habit-color fallback (for hover etc).
  container.style.setProperty('--habit-color', habits[0]?.color || 'var(--accent)');
  setCalendarLayout(container, ['calendar-all']);
}

// All-habits continuous: same stacked-year layout as single-habit, but each
// day cell renders as N sliced stripes (one per habit).
export function renderContinuousAllCalendar(container, habits, completionsByHabit, year) {
  const today = todayISO();
  const startYear = year;
  const endYear   = year + (CONTINUOUS_YEARS - 1);

  let blocks = '';
  for (let yr = startYear; yr <= endYear; yr++) {
    blocks += renderYearBlockAll(yr, habits, completionsByHabit, today);
  }

  container.innerHTML = blocks;
  container.style.setProperty('--habit-color', habits[0]?.color || 'var(--accent)');
  setCalendarLayout(container, ['calendar-all', 'calendar-continuous']);
}

// ----- Shared month scaffolding -------------------------------------------

// `renderCell` is a function (iso, dayNum) => HTML for one day cell. Lets us
// reuse the month chrome across single-habit and All views.
//
// The 16px week-number gutter is ALWAYS present in layout (8-col grid:
// 1 narrow + 7 days), and the week-num cell + wd-corner are always emitted.
// The toggle only flips the gutter's contents from visible to hidden, so
// the day cells never resize or shift when the user toggles week numbers.
function renderMonth(month, year, renderCell) {
  const dim = daysInMonth(year, month);
  const first = firstWeekdayOfMonth(year, month);
  const used = first + dim;
  const tail = (7 - (used % 7)) % 7;
  const totalCells = used + tail;
  const rowCount = totalCells / 7;

  let body = '';
  for (let r = 0; r < rowCount; r++) {
    // Sunday at the start of this row, used to compute the week number.
    const rowSunday = new Date(year, month, 1 - first + r * 7);
    body += `<div class="month-week-num">${ordinalWeekOfYear(rowSunday, year)}</div>`;
    for (let i = 0; i < 7; i++) {
      const dayOfMonth = r * 7 + i - first + 1;
      if (dayOfMonth < 1 || dayOfMonth > dim) {
        body += `<div class="day day-blank"></div>`;
      } else {
        const iso = `${year}-${String(month + 1).padStart(2,'0')}-${String(dayOfMonth).padStart(2,'0')}`;
        body += renderCell(iso, dayOfMonth);
      }
    }
  }

  const weekdayHeader =
    `<div class="wd-corner"></div>` +
    WEEKDAY_LETTERS.map(l => `<div class="wd">${l}</div>`).join('');

  return `
    <div class="month">
      <div class="month-name">${MONTH_SHORT[month]}</div>
      <div class="month-weekdays">${weekdayHeader}</div>
      <div class="month-grid">${body}</div>
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
