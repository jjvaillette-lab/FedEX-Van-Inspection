"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/app/components/portal/AuthProvider";
import { IconDownload, IconPlus, IconVan, IconWrench } from "@/app/components/icons";
import type { Inspection, MaintenanceRecord } from "@/lib/types";

const CATEGORIES = ["Repair", "Preventive", "Tires", "Brakes", "Oil / Fluids", "Body", "Other"];

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const dateFmt = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US");

export default function MaintenancePage() {
  const { user, tenant, hasPermission } = useAuth();
  const brand = tenant.themeColor;
  const canManage = user?.role === "owner" || !!user?.admin || hasPermission("fleet.maintenance");

  const [entries, setEntries] = useState<MaintenanceRecord[]>([]);
  const [persisted, setPersisted] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [logOpen, setLogOpen] = useState(false);
  const [selVan, setSelVan] = useState<string | null>(null);
  const [knownVans, setKnownVans] = useState<string[]>([]);

  const reload = () => {
    fetch("/api/maintenance")
      .then((r) => r.json())
      .then((d) => {
        setEntries(d.entries ?? []);
        setPersisted(d.persisted !== false);
        setApiError(d.error ?? null);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
    // Vans seen in inspections seed the van picker (plus any typed manually).
    fetch("/api/inspections")
      .then((r) => r.json())
      .then((d) =>
        setKnownVans(
          [...new Set(((d.inspections ?? []) as Inspection[]).map((i) => i.vanId))].sort((a, b) =>
            a.localeCompare(b, undefined, { numeric: true })
          )
        )
      )
      .catch(() => {});
  }, []);

  const allVans = useMemo(
    () =>
      [...new Set([...knownVans, ...entries.map((e) => e.vanId)])].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true })
      ),
    [knownVans, entries]
  );

  const shown = selVan ? entries.filter((e) => e.vanId === selVan) : entries;

  const thisYear = new Date().getFullYear();
  const stats = useMemo(() => {
    const ytd = entries.filter((e) => new Date(`${e.date}T12:00:00`).getFullYear() === thisYear);
    const ytdSpend = ytd.reduce((s, e) => s + e.cost, 0);
    const byVanYtd = new Map<string, number>();
    ytd.forEach((e) => byVanYtd.set(e.vanId, (byVanYtd.get(e.vanId) ?? 0) + e.cost));
    const top = [...byVanYtd.entries()].sort((a, b) => b[1] - a[1])[0];
    return {
      ytdSpend,
      count: entries.length,
      vans: new Set(entries.map((e) => e.vanId)).size,
      topVan: top ? `${top[0]} (${money(top[1])})` : "—",
    };
  }, [entries, thisYear]);

  /** Van ROI rollup: what each vehicle is costing. */
  const costByVan = useMemo(() => {
    const map = new Map<string, { count: number; ytd: number; allTime: number; last?: MaintenanceRecord }>();
    for (const e of entries) {
      const v = map.get(e.vanId) ?? { count: 0, ytd: 0, allTime: 0, last: undefined };
      v.count += 1;
      v.allTime += e.cost;
      if (new Date(`${e.date}T12:00:00`).getFullYear() === thisYear) v.ytd += e.cost;
      if (!v.last || e.date > v.last.date) v.last = e;
      map.set(e.vanId, v);
    }
    return [...map.entries()]
      .map(([vanId, v]) => ({ vanId, ...v }))
      .sort((a, b) => b.ytd - a.ytd || b.allTime - a.allTime);
  }, [entries, thisYear]);

  const exportCsv = () => {
    const rows = [
      ["Date", "Van", "Category", "Description", "Mileage", "Cost", "Receipt", "Logged by"],
      ...shown.map((e) => [
        dateFmt(e.date),
        e.vanId,
        e.category,
        e.description,
        e.mileage != null ? String(e.mileage) : "",
        e.cost.toFixed(2),
        e.receiptUrl ? "yes" : "",
        e.createdBy ?? "",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `maintenance-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const remove = async (id: string) => {
    await fetch(`/api/maintenance?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    reload();
  };

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:px-8">
      <nav className="mb-1 flex items-center gap-2 text-sm text-slate-400">
        <Link href="/portal" className="hover:text-slate-600">Portal</Link>
        <span>/</span>
        <Link href="/portal/fleet" className="hover:text-slate-600">Fleet</Link>
        <span>/</span>
        <span className="text-slate-500">Maintenance</span>
      </nav>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Maintenance &amp; Costs</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Every repair by van — mileage, cost, and receipts — rolled up into what each vehicle
            really costs you.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <IconDownload size={16} /> Export CSV
          </button>
          {canManage && (
            <button
              onClick={() => setLogOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold text-white"
              style={{ background: brand }}
            >
              <IconPlus size={16} /> Log maintenance
            </button>
          )}
        </div>
      </div>

      {(!persisted || apiError) && (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {apiError ?? "Database not configured."}
        </p>
      )}

      {/* Stat tiles */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: `Spend this year (${thisYear})`, value: money(stats.ytdSpend) },
          { label: "Entries logged", value: String(stats.count) },
          { label: "Vans tracked", value: String(stats.vans) },
          { label: "Highest-cost van (YTD)", value: stats.topVan },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-slate-200 bg-white px-4 py-3.5">
            <p className="truncate text-xl font-bold tabular-nums text-slate-900">{s.value}</p>
            <p className="mt-0.5 text-xs font-medium text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Van filter */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <select
          value={selVan ?? ""}
          onChange={(e) => setSelVan(e.target.value || null)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
        >
          <option value="">All vans</option>
          {allVans.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
        {selVan && (
          <button onClick={() => setSelVan(null)} className="text-xs font-semibold text-slate-400 underline">
            Clear
          </button>
        )}
      </div>

      {/* Entries */}
      <div className="mt-4">
        {loading ? (
          <p className="py-16 text-center text-slate-400">Loading…</p>
        ) : shown.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-400">
            No maintenance logged{selVan ? ` for ${selVan}` : ""} yet.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            {shown.map((e, idx) => (
              <div
                key={e.id}
                className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 ${idx > 0 ? "border-t border-slate-100" : ""}`}
              >
                <span className="w-20 text-sm tabular-nums text-slate-500">{dateFmt(e.date)}</span>
                <span className="w-24 font-semibold text-slate-900">{e.vanId}</span>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500">
                  {e.category}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{e.description}</span>
                {e.mileage != null && (
                  <span className="text-xs tabular-nums text-slate-400">{e.mileage.toLocaleString()} mi</span>
                )}
                {e.receiptUrl && (
                  <a href={e.receiptUrl} target="_blank" className="text-xs font-semibold underline" style={{ color: brand }}>
                    Receipt
                  </a>
                )}
                <span className="w-24 text-right font-bold tabular-nums text-slate-900">{money(e.cost)}</span>
                {canManage && (
                  <button
                    onClick={() => remove(e.id)}
                    title="Delete entry"
                    className="text-xs font-semibold text-slate-300 hover:text-red-600"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cost by van (Van ROI) */}
      {costByVan.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
            <IconVan size={16} /> Cost by van
          </h2>
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="hidden gap-3 border-b border-slate-100 bg-slate-50 px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-400 sm:flex">
              <span className="flex-1">Van</span>
              <span className="w-20 text-right">Entries</span>
              <span className="w-32 text-right">Last service</span>
              <span className="w-28 text-right">{thisYear} cost</span>
              <span className="w-28 text-right">All-time</span>
            </div>
            {costByVan.map((v, idx) => (
              <button
                key={v.vanId}
                onClick={() => setSelVan(v.vanId)}
                className={`flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left text-sm hover:bg-slate-50 ${idx > 0 ? "border-t border-slate-100" : ""}`}
              >
                <span className="flex-1 font-semibold text-slate-800">{v.vanId}</span>
                <span className="w-20 text-right tabular-nums text-slate-600">{v.count}</span>
                <span className="w-32 text-right text-xs tabular-nums text-slate-400">
                  {v.last ? `${dateFmt(v.last.date)}${v.last.mileage != null ? ` · ${v.last.mileage.toLocaleString()} mi` : ""}` : "—"}
                </span>
                <span className="w-28 text-right font-semibold tabular-nums text-slate-900">{money(v.ytd)}</span>
                <span className="w-28 text-right tabular-nums text-slate-500">{money(v.allTime)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {logOpen && (
        <LogModal
          vans={allVans}
          brand={brand}
          userName={user?.name ?? ""}
          onClose={() => setLogOpen(false)}
          onSaved={() => {
            setLogOpen(false);
            reload();
          }}
        />
      )}
    </div>
  );
}

/* ---------- log-maintenance modal ---------- */

function LogModal({
  vans,
  brand,
  userName,
  onClose,
  onSaved,
}: {
  vans: string[];
  brand: string;
  userName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [vanId, setVanId] = useState("");
  const [customVan, setCustomVan] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [mileage, setMileage] = useState("");
  const [category, setCategory] = useState("Repair");
  const [description, setDescription] = useState("");
  const [cost, setCost] = useState("");
  const [receipt, setReceipt] = useState<string | null>(null);
  const [receiptName, setReceiptName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setReceipt(reader.result as string);
      setReceiptName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vanId,
          date,
          mileage: mileage ? Number(mileage) : null,
          category,
          description,
          cost: cost ? Number(cost) : 0,
          receiptDataUrl: receipt ?? undefined,
          createdBy: userName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      onSaved();
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
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
          <IconWrench size={19} /> Log maintenance
        </h2>
        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Van *</label>
            {customVan ? (
              <input
                value={vanId}
                onChange={(e) => setVanId(e.target.value)}
                placeholder="Van ID (e.g. Van 12)"
                className={inputCls}
              />
            ) : (
              <select
                value={vanId}
                onChange={(e) => {
                  if (e.target.value === "__new__") {
                    setCustomVan(true);
                    setVanId("");
                  } else setVanId(e.target.value);
                }}
                className={`${inputCls} bg-white`}
              >
                <option value="">Select a van…</option>
                {vans.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
                <option value="__new__">+ Other / new van…</option>
              </select>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Date *</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Mileage</label>
              <input
                inputMode="numeric"
                value={mileage}
                onChange={(e) => setMileage(e.target.value.replace(/[^\d]/g, ""))}
                placeholder="e.g. 48200"
                className={inputCls}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={`${inputCls} bg-white`}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Cost ($)</label>
              <input
                inputMode="decimal"
                value={cost}
                onChange={(e) => setCost(e.target.value.replace(/[^\d.]/g, ""))}
                placeholder="0.00"
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">What was done *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="e.g. Replaced front brake pads and rotors"
              className={inputCls}
            />
          </div>
          <div>
            <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full rounded-lg border border-dashed border-slate-300 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              {receiptName ? `Receipt attached: ${receiptName}` : "Upload receipt (optional)"}
            </button>
            <p className="mt-1 text-[11px] text-slate-400">Saved to this van&apos;s folder.</p>
          </div>
          {err && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button onClick={onClose} className="rounded-lg border border-slate-300 py-2.5 text-sm font-semibold text-slate-700">
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={busy || !vanId.trim() || !date || !description.trim()}
              className="rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              style={{ background: brand }}
            >
              {busy ? "Saving…" : "Save entry"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
