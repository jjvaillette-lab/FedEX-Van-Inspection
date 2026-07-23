import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { companyFromRequest, loadSetting, saveSetting } from "@/lib/company";
import { DEFAULT_MANAGERS, type ManagerRecord } from "@/lib/tenant";

export const runtime = "nodejs";

/**
 * Manager accounts + their tab access, stored per company in app_settings
 * (key "managers"). Team-session only — proxy.ts blocks drivers & the public.
 * Replaced by real per-user auth (Supabase Auth) in the production phase.
 */

async function load(companyId: string): Promise<{ managers: ManagerRecord[]; persisted: boolean }> {
  const supabase = getSupabase();
  if (!supabase) return { managers: DEFAULT_MANAGERS, persisted: false };
  const { value, persisted } = await loadSetting<ManagerRecord[]>(companyId, "managers");
  if (!persisted) return { managers: DEFAULT_MANAGERS, persisted: false };
  if (!value) {
    // First use: seed the defaults so edits start from a stored list.
    try {
      await saveSetting(companyId, "managers", DEFAULT_MANAGERS);
      return { managers: DEFAULT_MANAGERS, persisted: true };
    } catch {
      return { managers: DEFAULT_MANAGERS, persisted: false };
    }
  }
  return { managers: value, persisted: true };
}

export async function GET(request: Request) {
  const result = await load(await companyFromRequest(request));
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
  try {
    await saveSetting(await companyFromRequest(request), "managers", body.managers);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Save failed";
    return NextResponse.json(
      {
        error: /relation|schema cache/i.test(msg)
          ? "Database update required: run supabase/migration-v2.sql in the Supabase SQL editor."
          : msg,
      },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
