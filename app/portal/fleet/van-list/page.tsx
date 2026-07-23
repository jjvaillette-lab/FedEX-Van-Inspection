"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/app/components/portal/AuthProvider";
import { IconVan, IconWrench } from "@/app/components/icons";
import type { MaintenanceRecord, VanRecord } from "@/lib/types";

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const dateFmt = (iso: string) => new Date(iso).toLocaleDateString("en-US");
const dayFmt = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US");

export default function VanListPage() {
  const { user, tenant, hasPermission } = useAuth();
  const brand = tenant.themeColor;
  const canManage = user?.role === "owner" || !!user?.admin || hasPermission("fleet.maintenance");

  const [vans, setVans] = useState<VanRecord[]>([]);
  const [persisted, setPersisted] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editVan, setEditVan] = useState<VanRecord | null>(null);
  const [maintVan, setMaintVan] = useState<VanRecord | null>(null);
  const [statusVan, setStatusVan] = useState<VanRecord | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const reload = () => {
    fetch("/api/vans")
      .then((r) => r.json())
      .then((d) => {
        setVans(d.vans ?? []);
        setPersisted(d.persisted !== false);
        setApiError(d.error ?? null);
      })
      .finally(() => setLoading(false));
  };
  useEffect(reload, []);

  const active = useMemo(() => vans.filter((v) => v.active), [vans]);
  const inactive = useMemo(() => vans.filter((v) => !v.active), [vans]);

  const VanCard = ({ v }: { v: VanRecord }) => (
    <div
      className={`rounded-xl border bg-white p-4 ${
        v.active ? "border-slate-200" : "border-rose-200"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-lg"
            style={
              v.active
                ? { background: `${brand}14`, color: brand }
                : { background: "#ffe4e6", color: "#e11d48" }
            }
          >
            <IconVan size={19} />
          </span>
          <div>
            <p className="font-bold text-slate-900">{v.id}</p>
            <p className="text-[11px] text-slate-400">
              {[v.year, v.make, v.model].filter(Boolean).join(" ") || "Details not entered"}
            </p>
          </div>
        </div>
        <span
          className={`rounded-full border px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide ${
            v.active
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {v.active ? "Active" : "Inactive"}
        </span>
      </div>

      {!v.active && v.statusReason && (
        <p className="mt-2.5 rounded-lg border border-rose-100 bg-rose-50 px-2.5 py-1.5 text-[11px] text-rose-800">
          {v.statusReason}
          {v.statusChangedAt ? ` · ${dateFmt(v.statusChangedAt)}` : ""}
        </p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px]">
        <p><span className="text-slate-400">VIN:</span> <span className="font-medium text-slate-700">{v.vin || "—"}</span></p>
        <p><span className="text-slate-400">Plate:</span> <span className="font-medium text-slate-700">{v.plate || "—"}</span></p>
        <p className="col-span-2">
          <span className="text-slate-400">Mileage:</span>{" "}
          <span className="font-bold tabular-nums text-slate-900">
            {v.mileage != null ? v.mileage.toLocaleString() : "—"}
          </span>
          {v.mileageAsOf && (
            <span className="text-slate-400"> · from DVIR {dateFmt(v.mileageAsOf)}</span>
          )}
        </p>
      </div>

      <div className="mt-3.5 flex gap-2">
        <button
          onClick={() => setMaintVan(v)}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          <IconWrench size={14} /> Maint
        </button>
        {canManage && (
          <>
            <button
              onClick={() => setEditVan(v)}
              className="flex-1 rounded-lg border border-slate-300 bg-white py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Edit info
            </button>
            <button
              onClick={() => setStatusVan(v)}
              className={`flex-1 rounded-lg py-2 text-xs font-bold text-white ${
                v.active ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700"
              }`}
            >
              {v.active ? "Inactivate" : "Activate"}
            </button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:px-8">
      <nav className="mb-1 flex items-center gap-2 text-sm text-slate-400">
        <Link href="/portal" className="hover:text-slate-600">Portal</Link>
        <span>/</span>
        <Link href="/portal/fleet" className="hover:text-slate-600">Fleet</Link>
        <span>/</span>
        <span className="text-slate-500">Van List</span>
      </nav>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Van List</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Every van&apos;s folder — details, latest DVIR mileage, maintenance, and service status.
            Safety issues on a DVIR ground a van automatically.
          </p>
        </div>
        {canManage && (
          <button
            onClick={() =>
              setEditVan({ id: "", active: true, unregistered: true })
            }
            className="rounded-lg px-3.5 py-2 text-sm font-semibold text-white"
            style={{ background: brand }}
          >
            + Add van
          </button>
        )}
      </div>

      {(!persisted || apiError) && (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {apiError ?? "Database not configured."}
        </p>
      )}
      {message && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{message}</p>
      )}

      {loading ? (
        <p className="py-16 text-center text-slate-400">Loading…</p>
      ) : (
        <>
          <h2 className="mt-7 mb-2.5 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-emerald-700">
            Active Vans
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs tabular-nums">
              {active.length}
            </span>
            <span className="h-px flex-1 bg-slate-200" />
          </h2>
          {active.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-400">
              No active vans.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {active.map((v) => <VanCard key={v.id} v={v} />)}
            </div>
          )}

          <h2 className="mt-8 mb-2.5 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-rose-700">
            Inactive Vans
            <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs tabular-nums">
              {inactive.length}
            </span>
            <span className="h-px flex-1 bg-slate-200" />
          </h2>
          {inactive.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-400">
              No vans out of service. 🎉
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {inactive.map((v) => <VanCard key={v.id} v={v} />)}
            </div>
          )}
        </>
      )}

      {editVan && (
        <EditVanModal
          van={editVan}
          brand={brand}
          onClose={() => setEditVan(null)}
          onSaved={() => {
            setEditVan(null);
            reload();
          }}
        />
      )}
      {maintVan && (
        <MaintModal van={maintVan} brand={brand} canManage={canManage} userName={user?.name ?? ""} onClose={() => setMaintVan(null)} />
      )}
      {statusVan && (
        <StatusModal
          van={statusVan}
          brand={brand}
          onClose={() => setStatusVan(null)}
          onDone={(err) => {
            setStatusVan(null);
            if (err) setMessage(err);
            else {
              setMessage(null);
              reload();
            }
          }}
        />
      )}
    </div>
  );
}

/* ---------- edit / add van ---------- */

function EditVanModal({
  van,
  brand,
  onClose,
  onSaved,
}: {
  van: VanRecord;
  brand: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = !van.id;
  const [id, setId] = useState(van.id);
  const [vin, setVin] = useState(van.vin ?? "");
  const [make, setMake] = useState(van.make ?? "");
  const [model, setModel] = useState(van.model ?? "");
  const [year, setYear] = useState(van.year ?? "");
  const [plate, setPlate] = useState(van.plate ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/vans", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, vin, make, model, year, plate, ...(isNew ? { active: true } : {}) }),
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
      <div className="w-full max-w-md rounded-xl bg-white p-6">
        <h2 className="text-lg font-bold text-slate-900">{isNew ? "Add van" : `Edit ${van.id}`}</h2>
        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Van number / ID *</label>
            <input
              value={id}
              onChange={(e) => setId(e.target.value)}
              disabled={!isNew}
              placeholder="e.g. Van 12"
              className={`${inputCls} disabled:bg-slate-50 disabled:text-slate-500`}
            />
            {isNew && (
              <p className="mt-1 text-[11px] text-slate-400">
                Must match what drivers scan on the DVIR (the van QR code value).
              </p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">VIN</label>
            <input value={vin} onChange={(e) => setVin(e.target.value.toUpperCase())} className={inputCls} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Year</label>
              <input value={year} onChange={(e) => setYear(e.target.value)} placeholder="2022" className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Make</label>
              <input value={make} onChange={(e) => setMake(e.target.value)} placeholder="Ford" className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Model</label>
              <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Transit" className={inputCls} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">License plate</label>
            <input value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} className={inputCls} />
          </div>
          {err && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button onClick={onClose} className="rounded-lg border border-slate-300 py-2.5 text-sm font-semibold text-slate-700">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={busy || !id.trim()}
              className="rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              style={{ background: brand }}
            >
              {busy ? "Saving…" : "Save van"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- activate / inactivate ---------- */

function StatusModal({
  van,
  brand,
  onClose,
  onDone,
}: {
  van: VanRecord;
  brand: string;
  onClose: () => void;
  onDone: (err?: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/vans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: van.id, active: !van.active, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      onDone();
    } catch (e) {
      onDone(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 px-5">
      <div className="w-full max-w-md rounded-xl bg-white p-6">
        <h2 className="text-lg font-bold text-slate-900">
          {van.active ? `Take ${van.id} out of service?` : `Return ${van.id} to service?`}
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          {van.active
            ? "The van moves to the Inactive list and managers will see it's not usable."
            : `The van returns to the Active list.${van.statusReason ? ` Make sure the issue is resolved: "${van.statusReason}"` : ""}`}
        </p>
        {van.active && (
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional — e.g. transmission repair)"
            className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
          />
        )}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={onClose} className="rounded-lg border border-slate-300 py-2.5 text-sm font-semibold text-slate-700">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className={`rounded-lg py-2.5 text-sm font-bold text-white disabled:opacity-40 ${
              van.active ? "bg-rose-600" : "bg-emerald-600"
            }`}
          >
            {busy ? "Saving…" : van.active ? "Inactivate van" : "Activate van"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- maintenance (per van) ---------- */

const CATEGORIES = ["Repair", "Preventive", "Tires", "Brakes", "Oil / Fluids", "Body", "Other"];

function MaintModal({
  van,
  brand,
  canManage,
  userName,
  onClose,
}: {
  van: VanRecord;
  brand: string;
  canManage: boolean;
  userName: string;
  onClose: () => void;
}) {
  const [entries, setEntries] = useState<MaintenanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [cost, setCost] = useState("");
  const [category, setCategory] = useState("Repair");
  const [description, setDescription] = useState("");
  const [receipt, setReceipt] = useState<string | null>(null);
  const [receiptName, setReceiptName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reload = () => {
    fetch(`/api/maintenance?vanId=${encodeURIComponent(van.id)}`)
      .then((r) => r.json())
      .then((d) => setEntries(d.entries ?? []))
      .finally(() => setLoading(false));
  };
  useEffect(reload, []); // eslint-disable-line react-hooks/exhaustive-deps

  const total = entries.reduce((s, e) => s + e.cost, 0);

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
          vanId: van.id,
          date,
          cost: Number(cost),
          category,
          description,
          receiptDataUrl: receipt ?? undefined,
          createdBy: userName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setShowForm(false);
      setCost("");
      setDescription("");
      setReceipt(null);
      setReceiptName(null);
      reload();
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
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <IconWrench size={18} /> {van.id} — Maintenance
          </h2>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold tabular-nums text-slate-700">
            Total: {money(total)}
          </span>
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-slate-400">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-400">
            No maintenance logged for this van yet.
          </p>
        ) : (
          <div className="mt-4 space-y-1.5">
            {entries.map((e) => (
              <div key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <span className="w-20 tabular-nums text-slate-500">{dayFmt(e.date)}</span>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-slate-500">{e.category}</span>
                <span className="min-w-0 flex-1 truncate text-slate-700">{e.description}</span>
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

        {canManage && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 w-full rounded-lg py-2.5 text-sm font-semibold text-white"
            style={{ background: brand }}
          >
            + Log maintenance
          </button>
        )}

        {showForm && (
          <div className="mt-4 rounded-xl border border-slate-200 p-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Date performed *</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Cost ($) *</label>
                <input
                  inputMode="decimal"
                  value={cost}
                  onChange={(e) => setCost(e.target.value.replace(/[^\d.]/g, ""))}
                  placeholder="0.00"
                  className={inputCls}
                />
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Category</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className={`${inputCls} bg-white`}>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">What was done (optional)</label>
                <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} />
              </div>
            </div>
            <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            <button
              onClick={() => fileRef.current?.click()}
              className="mt-3 w-full rounded-lg border border-dashed border-slate-300 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              {receiptName ? `Receipt attached: ${receiptName}` : "Upload receipt (optional)"}
            </button>
            {err && <p className="mt-2 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button onClick={() => setShowForm(false)} className="rounded-lg border border-slate-300 py-2 text-sm font-semibold text-slate-700">
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={busy || !date || cost.trim() === ""}
                className="rounded-lg py-2 text-sm font-semibold text-white disabled:opacity-40"
                style={{ background: brand }}
              >
                {busy ? "Saving…" : "Save entry"}
              </button>
            </div>
          </div>
        )}

        <button onClick={onClose} className="mt-4 w-full rounded-lg border border-slate-300 py-2.5 text-sm font-semibold text-slate-700">
          Close
        </button>
        <p className="mt-2 text-center text-[11px] text-slate-400">
          Full cost reporting across all vans lives in Fleet › Maintenance &amp; Costs.
        </p>
      </div>
    </div>
  );
}
