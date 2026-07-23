import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { companyFromRequest, DEFAULT_COMPANY_ID } from "@/lib/company";

export const runtime = "nodejs";

/**
 * Returns the driver activation link for the signed-in user's company.
 * Reachable only with a full team session (proxy.ts blocks this path for
 * driver-scoped cookies and the public), so the activation code is never
 * exposed to drivers or visitors.
 */
export async function GET(request: Request) {
  const companyId = await companyFromRequest(request);

  // Per-company key when the companies table has one …
  let key: string | null = null;
  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from("companies")
      .select("driver_key")
      .eq("id", companyId)
      .maybeSingle();
    if (!error && data?.driver_key) key = data.driver_key as string;
  }
  // … otherwise the original tenant falls back to the env key.
  if (!key && companyId === DEFAULT_COMPANY_ID) key = process.env.DRIVER_KEY ?? null;

  if (!key) {
    return NextResponse.json(
      { error: "No driver activation code is set for this company yet." },
      { status: 503 }
    );
  }
  const origin = new URL(request.url).origin;
  return NextResponse.json({
    key,
    url: `${origin}/driver?key=${encodeURIComponent(key)}`,
  });
}
