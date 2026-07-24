import { getSupabase } from "./supabase";
import { listInspections } from "./storage";
import { loadSetting, missingCompanyColumn } from "./company";
import { combinedStops, dailyBonus, DEFAULT_OPS, type DriverDay, type OpsSettings } from "./opstats";

/**
 * Report engine (server-side). One place builds every report the platform
 * offers, as {title, columns, rows} — the Reports page previews it, exports
 * come straight from it, and the morning cron emails it as a CSV attachment.
 */

export type ReportType = "inspections" | "driver-stats" | "maintenance" | "vans";

export interface ReportData {
  type: ReportType;
  title: string;
  /** Human date-range line ("7/18/2026 – 7/23/2026" or "Current snapshot"). */
  rangeLabel: string;
  columns: string[];
  rows: (string | number)[][];
}

export const REPORT_TYPES: { type: ReportType; label: string; dated: boolean }[] = [
  { type: "inspections", label: "Inspections / DVIR history", dated: true },
  { type: "driver-stats", label: "Driver stats & bonuses", dated: true },
  { type: "maintenance", label: "Maintenance & costs", dated: true },
  { type: "vans", label: "Van list & status", dated: false },
];

export interface ReportParams {
  from?: string; // YYYY-MM-DD inclusive
  to?: string;
  van?: string;
  driver?: string;
}

const day = (iso: string) => new Date(iso).toLocaleDateString("en-US");
const displayRange = (p: ReportParams) =>
  p.from || p.to
    ? `${p.from ? day(`${p.from}T12:00:00`) : "…"} – ${p.to ? day(`${p.to}T12:00:00`) : "today"}`
    : "All time";

export async function buildReport(
  companyId: string,
  type: ReportType,
  params: ReportParams
): Promise<ReportData> {
  switch (type) {
    case "inspections":
      return inspectionsReport(companyId, params);
    case "driver-stats":
      return driverStatsReport(companyId, params);
    case "maintenance":
      return maintenanceReport(companyId, params);
    case "vans":
      return vansReport(companyId);
    default:
      throw new Error("Unknown report type");
  }
}

/* ---------------- inspections ---------------- */

async function inspectionsReport(companyId: string, p: ReportParams): Promise<ReportData> {
  const all = await listInspections(companyId);
  const fromT = p.from ? new Date(`${p.from}T00:00:00`).getTime() : -Infinity;
  const toT = p.to ? new Date(`${p.to}T23:59:59`).getTime() : Infinity;
  const rows = all
    .filter((i) => {
      const t = new Date(i.createdAt).getTime();
      if (t < fromT || t > toT) return false;
      if (p.van && !i.vanId.toLowerCase().includes(p.van.toLowerCase())) return false;
      if (p.driver && !(i.driver.name ?? i.driver.raw).toLowerCase().includes(p.driver.toLowerCase()))
        return false;
      return true;
    })
    .map((i) => {
      const issues = i.answers.filter((a) => a.value === "issue");
      return [
        day(i.createdAt),
        new Date(i.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
        i.vanId,
        i.driver.name ?? i.driver.raw,
        i.driver.route ?? "",
        i.tripType === "post" ? "Post-trip" : "Pre-trip",
        i.status === "failed_inspection" ? "Incomplete" : i.status === "flagged" ? "Issues reported" : "Passed",
        issues.length,
        issues.map((a) => a.questionId.replace(/_/g, " ") + (a.note ? ` (${a.note})` : "")).join("; "),
        i.resolution ? `Yes — ${i.resolution.resolvedBy}, ${day(i.resolution.resolvedAt)}` : issues.length > 0 ? "Open" : "",
        i.photos.length,
      ];
    });
  return {
    type: "inspections",
    title: "Inspections / DVIR history",
    rangeLabel: displayRange(p),
    columns: ["Date", "Time", "Van", "Driver", "Route", "Trip", "Status", "Issues", "Issue detail", "Resolved", "Photos"],
    rows,
  };
}

/* ---------------- driver stats ---------------- */

interface StatsRow {
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

async function driverStatsReport(companyId: string, p: ReportParams): Promise<ReportData> {
  const supabase = getSupabase();
  const empty: ReportData = {
    type: "driver-stats",
    title: "Driver stats & bonuses",
    rangeLabel: displayRange(p),
    columns: [],
    rows: [],
  };
  if (!supabase) return empty;

  const { value: opsValue } = await loadSetting<Partial<OpsSettings>>(companyId, "opstats");
  const ops: OpsSettings = { ...DEFAULT_OPS, ...(opsValue ?? {}) };

  const build = (scoped: boolean) => {
    let q = supabase.from("driver_stats").select("*").order("date", { ascending: true });
    if (scoped) q = q.eq("company_id", companyId);
    if (p.from) q = q.gte("date", p.from);
    if (p.to) q = q.lte("date", p.to);
    return q;
  };
  let { data, error } = await build(true);
  if (error && missingCompanyColumn(error.message)) ({ data, error } = await build(false));
  if (error || !data) return empty;

  const rows = (data as StatsRow[])
    .filter((r) => !p.driver || r.driver.toLowerCase().includes(p.driver.toLowerCase()))
    .map((r) => {
      const d: DriverDay = {
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
      };
      const stops = combinedStops(d);
      const pct = d.vscanPkgs > 0 ? Math.round((d.actDelPkgs / d.vscanPkgs) * 1000) / 10 : 0;
      const sph = d.onRoadHours > 0 ? Math.round((stops / d.onRoadHours) * 10) / 10 : 0;
      return [
        day(`${d.date}T12:00:00`),
        d.driver,
        d.vehicle ?? "",
        d.route ?? "",
        d.vscanPkgs,
        d.actDelPkgs,
        `${pct}%`,
        stops,
        sph,
        d.miles,
        d.onRoadHours,
        d.onDutyHours,
        Math.round(dailyBonus(d, ops) * 100) / 100,
      ];
    });

  return {
    ...empty,
    columns: ["Date", "Driver", "Vehicle", "Route", "Dispatched", "Delivered", "Delivery %", "Stops", "Stops/Hr", "Miles", "On-Road Hrs", "On-Duty Hrs", "Bonus $"],
    rows,
  };
}

/* ---------------- maintenance ---------------- */

interface MaintRow {
  date: string;
  van_id: string;
  category: string;
  description: string;
  mileage: number | null;
  cost: number | string;
  receipt_url: string | null;
  created_by: string | null;
}

async function maintenanceReport(companyId: string, p: ReportParams): Promise<ReportData> {
  const supabase = getSupabase();
  const empty: ReportData = {
    type: "maintenance",
    title: "Maintenance & costs",
    rangeLabel: displayRange(p),
    columns: [],
    rows: [],
  };
  if (!supabase) return empty;

  const build = (scoped: boolean) => {
    let q = supabase.from("maintenance").select("*").order("date", { ascending: true });
    if (scoped) q = q.eq("company_id", companyId);
    if (p.from) q = q.gte("date", p.from);
    if (p.to) q = q.lte("date", p.to);
    if (p.van) q = q.ilike("van_id", `%${p.van}%`);
    return q;
  };
  let { data, error } = await build(true);
  if (error && missingCompanyColumn(error.message)) ({ data, error } = await build(false));
  if (error || !data) return empty;

  const rows = (data as MaintRow[]).map((r) => [
    day(`${r.date}T12:00:00`),
    r.van_id,
    r.category,
    r.description,
    r.mileage ?? "",
    Math.round((Number(r.cost) || 0) * 100) / 100,
    r.receipt_url ? "Yes" : "",
    r.created_by ?? "",
  ]);

  return {
    ...empty,
    columns: ["Date", "Van", "Category", "Work performed", "Mileage", "Cost $", "Receipt", "Logged by"],
    rows,
  };
}

/* ---------------- van list ---------------- */

interface VanRow {
  id: string;
  vin: string | null;
  make: string | null;
  model: string | null;
  year: string | null;
  plate: string | null;
  active: boolean;
  status_reason: string | null;
}

async function vansReport(companyId: string): Promise<ReportData> {
  const supabase = getSupabase();
  const empty: ReportData = {
    type: "vans",
    title: "Van list & status",
    rangeLabel: "Current snapshot",
    columns: [],
    rows: [],
  };
  if (!supabase) return empty;

  let { data, error } = await supabase.from("vans").select("*").eq("company_id", companyId);
  if (error && missingCompanyColumn(error.message)) {
    ({ data, error } = await supabase.from("vans").select("*"));
  }
  const registry = error || !data ? [] : (data as VanRow[]);

  // Latest DVIR mileage + activity per van.
  const inspections = await listInspections(companyId).catch(() => []);
  const info = new Map<string, { mileage: number | null; asOf: string | null; last: string }>();
  for (const i of inspections) {
    const e = info.get(i.vanId) ?? { mileage: null, asOf: null, last: i.createdAt };
    if (i.createdAt > e.last) e.last = i.createdAt;
    const m = i.answers.find(
      (a) => (a.questionId === "mileage_end" || a.questionId === "mileage_begin") && /^\d+$/.test(a.value)
    );
    if (m && (e.asOf == null || i.createdAt > e.asOf)) {
      e.mileage = parseInt(m.value, 10);
      e.asOf = i.createdAt;
    }
    info.set(i.vanId, e);
  }

  // Maintenance totals per van.
  const totals = new Map<string, number>();
  {
    let { data: m, error: mErr } = await supabase
      .from("maintenance")
      .select("van_id, cost")
      .eq("company_id", companyId);
    if (mErr && missingCompanyColumn(mErr.message)) {
      ({ data: m } = await supabase.from("maintenance").select("van_id, cost"));
    }
    for (const r of (m ?? []) as { van_id: string; cost: number | string }[]) {
      totals.set(r.van_id, (totals.get(r.van_id) ?? 0) + (Number(r.cost) || 0));
    }
  }

  const ids = new Set<string>([...registry.map((v) => v.id), ...info.keys()]);
  const byId = new Map(registry.map((v) => [v.id, v]));
  const rows = [...ids]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((id) => {
      const v = byId.get(id);
      const i = info.get(id);
      return [
        id,
        v ? (v.active ? "Active" : "Inactive") : "Active",
        v?.status_reason ?? "",
        v?.vin ?? "",
        v?.year ?? "",
        v?.make ?? "",
        v?.model ?? "",
        v?.plate ?? "",
        i?.mileage ?? "",
        i?.asOf ? day(i.asOf) : "",
        Math.round((totals.get(id) ?? 0) * 100) / 100,
        i?.last ? day(i.last) : "",
      ];
    });

  return {
    ...empty,
    columns: ["Van", "Status", "Status reason", "VIN", "Year", "Make", "Model", "Plate", "Mileage", "Mileage as of", "Maintenance total $", "Last DVIR"],
    rows,
  };
}

/* ---------------- CSV ---------------- */

export function reportToCsv(r: ReportData): string {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [r.columns.map(esc).join(","), ...r.rows.map((row) => row.map(esc).join(","))].join("\n");
}
