"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/app/components/portal/AuthProvider";
import {
  IconChart,
  IconClipboard,
  IconDownload,
  IconVan,
  IconWrench,
} from "@/app/components/icons";

/**
 * Reporting dashboard — every report the platform offers in one place:
 * pick a report, set the range, preview it, export Excel/PDF, email it now,
 * or put it on an automatic schedule.
 */

type ReportType = "inspections" | "driver-stats" | "maintenance" | "vans";

interface ReportData {
  type: ReportType;
  title: string;
  rangeLabel: string;
  columns: string[];
  rows: (string | number)[][];
}

interface ReportSchedule {
  id: string;
  type: ReportType;
  cadence: "daily" | "weekly" | "monthly";
  recipients: string[];
}

const TYPES: { type: ReportType; label: string; desc: string; icon: (p: { size?: number }) => React.ReactElement; dated: boolean }[] = [
  { type: "inspections", label: "Inspections / DVIR", desc: "Every check with status, issues, resolutions, photo counts.", icon: IconClipboard, dated: true },
  { type: "driver-stats", label: "Driver Stats & Bonuses", desc: "Deliveries, stops, hours, and bonus dollars per driver-day.", icon: IconChart, dated: true },
  { type: "maintenance", label: "Maintenance & Costs", desc: "Every repair with category, cost, and receipt status.", icon: IconWrench, dated: true },
  { type: "vans", label: "Van List & Status", desc: "Current fleet snapshot — status, details, mileage, cost totals.", icon: IconVan, dated: false },
];

const CADENCES = [
  { v: "daily", l: "Daily (yesterday's data)" },
  { v: "weekly", l: "Weekly (Mondays, prior 7 days)" },
  { v: "monthly", l: "Monthly (1st, prior month)" },
] as const;

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function presetRange(preset: string): { from: string; to: string } {
  const now = new Date();
  const today = iso(now);
  const shift = (days: number) => {
    const d = new Date(now);
    d.setDate(now.getDate() + days);
    return iso(d);
  };
  switch (preset) {
    case "today": return { from: today, to: today };
    case "yesterday": return { from: shift(-1), to: shift(-1) };
    case "7d": return { from: shift(-6), to: today };
    case "30d": return { from: shift(-29), to: today };
    case "month": return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
    case "lastmonth":
      return {
        from: iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        to: iso(new Date(now.getFullYear(), now.getMonth(), 0)),
      };
    default: return { from: "", to: "" };
  }
}

/** Column headers whose values should be totaled in the footer. */
const TOTAL_COLS = new Set(["Dispatched", "Delivered", "Stops", "Miles", "On-Road Hrs", "On-Duty Hrs", "Bonus $", "Cost $", "Issues", "Photos", "Maintenance total $"]);

export default function ReportsPage() {
  const { user, tenant, hasPermission, ready } = useAuth();
  const brand = tenant.themeColor;
  const canView = user?.role === "owner" || !!user?.admin || hasPermission("reports.view");

  const [type, setType] = useState<ReportType>("inspections");
  const [from, setFrom] = useState(presetRange("7d").from);
  const [to, setTo] = useState(presetRange("7d").to);
  const [van, setVan] = useState("");
  const [driver, setDriver] = useState("");
  const [report, setReport] = useState<ReportData | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);

  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [schedDirty, setSchedDirty] = useState(false);
  const [emailReady, setEmailReady] = useState(true);

  const meta = TYPES.find((t) => t.type === type)!;

  useEffect(() => {
    fetch("/api/reports?schedules=1")
      .then((r) => r.json())
      .then((d) => {
        setSchedules(d.schedules ?? []);
        setEmailReady(d.emailConfigured !== false);
      })
      .catch(() => {});
  }, []);

  const query = () => {
    const params = new URLSearchParams({ type });
    if (meta.dated && from) params.set("from", from);
    if (meta.dated && to) params.set("to", to);
    if (van.trim()) params.set("van", van.trim());
    if (driver.trim()) params.set("driver", driver.trim());
    return params;
  };

  const preview = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/reports?${query()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Report failed");
      setReport(data.report as ReportData);
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "Report failed" });
    } finally {
      setBusy(false);
    }
  };

  const ensureReport = async (): Promise<ReportData | null> => {
    if (report && report.type === type) return report;
    await preview();
    // preview sets state async; refetch directly for the export path
    const res = await fetch(`/api/reports?${query()}`);
    const data = await res.json();
    return res.ok ? (data.report as ReportData) : null;
  };

  const exportExcel = async () => {
    const r = await ensureReport();
    if (!r) return;
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet([[`${tenant.name} — ${r.title}`], [r.rangeLabel], [], r.columns, ...r.rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, r.title.slice(0, 28));
    XLSX.writeFile(wb, `${r.type}-${iso(new Date())}.xlsx`);
  };

  const exportPdf = async () => {
    const r = await ensureReport();
    if (!r) return;
    const win = window.open("", "_blank");
    if (!win) {
      setMessage({ ok: false, text: "Allow pop-ups to export PDF." });
      return;
    }
    const totals = totalsRow(r);
    win.document.write(`<!doctype html><html><head><title>${r.title}</title><style>
      body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;margin:32px}
      .bar{height:6px;background:${brand};border-radius:3px;margin-bottom:18px}
      h1{font-size:20px;margin:0}
      .sub{color:#64748b;font-size:12px;margin:4px 0 18px}
      table{border-collapse:collapse;width:100%;font-size:10.5px}
      th{background:#f1f5f9;text-align:left;padding:6px 8px;border:1px solid #e2e8f0;white-space:nowrap}
      td{padding:5px 8px;border:1px solid #e2e8f0;vertical-align:top}
      tfoot td{font-weight:700;background:#f8fafc}
      @media print{body{margin:12px}}
    </style></head><body>
      <div class="bar"></div>
      <h1>${tenant.name} — ${r.title}</h1>
      <p class="sub">${r.rangeLabel} · ${r.rows.length} rows · Generated ${new Date().toLocaleString("en-US")} · Last Mile Assist</p>
      <table><thead><tr>${r.columns.map((c) => `<th>${c}</th>`).join("")}</tr></thead>
      <tbody>${r.rows.map((row) => `<tr>${row.map((v) => `<td>${String(v ?? "")}</td>`).join("")}</tr>`).join("")}</tbody>
      ${totals ? `<tfoot><tr>${totals.map((v) => `<td>${v}</td>`).join("")}</tr></tfoot>` : ""}
      </table></body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };

  const emailNow = async (recipients: string[]) => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          from: meta.dated ? from : undefined,
          to: meta.dated ? to : undefined,
          van: van.trim() || undefined,
          driver: driver.trim() || undefined,
          recipients,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Send failed");
      setEmailOpen(false);
      setMessage({ ok: true, text: `Report emailed to ${data.sent} recipient${data.sent === 1 ? "" : "s"}.` });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "Send failed" });
    } finally {
      setBusy(false);
    }
  };

  const saveSchedules = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/reports", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedules }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setSchedDirty(false);
      setMessage({ ok: true, text: "Schedules saved — reports go out with the 6:00 AM run." });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "Save failed" });
    } finally {
      setBusy(false);
    }
  };

  const totals = useMemo(() => (report ? totalsRow(report) : null), [report]);

  if (!ready) return null;
  if (!canView) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 text-center text-slate-500">
        You don&apos;t have access to reporting. Ask an owner to grant it.
      </div>
    );
  }

  const inputCls =
    "rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500";

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:px-8">
      <nav className="mb-1 flex items-center gap-2 text-sm text-slate-400">
        <Link href="/portal" className="hover:text-slate-600">Portal</Link>
        <span>/</span>
        <span className="text-slate-500">Reports</span>
      </nav>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Reports</h1>
      <p className="mt-0.5 text-sm text-slate-500">
        Build, preview, export, and schedule every report — one place for the whole operation.
      </p>

      {/* Report type */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {TYPES.map((t) => {
          const active = t.type === type;
          return (
            <button
              key={t.type}
              onClick={() => {
                setType(t.type);
                setReport(null);
                setMessage(null);
              }}
              className={`rounded-xl border p-4 text-left transition-shadow ${
                active ? "shadow-md" : "border-slate-200 bg-white hover:shadow-sm"
              }`}
              style={active ? { borderColor: brand, background: `${brand}0d` } : undefined}
            >
              <span
                className="flex h-9 w-9 items-center justify-center rounded-lg"
                style={{ background: `${brand}14`, color: brand }}
              >
                <t.icon size={19} />
              </span>
              <span className="mt-2.5 block text-[14px] font-bold text-slate-900">{t.label}</span>
              <span className="mt-0.5 block text-[11.5px] leading-snug text-slate-500">{t.desc}</span>
            </button>
          );
        })}
      </div>

      {/* Configuration */}
      <div className="mt-5 rounded-xl border border-slate-200 bg-white p-5">
        {meta.dated ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Date range</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
            <span className="text-slate-400">→</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} />
            <span className="text-xs text-slate-400">
              Pick one day (same date twice) or any range.
            </span>
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            This report is a live snapshot of the fleet — no date range needed.
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Filters</span>
          {(type === "inspections" || type === "maintenance") && (
            <input value={van} onChange={(e) => setVan(e.target.value)} placeholder="Van # (optional)" className={inputCls} />
          )}
          {(type === "inspections" || type === "driver-stats") && (
            <input value={driver} onChange={(e) => setDriver(e.target.value)} placeholder="Driver name (optional)" className={inputCls} />
          )}
          {type === "vans" && <span className="text-xs text-slate-400">None for this report.</span>}
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          <button
            onClick={preview}
            disabled={busy}
            className="rounded-lg px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40"
            style={{ background: brand }}
          >
            {busy ? "Working…" : "Preview report"}
          </button>
          <button
            onClick={exportExcel}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            <IconDownload size={15} /> Excel
          </button>
          <button
            onClick={exportPdf}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            <IconDownload size={15} /> PDF
          </button>
          <button
            onClick={() => setEmailOpen(true)}
            disabled={busy || !emailReady}
            title={emailReady ? undefined : "Email isn't configured yet"}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            Email now…
          </button>
        </div>
      </div>

      {message && (
        <p
          className={`mt-4 rounded-lg border px-4 py-2.5 text-sm ${
            message.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </p>
      )}

      {/* Preview */}
      {report && (
        <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 px-5 py-3.5">
            <div>
              <p className="text-[15px] font-bold text-slate-900">
                {tenant.name} — {report.title}
              </p>
              <p className="text-xs text-slate-400">
                {report.rangeLabel} · {report.rows.length} rows · Generated {new Date().toLocaleString("en-US")}
              </p>
            </div>
          </div>
          {report.rows.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-400">
              No data for this selection.
            </p>
          ) : (
            <div className="max-h-[520px] overflow-auto">
              <table className="w-full text-left text-[12px]">
                <thead className="sticky top-0 bg-slate-50 text-[10.5px] uppercase tracking-wide text-slate-500">
                  <tr>
                    {report.columns.map((c) => (
                      <th key={c} className="whitespace-nowrap px-3 py-2 font-bold">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((row, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      {row.map((v, j) => (
                        <td key={j} className="max-w-[280px] truncate px-3 py-1.5 text-slate-700" title={String(v ?? "")}>
                          {String(v ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                {totals && (
                  <tfoot className="sticky bottom-0 border-t border-slate-200 bg-slate-50 font-bold text-slate-800">
                    <tr>
                      {totals.map((v, i) => (
                        <td key={i} className="px-3 py-2">{v}</td>
                      ))}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>
      )}

      {/* Auto-email schedules */}
      <ScheduleSection
        brand={brand}
        schedules={schedules}
        setSchedules={(s) => {
          setSchedules(s);
          setSchedDirty(true);
        }}
        dirty={schedDirty}
        onSave={saveSchedules}
        busy={busy}
        emailReady={emailReady}
      />

      {emailOpen && (
        <EmailModal brand={brand} busy={busy} onClose={() => setEmailOpen(false)} onSend={emailNow} />
      )}
    </div>
  );
}

function totalsRow(r: ReportData): (string | number)[] | null {
  const totalable = r.columns.map((c) => TOTAL_COLS.has(c));
  if (!totalable.some(Boolean)) return null;
  return r.columns.map((c, i) => {
    if (i === 0) return "TOTAL";
    if (!totalable[i]) return "";
    const sum = r.rows.reduce((s, row) => s + (Number(row[i]) || 0), 0);
    return Math.round(sum * 100) / 100;
  });
}

function ScheduleSection({
  brand,
  schedules,
  setSchedules,
  dirty,
  onSave,
  busy,
  emailReady,
}: {
  brand: string;
  schedules: ReportSchedule[];
  setSchedules: (s: ReportSchedule[]) => void;
  dirty: boolean;
  onSave: () => void;
  busy: boolean;
  emailReady: boolean;
}) {
  const [newType, setNewType] = useState<ReportType>("driver-stats");
  const [newCadence, setNewCadence] = useState<ReportSchedule["cadence"]>("daily");
  const [newRecipients, setNewRecipients] = useState("");

  const add = () => {
    const recipients = newRecipients.split(/[,;\s]+/).map((r) => r.trim()).filter((r) => r.includes("@"));
    if (recipients.length === 0) return;
    setSchedules([
      ...schedules,
      { id: `sch_${Date.now()}`, type: newType, cadence: newCadence, recipients },
    ]);
    setNewRecipients("");
  };

  const label = (t: ReportType) => TYPES.find((x) => x.type === t)?.label ?? t;

  return (
    <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Automatic email reports</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Reports go out with the 6:00 AM morning run as spreadsheet attachments.
          </p>
        </div>
        <button
          onClick={onSave}
          disabled={busy || !dirty}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          style={{ background: brand }}
        >
          {dirty ? "Save schedules" : "Saved"}
        </button>
      </div>

      {!emailReady && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
          Email delivery isn&apos;t configured yet — schedules save, but nothing sends until it is.
        </p>
      )}

      {schedules.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-400">
          No scheduled reports yet — add one below.
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {schedules.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm">
              <span className="font-semibold text-slate-800">{label(s.type)}</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold capitalize text-slate-500">
                {s.cadence}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs text-slate-500">
                → {s.recipients.join(", ")}
              </span>
              <button
                onClick={() => setSchedules(schedules.filter((x) => x.id !== s.id))}
                className="text-xs font-semibold text-slate-400 hover:text-red-600"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
        <select
          value={newType}
          onChange={(e) => setNewType(e.target.value as ReportType)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none"
        >
          {TYPES.map((t) => (
            <option key={t.type} value={t.type}>{t.label}</option>
          ))}
        </select>
        <select
          value={newCadence}
          onChange={(e) => setNewCadence(e.target.value as ReportSchedule["cadence"])}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none"
        >
          {CADENCES.map((c) => (
            <option key={c.v} value={c.v}>{c.l}</option>
          ))}
        </select>
        <input
          value={newRecipients}
          onChange={(e) => setNewRecipients(e.target.value)}
          placeholder="Recipient emails (comma-separated)"
          className="min-w-[220px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
        />
        <button
          onClick={add}
          disabled={!newRecipients.includes("@")}
          className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          + Add schedule
        </button>
      </div>
    </section>
  );
}

function EmailModal({
  brand,
  busy,
  onClose,
  onSend,
}: {
  brand: string;
  busy: boolean;
  onClose: () => void;
  onSend: (recipients: string[]) => void;
}) {
  const [value, setValue] = useState("");
  const recipients = value.split(/[,;\s]+/).map((r) => r.trim()).filter((r) => r.includes("@"));

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 px-5">
      <div className="w-full max-w-md rounded-xl bg-white p-6">
        <h3 className="text-lg font-bold text-slate-900">Email this report</h3>
        <p className="mt-1.5 text-sm text-slate-500">
          Sends the current report as a spreadsheet attachment.
        </p>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Recipient emails (comma-separated)"
          className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
        />
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button onClick={onClose} className="rounded-lg border border-slate-300 py-2.5 text-sm font-semibold text-slate-700">
            Cancel
          </button>
          <button
            onClick={() => onSend(recipients)}
            disabled={busy || recipients.length === 0}
            className="rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: brand }}
          >
            {busy ? "Sending…" : `Send to ${recipients.length || "…"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
