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
  const from = `${fromYear}-01-01`;
  const to   = `${toYear}-12-31`;
  const { data, error } = await withTimeout(
    supabase
      .from('completions')
      .select('day')
      .eq('habit_id', habitId)
      .gte('day', from)
      .lte('day', to),
    8000,
    'loadCompletionsInRange'
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
