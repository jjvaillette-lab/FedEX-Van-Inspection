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

export type RowKind = "data" | "subtotal" | "total";

export interface ReportData {
  type: ReportType;
  title: string;
  /** Human date-range line ("7/18/2026 – 7/23/2026" or "Current snapshot"). */
  rangeLabel: string;
  columns: string[];
  rows: (string | number)[][];
  /** Parallel to rows — lets viewers style subtotal/total lines. */
  rowKinds?: RowKind[];
  mode?: "summary" | "detail";
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
  /** summary = one line per driver/van with totals; detail = every day,
   *  grouped with subtotals. Defaults to detail. */
  mode?: "summary" | "detail";
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;
const pct = (num: number, den: number) => (den > 0 ? `${r1((num / den) * 100)}%` : "");

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
  const matched = all.filter((i) => {
    const t = new Date(i.createdAt).getTime();
    if (t < fromT || t > toT) return false;
    if (p.van && !i.vanId.toLowerCase().includes(p.van.toLowerCase())) return false;
    if (p.driver && !(i.driver.name ?? i.driver.raw).toLowerCase().includes(p.driver.toLowerCase()))
      return false;
    return true;
  });

  const base = {
    type: "inspections" as const,
    title: "Inspections / DVIR history",
    rangeLabel: displayRange(p),
  };

  if (p.mode === "summary") {
    // One line per van over the range.
    const byVan = new Map<string, typeof matched>();
    for (const i of matched) {
      const list = byVan.get(i.vanId) ?? [];
      list.push(i);
      byVan.set(i.vanId, list);
    }
    const vans = [...byVan.keys()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const rows: (string | number)[][] = [];
    const rowKinds: RowKind[] = [];
    const count = (list: typeof matched) => ({
      checks: list.length,
      pre: list.filter((i) => i.tripType === "pre").length,
      post: list.filter((i) => i.tripType === "post").length,
      passed: list.filter((i) => i.status === "passed").length,
      flagged: list.filter((i) => i.status === "flagged").length,
      incomplete: list.filter((i) => i.status === "failed_inspection").length,
      open: list.filter((i) => i.status === "flagged" && !i.resolution).length,
      photos: list.reduce((s, i) => s + i.photos.length, 0),
    });
    for (const van of vans) {
      const c = count(byVan.get(van)!);
      rows.push([van, c.checks, c.pre, c.post, c.passed, c.flagged, c.incomplete, c.open, c.photos]);
      rowKinds.push("data");
    }
    const t = count(matched);
    rows.push([
      `TOTAL — ${vans.length} vans`, t.checks, t.pre, t.post, t.passed, t.flagged, t.incomplete, t.open, t.photos,
    ]);
    rowKinds.push("total");
    return {
      ...base,
      mode: "summary",
      columns: ["Van", "Checks", "Pre-trips", "Post-trips", "Passed", "With issues", "Incomplete", "Open issues", "Photos"],
      rows,
      rowKinds,
    };
  }

  const rows = matched.map((i) => {
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
    ...base,
    mode: "detail",
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

  const days = (data as StatsRow[])
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
      return { d, stops: combinedStops(d), bonus: dailyBonus(d, ops) };
    });

  // Group by driver — every driver gets its own totals, always.
  const byDriver = new Map<string, typeof days>();
  for (const e of days) {
    const list = byDriver.get(e.d.driver) ?? [];
    list.push(e);
    byDriver.set(e.d.driver, list);
  }
  const drivers = [...byDriver.keys()].sort();

  const sum = (list: typeof days) => ({
    days: list.length,
    dispatched: list.reduce((s, e) => s + e.d.vscanPkgs, 0),
    delivered: list.reduce((s, e) => s + e.d.actDelPkgs, 0),
    stops: list.reduce((s, e) => s + e.stops, 0),
    miles: r1(list.reduce((s, e) => s + e.d.miles, 0)),
    road: r2(list.reduce((s, e) => s + e.d.onRoadHours, 0)),
    duty: r2(list.reduce((s, e) => s + e.d.onDutyHours, 0)),
    bonus: r2(list.reduce((s, e) => s + e.bonus, 0)),
  });
  const all = sum(days);

  if (p.mode === "summary") {
    // One line per driver over the whole range.
    const rows: (string | number)[][] = [];
    const rowKinds: RowKind[] = [];
    for (const driver of drivers) {
      const t = sum(byDriver.get(driver)!);
      rows.push([
        driver, t.days, t.dispatched, t.delivered, pct(t.delivered, t.dispatched),
        t.stops, t.road > 0 ? r1(t.stops / t.road) : "", t.miles, t.road, t.duty, t.bonus,
      ]);
      rowKinds.push("data");
    }
    rows.push([
      `TOTAL — ${drivers.length} drivers`, all.days, all.dispatched, all.delivered,
      pct(all.delivered, all.dispatched), all.stops,
      all.road > 0 ? r1(all.stops / all.road) : "", all.miles, all.road, all.duty, all.bonus,
    ]);
    rowKinds.push("total");
    return {
      ...empty,
      mode: "summary",
      columns: ["Driver", "Days", "Dispatched", "Delivered", "Delivery %", "Stops", "Stops/Hr", "Miles", "On-Road Hrs", "On-Duty Hrs", "Bonus $"],
      rows,
      rowKinds,
    };
  }

  // Detail: chronological per driver, with a subtotal line after each driver.
  const rows: (string | number)[][] = [];
  const rowKinds: RowKind[] = [];
  for (const driver of drivers) {
    const list = byDriver.get(driver)!;
    for (const e of list) {
      rows.push([
        day(`${e.d.date}T12:00:00`), driver, e.d.vehicle ?? "", e.d.route ?? "",
        e.d.vscanPkgs, e.d.actDelPkgs, pct(e.d.actDelPkgs, e.d.vscanPkgs), e.stops,
        e.d.onRoadHours > 0 ? r1(e.stops / e.d.onRoadHours) : "", e.d.miles,
        e.d.onRoadHours, e.d.onDutyHours, r2(e.bonus),
      ]);
      rowKinds.push("data");
    }
    if (list.length > 0 && drivers.length > 1) {
      const t = sum(list);
      rows.push([
        `${driver} — TOTAL (${t.days} day${t.days === 1 ? "" : "s"})`, "", "", "",
        t.dispatched, t.delivered, pct(t.delivered, t.dispatched), t.stops,
        t.road > 0 ? r1(t.stops / t.road) : "", t.miles, t.road, t.duty, t.bonus,
      ]);
      rowKinds.push("subtotal");
    }
  }
  if (days.length > 0) {
    rows.push([
      `TOTAL — ALL DRIVERS (${all.days} driver-days)`, "", "", "",
      all.dispatched, all.delivered, pct(all.delivered, all.dispatched), all.stops,
      all.road > 0 ? r1(all.stops / all.road) : "", all.miles, all.road, all.duty, all.bonus,
    ]);
    rowKinds.push("total");
  }

  return {
    ...empty,
    mode: "detail",
    columns: ["Date", "Driver", "Vehicle", "Route", "Dispatched", "Delivered", "Delivery %", "Stops", "Stops/Hr", "Miles", "On-Road Hrs", "On-Duty Hrs", "Bonus $"],
    rows,
    rowKinds,
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

  const entries = data as MaintRow[];
  const byVan = new Map<string, MaintRow[]>();
  for (const r of entries) {
    const list = byVan.get(r.van_id) ?? [];
    list.push(r);
    byVan.set(r.van_id, list);
  }
  const vans = [...byVan.keys()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const cost = (r: MaintRow) => Number(r.cost) || 0;
  const grand = r2(entries.reduce((s, r) => s + cost(r), 0));

  if (p.mode === "summary") {
    // One line per van over the range.
    const rows: (string | number)[][] = [];
    const rowKinds: RowKind[] = [];
    for (const van of vans) {
      const list = byVan.get(van)!;
      const cats = new Map<string, number>();
      list.forEach((r) => cats.set(r.category, (cats.get(r.category) ?? 0) + 1));
      const topCat = [...cats.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
      rows.push([
        van,
        list.length,
        r2(list.reduce((s, r) => s + cost(r), 0)),
        day(`${list[0].date}T12:00:00`),
        day(`${list[list.length - 1].date}T12:00:00`),
        topCat,
      ]);
      rowKinds.push("data");
    }
    rows.push([`TOTAL — ${vans.length} vans`, entries.length, grand, "", "", ""]);
    rowKinds.push("total");
    return {
      ...empty,
      mode: "summary",
      columns: ["Van", "Entries", "Total $", "First entry", "Last entry", "Top category"],
      rows,
      rowKinds,
    };
  }

  // Detail: grouped by van with a subtotal per van.
  const rows: (string | number)[][] = [];
  const rowKinds: RowKind[] = [];
  for (const van of vans) {
    const list = byVan.get(van)!;
    for (const r of list) {
      rows.push([
        day(`${r.date}T12:00:00`), van, r.category, r.description,
        r.mileage ?? "", r2(cost(r)), r.receipt_url ? "Yes" : "", r.created_by ?? "",
      ]);
      rowKinds.push("data");
    }
    if (vans.length > 1) {
      rows.push([
        `${van} — TOTAL (${list.length} entr${list.length === 1 ? "y" : "ies"})`,
        "", "", "", "", r2(list.reduce((s, r) => s + cost(r), 0)), "", "",
      ]);
      rowKinds.push("subtotal");
    }
  }
  if (entries.length > 0) {
    rows.push([`TOTAL — ALL VANS (${entries.length} entries)`, "", "", "", "", grand, "", ""]);
    rowKinds.push("total");
  }

  return {
    ...empty,
    mode: "detail",
    columns: ["Date", "Van", "Category", "Work performed", "Mileage", "Cost $", "Receipt", "Logged by"],
    rows,
    rowKinds,
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
