-- Last Mile Assist — database update v9 (HR: Hiring & AI interviews).
-- Run once in Supabase: SQL Editor → New query → paste → Run. Safe to re-run.
--
--  positions:  open roles with their interview question sets.
--  candidates: every applicant — invite token, live transcript, AI score.

create table if not exists public.positions (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  company_id  text not null references public.companies (id) default 'stratford',
  title       text not null,
  description text,
  pay         text,
  location    text,
  questions   jsonb not null default '[]',   -- [{id, text}]
  active      boolean not null default true
);
create index if not exists positions_company_idx on public.positions (company_id);

create table if not exists public.candidates (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  company_id     text not null references public.companies (id) default 'stratford',
  position_id    uuid references public.positions (id),
  name           text not null,
  phone          text,
  email          text,
  -- invited → in_progress → completed; archived at any point
  status         text not null default 'invited',
  interview_token text unique not null,
  invited_at     timestamptz not null default now(),
  started_at     timestamptz,
  completed_at   timestamptz,
  duration_secs  integer,
  transcript     jsonb not null default '[]', -- [{role: 'interviewer'|'candidate', text, at}]
  score          integer,                     -- 1–10 (null until scored)
  summary        text,
  red_flags      jsonb not null default '[]',
  notes          text
);
create index if not exists candidates_company_idx on public.candidates (company_id, created_at desc);
create index if not exists candidates_token_idx on public.candidates (interview_token);

alter table public.positions enable row level security;
alter table public.candidates enable row level security;

drop policy if exists positions_company on public.positions;
create policy positions_company on public.positions
  for all to authenticated
  using (company_id = (select company_id from public.profiles where id = auth.uid()))
  with check (company_id = (select company_id from public.profiles where id = auth.uid()));

drop policy if exists candidates_company on public.candidates;
create policy candidates_company on public.candidates
  for all to authenticated
  using (company_id = (select company_id from public.profiles where id = auth.uid()))
  with check (company_id = (select company_id from public.profiles where id = auth.uid()));
