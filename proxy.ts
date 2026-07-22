import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { GATE_COOKIE, verifyGate } from "@/lib/gate";

/**
 * Pre-launch access gate (Next.js 16 "proxy", formerly middleware).
 *
 * The public marketing page stays open; everything else — the portal, the
 * inspection app, and the API — requires the team access password. Enforced on
 * the server, so the app is genuinely private, not just visually hidden.
 */

// Paths anyone may reach without signing in: the public marketing pages and the
// sign-in / contact endpoints. Everything else (the working app + its data API)
// stays private behind a valid session.
function isPublic(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/contact" ||
    pathname.startsWith("/api/gate") ||
    pathname.startsWith("/api/contact")
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  const ok = await verifyGate(request.cookies.get(GATE_COOKIE)?.value);
  if (ok) return NextResponse.next();

  // Block API calls with a 401; send page requests to the password screen.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Access restricted" }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/portal" ? "" : `?next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Run on everything except Next internals and static asset files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg|.*\\.png|.*\\.ico|.*\\.webmanifest).*)"],
};
