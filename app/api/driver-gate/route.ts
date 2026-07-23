import { NextResponse } from "next/server";
import { DRIVER_COOKIE, signDriverFor } from "@/lib/gate";
import { getSupabase } from "@/lib/supabase";
import { DEFAULT_COMPANY_ID } from "@/lib/company";

export const runtime = "nodejs";

/**
 * Activates a driver device. The owner opens the activation link (or types the
 * code) on each phone once; the device gets a year-long cookie scoped to the
 * inspection surface only (enforced in proxy.ts) AND to one company.
 *
 * Keys: each company can have its own driver_key (companies table); the
 * DRIVER_KEY env var remains the original tenant's code so existing printed
 * QR sheets keep working.
 */
export async function POST(request: Request) {
  const { key } = (await request.json().catch(() => ({}))) as { key?: string };
  if (!key?.trim()) {
    return NextResponse.json({ error: "Invalid activation code." }, { status: 401 });
  }

  let companyId: string | null = null;

  // Per-company key from the companies table (post-migration).
  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from("companies")
      .select("id, active")
      .eq("driver_key", key.trim())
      .maybeSingle();
    if (!error && data && data.active !== false) companyId = data.id as string;
  }

  // Legacy env key → the original tenant.
  if (!companyId && process.env.DRIVER_KEY && key === process.env.DRIVER_KEY) {
    companyId = DEFAULT_COMPANY_ID;
  }

  if (!companyId) {
    if (!process.env.DRIVER_KEY && !supabase) {
      return NextResponse.json(
        { error: "Driver access isn't configured yet (DRIVER_KEY not set)." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "Invalid activation code." }, { status: 401 });
  }

  const token = await signDriverFor(companyId, 365);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(DRIVER_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
  });
  return res;
}

/** Deactivate this device. */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(DRIVER_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
