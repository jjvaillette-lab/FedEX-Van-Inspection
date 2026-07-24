"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/app/components/portal/AuthProvider";
import { parseJsonResponse, uploadReceiptFile, validateReceiptFile } from "@/app/components/uploadFile";
import { EditVanModal, MaintModal, StatusModal, VanQrModal } from "@/app/components/vanModals";
import { IconAlert, IconQr, IconVan, IconWrench } from "@/app/components/icons";
import type { MaintenanceRecord, VanRecord } from "@/lib/types";

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const dateFmt = (iso: string) => new Date(iso).toLocaleDateString("en-US");
const dayFmt = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US");

export default function VanListPage() {
  const { user, tenant, hasPermission } = useAuth();
  const brand = tenant.themeColor;
  const canManage =
    user?.role === "owner" ||
    !!user?.admin ||
    hasPermission("fleet.van_list") ||
    hasPermission("fleet.maintenance");

  const [vans, setVans] = useState<VanRecord[]>([]);
  const [persisted, setPersisted] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"active" | "inactive">("active");
  const [showAlert, setShowAlert] = useState(false);
  // The out-of-service pop-up fires once per visit to this screen, not on
  // every data refresh after an edit.
  const alertShownRef = useRef(false);
  const [editVan, setEditVan] = useState<VanRecord | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [qrVan, setQrVan] = useState<VanRecord | null>(null);
  const [maintVan, setMaintVan] = useState<VanRecord | null>(null);
  const [statusVan, setStatusVan] = useState<VanRecord | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const SNOOZE_KEY = "lma.inactivePopupSnooze";
  const todaySnoozed = () => {
    try {
      return localStorage.getItem(SNOOZE_KEY) === new Date().toLocaleDateString("en-US");
    } catch {
      return false;
    }
  };
  const snoozeToday = () => {
    try {
      localStorage.setItem(SNOOZE_KEY, new Date().toLocaleDateString("en-US"));
    } catch {
      /* ignore */
    }
    setShowAlert(false);
  };

  const reload = () => {
    fetch("/api/vans")
      .then((r) => r.json())
      .then((d) => {
        const list: VanRecord[] = d.vans ?? [];
        setVans(list);
        setPersisted(d.persisted !== false);
        setApiError(d.error ?? null);
        if (!alertShownRef.current && list.some((v) => !v.active) && !todaySnoozed()) {
          alertShownRef.current = true;
          setShowAlert(true);
        }
      })
      .finally(() => setLoading(false));
  };
  useEffect(reload, []); // eslint-disable-line react-hooks/exhaustive-deps

  const active = useMemo(() => vans.filter((v) => v.active), [vans]);
  const inactive = useMemo(() => vans.filter((v) => !v.active), [vans]);

  const VanCard = ({ v }: { v: VanRecord }) => (
    <div
      className={`rounded-xl border bg-white p-4 ${
        v.active ? "border-slate-200" : "border-rose-200"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/portal/fleet/van-list/${encodeURIComponent(v.id)}`}
          title="Open this van's folder — everything in one place"
          className="group flex items-center gap-2.5"
        >
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
            <p className="font-bold text-slate-900 group-hover:underline">{v.id}</p>
            <p className="text-[11px] text-slate-400">
              {[v.year, v.make, v.model].filter(Boolean).join(" ") || "Details not entered"}
            </p>
          </div>
        </Link>
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
        <p className="mt-2.5 rounded-lg border-2 border-rose-300 bg-white px-2.5 py-1.5 text-[11px] text-slate-600">
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
          onClick={() => setQrVan(v)}
          title="Van QR code — print or replace"
          className="inline-flex w-10 items-center justify-center rounded-lg border border-slate-300 bg-white py-2 text-slate-600 hover:bg-slate-50"
        >
          <IconQr size={15} />
        </button>
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
              className={`flex-1 rounded-lg py-2 text-xs font-semibold ${
                v.active
                  ? "border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100"
                  : "bg-emerald-600 font-bold text-white hover:bg-emerald-700"
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
        <div className="flex flex-wrap items-center gap-2">
          {inactive.length > 0 && (
            <button
              onClick={() => setView("inactive")}
              className="animate-pulse rounded-lg bg-rose-600 px-3.5 py-2 text-sm font-bold text-white hover:bg-rose-700"
              title="Vans out of service — click to view"
            >
              Inactive Vans ({inactive.length})
            </button>
          )}
        {canManage && (
          <div className="flex gap-2">
            <button
              onClick={() => setImportOpen(true)}
              className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Import CSV / Excel
            </button>
            <button
              onClick={() =>
                setEditVan({ id: "", active: true, unregistered: true })
              }
              className="rounded-lg px-3.5 py-2 text-sm font-semibold text-white"
              style={{ background: brand }}
            >
              + Add van
            </button>
          </div>
        )}
        </div>
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
          <div className="mt-7 mb-3 flex flex-wrap items-center gap-2.5">
            <select
              value={view}
              onChange={(e) => setView(e.target.value as "active" | "inactive")}
              className={`rounded-lg border bg-white px-3 py-2 text-sm font-bold outline-none ${
                view === "active"
                  ? "border-emerald-300 text-emerald-700"
                  : "border-rose-300 text-rose-700"
              }`}
            >
              <option value="active">Active Vans ({active.length})</option>
              <option value="inactive">Inactive Vans ({inactive.length})</option>
            </select>
            {view === "active" && inactive.length > 0 && (
              <button
                onClick={() => setView("inactive")}
                className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
              >
                <IconAlert size={13} />
                {inactive.length} van{inactive.length === 1 ? "" : "s"} out of service
              </button>
            )}
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          {(view === "active" ? active : inactive).length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-400">
              {view === "active" ? "No active vans." : "No vans out of service. 🎉"}
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {(view === "active" ? active : inactive).map((v) => <VanCard key={v.id} v={v} />)}
            </div>
          )}
        </>
      )}

      {showAlert && inactive.length > 0 && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 px-5">
          <div className="w-full max-w-md rounded-xl bg-white p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                <IconAlert size={19} />
              </span>
              {inactive.length} van{inactive.length === 1 ? "" : "s"} out of service
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              These vans are inactive and need attention before they can run routes.
            </p>
            <div className="mt-3 max-h-60 space-y-1.5 overflow-y-auto">
              {inactive.map((v) => (
                <div key={v.id} className="rounded-lg border-2 border-rose-300 bg-white px-3 py-2">
                  <p className="text-sm font-bold text-slate-900">{v.id}</p>
                  {v.statusReason && (
                    <p className="text-[11px] text-slate-600">
                      {v.statusReason}
                      {v.statusChangedAt ? ` · ${dateFmt(v.statusChangedAt)}` : ""}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowAlert(false)}
                className="rounded-lg border border-slate-300 py-2.5 text-sm font-semibold text-slate-700"
              >
                OK
              </button>
              <button
                onClick={() => {
                  setView("inactive");
                  setShowAlert(false);
                }}
                className="rounded-lg bg-rose-600 py-2.5 text-sm font-bold text-white hover:bg-rose-700"
              >
                View inactive vans
              </button>
            </div>
            <button
              onClick={snoozeToday}
              className="mt-2.5 w-full rounded-lg py-2 text-xs font-semibold text-slate-400 hover:text-slate-600"
            >
              Don&apos;t show this message again today
            </button>
          </div>
        </div>
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
      {importOpen && (
        <ImportVansModal
          brand={brand}
          onClose={() => setImportOpen(false)}
          onDone={() => {
            setImportOpen(false);
            setMessage(null);
            reload();
          }}
        />
      )}
      {qrVan && <VanQrModal van={qrVan} brand={brand} onClose={() => setQrVan(null)} />}
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

/* ---------- bulk import (CSV / Excel) ---------- */

interface ParsedVan {
  id: string;
  vin?: string;
  make?: string;
  model?: string;
  year?: string;
  plate?: string;
}

const TEMPLATE_CSV =
  "Van Number,VIN,Year,Make,Model,License Plate\nVan 12,1FTBW2CM5NKA12345,2022,Ford,Transit 250,ABC-1234\nVan 13,,2021,Ram,ProMaster,\n";

function ImportVansModal({
  brand,
  onClose,
  onDone,
}: {
  brand: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [parsed, setParsed] = useState<ParsedVan[] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const parseFile = async (file?: File) => {
    if (!file) return;
    setErr(null);
    setFileName(file.name);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer(), { cellDates: false });
      const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], {
        header: 1,
      }) as unknown[][];

      const cell = (v: unknown) => String(v ?? "").trim();
      // Find the header row: the first row with a van/unit/vehicle-ish column.
      const isIdHeader = (h: string) => /van|unit|vehicle|^id$|number|#/i.test(h);
      let headerAt = -1;
      for (let i = 0; i < Math.min(grid.length, 10); i++) {
        if ((grid[i] ?? []).some((c) => isIdHeader(cell(c)))) {
          headerAt = i;
          break;
        }
      }
      if (headerAt < 0) {
        setParsed(null);
        setErr('No van column found. The first row should have headers — at minimum a "Van Number" column.');
        return;
      }

      const headers = (grid[headerAt] ?? []).map((c) => cell(c).toLowerCase());
      const col = (re: RegExp) => headers.findIndex((h) => re.test(h));
      const idCol = (() => {
        const exact = col(/^(van( ?(number|#|id|no\.?))?|unit( ?(number|#|no\.?))?|vehicle( ?(number|#|id|no\.?))?|id)$/);
        return exact >= 0 ? exact : headers.findIndex((h) => isIdHeader(h) && !/vin/.test(h));
      })();
      const vinCol = col(/vin/);
      const yearCol = col(/year/);
      const makeCol = col(/make/);
      const modelCol = col(/model/);
      const plateCol = col(/plate|license|tag/);

      const byId = new Map<string, ParsedVan>();
      for (const row of grid.slice(headerAt + 1)) {
        const id = cell(row?.[idCol]);
        if (!id) continue;
        byId.set(id, {
          id,
          vin: vinCol >= 0 ? cell(row[vinCol]).toUpperCase() : undefined,
          year: yearCol >= 0 ? cell(row[yearCol]).replace(/\.0$/, "") : undefined,
          make: makeCol >= 0 ? cell(row[makeCol]) : undefined,
          model: modelCol >= 0 ? cell(row[modelCol]) : undefined,
          plate: plateCol >= 0 ? cell(row[plateCol]).toUpperCase() : undefined,
        });
      }
      const vans = [...byId.values()];
      if (vans.length === 0) {
        setParsed(null);
        setErr("No van rows found under the header row.");
        return;
      }
      setParsed(vans);
    } catch {
      setParsed(null);
      setErr("Couldn't read that file. Save it as .xlsx or .csv and try again (Numbers: File → Export To).");
    }
  };

  const submit = async () => {
    if (!parsed) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/vans", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vans: parsed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 px-5">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6">
        <h2 className="text-lg font-bold text-slate-900">Import vans</h2>
        <p className="mt-1.5 text-sm text-slate-600">
          Upload a .csv or Excel file with one van per row. Only a{" "}
          <strong>Van Number</strong> column is required — VIN, Year, Make, Model, and License
          Plate are matched automatically when present. Existing vans with the same number are
          updated.
        </p>
        <a
          href={`data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE_CSV)}`}
          download="van-import-template.csv"
          className="mt-2 inline-block text-sm font-semibold underline"
          style={{ color: brand }}
        >
          Download a blank template
        </a>

        <input
          ref={fileRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={(e) => parseFile(e.target.files?.[0])}
        />
        <button
          onClick={() => fileRef.current?.click()}
          className="mt-4 w-full rounded-lg border border-dashed border-slate-300 py-6 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          {fileName ? `Selected: ${fileName} — choose a different file` : "Choose a .csv or .xlsx file"}
        </button>

        {err && <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}

        {parsed && (
          <div className="mt-4">
            <p className="text-sm font-semibold text-slate-800">
              {parsed.length} van{parsed.length === 1 ? "" : "s"} ready to import
            </p>
            <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-[12px]">
                <thead className="bg-slate-50 text-[10.5px] uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-2.5 py-1.5">Van</th>
                    <th className="px-2.5 py-1.5">Year / Make / Model</th>
                    <th className="px-2.5 py-1.5">Plate</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.map((v) => (
                    <tr key={v.id} className="border-t border-slate-100">
                      <td className="px-2.5 py-1.5 font-semibold text-slate-800">{v.id}</td>
                      <td className="px-2.5 py-1.5 text-slate-600">
                        {[v.year, v.make, v.model].filter(Boolean).join(" ") || "—"}
                      </td>
                      <td className="px-2.5 py-1.5 text-slate-600">{v.plate || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={onClose} className="rounded-lg border border-slate-300 py-2.5 text-sm font-semibold text-slate-700">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy || !parsed}
            className="rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: brand }}
          >
            {busy ? "Importing…" : `Import ${parsed ? parsed.length : ""} van${parsed && parsed.length === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );
}

