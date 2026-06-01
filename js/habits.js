// Habit CRUD
import { supabase, withTimeout } from './supabase.js';
import { todayISO } from './utils.js';
import { DEFAULT_TEXTURE_ID, normalizeTexture } from './textures.js';

// Columns that may not yet exist in the user's schema (added by later
// migrations). When Supabase rejects a write because one of these is missing
// from the schema cache, we strip it and retry — so the user can keep using
// the app even before they've run the migration.
const OPTIONAL_COLUMNS = ['texture', 'text_color'];
const COLUMN_MIGRATIONS = {
  texture:    'migrations/002_textures.sql',
  text_color: 'migrations/003_text_color.sql',
};
export function migrationFileForColumn(col) { return COLUMN_MIGRATIONS[col]; }

// Runs `buildQuery(body)` and, when Supabase says the column doesn't exist,
// drops that column and retries. Returns the row data, with a non-enumerable
// _droppedColumns array attached when any column had to be stripped so the
// caller can surface "run migration X" guidance.
async function withColumnFallback(buildQuery, payload, label) {
  let body = { ...payload };
  const dropped = [];
  for (let i = 0; i <= OPTIONAL_COLUMNS.length; i++) {
    const { data, error } = await buildQuery(body);
    if (!error) {
      if (data && dropped.length) data._droppedColumns = dropped.slice();
      return data;
    }
    const m = error.message?.match(/Could not find the '(\w+)' column/);
    if (m && OPTIONAL_COLUMNS.includes(m[1]) && body[m[1]] !== undefined) {
      dropped.push(m[1]);
      delete body[m[1]];
      continue;
    }
    throw error;
  }
  throw new Error(`Too many schema-fallback retries on ${label}`);
}

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

export const DEFAULT_TEXT_COLOR = '#ffffff';

// Normalize a text color value — accept #rrggbb / #rgb, default to white.
export function normalizeTextColor(value) {
  if (typeof value !== 'string') return DEFAULT_TEXT_COLOR;
  const v = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(v)) {
    return ('#' + v.slice(1).split('').map(c => c + c).join('')).toLowerCase();
  }
  return DEFAULT_TEXT_COLOR;
}

export const DEFAULT_COLOR = COLORS[0];

// Normalize a habit color the same way as text color. This is also a security
// boundary: habit.color is interpolated raw into style="..." inside innerHTML
// templates (tabs, day-cell slices, the delete dialog), so an un-hex value
// containing a quote could break out of the attribute. Forcing it to #rrggbb
// on write closes that at the source.
export function normalizeColor(value) {
  if (typeof value !== 'string') return DEFAULT_COLOR;
  const v = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(v)) {
    return ('#' + v.slice(1).split('').map(c => c + c).join('')).toLowerCase();
  }
  return DEFAULT_COLOR;
}

export async function createHabit(userId, name, color, texture = DEFAULT_TEXTURE_ID, textColor = DEFAULT_TEXT_COLOR) {
  // Place new habit at the end. Cheap to compute client-side because the
  // user can only have a handful of habits (capped at 5 in UI).
  const existing = await loadHabits(userId);
  const sort_order = existing.length;
  // Send the client's local date as created_at. Postgres `current_date`
  // (the schema default) uses the server's UTC, which is "tomorrow" for any
  // user west of UTC after their local 5pm-ish — that future date then
  // locks every cell with "habit didn't exist yet."
  const created_at = todayISO();
  const row = {
    user_id: userId, name, sort_order, created_at,
    color: normalizeColor(color),
    texture: normalizeTexture(texture),
    text_color: normalizeTextColor(textColor),
  };
  return await withColumnFallback(
    (body) => withTimeout(
      supabase.from('habits').insert(body).select().single(),
      8000, 'createHabit'
    ),
    row, 'createHabit'
  );
}

// One-shot repair: if any habit's created_at is in the future (UTC vs local
// timezone skew from before the createHabit fix), pull it back to today so
// the user isn't locked out of marking days. Called from app boot.
export async function repairFutureCreatedDates(userId) {
  const today = todayISO();
  const all = await loadHabits(userId);
  const brokenIds = all.filter(h => h.created_at > today).map(h => h.id);
  if (brokenIds.length === 0) return 0;
  // One batched UPDATE ... WHERE id IN (...) instead of N serial round-trips,
  // and surface a failure instead of silently swallowing it.
  const { error } = await withTimeout(
    supabase.from('habits').update({ created_at: today }).in('id', brokenIds),
    8000,
    'repairFutureCreatedDates'
  );
  if (error) throw error;
  return brokenIds.length;
}

export async function updateHabit(id, fields) {
  // Normalize the color fields on write too (not just create) — both feed
  // raw into style="..." innerHTML sinks, so this is the security boundary.
  const body = { ...fields };
  if ('color' in body) body.color = normalizeColor(body.color);
  if ('text_color' in body) body.text_color = normalizeTextColor(body.text_color);
  return await withColumnFallback(
    (buildBody) => withTimeout(
      supabase.from('habits').update(buildBody).eq('id', id).select().single(),
      8000, 'updateHabit'
    ),
    body, 'updateHabit'
  );
}

export async function deleteHabit(id) {
  const { error } = await withTimeout(
    supabase.from('habits').delete().eq('id', id),
    8000,
    'deleteHabit'
  );
  if (error) throw error;
}
