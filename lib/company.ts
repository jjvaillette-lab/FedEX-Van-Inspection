import { getSupabase } from "./supabase";
import { DRIVER_COOKIE, USER_COOKIE, verifyDriverCompany, verifyUser } from "./gate";
import { DEMO_TENANT } from "./tenant";
import type { PermissionKey, PortalUser, Section, Tenant } from "./tenant";

/**
 * Multi-tenant request context (server-side).
 *
 * Every API route resolves WHICH company a request belongs to:
 *   1. a real user session (lma_user cookie → profiles row), or
 *   2. a driver-device token (carries its company), or
 *   3. a legacy team-password session → the original single tenant.
 *
 * Data queries are scoped with .eq("company_id", …). Until migration-v7 is
 * run the column doesn't exist, so every scoped call falls back to the
 * unscoped legacy query (single-tenant behavior, nothing breaks).
 */

export const DEFAULT_COMPANY_ID = "stratford";

/** LMA platform staff — full master access; bootstrap before profiles exist. */
export const PLATFORM_ADMINS: Record<string, string> = {
  "jjvaillette@gmail.com": "Jason Vaillette",
  "jason.v@ptrntransport.com": "Jason Vaillette",
};

export interface SessionProfile {
  id: string;
  email: string;
  name: string;
  role: "owner" | "manager";
  admin: boolean;
  platformAdmin: boolean;
  companyId: string;
  tabs: Section[];
  permissions: PermissionKey[];
}

export function profileToPortalUser(p: SessionProfile): PortalUser {
  return {
    id: p.id,
    name: p.name,
    email: p.email,
    role: p.role,
    tenantId: p.companyId,
    permissions: p.permissions,
    admin: p.admin,
    tabs: p.tabs,
    platformAdmin: p.platformAdmin,
  };
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie") ?? "";
  const m = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

interface ProfileRow {
  id: string;
  company_id: string;
  email: string;
  name: string;
  role: string;
  admin: boolean;
  tabs: Section[] | null;
  permissions: PermissionKey[] | null;
  platform_admin: boolean;
  active: boolean;
}

/** Load a user's profile; bootstraps platform admins before/without a row. */
export async function loadProfile(userId: string): Promise<SessionProfile | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (!error && data) {
    const r = data as ProfileRow;
    if (r.active === false) return null;
    return {
      id: r.id,
      email: r.email,
      name: r.name,
      role: r.role === "owner" ? "owner" : "manager",
      admin: !!r.admin,
      platformAdmin: !!r.platform_admin,
      companyId: r.company_id,
      tabs: r.tabs ?? [],
      permissions: r.permissions ?? [],
    };
  }

  // No row (or table not migrated yet): platform admins still get in, so the
  // very first real login works before migration-v7 and self-heals after it.
  const { data: authUser } = await supabase.auth.admin.getUserById(userId);
  const email = authUser?.user?.email?.toLowerCase();
  if (!email || !(email in PLATFORM_ADMINS)) return null;

  const bootstrap: SessionProfile = {
    id: userId,
    email,
    name: PLATFORM_ADMINS[email],
    role: "owner",
    admin: true,
    platformAdmin: true,
    companyId: DEFAULT_COMPANY_ID,
    tabs: [],
    permissions: [],
  };
  // Self-heal: create the profile row once the table exists (ignore failures).
  await supabase
    .from("profiles")
    .upsert({
      id: userId,
      company_id: DEFAULT_COMPANY_ID,
      email,
      name: bootstrap.name,
      role: "owner",
      admin: true,
      platform_admin: true,
    })
    .then(() => {});
  return bootstrap;
}

/** The signed-in real user for this request, if any. */
export async function sessionFromRequest(request: Request): Promise<SessionProfile | null> {
  const userId = await verifyUser(readCookie(request, USER_COOKIE));
  if (!userId) return null;
  return loadProfile(userId);
}

/** Support-mode cookie: platform admins temporarily act as another company. */
export const VIEWAS_COOKIE = "lma_viewas";

/** Which company this request acts for (user session → driver token → legacy). */
export async function companyFromRequest(request: Request): Promise<string> {
  const session = await sessionFromRequest(request);
  if (session) {
    // Support mode: only honored for platform staff, and only for real companies.
    const viewAs = readCookie(request, VIEWAS_COOKIE);
    if (viewAs && session.platformAdmin && viewAs !== session.companyId) return viewAs;
    return session.companyId;
  }
  const driverCompany = await verifyDriverCompany(readCookie(request, DRIVER_COOKIE));
  if (driverCompany) return driverCompany;
  return DEFAULT_COMPANY_ID;
}

/** Record a platform-staff support action (best-effort; never throws). */
export async function logAdminAction(
  adminEmail: string,
  action: string,
  companyId?: string | null,
  detail?: string
): Promise<void> {
  try {
    const supabase = getSupabase();
    if (!supabase) return;
    await supabase.from("admin_audit").insert({
      admin_email: adminEmail,
      action,
      company_id: companyId ?? null,
      detail: detail ?? null,
    });
  } catch {
    /* audit is best-effort */
  }
}

/** True when a scoped query failed only because migration-v7 hasn't run. */
export function missingCompanyColumn(message: string | undefined | null): boolean {
  return !!message && /company_id|schema cache|column/i.test(message);
}

interface CompanyRow {
  id: string;
  name: string;
  slug: string;
  theme_color: string;
  logo_data_uri: string | null;
  enabled_modules: string[] | null;
  driver_key: string | null;
  active: boolean;
}

/** Branding + entitlements for a company (falls back to the seeded tenant). */
export async function tenantFor(companyId: string): Promise<Tenant> {
  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .eq("id", companyId)
      .maybeSingle();
    if (!error && data) {
      const r = data as CompanyRow;
      return {
        id: r.id,
        name: r.name,
        slug: r.slug,
        themeColor: r.theme_color || DEMO_TENANT.themeColor,
        logoDataUri: r.logo_data_uri ?? undefined,
        // The original tenant's entitlements stay code-driven so a stale DB
        // row can never hide newly shipped modules (learned the hard way).
        enabledModules:
          r.id === DEFAULT_COMPANY_ID
            ? DEMO_TENANT.enabledModules
            : ((r.enabled_modules ?? []) as Tenant["enabledModules"]),
      };
    }
  }
  return { ...DEMO_TENANT };
}

/**
 * Per-company app_settings row (key + jsonb value). Falls back to the
 * unscoped legacy query/write until migration-v7 adds the company column.
 */
export async function loadSetting<T>(
  companyId: string,
  key: string
): Promise<{ value: T | null; persisted: boolean }> {
  const supabase = getSupabase();
  if (!supabase) return { value: null, persisted: false };
  let { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .eq("company_id", companyId)
    .maybeSingle();
  if (error && missingCompanyColumn(error.message)) {
    ({ data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle());
  }
  if (error) return { value: null, persisted: false };
  return { value: (data?.value as T) ?? null, persisted: true };
}

export async function saveSetting(companyId: string, key: string, value: unknown): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Database not configured.");
  let { error } = await supabase.from("app_settings").upsert({ company_id: companyId, key, value });
  if (error && missingCompanyColumn(error.message)) {
    ({ error } = await supabase.from("app_settings").upsert({ key, value }));
  }
  if (error) throw new Error(`Save failed: ${error.message}`);
}

/** Active companies (for platform-wide jobs like the daily recap). */
export async function listActiveCompanyIds(): Promise<string[]> {
  const supabase = getSupabase();
  if (!supabase) return [DEFAULT_COMPANY_ID];
  const { data, error } = await supabase.from("companies").select("id").eq("active", true);
  if (error || !data || data.length === 0) return [DEFAULT_COMPANY_ID];
  return (data as { id: string }[]).map((r) => r.id);
}
