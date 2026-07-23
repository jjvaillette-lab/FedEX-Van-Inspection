import { NextResponse } from "next/server";
import { GATE_COOKIE, USER_COOKIE } from "@/lib/gate";

export const runtime = "nodejs";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(USER_COOKIE, "", { path: "/", maxAge: 0 });
  res.cookies.set(GATE_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
