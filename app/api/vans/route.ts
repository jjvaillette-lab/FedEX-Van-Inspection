import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { listInspections } from "@/lib/storage";
import type { VanRecord } from "@/lib/types";

export const runtime = "nodejs";

const MIGRATION_MSG =
  "Database update required: run supabase/migration-v6.sql in the Supabase SQL editor.";

interface Row {
  id: string;
  vin: string | null;
  make: string | null;
  model: string | null;
  year: string | null;
  plate: string | null;
  active: boolean;
  status_reason: string | null;
  status_changed_at: string | null;
}

const rowToVan = (r: Row): VanRecord => ({
  id: r.id,
  vin: r.vin,
  make: r.make,
  model: r.model,
  year: r.year,
  plate: r.plate,
  active: r.active,
  statusReason: r.status_reason,
  statusChangedAt: r.status_changed_at,
});

/**
 * GET: the full van list — registry rows merged with every van that appears
 * in DVIRs (auto-discovered), plus the latest DVIR mileage per van.
 */
export async function GET() {
  const supabase = getSupabase();

  let registry: VanRecord[] = [];
  let persisted = false;
  if (supabase) {
    const { data, error } = await supabase.from("vans").select("*");
    if (!error) {
      registry = (data as Row[]).map(rowToVan);
      persisted = true;
    }
  }

  // Discover vans + latest mileage from inspections.
  const inspections = await listInspections().catch(() => []);
  const seen = new Map<string, { lastDvir: string; mileage: number | null; mileageAsOf: string | null }>();
  for (const i of inspections) {
    const e = seen.get(i.vanId) ?? { lastDvir: i.createdAt, mileage: null, mileageAsOf: null };
    if (i.createdAt > e.lastDvir) e.lastDvir = i.createdAt;
    const m = i.answers.find(
      (a) => (a.questionId === "mileage_end" || a.questionId === "mileage_begin") && /^\d+$/.test(a.value)
    );
    if (m && (e.mileageAsOf == null || i.createdAt > e.mileageAsOf)) {
      e.mileage = parseInt(m.value, 10);
      e.mileageAsOf = i.createdAt;
    }
    seen.set(i.vanId, e);
  }

  const byId = new Map<string, VanRecord>();
  for (const v of registry) byId.set(v.id, v);
  for (const [id, info] of seen) {
    const existing = byId.get(id);
    if (existing) {
      existing.mileage = info.mileage;
      existing.mileageAsOf = info.mileageAsOf;
      existing.lastDvir = info.lastDvir;
    } else {
      byId.set(id, {
        id,
        active: true,
        unregistered: true,
        mileage: info.mileage,
        mileageAsOf: info.mileageAsOf,
        lastDvir: info.lastDvir,
      });
    }
  }

  const vans = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  return NextResponse.json({ vans, persisted, ...(persisted ? {} : { error: MIGRATION_MSG }) });
}

/** PUT: create/update a van's details. */
export async function PUT(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Partial<VanRecord>;
  if (!body.id?.trim()) return NextResponse.json({ error: "Van ID is required." }, { status: 400 });
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  const { error } = await supabase.from("vans").upsert({
    id: body.id.trim(),
    vin: body.vin?.trim() || null,
    make: body.make?.trim() || null,
    model: body.model?.trim() || null,
    year: body.year?.trim() || null,
    plate: body.plate?.trim() || null,
    ...(typeof body.active === "boolean" ? { active: body.active } : {}),
  });
  if (error) {
    return NextResponse.json(
      { error: /relation|schema cache/i.test(error.message) ? MIGRATION_MSG : `Save failed: ${error.message}` },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}

/** PATCH: activate / inactivate a van. */
export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    active?: boolean;
    reason?: string;
  };
  if (!body.id?.trim() || typeof body.active !== "boolean") {
    return NextResponse.json({ error: "Van ID and status are required." }, { status: 400 });
  }
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  const { error } = await supabase.from("vans").upsert({
    id: body.id.trim(),
    active: body.active,
    status_reason: body.active ? null : body.reason?.trim() || "Taken out of service",
    status_changed_at: new Date().toISOString(),
  });
  if (error) {
    return NextResponse.json(
      { error: /relation|schema cache/i.test(error.message) ? MIGRATION_MSG : `Update failed: ${error.message}` },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
