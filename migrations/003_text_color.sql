-- Migration 003: add `text_color` column to habits for day-number font color.
--
-- Run in the Supabase SQL editor on project dxqtfoeunwswzvgliyek.
-- Safe to re-run.

alter table public.habits
  add column if not exists text_color text not null default '#ffffff';

update public.habits set text_color = '#ffffff' where text_color is null;
