-- Last Mile Assist — database update v2 (pre/post trips, editable questions,
-- resolutions & comments, contact messages).
-- Run once in Supabase: SQL Editor → New query → paste everything → Run.
-- Safe to re-run: every statement is IF NOT EXISTS / additive.

-- Inspections gain trip type, daily cycle number, resolution, and comments.
alter table public.inspections add column if not exists trip_type text not null default 'pre';
alter table public.inspections add column if not exists cycle int not null default 1;
alter table public.inspections add column if not exists resolution jsonb;
alter table public.inspections add column if not exists comments jsonb not null default '[]'::jsonb;

-- Owner-editable inspection questions (seeded automatically by the app).
create table if not exists public.questions (
  id           text primary key,
  label        text not null,
  category     text not null,
  hint         text,
  trip_type    text not null default 'pre',   -- 'pre' | 'post' | 'both'
  input_type   text not null default 'check', -- 'check' | 'yesno' | 'number' | 'text'
  dot_specific boolean not null default false,
  enabled      boolean not null default true,
  sort_order   int not null default 0
);
alter table public.questions enable row level security;

-- Small key-value settings store (DOT mode, interior photos toggle, ...).
create table if not exists public.app_settings (
  key   text primary key,
  value jsonb not null
);
alter table public.app_settings enable row level security;

-- Contact form submissions (public Contact page) — included here in case the
-- earlier snippet wasn't run.
create table if not exists public.contact_messages (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name       text not null,
  email      text,
  message    text not null,
  recipient  text,
  handled    boolean not null default false
);
alter table public.contact_messages enable row level security;
