"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/app/components/portal/AuthProvider";
import { EditVanModal, MaintModal, StatusModal, VanQrModal } from "@/app/components/vanModals";
import { IconCamera, IconQr, IconVan, IconWrench } from "@/app/components/icons";
import type { Inspection, MaintenanceRecord, VanRecord } from "@/lib/types";

/**
 * The van's folder — EVERYTHING about one van in one place: details and
 * status, full maintenance history with costs, and every DVIR it has ever
 * had. New van-related features land here as they're built.
 */

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const dateFmt = (iso: string) => new Date(iso).toLocaleDateString("en-US");
const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
const dayFmt = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US");

export default function VanFolderPage({ params }: { params: Promise<{ vanId: string }> }) {
  const { vanId: raw } = use(params);
  const vanId = decodeURIComponent(raw);
  const { user, tenant, hasPermission } = useAuth();
  const brand = tenant.themeColor;
  const canManage =
    user?.role === "owner" ||
    !!user?.admin ||
    hasPermission("fleet.van_list") ||
    hasPermission("fleet.maintenance");

  const [van, setVan] = useState<VanRecord | null>(null);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [maint, setMaint] = useState<MaintenanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"edit" | "status" | "maint" | "qr" | null>(null);

  const reload = useCallback(() => {
    Promise.all([
      fetch("/api/vans").then((r) => r.json()),
      fetch(`/api/inspections?vanId=${encodeURIComponent(vanId)}`).then((r) => r.json()),
      fetch(`/api/maintenance?vanId=${encodeURIComponent(vanId)}`).then((r) => r.json()),
    ])
      .then(([v, i, m]) => {
        setVan(((v.vans ?? []) as VanRecord[]).find((x) => x.id === vanId) ?? null);
        setInspections(i.inspections ?? []);
        setMaint(m.entries ?? []);
      })
      .finally(() => setLoading(false));
  }, [vanId]);
  useEffect(reload, [reload]);

  const maintTotal = maint.reduce((s, e) => s + e.cost, 0);
  const stats = useMemo(() => {
    const flagged = inspections.filter((i) => i.status === "flagged").length;
    const openIssues = inspections.filter((i) => i.status === "flagged" && !i.resolution).length;
    return { dvirs: inspections.length, flagged, openIssues };
  }, [inspections]);

  if (loading) {
    return <p className="py-24 text-center text-slate-400">Loading van folder…</p>;
  }
  if (!van) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 text-center text-slate-500">
        Van &ldquo;{vanId}&rdquo; not found.{" "}
        <Link href="/portal/fleet/van-list" className="font-semibold underline">
          Back to the Van List
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 md:px-8">
      <nav className="mb-1 flex items-center gap-2 text-sm text-slate-400">
        <Link href="/portal" className="hover:text-slate-600">Portal</Link>
        <span>/</span>
        <Link href="/portal/fleet/van-list" className="hover:text-slate-600">Van List</Link>
        <span>/</span>
        <span className="text-slate-500">{van.id}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="flex h-12 w-12 items-center justify-center rounded-xl"
            style={
              van.active
                ? { background: `${brand}14`, color: brand }
                : { background: "#ffe4e6", color: "#e11d48" }
            }
          >
            <IconVan size={26} />
          </span>
          <div>
            <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-slate-900">
              {van.id}
              <span
                className={`rounded-full border px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${
                  van.active
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-rose-200 bg-rose-50 text-rose-700"
                }`}
              >
                {van.active ? "Active" : "Inactive"}
              </span>
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {[van.year, van.make, van.model].filter(Boolean).join(" ") || "Details not entered"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setModal("qr")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <IconQr size={14} /> QR code
          </button>
          {canManage && (
            <>
              <button
                onClick={() => setModal("edit")}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Edit info
              </button>
              <button
                onClick={() => setModal("status")}
                className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                  van.active
                    ? "border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100"
                    : "bg-emerald-600 font-bold text-white hover:bg-emerald-700"
                }`}
              >
                {van.active ? "Inactivate" : "Activate"}
              </button>
            </>
          )}
        </div>
      </div>

      {!van.active && van.statusReason && (
        <p className="mt-4 rounded-lg border-2 border-rose-300 bg-white px-3.5 py-2.5 text-sm text-slate-700">
          <span className="font-bold text-rose-600">Out of service:</span> {van.statusReason}
          {van.statusChangedAt ? ` · ${dateFmt(van.statusChangedAt)}` : ""}
        </p>
      )}

      {/* Vitals */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            label: "Current mileage",
            value: van.mileage != null ? van.mileage.toLocaleString() : "—",
            sub: van.mileageAsOf ? `from DVIR ${dateFmt(van.mileageAsOf)}` : "",
          },
          { label: "DVIRs on record", value: String(stats.dvirs), sub: stats.openIssues ? `${stats.openIssues} open issue${stats.openIssues === 1 ? "" : "s"}` : "no open issues" },
          { label: "Maintenance total", value: money(maintTotal), sub: `${maint.length} entr${maint.length === 1 ? "y" : "ies"}` },
          { label: "VIN / Plate", value: van.plate || "—", sub: van.vin || "VIN not entered" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-slate-200 bg-white px-4 py-3.5">
            <p className="truncate text-xl font-bold tabular-nums text-slate-900">{s.value}</p>
            <p className="mt-0.5 truncate text-xs font-medium text-slate-500">
              {s.label}
              {s.sub ? ` · ${s.sub}` : ""}
            </p>
          </div>
        ))}
      </div>

      {/* Maintenance */}
      <div className="mt-8 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
          <IconWrench size={15} /> Maintenance history
        </h2>
        <button
          onClick={() => setModal("maint")}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
          style={{ background: brand }}
        >
          + Log maintenance
        </button>
      </div>
      {maint.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-400">
          No maintenance logged for this van yet.
        </p>
      ) : (
        <div className="mt-3 space-y-1.5">
          {maint.map((e) => (
            <div key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm">
              <span className="w-20 tabular-nums text-slate-500">{dayFmt(e.date)}</span>
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-slate-500">{e.category}</span>
              <span className="min-w-0 flex-1 truncate text-slate-700">{e.description}</span>
              {e.mileage != null && (
                <span className="text-xs tabular-nums text-slate-400">{e.mileage.toLocaleString()} mi</span>
              )}
              {e.receiptUrl && (
                <a href={e.receiptUrl} target="_blank" className="text-xs font-semibold underline" style={{ color: brand }}>
                  Receipt
                </a>
              )}
              <span className="font-bold tabular-nums text-slate-900">{money(e.cost)}</span>
            </div>
          ))}
        </div>
      )}

      {/* DVIR history */}
      <h2 className="mt-8 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
        <IconCamera size={15} /> DVIR history
      </h2>
      {inspections.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-400">
          No inspections recorded for this van yet.
        </p>
      ) : (
        <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white">
          {inspections.map((i, idx) => {
            const issues = i.answers.filter((a) => a.value === "issue").length;
            return (
              <div
                key={i.id}
                className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-3.5 py-2.5 text-sm ${idx > 0 ? "border-t border-slate-100" : ""}`}
              >
                <span className="w-24 tabular-nums text-slate-600">{dateFmt(i.createdAt)}</span>
                <span className="w-16 tabular-nums text-slate-400">{timeOf(i.createdAt)}</span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10.5px] font-bold uppercase ${
                    i.tripType === "pre" ? "bg-sky-50 text-sky-700" : "bg-indigo-50 text-indigo-700"
                  }`}
                >
                  {i.tripType}
                </span>
                <span className="min-w-0 flex-1 truncate text-slate-600">
                  {i.driver.name ?? i.driver.raw}
                </span>
                {i.photos.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                    <IconCamera size={12} /> {i.photos.length}
                  </span>
                )}
                <span
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                    i.status === "failed_inspection"
                      ? "border-red-200 bg-red-50 text-red-700"
                      : i.status === "flagged"
                        ? "border-amber-200 bg-amber-50 text-amber-800"
                        : "border-emerald-200 bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {i.status === "failed_inspection" ? "Incomplete" : i.status === "flagged" ? `${issues} issue${issues === 1 ? "" : "s"}` : "Passed"}
                </span>
                {i.resolution && (
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                    Resolved
                  </span>
                )}
                <a
                  href={`/dvir/${i.id}`}
                  target="_blank"
                  className="text-xs font-semibold"
                  style={{ color: brand }}
                >
                  DVIR →
                </a>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals (shared with the Van List grid) */}
      {modal === "edit" && (
        <EditVanModal
          van={van}
          brand={brand}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            reload();
          }}
        />
      )}
      {modal === "status" && (
        <StatusModal
          van={van}
          brand={brand}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            reload();
          }}
        />
      )}
      {modal === "maint" && (
        <MaintModal
          van={van}
          brand={brand}
          canManage={canManage}
          userName={user?.name ?? ""}
          onClose={() => {
            setModal(null);
            reload();
          }}
        />
      )}
      {modal === "qr" && <VanQrModal van={van} brand={brand} onClose={() => setModal(null)} />}
    </div>
  );
}
