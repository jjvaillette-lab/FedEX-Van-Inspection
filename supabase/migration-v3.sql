-- Last Mile Assist — database update v3 (structured contact-form details).
-- Optional but recommended: keeps company/routes/employees/location as
-- structured data instead of folded into the message text.
-- Run once in Supabase: SQL Editor → New query → paste → Run. Safe to re-run.

alter table public.contact_messages add column if not exists details jsonb;
