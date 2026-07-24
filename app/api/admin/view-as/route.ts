import { NextResponse } from "next/server";
import { logAdminAction, sessionFromRequest, VIEWAS_COOKIE } from "@/lib/company";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * Support mode: a platform admin temporarily views the portal as one company.
 * Every entry/exit is written to the audit log. The cookie expires after 4
 * hours on its own.
 */
export async function POST(request: Request) {
  const session = await sessionFromRequest(request);
  if (!session?.platformAdmin) {
    return NextResponse.json({ error: "Platform admin only." }, { status: 403 });
  }
  const { companyId } = (await request.json().catch(() => ({}))) as { companyId?: string };
  if (!companyId?.trim()) {
    return NextResponse.json({ error: "Company id is required." }, { status: 400 });
  }
  const supabase = getSupabase();
  if (supabase) {
    const { data } = await supabase.from("companies").select("id").eq("id", companyId).maybeSingle();
    if (!data) return NextResponse.json({ error: "Company not found." }, { status: 404 });
  }
  await logAdminAction(session.email, "view_as_start", companyId);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(VIEWAS_COOKIE, companyId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 4 * 60 * 60,
  });
  return res;
}

export async function DELETE(request: Request) {
  const session = await sessionFromRequest(request);
  if (session?.platformAdmin) await logAdminAction(session.email, "view_as_end");
  const res = NextResponse.json({ ok: true });
  res.cookies.set(VIEWAS_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
