-- 005 — per-account sound settings synced across devices.
-- Run in the Supabase SQL Editor for project dxqtfoeunwswzvgliyek. Safe to re-run.
--
-- Adds a jsonb column on public.users that stores the user's sound config
-- (selected scale, octave/pitch/speed, global pattern, and the per-habit
-- pattern queues). The existing "own profile" RLS policy (auth.uid() = id)
-- already scopes read/write to the owner, so no policy change is needed.
--
-- The app degrades gracefully if this hasn't been run yet: it just keeps the
-- settings in localStorage (per-device) and doesn't sync.

alter table public.users add column if not exists sound_settings jsonb;
