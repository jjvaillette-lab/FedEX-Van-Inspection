-- Last Mile Assist — database update v5 (driver stats + van maintenance).
-- Run once in Supabase: SQL Editor → New query → paste → Run. Safe to re-run.
-- (Includes the v4 maintenance table in case it wasn't run yet.)

-- Van maintenance & cost tracking (v4)
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

-- Driver daily stats (Operations › Driver Stats), imported from the FedEx
-- Daily Service Worksheet. One row per driver per day (both delivery-type
-- tabs combined).
create table if not exists public.driver_stats (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  date           date not null,
  driver         text not null,
  vehicle        text,
  route          text,
  vscan_pkgs     integer not null default 0,
  del_stops      integer not null default 0,
  pu_stops       integer not null default 0,
  diff           integer not null default 0,
  act_del_stops  integer not null default 0,
  act_del_pkgs   integer not null default 0,
  act_pu_stops   integer not null default 0,
  act_pu_pkgs    integer not null default 0,
  miles          numeric(8, 1) not null default 0,
  on_road_hours  numeric(6, 2) not null default 0,
  on_duty_hours  numeric(6, 2) not null default 0,
  unique (date, driver)
);
create index if not exists driver_stats_date_idx on public.driver_stats (date desc);
create index if not exists driver_stats_driver_idx on public.driver_stats (driver, date desc);
alter table public.driver_stats enable row level security;
