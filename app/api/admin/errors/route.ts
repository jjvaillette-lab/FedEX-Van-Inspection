import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { sessionFromRequest } from "@/lib/company";

export const runtime = "nodejs";

/** Recent server errors + support audit trail for the Admin console. */
export async function GET(request: Request) {
  const session = await sessionFromRequest(request);
  if (!session?.platformAdmin) {
    return NextResponse.json({ error: "Platform admin only." }, { status: 403 });
  }
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ errors: [], audit: [] });

  const [errs, audit] = await Promise.all([
    supabase.from("platform_errors").select("*").order("at", { ascending: false }).limit(50),
    supabase.from("admin_audit").select("*").order("at", { ascending: false }).limit(50),
  ]);
  return NextResponse.json({
    errors: errs.error ? [] : errs.data,
    audit: audit.error ? [] : audit.data,
    persisted: !errs.error,
  });
}
