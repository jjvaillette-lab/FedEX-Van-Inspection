-- Parali Van Check — Supabase schema.
-- Run this once in Supabase: SQL Editor → New query → paste → Run.

create table if not exists public.inspections (
  id         uuid primary key,
  created_at timestamptz not null default now(),
  driver     jsonb       not null,
  van_id     text        not null,
  answers    jsonb       not null,
  photos     jsonb       not null default '[]'::jsonb,
  has_issues boolean     not null default false,
  status     text        not null
);

-- Handy indexes for the dashboard.
create index if not exists inspections_created_at_idx on public.inspections (created_at desc);
create index if not exists inspections_flagged_idx    on public.inspections (has_issues) where has_issues;

-- The app talks to Supabase only from the server using the service_role key,
-- which bypasses Row Level Security, so no policies are required for the MVP.
-- RLS stays enabled (secure by default); add policies later if you ever expose
-- the anon key to the browser.
alter table public.inspections enable row level security;

-- Contact form submissions (from the public Contact page).
create table if not exists public.contact_messages (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name       text not null,
  email      text,
  message    text not null,
  recipient  text,           -- intended destination; set server-side, never shown to visitors
  handled    boolean not null default false
);

alter table public.contact_messages enable row level security;
