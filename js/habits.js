// Habit CRUD
import { supabase, withTimeout } from './supabase.js';

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
  const { data, error } = await withTimeout(
    supabase
      .from('habits')
      .insert({ user_id: userId, name, color, sort_order })
      .select()
      .single(),
    8000,
    'createHabit'
  );
  if (error) throw error;
  return data;
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
