import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { logAdminAction, sessionFromRequest } from "@/lib/company";

export const runtime = "nodejs";

/**
 * Platform admin console data: every company with usage at a glance, plus
 * onboarding (create a company + its owner login in one step).
 * LMA staff only (profiles.platform_admin).
 */

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
}

function tempPassword(): string {
  const words = ["Fleet", "Route", "Cargo", "Depot", "Miles"];
  return `${words[Math.floor(Math.random() * words.length)]}-${Math.floor(1000 + Math.random() * 9000)}-Assist`;
}

export async function GET(request: Request) {
  const session = await sessionFromRequest(request);
  if (!session?.platformAdmin) {
    return NextResponse.json({ error: "Platform admin only." }, { status: 403 });
  }
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Database not configured." }, { status: 503 });

  const { data: companies, error } = await supabase
    .from("companies")
    .select("id, name, slug, theme_color, active, driver_key, created_at")
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = [];
  for (const c of companies ?? []) {
    const [users, inspections, vans, lastInsp] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("company_id", c.id),
      supabase.from("inspections").select("id", { count: "exact", head: true }).eq("company_id", c.id),
      supabase.from("vans").select("id", { count: "exact", head: true }).eq("company_id", c.id),
      supabase
        .from("inspections")
        .select("created_at")
        .eq("company_id", c.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    rows.push({
      id: c.id,
      name: c.name,
      slug: c.slug,
      themeColor: c.theme_color,
      active: c.active,
      driverKey: c.driver_key,
      createdAt: c.created_at,
      users: users.count ?? 0,
      inspections: inspections.count ?? 0,
      vans: vans.count ?? 0,
      lastActivity: lastInsp.data?.created_at ?? null,
    });
  }
  return NextResponse.json({ companies: rows });
}

export async function POST(request: Request) {
  const session = await sessionFromRequest(request);
  if (!session?.platformAdmin) {
    return NextResponse.json({ error: "Platform admin only." }, { status: 403 });
  }
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Database not configured." }, { status: 503 });

  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    slug?: string;
    themeColor?: string;
    ownerName?: string;
    ownerEmail?: string;
  };
  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: "Company name is required." }, { status: 400 });
  const slug = slugify(body.slug?.trim() || name);
  if (!slug) return NextResponse.json({ error: "Company slug is required." }, { status: 400 });

  const driverKey = `${slug}-fleet-${Math.floor(1000 + Math.random() * 9000)}`;
  const { error: coErr } = await supabase.from("companies").insert({
    id: slug,
    name,
    slug,
    theme_color: body.themeColor?.trim() || "#0E7C5A",
    driver_key: driverKey,
    active: true,
  });
  if (coErr) {
    return NextResponse.json(
      { error: /duplicate/i.test(coErr.message) ? "A company with that ID already exists." : coErr.message },
      { status: 409 }
    );
  }

  // Optional: the company owner's login, created in the same step.
  let owner: { email: string; tempPassword: string } | null = null;
  const ownerEmail = body.ownerEmail?.trim().toLowerCase();
  if (ownerEmail && body.ownerName?.trim()) {
    const password = tempPassword();
    const { data: created, error: userErr } = await supabase.auth.admin.createUser({
      email: ownerEmail,
      password,
      email_confirm: true,
    });
    if (!userErr && created.user) {
      const { error: profErr } = await supabase.from("profiles").insert({
        id: created.user.id,
        company_id: slug,
        email: ownerEmail,
        name: body.ownerName.trim(),
        role: "owner",
        admin: false,
        active: true,
      });
      if (!profErr) owner = { email: ownerEmail, tempPassword: password };
    }
    if (!owner) {
      await logAdminAction(session.email, "create_company_owner_failed", slug, userErr?.message);
    }
  }

  await logAdminAction(session.email, "create_company", slug, name);
  return NextResponse.json({ ok: true, companyId: slug, driverKey, owner });
}

/** PATCH: activate / suspend a company (suspension blocks its logins). */
export async function PATCH(request: Request) {
  const session = await sessionFromRequest(request);
  if (!session?.platformAdmin) {
    return NextResponse.json({ error: "Platform admin only." }, { status: 403 });
  }
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  const body = (await request.json().catch(() => ({}))) as { id?: string; active?: boolean };
  if (!body.id || typeof body.active !== "boolean") {
    return NextResponse.json({ error: "Company id and status are required." }, { status: 400 });
  }
  const { error } = await supabase.from("companies").update({ active: body.active }).eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAdminAction(session.email, body.active ? "activate_company" : "suspend_company", body.id);
  return NextResponse.json({ ok: true });
}
