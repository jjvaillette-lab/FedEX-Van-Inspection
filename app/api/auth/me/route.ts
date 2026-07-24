import { NextResponse } from "next/server";
import {
  profileToPortalUser,
  readCookie,
  sessionFromRequest,
  tenantFor,
  VIEWAS_COOKIE,
} from "@/lib/company";

export const runtime = "nodejs";

/** Current real-account session (null when signed in via the legacy path). */
export async function GET(request: Request) {
  const profile = await sessionFromRequest(request);
  if (!profile) return NextResponse.json({ user: null });

  // Support mode: the whole portal shows the viewed company's data + branding.
  const viewAs = readCookie(request, VIEWAS_COOKIE);
  const effective =
    viewAs && profile.platformAdmin && viewAs !== profile.companyId ? viewAs : profile.companyId;
  const tenant = await tenantFor(effective);

  return NextResponse.json({
    user: profileToPortalUser(profile),
    tenant,
    viewingAs: effective !== profile.companyId ? { companyId: effective, name: tenant.name } : null,
  });
}
