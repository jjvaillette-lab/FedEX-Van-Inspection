import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Returns the driver activation link. Reachable only with a full team session
 * (proxy.ts blocks this path for driver-scoped cookies and the public), so the
 * activation code is never exposed to drivers or visitors.
 */
export async function GET(request: Request) {
  const key = process.env.DRIVER_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "DRIVER_KEY isn't set. Add it in Vercel → Settings → Environment Variables." },
      { status: 503 }
    );
  }
  const origin = new URL(request.url).origin;
  return NextResponse.json({
    key,
    url: `${origin}/driver?key=${encodeURIComponent(key)}`,
  });
}
