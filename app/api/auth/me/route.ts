import { NextResponse } from "next/server";
import { profileToPortalUser, sessionFromRequest, tenantFor } from "@/lib/company";

export const runtime = "nodejs";

/** Current real-account session (null when signed in via the legacy path). */
export async function GET(request: Request) {
  const profile = await sessionFromRequest(request);
  if (!profile) return NextResponse.json({ user: null });
  const tenant = await tenantFor(profile.companyId);
  return NextResponse.json({ user: profileToPortalUser(profile), tenant });
}
