/**
 * Driver-stats types + pure calculation helpers (client-safe).
 * Data comes from the FedEx Daily Service Worksheet, one record per driver
 * per day (both delivery-type tabs combined at import).
 */

export interface DriverDay {
  date: string; // YYYY-MM-DD
  driver: string;
  vehicle?: string | null;
  route?: string | null;
  vscanPkgs: number; // packages dispatched
  delStops: number; // delivery stops assigned
  puStops: number; // pickup stops assigned
  diff: number;
  actDelStops: number;
  actDelPkgs: number;
  actPuStops: number;
  actPuPkgs: number;
  miles: number;
  onRoadHours: number;
  onDutyHours: number;
}

export interface OpsSettings {
  /** 0 = Sunday … 6 = Saturday. Default Sun–Sat weeks. */
  weekStart: number;
  /** Per-stop bonus: paid on combined stops AFTER this count each day. */
  bonusThreshold: number;
  bonusRate: number;
  payroll: "weekly" | "biweekly";
  /** First day of a pay period (used to anchor bi-weekly periods). */
  payrollAnchor: string; // YYYY-MM-DD
}

export const DEFAULT_OPS: OpsSettings = {
  weekStart: 0,
  bonusThreshold: 120,
  bonusRate: 1.35,
  payroll: "weekly",
  payrollAnchor: "2026-01-04",
};

export const combinedStops = (d: Pick<DriverDay, "actDelStops" | "actPuStops">) =>
  d.actDelStops + d.actPuStops;

/** Per-stop bonus for one day: stops past the threshold, reset daily. */
export function dailyBonus(day: DriverDay, s: OpsSettings): number {
  const stops = combinedStops(day);
  return stops > s.bonusThreshold ? (stops - s.bonusThreshold) * s.bonusRate : 0;
}

export interface DriverAgg {
  driver: string;
  days: number;
  vscanPkgs: number;
  actDelPkgs: number;
  actDelStops: number;
  puStops: number;
  actPuStops: number;
  actPuPkgs: number;
  stops: number;
  miles: number;
  onRoadHours: number;
  onDutyHours: number;
  bonus: number;
  vehicles: string;
}

export function aggregateByDriver(rows: DriverDay[], s: OpsSettings): DriverAgg[] {
  const map = new Map<string, DriverAgg & { vehicleSet: Set<string> }>();
  for (const r of rows) {
    const e =
      map.get(r.driver) ??
      ({
        driver: r.driver,
        days: 0,
        vscanPkgs: 0,
        actDelPkgs: 0,
        actDelStops: 0,
        puStops: 0,
        actPuStops: 0,
        actPuPkgs: 0,
        stops: 0,
        miles: 0,
        onRoadHours: 0,
        onDutyHours: 0,
        bonus: 0,
        vehicles: "",
        vehicleSet: new Set<string>(),
      } as DriverAgg & { vehicleSet: Set<string> });
    e.days += 1;
    e.vscanPkgs += r.vscanPkgs;
    e.actDelPkgs += r.actDelPkgs;
    e.actDelStops += r.actDelStops;
    e.puStops += r.puStops;
    e.actPuStops += r.actPuStops;
    e.actPuPkgs += r.actPuPkgs;
    e.stops += combinedStops(r);
    e.miles += r.miles;
    e.onRoadHours += r.onRoadHours;
    e.onDutyHours += r.onDutyHours;
    e.bonus += dailyBonus(r, s);
    if (r.vehicle) r.vehicle.split(",").forEach((v) => v.trim() && e.vehicleSet.add(v.trim()));
    map.set(r.driver, e);
  }
  return [...map.values()].map((e) => {
    e.vehicles = [...e.vehicleSet].join(", ");
    // @ts-expect-error strip helper
    delete e.vehicleSet;
    return e;
  });
}

export interface DriverMetrics {
  deliveryPct: number | null; // packages delivered vs dispatched
  pickupPct: number | null; // successful pickups vs assigned
  stopsPerHour: number | null; // (del + pu stops) / on-road hours
  utilization: number | null; // on-road vs on-duty
}

export function metricsOf(a: {
  vscanPkgs: number;
  actDelPkgs: number;
  puStops: number;
  actPuStops: number;
  stops: number;
  onRoadHours: number;
  onDutyHours: number;
}): DriverMetrics {
  return {
    deliveryPct: a.vscanPkgs > 0 ? a.actDelPkgs / a.vscanPkgs : null,
    pickupPct: a.puStops > 0 ? Math.min(a.actPuStops / a.puStops, 1) : null,
    stopsPerHour: a.onRoadHours > 0 ? a.stops / a.onRoadHours : null,
    utilization: a.onDutyHours > 0 ? Math.min(a.onRoadHours / a.onDutyHours, 1) : null,
  };
}

export interface Rank {
  score: number;
  tier: "Elite" | "Strong" | "Good" | "Coach" | "Action";
}

/**
 * Composite 0–100 score, graded on a hard curve:
 *  - Delivery success 45%: 90% delivery = zero credit, 100% = full credit.
 *  - Pickup success 15%: same 90–100% curve.
 *  - Stops/hour 30%: full marks at 25/hr.
 *  - Road-vs-duty 10%: 70% = zero credit, 95%+ = full credit.
 * Missing components drop out and the rest re-normalize.
 * Tiers: Elite ≥93 · Strong ≥85 · Good ≥75 · Coach ≥65 · Action below.
 */
export function rankOf(m: DriverMetrics): Rank {
  const clamp = (v: number) => Math.max(0, Math.min(v, 1));
  const parts: { w: number; v: number }[] = [];
  if (m.deliveryPct != null) parts.push({ w: 0.45, v: clamp((m.deliveryPct - 0.9) / 0.1) });
  if (m.pickupPct != null) parts.push({ w: 0.15, v: clamp((m.pickupPct - 0.9) / 0.1) });
  if (m.stopsPerHour != null) parts.push({ w: 0.3, v: clamp(m.stopsPerHour / 25) });
  if (m.utilization != null) parts.push({ w: 0.1, v: clamp((m.utilization - 0.7) / 0.25) });
  const totalW = parts.reduce((s, p) => s + p.w, 0);
  const score = totalW > 0 ? Math.round((parts.reduce((s, p) => s + p.w * p.v, 0) / totalW) * 100) : 0;
  const tier = score >= 93 ? "Elite" : score >= 85 ? "Strong" : score >= 75 ? "Good" : score >= 65 ? "Coach" : "Action";
  return { score, tier };
}

export const TIER_STYLE: Record<Rank["tier"], string> = {
  Elite: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Strong: "bg-sky-50 text-sky-700 border-sky-200",
  Good: "bg-slate-100 text-slate-600 border-slate-200",
  Coach: "bg-amber-50 text-amber-800 border-amber-200",
  Action: "bg-red-50 text-red-700 border-red-200",
};

/* ---------- date/period helpers ---------- */

export const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const yesterdayIso = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return isoDay(d);
};

/** Start of the week containing `date`, honoring the owner's week start. */
export function weekStartOf(dateIso: string, weekStart: number): string {
  const d = new Date(`${dateIso}T12:00:00`);
  const delta = (d.getDay() - weekStart + 7) % 7;
  d.setDate(d.getDate() - delta);
  return isoDay(d);
}

export function addDays(dateIso: string, days: number): string {
  const d = new Date(`${dateIso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return isoDay(d);
}

/** Pay period containing `date`: weekly = owner's week; biweekly = 14 days anchored. */
export function payPeriodOf(dateIso: string, s: OpsSettings): { start: string; end: string } {
  if (s.payroll === "weekly") {
    const start = weekStartOf(dateIso, s.weekStart);
    return { start, end: addDays(start, 6) };
  }
  const anchor = new Date(`${s.payrollAnchor || DEFAULT_OPS.payrollAnchor}T12:00:00`);
  const d = new Date(`${dateIso}T12:00:00`);
  const diffDays = Math.floor((d.getTime() - anchor.getTime()) / 86400000);
  const periodIndex = Math.floor(diffDays / 14);
  const start = new Date(anchor);
  start.setDate(anchor.getDate() + periodIndex * 14);
  return { start: isoDay(start), end: addDays(isoDay(start), 13) };
}
