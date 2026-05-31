// Per-day completion toggling
import { supabase, withTimeout } from './supabase.js';

// Load completed days for one habit in a given year. Returns a Set of
// 'YYYY-MM-DD' strings — Set membership is O(1) per cell during render.
export async function loadCompletions(habitId, year) {
  return loadCompletionsInRange(habitId, year, year);
}

// Same as loadCompletions but spans a multi-year window. Used by the
// continuous strip view which renders 5 years at once.
export async function loadCompletionsInRange(habitId, fromYear, toYear) {
  return loadCompletionsBetween(habitId, `${fromYear}-01-01`, `${toYear}-12-31`);
}

// Load completed days for one habit between two inclusive 'YYYY-MM-DD' dates.
// Used for today-anchored current-streak math, which must span year
// boundaries independently of the calendar grid's per-year fetch.
export async function loadCompletionsBetween(habitId, fromISO, toISO) {
  const { data, error } = await withTimeout(
    supabase
      .from('completions')
      .select('day')
      .eq('habit_id', habitId)
      .gte('day', fromISO)
      .lte('day', toISO),
    8000,
    'loadCompletionsBetween'
  );
  if (error) throw error;
  return new Set((data || []).map(r => r.day));
}

export async function markDay(habitId, userId, dayISO) {
  const { error } = await withTimeout(
    supabase
      .from('completions')
      .upsert({ habit_id: habitId, user_id: userId, day: dayISO }, { onConflict: 'habit_id,day' }),
    8000,
    'markDay'
  );
  if (error) throw error;
}

export async function unmarkDay(habitId, dayISO) {
  const { error } = await withTimeout(
    supabase
      .from('completions')
      .delete()
      .eq('habit_id', habitId)
      .eq('day', dayISO),
    8000,
    'unmarkDay'
  );
  if (error) throw error;
}
