import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { sessionFromRequest, tenantFor } from "@/lib/company";

export const runtime = "nodejs";

/** GET: the signed-in user's company branding + entitlements. */
export async function GET(request: Request) {
  const profile = await sessionFromRequest(request);
  if (!profile) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  return NextResponse.json({ tenant: await tenantFor(profile.companyId) });
}

/** PUT: owner updates company branding (name, theme color, logo). */
export async function PUT(request: Request) {
  const profile = await sessionFromRequest(request);
  if (!profile || (profile.role !== "owner" && !profile.admin)) {
    return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    themeColor?: string;
    logoDataUri?: string | null;
  };
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Database not configured." }, { status: 503 });

  const patch: Record<string, unknown> = {};
  if (body.name?.trim()) patch.name = body.name.trim();
  if (body.themeColor?.trim()) patch.theme_color = body.themeColor.trim();
  if (body.logoDataUri !== undefined) patch.logo_data_uri = body.logoDataUri;
  if (Object.keys(patch).length === 0) return NextResponse.json({ ok: true });

  // Tolerant: before migration-v7 there is no companies table — branding just
  // stays browser-local as it does today.
  const { error } = await supabase.from("companies").update(patch).eq("id", profile.companyId);
  return NextResponse.json({ ok: true, persisted: !error });
}
