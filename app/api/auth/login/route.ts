import { NextResponse } from "next/server";
import { GATE_COOKIE, USER_COOKIE, signGate, signUser } from "@/lib/gate";
import { loadProfile, profileToPortalUser, tenantFor } from "@/lib/company";

export const runtime = "nodejs";

/**
 * Sign-in. Tries a real account first (Supabase Auth email + password); if the
 * password instead matches the legacy shared team password, falls back to the
 * pre-auth flow so existing owner/manager sign-ins keep working during the
 * transition. Real sessions get the signed lma_user cookie.
 */

const SESSION_DAYS = 30;

export async function POST(request: Request) {
  const { email, password } = (await request.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
  };
  if (!email?.trim() || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  // 1) Real account (Supabase Auth).
  if (url && key) {
    try {
      const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { apikey: key, "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      if (res.ok) {
        const data = (await res.json()) as { user?: { id?: string } };
        const userId = data.user?.id;
        const profile = userId ? await loadProfile(userId) : null;
        if (!profile) {
          return NextResponse.json(
            { error: "Your login works, but the account isn't attached to a company yet. Contact support." },
            { status: 403 }
          );
        }
        const tenant = await tenantFor(profile.companyId);
        const out = NextResponse.json({ ok: true, user: profileToPortalUser(profile), tenant });
        out.cookies.set(USER_COOKIE, await signUser(profile.id, SESSION_DAYS), {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          path: "/",
          maxAge: SESSION_DAYS * 24 * 60 * 60,
        });
        return out;
      }
    } catch {
      /* fall through to legacy */
    }
  }

  // 2) Legacy shared team password (transition path).
  const legacyExpected = process.env.PORTAL_PASSWORD;
  if (legacyExpected && password === legacyExpected) {
    const out = NextResponse.json({ ok: true, legacy: true });
    out.cookies.set(GATE_COOKIE, await signGate(30), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });
    return out;
  }

  return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
}
