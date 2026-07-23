import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { companyFromRequest, loadSetting, missingCompanyColumn, saveSetting } from "@/lib/company";
import { DEFAULT_OPS, type DriverDay, type OpsSettings } from "@/lib/opstats";

export const runtime = "nodejs";

const MIGRATION_MSG =
  "Database update required: run supabase/migration-v5.sql in the Supabase SQL editor.";

interface Row {
  date: string;
  driver: string;
  vehicle: string | null;
  route: string | null;
  vscan_pkgs: number;
  del_stops: number;
  pu_stops: number;
  diff: number;
  act_del_stops: number;
  act_del_pkgs: number;
  act_pu_stops: number;
  act_pu_pkgs: number;
  miles: number | string;
  on_road_hours: number | string;
  on_duty_hours: number | string;
}

const toDay = (r: Row): DriverDay => ({
  date: r.date,
  driver: r.driver,
  vehicle: r.vehicle,
  route: r.route,
  vscanPkgs: r.vscan_pkgs,
  delStops: r.del_stops,
  puStops: r.pu_stops,
  diff: r.diff,
  actDelStops: r.act_del_stops,
  actDelPkgs: r.act_del_pkgs,
  actPuStops: r.act_pu_stops,
  actPuPkgs: r.act_pu_pkgs,
  miles: Number(r.miles) || 0,
  onRoadHours: Number(r.on_road_hours) || 0,
  onDutyHours: Number(r.on_duty_hours) || 0,
});

const toRow = (d: DriverDay) => ({
  date: d.date,
  driver: d.driver.trim(),
  vehicle: d.vehicle || null,
  route: d.route || null,
  vscan_pkgs: Math.round(Number(d.vscanPkgs) || 0),
  del_stops: Math.round(Number(d.delStops) || 0),
  pu_stops: Math.round(Number(d.puStops) || 0),
  diff: Math.round(Number(d.diff) || 0),
  act_del_stops: Math.round(Number(d.actDelStops) || 0),
  act_del_pkgs: Math.round(Number(d.actDelPkgs) || 0),
  act_pu_stops: Math.round(Number(d.actPuStops) || 0),
  act_pu_pkgs: Math.round(Number(d.actPuPkgs) || 0),
  // Odometer readings sometimes land in the Miles column — cap at a
  // plausible daily figure and treat the rest as missing.
  miles: (() => {
    const n = Number(d.miles) || 0;
    return n > 600 || n < 0 ? 0 : n;
  })(),
  on_road_hours: Number(d.onRoadHours) || 0,
  on_duty_hours: Number(d.onDutyHours) || 0,
});

async function loadOps(companyId: string): Promise<OpsSettings> {
  const { value } = await loadSetting<Partial<OpsSettings>>(companyId, "opstats");
  return { ...DEFAULT_OPS, ...(value ?? {}) };
}

export async function GET(request: Request) {
  const supabase = getSupabase();
  const companyId = await companyFromRequest(request);
  const settings = await loadOps(companyId);
  if (!supabase) return NextResponse.json({ rows: [], settings, persisted: false });

  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const build = (scoped: boolean) => {
    let query = supabase.from("driver_stats").select("*").order("date", { ascending: false });
    if (scoped) query = query.eq("company_id", companyId);
    if (from) query = query.gte("date", from);
    if (to) query = query.lte("date", to);
    return query;
  };
  let { data, error } = await build(true);
  if (error && missingCompanyColumn(error.message)) {
    ({ data, error } = await build(false));
  }
  if (error) {
    return NextResponse.json({ rows: [], settings, persisted: false, error: MIGRATION_MSG });
  }
  return NextResponse.json({ rows: (data as Row[]).map(toDay), settings, persisted: true });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { rows?: DriverDay[] };
  if (!Array.isArray(body.rows) || body.rows.length === 0) {
    return NextResponse.json({ error: "No rows to import." }, { status: 400 });
  }
  for (const r of body.rows) {
    if (!r.date || !/^\d{4}-\d{2}-\d{2}$/.test(r.date) || !r.driver?.trim()) {
      return NextResponse.json(
        { error: "Every row needs a date (YYYY-MM-DD) and a driver name." },
        { status: 400 }
      );
    }
  }
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Database not configured." }, { status: 503 });

  // Re-importing a day overwrites that driver's row for the day.
  const companyId = await companyFromRequest(request);
  let { error } = await supabase
    .from("driver_stats")
    .upsert(
      body.rows.map((r) => ({ ...toRow(r), company_id: companyId })),
      { onConflict: "company_id,date,driver" }
    );
  if (error && /company_id|schema cache|column|constraint|conflict/i.test(error.message)) {
    ({ error } = await supabase
      .from("driver_stats")
      .upsert(body.rows.map(toRow), { onConflict: "date,driver" }));
  }
  if (error) {
    return NextResponse.json(
      { error: /relation|schema cache/i.test(error.message) ? MIGRATION_MSG : `Import failed: ${error.message}` },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, imported: body.rows.length });
}

export async function PUT(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { settings?: OpsSettings };
  const s = body.settings;
  if (
    !s ||
    typeof s.bonusThreshold !== "number" ||
    typeof s.bonusRate !== "number" ||
    s.bonusThreshold < 0 ||
    s.bonusRate < 0
  ) {
    return NextResponse.json(
      { error: "Both a per-stop dollar amount and an 'earned after stop #' are required." },
      { status: 400 }
    );
  }
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  const clean: OpsSettings = {
    weekStart: Math.min(6, Math.max(0, Math.round(s.weekStart ?? 0))),
    bonusThreshold: Math.round(s.bonusThreshold),
    bonusRate: s.bonusRate,
    payroll: s.payroll === "biweekly" ? "biweekly" : "weekly",
    payrollAnchor: /^\d{4}-\d{2}-\d{2}$/.test(s.payrollAnchor ?? "") ? s.payrollAnchor : DEFAULT_OPS.payrollAnchor,
  };
  try {
    await saveSetting(await companyFromRequest(request), "opstats", clean);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Save failed" },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, settings: clean });
}

export async function DELETE(request: Request) {
  const date = new URL(request.url).searchParams.get("date");
  if (!date) return NextResponse.json({ error: "Missing date" }, { status: 400 });
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  const companyId = await companyFromRequest(request);
  let { error } = await supabase
    .from("driver_stats")
    .delete()
    .eq("date", date)
    .eq("company_id", companyId);
  if (error && missingCompanyColumn(error.message)) {
    ({ error } = await supabase.from("driver_stats").delete().eq("date", date));
  }
  if (error) return NextResponse.json({ error: `Delete failed: ${error.message}` }, { status: 500 });
  return NextResponse.json({ ok: true });
}
