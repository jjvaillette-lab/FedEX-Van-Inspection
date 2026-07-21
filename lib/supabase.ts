import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client.
 *
 * Uses the SERVICE ROLE key, so it must ONLY ever be imported from server code
 * (API routes / server components) — never shipped to the browser. Because the
 * env vars have no NEXT_PUBLIC_ prefix, Next.js keeps them server-only.
 *
 * Returns null when Supabase isn't configured yet, which lets the storage layer
 * fall back to local-file storage until the keys are filled in.
 */

export const PHOTO_BUCKET = "inspection-photos";

let cached: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (cached !== undefined) return cached;

  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !key) {
    cached = null;
    return null;
  }

  cached = createClient(url, key, { auth: { persistSession: false } });
  return cached;
}
