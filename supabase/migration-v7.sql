-- Last Mile Assist — database update v7 (MULTI-TENANT FOUNDATION).
-- Run once in Supabase: SQL Editor → New query → paste → Run. Safe to re-run.
--
-- What this does:
--  1. Creates the `companies` table (one row per customer) and seeds Stratford.
--  2. Creates `profiles` (real user accounts: role, permissions, company).
--  3. Adds a company_id column to every data table, backfilled to 'stratford',
--     so every row belongs to exactly one company from here on.
--  4. Rebuilds keys/uniques to be per-company (two companies can both have a
--     "Van 12", their own settings keys, and the same driver name on a date).
--  5. Turns on Row Level Security everywhere with company-isolation policies —
--     the database itself refuses to serve one company's rows to another
--     company's login.

-- 1. Companies -------------------------------------------------------------
create table if not exists public.companies (
  id              text primary key,          -- short slug, e.g. 'stratford'
  created_at      timestamptz not null default now(),
  name            text not null,
  slug            text unique not null,
  theme_color     text not null default '#0E7C5A',
  logo_data_uri   text,
  enabled_modules jsonb not null default '["fleet-inspection","fleet-van-list","fleet-maintenance","operations-driver-stats"]',
  driver_key      text,                      -- per-company driver activation code
  active          boolean not null default true
);

insert into public.companies (id, name, slug, theme_color)
values ('stratford', 'Stratford Delivery Corp', 'stratford', '#0E7C5A')
on conflict (id) do nothing;

-- 2. Profiles (app users; id = Supabase Auth user id) ----------------------
create table if not exists public.profiles (
  id             uuid primary key,
  created_at     timestamptz not null default now(),
  company_id     text not null references public.companies (id),
  email          text unique not null,
  name           text not null,
  role           text not null default 'manager',   -- 'owner' | 'manager'
  admin          boolean not null default false,
  tabs           jsonb not null default '[]',
  permissions    jsonb not null default '[]',
  platform_admin boolean not null default false,     -- LMA staff: master access
  active         boolean not null default true
);

-- 3. company_id on every data table (default keeps existing code working) --
alter table public.inspections  add column if not exists company_id text not null default 'stratford';
alter table public.questions    add column if not exists company_id text not null default 'stratford';
alter table public.app_settings add column if not exists company_id text not null default 'stratford';
alter table public.maintenance  add column if not exists company_id text not null default 'stratford';
alter table public.driver_stats add column if not exists company_id text not null default 'stratford';
alter table public.vans         add column if not exists company_id text not null default 'stratford';

create index if not exists inspections_company_idx  on public.inspections  (company_id, created_at desc);
create index if not exists questions_company_idx    on public.questions    (company_id);
create index if not exists maintenance_company_idx  on public.maintenance  (company_id, date desc);
create index if not exists driver_stats_company_idx on public.driver_stats (company_id, date desc);
create index if not exists vans_company_idx         on public.vans         (company_id);

-- 4. Per-company keys ------------------------------------------------------
-- questions: (company, question id)
alter table public.questions drop constraint if exists questions_pkey;
alter table public.questions add primary key (company_id, id);

-- app_settings: (company, key)
alter table public.app_settings drop constraint if exists app_settings_pkey;
alter table public.app_settings add primary key (company_id, key);

-- vans: (company, van id)
alter table public.vans drop constraint if exists vans_pkey;
alter table public.vans add primary key (company_id, id);

-- driver_stats: one row per company + date + driver
alter table public.driver_stats drop constraint if exists driver_stats_date_driver_key;
alter table public.driver_stats drop constraint if exists driver_stats_company_date_driver_key;
alter table public.driver_stats add constraint driver_stats_company_date_driver_key unique (company_id, date, driver);

-- 5. Row Level Security ----------------------------------------------------
-- The portal's server talks to the database with the service key (bypasses
-- RLS by design) and adds company filters itself. These policies are the
-- locked door for every OTHER path: any future browser-side access, leaked
-- anon keys, or third-party tools get company isolation enforced by Postgres.
alter table public.companies     enable row level security;
alter table public.profiles      enable row level security;
alter table public.inspections   enable row level security;
alter table public.questions     enable row level security;
alter table public.app_settings  enable row level security;
alter table public.maintenance   enable row level security;
alter table public.driver_stats  enable row level security;
alter table public.vans          enable row level security;

-- Each signed-in user can read their own profile (needed by the policies below).
drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles
  for select to authenticated
  using (id = auth.uid());

-- Users can see their own company's row.
drop policy if exists companies_own on public.companies;
create policy companies_own on public.companies
  for select to authenticated
  using (id = (select company_id from public.profiles where id = auth.uid()));

-- Company isolation on every data table.
drop policy if exists inspections_company on public.inspections;
create policy inspections_company on public.inspections
  for all to authenticated
  using (company_id = (select company_id from public.profiles where id = auth.uid()))
  with check (company_id = (select company_id from public.profiles where id = auth.uid()));

drop policy if exists questions_company on public.questions;
create policy questions_company on public.questions
  for all to authenticated
  using (company_id = (select company_id from public.profiles where id = auth.uid()))
  with check (company_id = (select company_id from public.profiles where id = auth.uid()));

drop policy if exists app_settings_company on public.app_settings;
create policy app_settings_company on public.app_settings
  for all to authenticated
  using (company_id = (select company_id from public.profiles where id = auth.uid()))
  with check (company_id = (select company_id from public.profiles where id = auth.uid()));

drop policy if exists maintenance_company on public.maintenance;
create policy maintenance_company on public.maintenance
  for all to authenticated
  using (company_id = (select company_id from public.profiles where id = auth.uid()))
  with check (company_id = (select company_id from public.profiles where id = auth.uid()));

drop policy if exists driver_stats_company on public.driver_stats;
create policy driver_stats_company on public.driver_stats
  for all to authenticated
  using (company_id = (select company_id from public.profiles where id = auth.uid()))
  with check (company_id = (select company_id from public.profiles where id = auth.uid()));

drop policy if exists vans_company on public.vans;
create policy vans_company on public.vans
  for all to authenticated
  using (company_id = (select company_id from public.profiles where id = auth.uid()))
  with check (company_id = (select company_id from public.profiles where id = auth.uid()));

-- contact_messages stays platform-level (website leads belong to LMA, not a
-- customer). Lock it to the server only.
alter table public.contact_messages enable row level security;
