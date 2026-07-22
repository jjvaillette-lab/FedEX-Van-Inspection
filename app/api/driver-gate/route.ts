import { NextResponse } from "next/server";
import { DRIVER_COOKIE, signDriver } from "@/lib/gate";

export const runtime = "nodejs";

/**
 * Activates a driver device. The owner opens the activation link (or types the
 * code) on each phone once; the device gets a year-long cookie scoped to the
 * inspection surface only (enforced in proxy.ts).
 */
export async function POST(request: Request) {
  const { key } = (await request.json().catch(() => ({}))) as { key?: string };
  const expected = process.env.DRIVER_KEY;

  if (!expected) {
    return NextResponse.json(
      { error: "Driver access isn't configured yet (DRIVER_KEY not set)." },
      { status: 503 }
    );
  }
  if (!key || key !== expected) {
    return NextResponse.json({ error: "Invalid activation code." }, { status: 401 });
  }

  const token = await signDriver(365);
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
