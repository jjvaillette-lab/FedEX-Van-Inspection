-- Last Mile Assist — database update v4 (van maintenance & cost tracking).
-- Run once in Supabase: SQL Editor → New query → paste → Run. Safe to re-run.

create table if not exists public.maintenance (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  van_id      text not null,
  date        date not null,
  mileage     integer,
  category    text not null default 'Repair',
  description text not null,
  cost        numeric(10, 2) not null default 0,
  receipt_url text,
  created_by  text
);

create index if not exists maintenance_van_idx on public.maintenance (van_id, date desc);
alter table public.maintenance enable row level security;
