# Operations runbook — Last Mile Assist

Plain-language guide for running the platform safely. Written for the owner —
no coding required for anything in here.

## If something breaks (the 1-minute rollback)

Every deploy keeps the previous working version one click away:

1. Go to **vercel.com → your project → Deployments**.
2. Find the last deployment that was working (they're timestamped).
3. Click the **⋯ menu → Promote to Production**.

The site is back on the old version in about a minute. No data is lost —
rollback only changes the code, never the database.

## Error monitoring (already on)

- Every server error is captured automatically and listed in
  **Portal → Admin → Recent server errors**.
- Each new error also emails the platform inbox (throttled to one email per
  issue per hour, so a bad night can't send 5,000 emails).
- If customers report something broken and the error list is empty, the
  problem is likely in the browser side — ask for a screenshot.

## Database backups (do this once)

Supabase backs up the database daily on paid plans. To check / enable:

1. **supabase.com → your project → Database → Backups.**
2. On the free plan, upgrade to **Pro** (~$25/mo) — it includes daily backups
   with 7-day retention. Do this before the first paying customer.
3. Later, when revenue justifies it, add **Point-in-Time Recovery** (PITR) —
   restores to any minute, not just last night.

Photos live in Supabase Storage and are included in the project; the same
plan covers them.

## Staging (test before customers see it)

Two levels, use what fits:

**Level 1 — preview deploys (free, already working):** every git branch gets
its own private URL from Vercel before it touches production. Good for
checking looks and flows. Caveat: previews talk to the SAME database as
production, so don't submit test data you don't want to clean up.

**Level 2 — true staging (when there are several customers):**
1. Create a second Supabase project ("lma-staging"), run all `supabase/*.sql`
   migrations in it.
2. In Vercel → Settings → Environment Variables, set the staging Supabase
   URL/key for the **Preview** environment only.
3. Previews then get their own sandbox database — break anything freely.

## Suspending a customer (non-payment etc.)

**Portal → Admin → the company card → Suspend.** Their logins stop working;
their data stays untouched. Reactivate restores everything.

## Support access etiquette

"View as (support)" shows you a customer's portal exactly as they see it.
Every entry and exit is written to the audit log — if a customer asks,
show them the log. Exit support view as soon as you're done.
