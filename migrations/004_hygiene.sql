-- 004 — data-hygiene hardening. Run in the Supabase SQL Editor for project
-- dxqtfoeunwswzvgliyek. Safe to re-run.
--
-- Two changes, both additive (no data dropped, no column removed):
--   1. Constrain habits.color to a #rrggbb hex string at the DB level. The
--      client already normalizes via normalizeColor(), but color is also
--      interpolated raw into style="..." innerHTML, so this is the last line
--      of defense against a crafted write storing an attribute-breakout value.
--   2. Tighten the completions RLS policy so a row is only writable/readable
--      when the caller ALSO owns the referenced habit. Previously the policy
--      only checked auth.uid() = user_id, so a user could create a completion
--      pointing at someone else's habit_id (harmless today, but a real
--      cross-habit integrity gap). The legitimate client is unaffected.

-- 1. color CHECK (idempotent — only added once)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'habits_color_hex') then
    alter table public.habits
      add constraint habits_color_hex check (color ~ '^#[0-9a-fA-F]{6}$');
  end if;
end $$;

-- 2. Habit-ownership-aware completions policy
drop policy if exists "own completions" on public.completions;
create policy "own completions" on public.completions
  for all
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.habits h
      where h.id = completions.habit_id and h.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.habits h
      where h.id = completions.habit_id and h.user_id = auth.uid()
    )
  );
