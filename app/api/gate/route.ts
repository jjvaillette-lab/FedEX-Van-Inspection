import { NextResponse } from "next/server";
import { GATE_COOKIE, signGate } from "@/lib/gate";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { password } = (await request.json().catch(() => ({}))) as { password?: string };
  const expected = process.env.PORTAL_PASSWORD;

  if (!expected || password !== expected) {
    return NextResponse.json({ error: "Incorrect access password." }, { status: 401 });
  }

  const token = await signGate(30);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(GATE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(GATE_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
