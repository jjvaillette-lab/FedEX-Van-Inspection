import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import {
  companyFromRequest,
  loadSetting,
  saveSetting,
  sessionFromRequest,
} from "@/lib/company";
import { DEFAULT_MANAGERS, type ManagerRecord } from "@/lib/tenant";

export const runtime = "nodejs";

/**
 * Managers for the signed-in company.
 *
 * Source of truth after migration-v7: `profiles` rows (real logins). Managers
 * added before provisioning live in app_settings (key "managers") until the
 * owner clicks "Create login". GET merges both; PUT saves tab/permission edits
 * to whichever store each manager lives in; POST provisions/reset/disables
 * real accounts (requires a real owner/admin session).
 */

interface ProfileManagerRow {
  id: string;
  email: string;
  name: string;
  admin: boolean;
  tabs: ManagerRecord["tabs"] | null;
  permissions: ManagerRecord["permissions"] | null;
  active: boolean;
  role: string;
}

async function profileManagers(companyId: string): Promise<ManagerRecord[] | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, name, admin, tabs, permissions, active, role")
    .eq("company_id", companyId)
    .eq("role", "manager");
  if (error) return null; // table not migrated yet
  return (data as ProfileManagerRow[]).map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    admin: !!r.admin,
    tabs: r.tabs ?? [],
    permissions: r.permissions ?? [],
    hasLogin: true,
    active: r.active !== false,
  }));
}

async function loadManagers(
  companyId: string
): Promise<{ managers: ManagerRecord[]; persisted: boolean }> {
  const withLogins = (await profileManagers(companyId)) ?? [];
  const { value, persisted } = await loadSetting<ManagerRecord[]>(companyId, "managers");

  let legacy: ManagerRecord[];
  if (value) {
    legacy = value;
  } else if (persisted && withLogins.length === 0) {
    // First use: seed the demo list so edits start from a stored list.
    try {
      await saveSetting(companyId, "managers", DEFAULT_MANAGERS);
    } catch {
      /* ignore */
    }
    legacy = DEFAULT_MANAGERS;
  } else {
    legacy = [];
  }

  const loginEmails = new Set(withLogins.map((m) => m.email.toLowerCase()));
  const merged = [
    ...withLogins,
    ...legacy
      .filter((m) => !loginEmails.has(m.email.trim().toLowerCase()))
      .map((m) => ({ ...m, hasLogin: false, active: true })),
  ];
  return { managers: merged, persisted };
}

export async function GET(request: Request) {
  const result = await loadManagers(await companyFromRequest(request));
  return NextResponse.json(result);
}

export async function PUT(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { managers?: ManagerRecord[] };
  if (!Array.isArray(body.managers)) {
    return NextResponse.json({ error: "Invalid manager list" }, { status: 400 });
  }
  for (const m of body.managers) {
    if (!m.id || !m.name?.trim() || !m.email?.trim()) {
      return NextResponse.json({ error: "Every manager needs a name and email." }, { status: 400 });
    }
  }
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }
  const companyId = await companyFromRequest(request);

  // Split: provisioned managers update their profile; the rest stay in app_settings.
  const withLogin = body.managers.filter((m) => m.hasLogin);
  const legacy = body.managers
    .filter((m) => !m.hasLogin)
    .map(({ hasLogin: _h, active: _a, ...rest }) => rest);

  try {
    for (const m of withLogin) {
      await supabase
        .from("profiles")
        .update({
          name: m.name.trim(),
          admin: !!m.admin,
          tabs: m.tabs ?? [],
          permissions: m.permissions ?? [],
        })
        .eq("id", m.id)
        .eq("company_id", companyId)
        .eq("role", "manager");
    }
    await saveSetting(companyId, "managers", legacy);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Save failed" },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}

/* ---- real-account provisioning ---- */

function tempPassword(): string {
  const words = ["Fleet", "Route", "Cargo", "Depot", "Miles"];
  const w = words[Math.floor(Math.random() * words.length)];
  return `${w}-${Math.floor(1000 + Math.random() * 9000)}-Assist`;
}

type PostBody = {
  action?: "provision" | "reset" | "deactivate" | "reactivate";
  id?: string;
  name?: string;
  email?: string;
  admin?: boolean;
  tabs?: ManagerRecord["tabs"];
  permissions?: ManagerRecord["permissions"];
};

export async function POST(request: Request) {
  const session = await sessionFromRequest(request);
  if (!session || (session.role !== "owner" && !session.admin)) {
    return NextResponse.json(
      { error: "Creating logins requires the owner to be signed in with their personal account." },
      { status: 403 }
    );
  }
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Database not configured." }, { status: 503 });

  const body = (await request.json().catch(() => ({}))) as PostBody;
  const companyId = session.companyId;

  if (body.action === "provision") {
    const email = body.email?.trim().toLowerCase();
    const name = body.name?.trim();
    if (!email || !name) {
      return NextResponse.json({ error: "Name and email are required." }, { status: 400 });
    }

    // Find or create the auth user.
    const password = tempPassword();
    let userId: string | null = null;
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (!createErr) {
      userId = created.user?.id ?? null;
    } else if (/already|registered|exists/i.test(createErr.message)) {
      const { data: list } = await supabase.auth.admin.listUsers();
      const existing = list?.users.find((u) => u.email?.toLowerCase() === email);
      if (existing) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("id, company_id")
          .eq("id", existing.id)
          .maybeSingle();
        if (prof && prof.company_id !== companyId) {
          return NextResponse.json(
            { error: "That email already has a login with a different company." },
            { status: 409 }
          );
        }
        if (prof) {
          return NextResponse.json(
            { error: "That manager already has a login — use Reset password instead." },
            { status: 409 }
          );
        }
        userId = existing.id;
        await supabase.auth.admin.updateUserById(existing.id, { password });
      }
    }
    if (!userId) {
      return NextResponse.json(
        { error: `Couldn't create the login: ${createErr?.message ?? "unknown error"}` },
        { status: 500 }
      );
    }

    const { error: profErr } = await supabase.from("profiles").upsert({
      id: userId,
      company_id: companyId,
      email,
      name,
      role: "manager",
      admin: !!body.admin,
      tabs: body.tabs ?? [],
      permissions: body.permissions ?? [],
      active: true,
    });
    if (profErr) {
      return NextResponse.json({ error: `Login created but the profile save failed: ${profErr.message}` }, { status: 500 });
    }

    // Clean the legacy list entry for this email, if any.
    try {
      const { value } = await loadSetting<ManagerRecord[]>(companyId, "managers");
      if (value?.some((m) => m.email.trim().toLowerCase() === email)) {
        await saveSetting(
          companyId,
          "managers",
          value.filter((m) => m.email.trim().toLowerCase() !== email)
        );
      }
    } catch {
      /* non-fatal */
    }

    return NextResponse.json({ ok: true, tempPassword: password });
  }

  // Remaining actions operate on an existing provisioned manager.
  if (!body.id) return NextResponse.json({ error: "Missing manager id." }, { status: 400 });
  const { data: prof, error: profErr } = await supabase
    .from("profiles")
    .select("id, company_id, role")
    .eq("id", body.id)
    .maybeSingle();
  if (profErr || !prof) return NextResponse.json({ error: "Manager not found." }, { status: 404 });
  if (prof.company_id !== companyId && !session.platformAdmin) {
    return NextResponse.json({ error: "Manager not found." }, { status: 404 });
  }

  if (body.action === "reset") {
    const password = tempPassword();
    const { error } = await supabase.auth.admin.updateUserById(body.id, { password });
    if (error) return NextResponse.json({ error: `Reset failed: ${error.message}` }, { status: 500 });
    return NextResponse.json({ ok: true, tempPassword: password });
  }

  if (body.action === "deactivate" || body.action === "reactivate") {
    const { error } = await supabase
      .from("profiles")
      .update({ active: body.action === "reactivate" })
      .eq("id", body.id);
    if (error) return NextResponse.json({ error: `Update failed: ${error.message}` }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
