// Cross-device sync for the user's "sound" configuration.
//
// The sound settings (selected scale, octave/pitch/speed, global pattern, and
// the per-habit pattern queues) live in localStorage for fast synchronous
// access by the audio engine. This module mirrors them to Supabase
// (users.sound_settings jsonb) so they're identical on every device signed
// into the same account. localStorage stays the source the engine reads; the
// cloud is just the cross-device backup.
//
// Everything here is best-effort and non-fatal: if the column doesn't exist
// yet (migration 004/005 not run) or the device is offline, the app keeps
// working from localStorage and simply doesn't sync.
import { supabase, withTimeout } from './supabase.js';
import { getUser } from './auth.js';

// The localStorage keys that make up the synced sound config. (Kept in sync
// with the *_STORAGE_KEY constants in audio.js.)
export const SOUND_KEYS = [
  'seinfeld_sound_scale',
  'seinfeld_sound_octave',
  'seinfeld_sound_pitch',
  'seinfeld_sound_pattern',
  'seinfeld_sound_pattern_queues_v2',
  'seinfeld_sound_speed',
];

function readLocalBlob() {
  const blob = {};
  for (const k of SOUND_KEYS) {
    const v = localStorage.getItem(k);
    if (typeof v === 'string') blob[k] = v;
  }
  return blob;
}
function writeLocalBlob(blob) {
  // Total mirror: the cloud is authoritative, so set the keys it has AND clear
  // the ones it lacks (which reset to their defaults). This makes the device an
  // exact match for the account rather than a partial blend of both.
  for (const k of SOUND_KEYS) {
    if (blob && typeof blob[k] === 'string') localStorage.setItem(k, blob[k]);
    else localStorage.removeItem(k);
  }
}
function cloudHasContent(blob) {
  return !!blob && typeof blob === 'object' && SOUND_KEYS.some(k => typeof blob[k] === 'string');
}
function localHasContent() {
  return SOUND_KEYS.some(k => localStorage.getItem(k) !== null);
}

async function pushNow(userId) {
  try {
    const { error } = await withTimeout(
      supabase.from('users').update({ sound_settings: readLocalBlob() }).eq('id', userId),
      8000, 'saveSoundSettings');
    if (error) throw error;
    return true;
  } catch (e) { return false; /* column missing / offline */ }
}

// Boot sync: pull this account's cloud settings into localStorage so the audio
// engine reads them on every device. If the cloud is empty but THIS device
// already has settings, seed the cloud from local so the first configured
// device populates the account. Fire-and-forget from boot; never throws.
export async function syncSoundSettingsOnBoot(userId) {
  if (!userId) return;
  let cloud = null;
  try {
    // maybeSingle: a missing users row returns data=null instead of erroring.
    const { data, error } = await withTimeout(
      supabase.from('users').select('sound_settings').eq('id', userId).maybeSingle(),
      8000, 'loadSoundSettings');
    if (error) throw error;
    cloud = data && data.sound_settings;
  } catch (e) {
    return; // column missing / offline — keep local, non-fatal
  }
  if (cloudHasContent(cloud)) writeLocalBlob(cloud);
  else if (localHasContent()) await pushNow(userId);
}

// Debounced save, called by the audio setters right after they write
// localStorage. A burst of edits (e.g. dragging a slider) collapses into one
// write ~1.5s after the last change. The user id is captured at edit time so a
// pending save can never land under a different account if the user switches
// before it flushes (RLS would reject it too).
let _timer = null;
export function scheduleSaveSoundSettings() {
  const u = getUser();
  if (!u || !u.id) return;
  const userId = u.id;
  if (_timer) clearTimeout(_timer);
  _timer = setTimeout(() => { _timer = null; pushNow(userId); }, 1500);
}

// Explicit "Save to account": flush immediately (cancel the pending debounce)
// and report whether it landed, so the UI can confirm. Returns false if offline,
// not signed in, or the column doesn't exist yet (migration 005 not run).
export async function saveSoundSettingsNow() {
  if (_timer) { clearTimeout(_timer); _timer = null; }
  const u = getUser();
  if (!u || !u.id) return false;
  return pushNow(u.id);
}
