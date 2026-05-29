-- Migration 002: add `texture` column to habits.
--
-- Run this once in the Supabase SQL editor on project dxqtfoeunwswzvgliyek.
-- Safe to re-run: uses `if not exists`.

alter table public.habits
  add column if not exists texture text not null default 'matte';

-- Backfill any rows that might somehow be null (shouldn't be possible with
-- the default + not null, but defensive).
update public.habits set texture = 'matte' where texture is null;
