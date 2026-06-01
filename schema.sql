-- Seinfeld habit tracker — Supabase schema
-- Run this in the Supabase SQL Editor for project dxqtfoeunwswzvgliyek.
-- Safe to re-run: every create uses "if not exists" or "or replace".

-- Profile mirror of auth.users (we keep our own row so RLS policies can
-- reference public.users and so we can add profile columns later).
create table if not exists public.users (
  id uuid primary key references auth.users on delete cascade,
  created_at timestamptz default now()
);

create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  color text not null constraint habits_color_hex check (color ~ '^#[0-9a-fA-F]{6}$'),  -- hex like '#e74c3c'
  created_at date not null default current_date,  -- chain starts here
  sort_order int not null default 0,
  archived boolean not null default false
);

create index if not exists habits_user_idx on public.habits(user_id);

create table if not exists public.completions (
  habit_id uuid not null references public.habits(id) on delete cascade,
  user_id  uuid not null references public.users(id)  on delete cascade,
  day date not null,
  created_at timestamptz default now(),
  primary key (habit_id, day)
);

create index if not exists completions_user_day_idx on public.completions(user_id, day);

-- Trigger: auto-create the public.users row when an auth user signs up.
create or replace function public.handle_new_user() returns trigger as $$
begin
  insert into public.users (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Row-Level Security: every row is scoped to the owning user.
alter table public.users       enable row level security;
alter table public.habits      enable row level security;
alter table public.completions enable row level security;

drop policy if exists "own profile"     on public.users;
drop policy if exists "own habits"      on public.habits;
drop policy if exists "own completions" on public.completions;

create policy "own profile" on public.users
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "own habits" on public.habits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- A completion is owned by the caller only when user_id matches AND the caller
-- owns the referenced habit (closes a cross-habit write gap). See migration
-- 004_hygiene.sql.
create policy "own completions" on public.completions
  for all
  using (
    auth.uid() = user_id
    and exists (select 1 from public.habits h where h.id = completions.habit_id and h.user_id = auth.uid())
  )
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.habits h where h.id = completions.habit_id and h.user_id = auth.uid())
  );
