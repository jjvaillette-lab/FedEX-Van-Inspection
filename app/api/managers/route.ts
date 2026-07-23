import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { DEFAULT_MANAGERS, type ManagerRecord } from "@/lib/tenant";

export const runtime = "nodejs";

/**
 * Manager accounts + their tab access, stored as one row in app_settings
 * (key "managers"). Team-session only — proxy.ts blocks drivers & the public.
 * Replaced by real per-user auth (Supabase Auth) in the production phase.
 */

async function load(): Promise<{ managers: ManagerRecord[]; persisted: boolean }> {
  const supabase = getSupabase();
  if (!supabase) return { managers: DEFAULT_MANAGERS, persisted: false };
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "managers")
    .maybeSingle();
  if (error) return { managers: DEFAULT_MANAGERS, persisted: false };
  if (!data) {
    // First use: seed the defaults so edits start from a stored list.
    const { error: seedError } = await supabase
      .from("app_settings")
      .upsert({ key: "managers", value: DEFAULT_MANAGERS });
    return { managers: DEFAULT_MANAGERS, persisted: !seedError };
  }
  return { managers: (data.value as ManagerRecord[]) ?? [], persisted: true };
}

export async function GET() {
  const result = await load();
  return NextResponse.json(result);
}

export async function PUT(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { managers?: ManagerRecord[] };
  if (!Array.isArray(body.managers)) {
    return NextResponse.json({ error: "Invalid manager list" }, { status: 400 });
  }
  for (const m of body.managers) {
    if (!m.id || !m.name?.trim() || !m.email?.trim()) {
      return NextResponse.json({ error: "Every manager needs a name and email." }, { status: 400 });
    }
  }
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key: "managers", value: body.managers });
  if (error) {
    return NextResponse.json(
      {
        error: /relation|schema cache/i.test(error.message)
          ? "Database update required: run supabase/migration-v2.sql in the Supabase SQL editor."
          : `Save failed: ${error.message}`,
      },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
