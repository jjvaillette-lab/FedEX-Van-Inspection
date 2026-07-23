"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/app/components/portal/AuthProvider";
import {
  IconChart,
  IconDownload,
  IconPlus,
  IconUsers,
} from "@/app/components/icons";
import {
  addDays,
  aggregateByDriver,
  combinedStops,
  dailyBonus,
  DEFAULT_OPS,
  isoDay,
  metricsOf,
  payPeriodOf,
  rankOf,
  TIER_STYLE,
  weekStartOf,
  yesterdayIso,
  type DriverDay,
  type OpsSettings,
} from "@/lib/opstats";

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const pct = (v: number | null) => (v == null ? "—" : `${(v * 100).toFixed(1)}%`);
const displayDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" });

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type Period = "day" | "week" | "sixweek" | "all";

export default function DriverStatsPage() {
  const { user, tenant, hasPermission } = useAuth();
  const brand = tenant.themeColor;
  const canView = user?.role === "owner" || !!user?.admin || hasPermission("ops.driver_stats");
  const isOwner = user?.role === "owner" || !!user?.admin;

  const [rows, setRows] = useState<DriverDay[]>([]);
  const [settings, setSettings] = useState<OpsSettings>({ ...DEFAULT_OPS });
  const [persisted, setPersisted] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [period, setPeriod] = useState<Period>("day");
  const [anchorDate, setAnchorDate] = useState(yesterdayIso());
  const [expandedDriver, setExpandedDriver] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const reload = () => {
    fetch("/api/driver-stats")
      .then((r) => r.json())
      .then((d) => {
        setRows(d.rows ?? []);
        if (d.settings) setSettings(d.settings);
        setPersisted(d.persisted !== false);
        setApiError(d.error ?? null);
      })
      .finally(() => setLoading(false));
  };
  useEffect(reload, []);

  /* ---------- period range ---------- */
  const range = useMemo((): { from: string; to: string; label: string } => {
    const today = isoDay(new Date());
    if (period === "day") return { from: anchorDate, to: anchorDate, label: displayDate(anchorDate) };
    if (period === "week") {
      const start = weekStartOf(anchorDate, settings.weekStart);
      const end = addDays(start, 6);
      return { from: start, to: end, label: `${displayDate(start)} – ${displayDate(end)}` };
    }
    if (period === "sixweek") {
      const from = addDays(today, -41);
      return { from, to: today, label: `Trailing 6 weeks (${displayDate(from)} – ${displayDate(today)})` };
    }
    return { from: "0000-01-01", to: "9999-12-31", label: "All time" };
  }, [period, anchorDate, settings.weekStart]);

  const inRange = useMemo(
    () => rows.filter((r) => r.date >= range.from && r.date <= range.to),
    [rows, range]
  );

  /* ---------- yesterday summary (always shown) ---------- */
  const yIso = yesterdayIso();
  const ySummary = useMemo(() => {
    const y = rows.filter((r) => r.date === yIso);
    const dispatched = y.reduce((s, r) => s + r.vscanPkgs, 0);
    const delivered = y.reduce((s, r) => s + r.actDelPkgs, 0);
    const stops = y.reduce((s, r) => s + combinedStops(r), 0);
    const bonus = y.reduce((s, r) => s + dailyBonus(r, settings), 0);
    return { drivers: y.length, dispatched, delivered, stops, bonus };
  }, [rows, yIso, settings]);

  /* ---------- pay-period bonus (per driver) ---------- */
  const payPeriod = useMemo(() => payPeriodOf(isoDay(new Date()), settings), [settings]);
  const periodBonus = useMemo(() => {
    const map = new Map<string, number>();
    rows
      .filter((r) => r.date >= payPeriod.start && r.date <= payPeriod.end)
      .forEach((r) => map.set(r.driver, (map.get(r.driver) ?? 0) + dailyBonus(r, settings)));
    return map;
  }, [rows, payPeriod, settings]);

  /* ---------- scorecards ---------- */
  const scorecards = useMemo(() => {
    const aggs = aggregateByDriver(inRange, settings);
    return aggs
      .map((a) => {
        const m = metricsOf(a);
        const rank = rankOf(m);
        return { ...a, m, rank };
      })
      .sort((a, b) => b.rank.score - a.rank.score);
  }, [inRange, settings]);

  const exportCsv = () => {
    const rowsOut = [
      ["Driver", "Days", "Pkgs Delivered", "Pkgs Dispatched", "Delivery %", "PU Stops Actual", "PU Stops Assigned", "Pickup %", "Stops", "Stops/Hr", "On-Road Hrs", "On-Duty Hrs", "Road vs Duty", "Miles", `Bonus (${range.label})`, "Score", "Tier"],
      ...scorecards.map((s) => [
        s.driver,
        String(s.days),
        String(s.actDelPkgs),
        String(s.vscanPkgs),
        s.m.deliveryPct != null ? (s.m.deliveryPct * 100).toFixed(1) : "",
        String(s.actPuStops),
        String(s.puStops),
        s.m.pickupPct != null ? (s.m.pickupPct * 100).toFixed(1) : "",
        String(s.stops),
        s.m.stopsPerHour != null ? s.m.stopsPerHour.toFixed(1) : "",
        s.onRoadHours.toFixed(1),
        s.onDutyHours.toFixed(1),
        s.m.utilization != null ? (s.m.utilization * 100).toFixed(0) : "",
        s.miles.toFixed(0),
        s.bonus.toFixed(2),
        String(s.rank.score),
        s.rank.tier,
      ]),
    ];
    const csv = rowsOut.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `driver-stats-${range.from}_${range.to}.csv`;
    a.click();
  };

  if (!canView) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 text-center text-slate-500">
        You don&apos;t have access to driver stats. Ask an owner to grant it.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:px-8">
      <nav className="mb-1 flex items-center gap-2 text-sm text-slate-400">
        <Link href="/portal" className="hover:text-slate-600">Portal</Link>
        <span>/</span>
        <span className="text-slate-500">Operations</span>
        <span>/</span>
        <span className="text-slate-500">Driver Stats</span>
      </nav>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Driver Stats</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Scorecards from your FedEx Daily Service Worksheets.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <IconDownload size={16} /> Export CSV
          </button>
          {isOwner && (
            <button
              onClick={() => setSettingsOpen(true)}
              className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Settings
            </button>
          )}
          <button
            onClick={() => setUploadOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold text-white"
            style={{ background: brand }}
          >
            <IconPlus size={16} /> Upload worksheet
          </button>
        </div>
      </div>

      {(!persisted || apiError) && (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {apiError ?? "Database not configured."}
        </p>
      )}

      {/* Yesterday summary — always pinned on top */}
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
          Yesterday · {displayDate(yIso)}
        </p>
        {ySummary.drivers === 0 ? (
          <p className="mt-1 text-sm text-slate-500">No driver stats imported for yesterday.</p>
        ) : (
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              { l: "Drivers out", v: String(ySummary.drivers) },
              { l: "Delivered / dispatched", v: `${ySummary.delivered.toLocaleString()} / ${ySummary.dispatched.toLocaleString()}` },
              { l: "Delivery %", v: ySummary.dispatched > 0 ? `${((ySummary.delivered / ySummary.dispatched) * 100).toFixed(1)}%` : "—" },
              { l: "Stops completed", v: ySummary.stops.toLocaleString() },
              { l: "Stop bonuses", v: money(ySummary.bonus) },
            ].map((s) => (
              <div key={s.l}>
                <p className="text-lg font-bold tabular-nums text-slate-900">{s.v}</p>
                <p className="text-xs text-slate-500">{s.l}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Period controls */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-slate-300 bg-white p-0.5">
          {(
            [
              { key: "day", label: "Day" },
              { key: "week", label: "Week" },
              { key: "sixweek", label: "6-Week" },
              { key: "all", label: "All Time" },
            ] as { key: Period; label: string }[]
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setPeriod(t.key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                period === t.key ? "text-white" : "text-slate-600 hover:bg-slate-50"
              }`}
              style={period === t.key ? { background: brand } : undefined}
            >
              {t.label}
            </button>
          ))}
        </div>
        {(period === "day" || period === "week") && (
          <input
            type="date"
            value={anchorDate}
            onChange={(e) => e.target.value && setAnchorDate(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
          />
        )}
        <span className="text-sm text-slate-500">{range.label}</span>
        <span className="ml-auto text-xs text-slate-400">
          Pay period ({settings.payroll}): {displayDate(payPeriod.start)} – {displayDate(payPeriod.end)}
        </span>
      </div>

      {/* Scorecard table */}
      {loading ? (
        <p className="py-16 text-center text-slate-400">Loading…</p>
      ) : scorecards.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-slate-300 bg-white px-4 py-12 text-center text-sm text-slate-400">
          No driver data in this period. Upload a worksheet to get started.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                <th className="px-3 py-2 text-left">Driver</th>
                <th className="px-2 py-2 text-right">Days</th>
                <th className="px-2 py-2 text-right">Delivered / Disp.</th>
                <th className="px-2 py-2 text-right">Del %</th>
                <th className="px-2 py-2 text-right">PU %</th>
                <th className="px-2 py-2 text-right">Stops</th>
                <th className="px-2 py-2 text-right">Stops/Hr</th>
                <th className="px-2 py-2 text-right">Road/Duty</th>
                <th className="px-2 py-2 text-right">Miles</th>
                <th className="px-2 py-2 text-right">Bonus</th>
                <th className="px-3 py-2 text-right">Rank</th>
              </tr>
            </thead>
            <tbody>
              {scorecards.map((s) => (
                <>
                  <tr
                    key={s.driver}
                    onClick={() => setExpandedDriver(expandedDriver === s.driver ? null : s.driver)}
                    className="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="px-3 py-2.5 font-semibold text-slate-800">{s.driver}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-slate-500">{s.days}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-slate-700">
                      {s.actDelPkgs.toLocaleString()} / {s.vscanPkgs.toLocaleString()}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-slate-700">{pct(s.m.deliveryPct)}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-slate-500">{pct(s.m.pickupPct)}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-slate-700">{s.stops.toLocaleString()}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-slate-700">
                      {s.m.stopsPerHour != null ? s.m.stopsPerHour.toFixed(1) : "—"}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-slate-500">{pct(s.m.utilization)}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-slate-500">{s.miles.toFixed(0)}</td>
                    <td className="px-2 py-2.5 text-right font-semibold tabular-nums text-slate-900">{money(s.bonus)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-bold ${TIER_STYLE[s.rank.tier]}`}>
                        {s.rank.score} · {s.rank.tier}
                      </span>
                    </td>
                  </tr>
                  {expandedDriver === s.driver && (
                    <tr key={`${s.driver}-detail`} className="border-b border-slate-100 bg-slate-50/60">
                      <td colSpan={11} className="px-4 py-3">
                        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                          Daily breakdown{s.vehicles ? ` · Vehicles: ${s.vehicles}` : ""} · Pay-period bonus to date: {money(periodBonus.get(s.driver) ?? 0)}
                        </p>
                        <div className="space-y-1">
                          {inRange
                            .filter((r) => r.driver === s.driver)
                            .sort((a, b) => b.date.localeCompare(a.date))
                            .map((r) => {
                              const stops = combinedStops(r);
                              const b = dailyBonus(r, settings);
                              return (
                                <div key={r.date} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded border border-slate-200 bg-white px-3 py-1.5 text-xs">
                                  <span className="w-20 font-semibold tabular-nums text-slate-700">{displayDate(r.date)}</span>
                                  <span className="tabular-nums text-slate-500">{r.actDelPkgs}/{r.vscanPkgs} pkgs</span>
                                  <span className="tabular-nums text-slate-500">{stops} stops</span>
                                  <span className="tabular-nums text-slate-500">
                                    {r.onRoadHours > 0 ? `${(stops / r.onRoadHours).toFixed(1)}/hr` : "—"}
                                  </span>
                                  <span className="tabular-nums text-slate-400">{r.miles.toFixed(0)} mi</span>
                                  <span className="tabular-nums text-slate-400">
                                    road {r.onRoadHours.toFixed(1)}h · duty {r.onDutyHours.toFixed(1)}h
                                  </span>
                                  <span className="ml-auto font-semibold tabular-nums" style={{ color: b > 0 ? brand : "#94a3b8" }}>
                                    {b > 0 ? `+${money(b)}` : "—"}
                                  </span>
                                </div>
                              );
                            })}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs text-slate-400">
        Bonus: ${settings.bonusRate.toFixed(2)}/stop after {settings.bonusThreshold} combined stops,
        reset daily; totals accumulate per {settings.payroll} pay period. Rankings weigh delivery
        success, pickup success, stops/hour, and road-vs-duty time.
      </p>

      {uploadOpen && (
        <UploadModal
          brand={brand}
          onClose={() => setUploadOpen(false)}
          onImported={() => {
            setUploadOpen(false);
            reload();
          }}
        />
      )}
      {settingsOpen && (
        <SettingsModal
          brand={brand}
          initial={settings}
          onClose={() => setSettingsOpen(false)}
          onSaved={(s) => {
            setSettings(s);
            setSettingsOpen(false);
          }}
        />
      )}
    </div>
  );
}

/* ---------- upload modal ---------- */

interface ParsedInfo {
  rows: DriverDay[];
  needsDate: boolean;
  days: string[];
  drivers: number;
}

const HOURS = (v: unknown): number => {
  if (v == null) return 0;
  if (typeof v === "number") return v < 1 ? Math.round(v * 24 * 100) / 100 : v;
  const m = String(v).match(/(\d+):(\d{2})/);
  if (m) return Math.round((parseInt(m[1]) + parseInt(m[2]) / 60) * 100) / 100;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};
const NUM = (v: unknown): number => {
  if (v == null || v === "") return 0;
  const n = Number(String(v).replace(/,/g, ""));
  return isNaN(n) ? 0 : Math.round(n);
};

function UploadModal({
  brand,
  onClose,
  onImported,
}: {
  brand: string;
  onClose: () => void;
  onImported: () => void;
}) {
  const [parsed, setParsed] = useState<ParsedInfo | null>(null);
  const [manualDate, setManualDate] = useState("");
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const parseFile = async (file: File) => {
    setErr(null);
    setFileName(file.name);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer(), { cellDates: false });
      const agg = new Map<string, DriverDay>();
      let needsDate = false;

      for (const sheetName of wb.SheetNames) {
        // Sheet names like "7 11 26 - 59" carry the date.
        const dm = sheetName.match(/^(\d{1,2})[ /-](\d{1,2})[ /-](\d{2,4})/);
        const sheetDate = dm
          ? `${dm[3].length === 2 ? "20" + dm[3] : dm[3]}-${dm[1].padStart(2, "0")}-${dm[2].padStart(2, "0")}`
          : null;
        const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], { header: 1 }) as unknown[][];
        const headerIdx = grid.findIndex((r) => r?.some((c) => String(c).trim() === "Driver Name" || String(c).trim().toLowerCase() === "driver"));
        if (headerIdx < 0) continue;
        const headers = grid[headerIdx].map((c) => String(c ?? "").trim());
        const col = (name: string) => headers.findIndex((h) => h.toLowerCase() === name.toLowerCase());
        const simple = col("driver") >= 0; // our exported CSV format
        const iDriver = simple ? col("driver") : col("Driver Name");
        const iDate = col("date");
        const idx = {
          vehicle: simple ? col("vehicle") : col("Veh #"),
          route: simple ? col("route") : col("WA Name"),
          vscan: simple ? col("vscanPkgs") : col("VScan Pkgs"),
          delStops: simple ? col("delStops") : col("Del Stps"),
          puStops: simple ? col("puStops") : col("PU Stps"),
          diff: simple ? col("diff") : col("DIFF"),
          actDelStops: simple ? col("actDelStops") : col("Act Del Stps"),
          actDelPkgs: simple ? col("actDelPkgs") : col("Act Del Pkgs"),
          actPuStops: simple ? col("actPuStops") : col("Act PU Stps"),
          actPuPkgs: simple ? col("actPuPkgs") : col("Act PU Pkgs"),
          miles: simple ? col("miles") : col("Miles"),
          road: simple ? col("onRoadHours") : col("On Road Hours"),
          duty: simple ? col("onDutyHours") : col("On Duty Hours"),
        };
        for (const row of grid.slice(headerIdx + 1)) {
          const driver = String(row?.[iDriver] ?? "").trim();
          if (!driver || /^(colocation|access|due to)/i.test(driver)) continue;
          let date = sheetDate;
          if (iDate >= 0 && row[iDate]) {
            const raw = String(row[iDate]).trim();
            const isoM = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
            const usM = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
            if (isoM) date = raw.slice(0, 10);
            else if (usM) date = `${usM[3].length === 2 ? "20" + usM[3] : usM[3]}-${usM[1].padStart(2, "0")}-${usM[2].padStart(2, "0")}`;
          }
          if (!date) {
            needsDate = true;
            date = "__manual__";
          }
          const key = `${date}|${driver}`;
          const e =
            agg.get(key) ??
            ({
              date,
              driver,
              vehicle: "",
              route: "",
              vscanPkgs: 0,
              delStops: 0,
              puStops: 0,
              diff: 0,
              actDelStops: 0,
              actDelPkgs: 0,
              actPuStops: 0,
              actPuPkgs: 0,
              miles: 0,
              onRoadHours: 0,
              onDutyHours: 0,
            } as DriverDay);
          const veh = String(row[idx.vehicle] ?? "").replace(/\s+/g, " ").trim();
          if (veh && !(e.vehicle ?? "").includes(veh)) e.vehicle = e.vehicle ? `${e.vehicle}, ${veh}` : veh;
          const rt = String(row[idx.route] ?? "").trim();
          if (rt && !(e.route ?? "").includes(rt)) e.route = e.route ? `${e.route}, ${rt}` : rt;
          e.vscanPkgs += NUM(row[idx.vscan]);
          e.delStops += NUM(row[idx.delStops]);
          e.puStops += NUM(row[idx.puStops]);
          e.diff += NUM(row[idx.diff]);
          e.actDelStops += NUM(row[idx.actDelStops]);
          e.actDelPkgs += NUM(row[idx.actDelPkgs]);
          e.actPuStops += NUM(row[idx.actPuStops]);
          e.actPuPkgs += NUM(row[idx.actPuPkgs]);
          e.miles += NUM(row[idx.miles]);
          e.onRoadHours = Math.round((e.onRoadHours + HOURS(row[idx.road])) * 100) / 100;
          e.onDutyHours = Math.round((e.onDutyHours + HOURS(row[idx.duty])) * 100) / 100;
          agg.set(key, e);
        }
      }
      const rows = [...agg.values()];
      if (rows.length === 0) {
        setErr("No driver rows found. Export the worksheet as .xlsx or .csv and try again.");
        setParsed(null);
        return;
      }
      setParsed({
        rows,
        needsDate,
        days: [...new Set(rows.map((r) => r.date).filter((d) => d !== "__manual__"))].sort(),
        drivers: new Set(rows.map((r) => r.driver)).size,
      });
    } catch {
      setErr("Couldn't read that file. Export as .xlsx or .csv (Numbers: File → Export To → Excel).");
      setParsed(null);
    }
  };

  const doImport = async () => {
    if (!parsed) return;
    if (parsed.needsDate && !manualDate) {
      setErr("This file has no dates — pick the date these stats are for.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const rows = parsed.rows.map((r) => ({ ...r, date: r.date === "__manual__" ? manualDate : r.date }));
      const res = await fetch("/api/driver-stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      onImported();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 px-5">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6">
        <h2 className="text-lg font-bold text-slate-900">Upload daily worksheet</h2>
        <p className="mt-1 text-sm text-slate-500">
          Accepts .xlsx or .csv. Both delivery-type tabs are combined automatically; re-uploading a
          day overwrites it. (From Numbers: File → Export To → Excel.)
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && void parseFile(e.target.files[0])}
        />
        <button
          onClick={() => fileRef.current?.click()}
          className="mt-4 w-full rounded-lg border border-dashed border-slate-300 py-6 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          {fileName ? `File: ${fileName}` : "Choose spreadsheet…"}
        </button>

        {parsed && (
          <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
            Found <strong>{parsed.rows.length}</strong> driver-day records ·{" "}
            <strong>{parsed.drivers}</strong> drivers
            {parsed.days.length > 0 && (
              <> · {parsed.days.length === 1 ? parsed.days[0] : `${parsed.days[0]} → ${parsed.days[parsed.days.length - 1]}`}</>
            )}
          </div>
        )}
        {parsed?.needsDate && (
          <div className="mt-3">
            <label className="mb-1 block text-sm font-medium text-slate-600">Stats date *</label>
            <input
              type="date"
              value={manualDate}
              onChange={(e) => setManualDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            />
          </div>
        )}
        {err && <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button onClick={onClose} className="rounded-lg border border-slate-300 py-2.5 text-sm font-semibold text-slate-700">
            Cancel
          </button>
          <button
            onClick={doImport}
            disabled={busy || !parsed}
            className="rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: brand }}
          >
            {busy ? "Importing…" : parsed ? `Import ${parsed.rows.length} records` : "Import"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- settings modal ---------- */

function SettingsModal({
  brand,
  initial,
  onClose,
  onSaved,
}: {
  brand: string;
  initial: OpsSettings;
  onClose: () => void;
  onSaved: (s: OpsSettings) => void;
}) {
  const [weekStart, setWeekStart] = useState(initial.weekStart);
  const [threshold, setThreshold] = useState(String(initial.bonusThreshold));
  const [rate, setRate] = useState(String(initial.bonusRate));
  const [payroll, setPayroll] = useState(initial.payroll);
  const [anchor, setAnchor] = useState(initial.payrollAnchor);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const valid = threshold.trim() !== "" && rate.trim() !== "" && !isNaN(Number(threshold)) && !isNaN(Number(rate));

  const save = async () => {
    if (!valid) {
      setErr("Both the per-stop dollar amount AND the 'earned after stop #' are required.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/driver-stats", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: {
            weekStart,
            bonusThreshold: Number(threshold),
            bonusRate: Number(rate),
            payroll,
            payrollAnchor: anchor,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      onSaved(data.settings);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500";

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 px-5">
      <div className="w-full max-w-md rounded-xl bg-white p-6">
        <h2 className="text-lg font-bold text-slate-900">Driver stats settings</h2>
        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Workweek starts on</label>
            <select value={weekStart} onChange={(e) => setWeekStart(Number(e.target.value))} className={`${inputCls} bg-white`}>
              {WEEKDAYS.map((d, i) => (
                <option key={d} value={i}>
                  {d} ({d.slice(0, 3)}–{WEEKDAYS[(i + 6) % 7].slice(0, 3)})
                </option>
              ))}
            </select>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-sm font-semibold text-slate-800">Per-stop bonus</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Both fields are required. Paid on combined delivery + pickup stops past the threshold,
              reset each day.
            </p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Earned after stop # *</label>
                <input inputMode="numeric" value={threshold} onChange={(e) => setThreshold(e.target.value.replace(/[^\d]/g, ""))} className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">$ per stop *</label>
                <input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value.replace(/[^\d.]/g, ""))} className={inputCls} />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Payroll</label>
              <select value={payroll} onChange={(e) => setPayroll(e.target.value as "weekly" | "biweekly")} className={`${inputCls} bg-white`}>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Bi-weekly (14 days)</option>
              </select>
            </div>
            {payroll === "biweekly" && (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-600">Period start date</label>
                <input type="date" value={anchor} onChange={(e) => setAnchor(e.target.value)} className={inputCls} />
              </div>
            )}
          </div>
          {err && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
          <div className="grid grid-cols-2 gap-3">
            <button onClick={onClose} className="rounded-lg border border-slate-300 py-2.5 text-sm font-semibold text-slate-700">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={busy || !valid}
              className="rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              style={{ background: brand }}
            >
              {busy ? "Saving…" : "Save settings"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
