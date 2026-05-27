// Habit CRUD
import { supabase, withTimeout } from './supabase.js';
import { todayISO } from './utils.js';

// Palette offered when creating/editing a habit. Picked for distinct hues
// that read well as solid-filled day cells against both light and dark.
export const COLORS = [
  '#e74c3c', // red
  '#e67e22', // orange
  '#f1c40f', // yellow
  '#2ecc71', // green
  '#1abc9c', // teal
  '#3498db', // blue
  '#9b59b6', // purple
  '#ec407a', // pink
];

export async function loadHabits(userId) {
  const { data, error } = await withTimeout(
    supabase
      .from('habits')
      .select('*')
      .eq('user_id', userId)
      .eq('archived', false)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    8000,
    'loadHabits'
  );
  if (error) throw error;
  return data || [];
}

export async function createHabit(userId, name, color) {
  // Place new habit at the end. Cheap to compute client-side because the
  // user can only have a handful of habits (capped at 5 in UI).
  const existing = await loadHabits(userId);
  const sort_order = existing.length;
  // Send the client's local date as created_at. Postgres `current_date`
  // (the schema default) uses the server's UTC, which is "tomorrow" for any
  // user west of UTC after their local 5pm-ish — that future date then
  // locks every cell with "habit didn't exist yet."
  const created_at = todayISO();
  const { data, error } = await withTimeout(
    supabase
      .from('habits')
      .insert({ user_id: userId, name, color, sort_order, created_at })
      .select()
      .single(),
    8000,
    'createHabit'
  );
  if (error) throw error;
  return data;
}

// One-shot repair: if any habit's created_at is in the future (UTC vs local
// timezone skew from before the createHabit fix), pull it back to today so
// the user isn't locked out of marking days. Called from app boot.
export async function repairFutureCreatedDates(userId) {
  const today = todayISO();
  const all = await loadHabits(userId);
  const broken = all.filter(h => h.created_at > today);
  if (broken.length === 0) return 0;
  for (const h of broken) {
    await withTimeout(
      supabase.from('habits').update({ created_at: today }).eq('id', h.id),
      8000,
      'repairFutureCreatedDates'
    );
  }
  return broken.length;
}

export async function updateHabit(id, fields) {
  const { data, error } = await withTimeout(
    supabase.from('habits').update(fields).eq('id', id).select().single(),
    8000,
    'updateHabit'
  );
  if (error) throw error;
  return data;
}

export async function deleteHabit(id) {
  const { error } = await withTimeout(
    supabase.from('habits').delete().eq('id', id),
    8000,
    'deleteHabit'
  );
  if (error) throw error;
}
