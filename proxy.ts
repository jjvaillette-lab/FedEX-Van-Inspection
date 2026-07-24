import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  DRIVER_COOKIE,
  GATE_COOKIE,
  USER_COOKIE,
  verifyDriver,
  verifyGate,
  verifyUser,
} from "@/lib/gate";

/**
 * Access control (Next.js 16 "proxy", formerly middleware).
 *
 * Three access levels, enforced server-side:
 *  - Public: marketing pages, sign-in, contact, and the driver activation page.
 *  - Driver devices (DRIVER_COOKIE): ONLY the inspection surface — the driver
 *    hub, the inspection flow, and the two APIs it needs. No portal, no
 *    review data, no settings.
 *  - Team (GATE_COOKIE): everything.
 */

function isPublic(pathname: string, method: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/contact" ||
    pathname === "/driver" ||
    // Offline shell for driver phones — a static file, safe to serve publicly.
    pathname === "/sw.js" ||
    pathname.startsWith("/api/gate") ||
    pathname.startsWith("/api/auth") || // login/logout/me self-guard their data
    pathname.startsWith("/api/driver-gate") ||
    // Vercel cron endpoint — the route enforces CRON_SECRET / team session itself.
    pathname === "/api/recap" ||
    // Visitors may SUBMIT the contact form; reading messages stays team-only.
    (pathname.startsWith("/api/contact") && method === "POST")
  );
}

/** Exact paths a driver-scoped device may reach. */
function isDriverAllowed(pathname: string): boolean {
  return (
    pathname === "/inspection" ||
    pathname === "/api/inspections" || // list (trip detection) + submit; /api/inspections/[id] stays team-only
    pathname === "/api/questions"
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname, request.method)) return NextResponse.next();

  const team =
    (await verifyGate(request.cookies.get(GATE_COOKIE)?.value)) ||
    (await verifyUser(request.cookies.get(USER_COOKIE)?.value)) !== null;
  if (team) return NextResponse.next();

  if (isDriverAllowed(pathname)) {
    const driver = await verifyDriver(request.cookies.get(DRIVER_COOKIE)?.value);
    if (driver) return NextResponse.next();
  }

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
