// Streak math — pure functions over a Set of completed 'YYYY-MM-DD' days.
import { todayISO, daysAgoISO, daysBetween, fromISO, toISO } from './utils.js';

// Current streak: count back from today (today counts only if marked; if
// today isn't marked yet we still allow yesterday to be the streak tail, so
// "I haven't logged today yet" doesn't visually destroy the chain).
export function currentStreak(completionsSet, habitCreatedISO) {
  if (!completionsSet || completionsSet.size === 0) return 0;
  const today = todayISO();
  let cursor;
  if (completionsSet.has(today)) {
    cursor = today;
  } else if (completionsSet.has(daysAgoISO(1))) {
    cursor = daysAgoISO(1);
  } else {
    return 0;
  }
  let count = 0;
  while (completionsSet.has(cursor)) {
    if (daysBetween(habitCreatedISO, cursor) < 0) break;
    count++;
    const d = fromISO(cursor);
    d.setDate(d.getDate() - 1);
    cursor = toISO(d);
  }
  return count;
}

// Longest streak across all completed days.
export function longestStreak(completionsSet) {
  if (!completionsSet || completionsSet.size === 0) return 0;
  const sorted = [...completionsSet].sort();
  let best = 1, run = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (daysBetween(sorted[i - 1], sorted[i]) === 1) {
      run++;
      if (run > best) best = run;
    } else {
      run = 1;
    }
  }
  return best;
}
