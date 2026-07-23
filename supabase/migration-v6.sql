-- Last Mile Assist — database update v6 (van registry + DVIR auto-grounding).
-- Run once in Supabase: SQL Editor → New query → paste → Run. Safe to re-run.

-- Van registry: one row per van (info card + active/inactive status).
create table if not exists public.vans (
  id                text primary key,       -- van number / ID (matches DVIR scans)
  created_at        timestamptz not null default now(),
  vin               text,
  make              text,
  model             text,
  year              text,
  plate             text,
  active            boolean not null default true,
  status_reason     text,                   -- why inactive (auto DVIR grounding or manual)
  status_changed_at timestamptz
);
alter table public.vans enable row level security;

-- Per-question auto-grounding: an "issue" on a flagged question automatically
-- moves the van to Inactive. Default ON for every safety check question.
alter table public.questions add column if not exists auto_inactive boolean not null default false;
update public.questions set auto_inactive = true where input_type = 'check';
