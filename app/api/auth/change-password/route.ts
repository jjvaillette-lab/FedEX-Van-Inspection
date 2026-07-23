import { NextResponse } from "next/server";
import { sessionFromRequest } from "@/lib/company";

export const runtime = "nodejs";

/** Change the signed-in user's password (verifies the current one first). */
export async function POST(request: Request) {
  const profile = await sessionFromRequest(request);
  if (!profile) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { currentPassword, newPassword } = (await request.json().catch(() => ({}))) as {
    currentPassword?: string;
    newPassword?: string;
  };
  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Current and new password are required." }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: "New password must be at least 8 characters." }, { status: 400 });
  }

  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return NextResponse.json({ error: "Database not configured." }, { status: 503 });

  // Verify the current password before changing anything.
  const check = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ email: profile.email, password: currentPassword }),
  });
  if (!check.ok) {
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
  }

  const update = await fetch(`${url}/auth/v1/admin/users/${profile.id}`, {
    method: "PUT",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password: newPassword }),
  });
  if (!update.ok) {
    return NextResponse.json({ error: "Password change failed. Try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
