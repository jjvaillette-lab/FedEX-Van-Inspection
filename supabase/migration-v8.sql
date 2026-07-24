-- Last Mile Assist — database update v8 (platform support & monitoring).
-- Run once in Supabase: SQL Editor → New query → paste → Run. Safe to re-run.
--
--  1. admin_audit: every support action by LMA staff (e.g. "viewed Stratford")
--     is recorded — customers' trust depends on support access being logged.
--  2. platform_errors: server errors captured for the Admin console + alerts.
-- Both are platform-level tables: RLS on, no policies → server-only access.

create table if not exists public.admin_audit (
  id          uuid primary key default gen_random_uuid(),
  at          timestamptz not null default now(),
  admin_email text not null,
  action      text not null,
  company_id  text,
  detail      text
);
create index if not exists admin_audit_at_idx on public.admin_audit (at desc);
alter table public.admin_audit enable row level security;

create table if not exists public.platform_errors (
  id         uuid primary key default gen_random_uuid(),
  at         timestamptz not null default now(),
  source     text not null default 'server',
  message    text not null,
  url        text,
  stack      text,
  company_id text
);
create index if not exists platform_errors_at_idx on public.platform_errors (at desc);
alter table public.platform_errors enable row level security;
