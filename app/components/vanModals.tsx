"use client";

import { useEffect, useRef, useState } from "react";
import { parseJsonResponse, uploadReceiptFile, validateReceiptFile } from "@/app/components/uploadFile";
import { IconWrench } from "@/app/components/icons";
import type { MaintenanceRecord, VanRecord } from "@/lib/types";

/**
 * Shared van modals — used by the Van List grid and the per-van detail page.
 */

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const dayFmt = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US");

/* ---------- edit / add van ---------- */

export function EditVanModal({
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

/* ---------- van QR code ---------- */

/**
 * Every van's scannable code, generated on the spot from the van number —
 * so a reprinted or replaced sticker is always correct, automatically.
 */
export function VanQrModal({
  van,
  brand,
  onClose,
}: {
  van: VanRecord;
  brand: string;
  onClose: () => void;
}) {
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    import("qrcode").then(async (m) => {
      const dataUrl = await m.default.toDataURL(van.id, { width: 600, margin: 2 });
      if (alive) setQr(dataUrl);
    });
    return () => {
      alive = false;
    };
  }, [van.id]);

  const detail = [van.year, van.make, van.model].filter(Boolean).join(" ");

  const print = () => {
    if (!qr) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!doctype html><html><head><title>${van.id} — QR</title><style>
      body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;display:flex;justify-content:center;padding-top:40px}
      .card{text-align:center;border:2px solid #111;border-radius:16px;padding:32px 40px;max-width:420px}
      h1{font-size:34px;margin:0 0 4px}
      .sub{color:#555;font-size:14px;margin:0 0 16px}
      img{width:300px;height:300px}
      .note{margin-top:20px;font-size:13px;color:#888}
      @media print{body{padding-top:0}}
    </style><script>window.onload=function(){window.print();}</scr${""}ipt></head><body>
      <div class="card">
        <h1>${van.id}</h1>
        <p class="sub">${detail || "&nbsp;"}${van.plate ? ` · ${van.plate}` : ""}</p>
        <img src="${qr}" alt="QR" />
        <p class="note">DVIR — mount inside the driver door</p>
      </div>
    </body></html>`);
    win.document.close();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 px-5">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 text-center">
        <h2 className="text-lg font-bold text-slate-900">{van.id} — QR code</h2>
        <p className="mt-1 text-xs text-slate-500">
          {detail}
          {van.plate ? ` · ${van.plate}` : ""}
        </p>
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt={`QR code for ${van.id}`} className="mx-auto mt-4 h-56 w-56 rounded-lg border border-slate-200" />
        ) : (
          <div className="mx-auto mt-4 flex h-56 w-56 items-center justify-center rounded-lg border border-slate-200 text-sm text-slate-400">
            Generating…
          </div>
        )}
        <p className="mt-3 text-[11px] text-slate-400">
          Drivers scan this to start a DVIR for this van. It&apos;s generated fresh from the van
          number every time — a reprint is always correct.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button onClick={onClose} className="rounded-lg border border-slate-300 py-2.5 text-sm font-semibold text-slate-700">
            Close
          </button>
          <button
            onClick={print}
            disabled={!qr}
            className="rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: brand }}
          >
            Print QR
          </button>
        </div>
      </div>
    </div>
  );
}


/* ---------- activate / inactivate ---------- */

export function StatusModal({
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

export function MaintModal({
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
  const [receipt, setReceipt] = useState<File | null>(null);
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
    const sizeErr = validateReceiptFile(file);
    if (sizeErr) {
      setErr(sizeErr);
      return;
    }
    setErr(null);
    setReceipt(file);
    setReceiptName(file.name);
  };

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      // Receipts go straight to cloud storage (big PDFs never hit API limits).
      const receiptUrl = receipt ? await uploadReceiptFile(receipt, van.id) : null;
      if (receipt && !receiptUrl) {
        throw new Error("Receipt upload failed — check your connection and try again.");
      }
      const res = await fetch("/api/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vanId: van.id,
          date,
          cost: Number(cost),
          category,
          description,
          receiptUrl: receiptUrl ?? undefined,
          createdBy: userName,
        }),
      });
      const data = await parseJsonResponse(res);
      if (!res.ok) throw new Error((data.error as string) ?? "Save failed");
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
              {receiptName ? `Receipt attached: ${receiptName}` : "Upload receipt (optional, up to 10 MB)"}
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
