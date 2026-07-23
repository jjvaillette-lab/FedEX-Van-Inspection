"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/app/components/portal/AuthProvider";
import { PHOTO_STEPS, INTERIOR_STEPS } from "@/lib/questions";
import {
  IconAlert,
  IconCalendar,
  IconCheckCircle,
  IconColumns,
  IconDownload,
  IconSearch,
  IconUsers,
  IconVan,
  IconXCircle,
} from "@/app/components/icons";
import type { Inspection, PhotoSlot } from "@/lib/types";

/* ---------- labels & helpers ---------- */

const SLOT_LABEL: Record<string, string> = Object.fromEntries([
  ...PHOTO_STEPS.map((p) => [p.slot, p.title]),
  ...INTERIOR_STEPS.map((p) => [p.slot, p.title]),
  ["fuel_gauge", "Fuel Gauge"],
  ["optional_1", "Optional 1"],
  ["optional_2", "Optional 2"],
  ["optional_3", "Optional 3"],
  ["optional_4", "Optional 4"],
  ["signature", "Driver Signature"],
]);

const EXTERIOR_SLOTS: PhotoSlot[] = ["driver_side", "back", "passenger_side", "front"];

const dateKey = (iso: string) => new Date(iso).toLocaleDateString("en-US");
const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

function statusMeta(i: Inspection) {
  if (i.status === "failed_inspection")
    return { label: "Failed", cls: "bg-red-50 text-red-700 border-red-200" };
  if (i.status === "flagged")
    return {
      label: `${i.answers.filter((a) => a.value === "issue").length} issue(s)`,
      cls: "bg-amber-50 text-amber-800 border-amber-200",
    };
  return { label: "Passed", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
}

/* ---------- page ---------- */

type ViewMode = "all" | "van" | "driver" | "date";

export default function InspectionReviewCenter() {
  const { user, tenant, hasPermission } = useAuth();
  const brand = tenant.themeColor;

  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("all");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "flagged" | "failed" | "passed">("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [resolveTarget, setResolveTarget] = useState<Inspection | null>(null);

  const reload = () => {
    fetch("/api/inspections")
      .then((r) => r.json())
      .then((d) => setInspections(d.inspections ?? []))
      .catch(() => setInspections([]))
      .finally(() => setLoading(false));
  };
  useEffect(reload, []);

  /* Daily pre/post completeness: pre-trips whose day has no matching post. */
  const missingPost = useMemo(() => {
    const map = new Map<string, { pre: number; post: number }>();
    for (const i of inspections) {
      const k = `${i.vanId}|${dateKey(i.createdAt)}`;
      const e = map.get(k) ?? { pre: 0, post: 0 };
      e[i.tripType] += 1;
      map.set(k, e);
    }
    return map;
  }, [inspections]);

  const today = dateKey(new Date().toISOString());

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return inspections.filter((i) => {
      if (statusFilter === "flagged" && i.status !== "flagged") return false;
      if (statusFilter === "failed" && i.status !== "failed_inspection") return false;
      if (statusFilter === "passed" && i.status !== "passed") return false;
      if (!q) return true;
      return (
        i.vanId.toLowerCase().includes(q) ||
        (i.driver.name ?? i.driver.raw).toLowerCase().includes(q) ||
        (i.driver.route ?? "").toLowerCase().includes(q)
      );
    });
  }, [inspections, search, statusFilter]);

  const groups = useMemo(() => {
    if (view === "all") return [{ key: "All inspections", items: filtered }];
    const by = new Map<string, Inspection[]>();
    for (const i of filtered) {
      const k =
        view === "van" ? `Van ${i.vanId}` :
        view === "driver" ? (i.driver.name ?? i.driver.raw) :
        dateKey(i.createdAt);
      by.set(k, [...(by.get(k) ?? []), i]);
    }
    return [...by.entries()].map(([key, items]) => ({ key, items }));
  }, [filtered, view]);

  const stats = useMemo(() => {
    const flaggedCount = inspections.filter((i) => i.status === "flagged" && !i.resolution).length;
    const failedCount = inspections.filter((i) => i.status === "failed_inspection" && !i.resolution).length;
    let pendingPost = 0;
    for (const [k, e] of missingPost) {
      if (k.endsWith(`|${today}`) && e.pre > e.post) pendingPost += 1;
    }
    return { total: inspections.length, flaggedCount, failedCount, pendingPost };
  }, [inspections, missingPost, today]);

  const toggleCompare = (id: string) =>
    setCompareIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 2 ? [prev[1], id] : [...prev, id]
    );
  const comparePair = compareIds
    .map((id) => inspections.find((i) => i.id === id))
    .filter(Boolean) as Inspection[];

  const exportCsv = () => {
    const rows = [
      ["Date", "Time", "Van", "Driver", "Route", "Trip", "Cycle", "Status", "Issues", "Issue notes", "Resolved by"],
      ...filtered.map((i) => [
        dateKey(i.createdAt),
        timeOf(i.createdAt),
        i.vanId,
        i.driver.name ?? i.driver.raw,
        i.driver.route ?? "",
        i.tripType,
        String(i.cycle),
        i.status,
        String(i.answers.filter((a) => a.value === "issue").length),
        i.answers.filter((a) => a.value === "issue").map((a) => `${a.questionId}${a.note ? `: ${a.note}` : ""}`).join(" | "),
        i.resolution?.resolvedBy ?? "",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `inspections-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const viewTabs: { key: ViewMode; label: string; icon: React.ReactNode }[] = [
    { key: "all", label: "All", icon: null },
    { key: "date", label: "By Date", icon: <IconCalendar size={15} /> },
    { key: "van", label: "By Van", icon: <IconVan size={15} /> },
    { key: "driver", label: "By Driver", icon: <IconUsers size={15} /> },
  ];

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:px-8">
      <nav className="mb-1 flex items-center gap-2 text-sm text-slate-400">
        <Link href="/portal" className="hover:text-slate-600">Portal</Link>
        <span>/</span>
        <Link href="/portal/fleet" className="hover:text-slate-600">Fleet</Link>
        <span>/</span>
        <span className="text-slate-500">Inspections</span>
      </nav>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Inspection Review</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Every pre and post-trip for {tenant.name}, with photo evidence.
          </p>
        </div>
        {hasPermission("inspection.export") && (
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <IconDownload size={16} /> Export CSV
          </button>
        )}
      </div>

      {/* Stat tiles */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Total inspections", value: stats.total, tone: "text-slate-900" },
          { label: "Open issues", value: stats.flaggedCount, tone: stats.flaggedCount ? "text-amber-600" : "text-slate-900" },
          { label: "Failed inspections", value: stats.failedCount, tone: stats.failedCount ? "text-red-600" : "text-slate-900" },
          { label: "Post-trips pending today", value: stats.pendingPost, tone: stats.pendingPost ? "text-amber-600" : "text-slate-900" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-slate-200 bg-white px-4 py-3.5">
            <p className={`text-2xl font-bold tabular-nums ${s.tone}`}>{s.value}</p>
            <p className="mt-0.5 text-xs font-medium text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-slate-300 bg-white p-0.5">
          {viewTabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setView(t.key)}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${
                view === t.key ? "text-white" : "text-slate-600 hover:bg-slate-50"
              }`}
              style={view === t.key ? { background: brand } : undefined}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <IconSearch size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search van, driver, route…"
            className="w-56 rounded-lg border border-slate-300 bg-white py-2 pl-8 pr-3 text-sm outline-none focus:border-slate-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
        >
          <option value="all">All statuses</option>
          <option value="flagged">With issues</option>
          <option value="failed">Failed inspections</option>
          <option value="passed">Passed</option>
        </select>
        {comparePair.length === 2 && (
          <button
            onClick={() => setCompareOpen(true)}
            className="ml-auto inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold text-white"
            style={{ background: brand }}
          >
            <IconColumns size={16} /> Compare selected (2)
          </button>
        )}
      </div>

      {/* List */}
      {loading ? (
        <p className="py-20 text-center text-slate-400">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="py-20 text-center text-slate-400">No inspections match.</p>
      ) : (
        <div className="mt-5 space-y-7">
          {groups.map((g) => (
            <section key={g.key}>
              {view !== "all" && (
                <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
                  {g.key}
                  <span className="rounded-full border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-400">
                    {g.items.length}
                  </span>
                </h2>
              )}
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                {g.items.map((i, idx) => {
                  const meta = statusMeta(i);
                  const open = expanded === i.id;
                  const dk = dateKey(i.createdAt);
                  const dayEntry = missingPost.get(`${i.vanId}|${dk}`);
                  const missing =
                    i.tripType === "pre" && dayEntry && dayEntry.pre > dayEntry.post;
                  const multiple = dayEntry && dayEntry.pre > 1;
                  return (
                    <div key={i.id} className={idx > 0 ? "border-t border-slate-100" : ""}>
                      <div className="flex items-center gap-3 px-4 py-3">
                        <input
                          type="checkbox"
                          checked={compareIds.includes(i.id)}
                          onChange={() => toggleCompare(i.id)}
                          title="Select for side-by-side compare"
                          className="h-4 w-4 rounded border-slate-300"
                          style={{ accentColor: brand }}
                        />
                        <button
                          onClick={() => setExpanded(open ? null : i.id)}
                          className="flex flex-1 flex-wrap items-center gap-x-4 gap-y-1 text-left"
                        >
                          <span className="w-24 font-semibold text-slate-900">{i.vanId}</span>
                          <span className="w-40 truncate text-sm text-slate-600">
                            {i.driver.name ?? i.driver.raw}
                          </span>
                          <span className="text-sm tabular-nums text-slate-500">
                            {dk} · {timeOf(i.createdAt)}
                          </span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                              i.tripType === "pre" ? "bg-sky-50 text-sky-700" : "bg-indigo-50 text-indigo-700"
                            }`}
                          >
                            {i.tripType}
                            {i.cycle > 1 ? ` #${i.cycle}` : ""}
                          </span>
                          {multiple && (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500">
                              multiple today
                            </span>
                          )}
                          {missing && (
                            <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold uppercase ${dk === today ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>
                              {dk === today ? "post-trip pending" : "missing post-trip"}
                            </span>
                          )}
                          <span className={`ml-auto rounded-full border px-2.5 py-0.5 text-xs font-semibold ${meta.cls}`}>
                            {meta.label}
                          </span>
                          {i.resolution && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                              <IconCheckCircle size={13} /> Resolved
                            </span>
                          )}
                        </button>
                      </div>

                      {open && (
                        <ExpandedDetails
                          inspection={i}
                          brand={brand}
                          canResolve={hasPermission("inspection.resolve")}
                          onResolve={() => setResolveTarget(i)}
                          onChanged={reload}
                          userName={user?.name ?? ""}
                          userRole={user?.role ?? "manager"}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Resolve modal */}
      {resolveTarget && (
        <ResolveModal
          inspection={resolveTarget}
          brand={brand}
          defaultName={user?.name ?? ""}
          onClose={() => setResolveTarget(null)}
          onDone={() => {
            setResolveTarget(null);
            reload();
          }}
        />
      )}

      {/* Compare modal */}
      {compareOpen && comparePair.length === 2 && (
        <CompareModal pair={comparePair} onClose={() => setCompareOpen(false)} />
      )}
    </div>
  );
}

/* ---------- expanded row ---------- */

function ExpandedDetails({
  inspection: i,
  brand,
  canResolve,
  onResolve,
  onChanged,
  userName,
  userRole,
}: {
  inspection: Inspection;
  brand: string;
  canResolve: boolean;
  onResolve: () => void;
  onChanged: () => void;
  userName: string;
  userRole: "owner" | "manager";
}) {
  const issues = i.answers.filter((a) => a.value === "issue");
  const info = i.answers.filter((a) => a.value && a.value !== "ok" && a.value !== "issue");
  const [comment, setComment] = useState("");
  const [disagree, setDisagree] = useState(false);
  const [posting, setPosting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const postComment = async () => {
    if (!comment.trim()) return;
    setPosting(true);
    setErr(null);
    try {
      const res = await fetch(`/api/inspections/${i.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "comment", text: comment, by: userName, role: userRole, disagreement: disagree }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setComment("");
      setDisagree(false);
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not add comment");
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-4">
      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          {/* Driver-reported record (immutable) */}
          {issues.length > 0 && (
            <div className="mb-4">
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-red-600">
                Driver-reported issues
              </p>
              <ul className="space-y-1">
                {issues.map((a) => (
                  <li key={a.questionId} className="rounded border border-red-100 bg-red-50 px-3 py-1.5 text-sm text-red-800">
                    {a.questionId.replace(/_/g, " ")}
                    {a.note ? ` — ${a.note}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {info.length > 0 && (
            <div className="mb-4">
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">
                Driver entries
              </p>
              <ul className="space-y-1">
                {info.map((a) => (
                  <li key={a.questionId} className="rounded border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700">
                    <span className="text-slate-400">{a.questionId.replace(/_/g, " ")}:</span>{" "}
                    {a.value}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Resolution */}
          {i.resolution ? (
            <div className="mb-4 rounded border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900">
              <p className="font-semibold">
                Resolved by {i.resolution.resolvedBy} · {dateKey(i.resolution.resolvedAt)}
              </p>
              <p className="mt-0.5">{i.resolution.note}</p>
              {i.resolution.receiptUrl && (
                <a
                  href={i.resolution.receiptUrl}
                  target="_blank"
                  className="mt-1 inline-block font-semibold underline"
                >
                  View receipt
                </a>
              )}
            </div>
          ) : (
            (i.status === "flagged" || i.status === "failed_inspection") &&
            canResolve && (
              <button
                onClick={onResolve}
                className="mb-4 rounded-lg px-4 py-2 text-sm font-semibold text-white"
                style={{ background: brand }}
              >
                Resolve this issue
              </button>
            )
          )}

          {/* Office comments (append-only; driver record never edited) */}
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">
            Office comments
          </p>
          {(i.comments ?? []).length > 0 && (
            <ul className="mb-2 space-y-1.5">
              {i.comments.map((c, idx) => (
                <li
                  key={idx}
                  className={`rounded border px-3 py-2 text-sm ${
                    c.disagreement ? "border-orange-200 bg-orange-50 text-orange-900" : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  {c.disagreement && (
                    <span className="mb-0.5 block text-[11px] font-bold uppercase text-orange-600">
                      Disputes driver report
                    </span>
                  )}
                  {c.text}
                  <span className="mt-0.5 block text-xs text-slate-400">
                    {c.by} ({c.role}) · {dateKey(c.at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="rounded border border-slate-200 bg-white p-2.5">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              placeholder="Add a comment (e.g. damage found on return, fuel discrepancy)…"
              className="w-full resize-none text-sm outline-none"
            />
            <div className="mt-1.5 flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs text-slate-500">
                <input
                  type="checkbox"
                  checked={disagree}
                  onChange={(e) => setDisagree(e.target.checked)}
                  className="h-3.5 w-3.5"
                />
                Flag as disagreement with driver report
              </label>
              <button
                onClick={postComment}
                disabled={posting || !comment.trim()}
                className="rounded px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                style={{ background: brand }}
              >
                {posting ? "Saving…" : "Add comment"}
              </button>
            </div>
            {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
          </div>
          <p className="mt-1.5 text-[11px] text-slate-400">
            Driver submissions are permanent and can never be edited — comments are recorded alongside them.
          </p>
        </div>

        {/* Photos */}
        <div>
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">
            Photos ({i.photos.length})
          </p>
          {i.photos.length === 0 ? (
            <p className="rounded border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-400">
              No photos captured
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {i.photos.map((ph) => (
                <figure key={ph.slot}>
                  <a href={ph.url} target="_blank">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ph.url} alt={SLOT_LABEL[ph.slot] ?? ph.slot} className="h-28 w-full rounded border border-slate-200 object-cover" />
                  </a>
                  <figcaption className="mt-0.5 text-center text-[11px] text-slate-500">
                    {SLOT_LABEL[ph.slot] ?? ph.slot}
                    {ph.description ? ` — ${ph.description}` : ""}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- resolve modal ---------- */

function ResolveModal({
  inspection,
  brand,
  defaultName,
  onClose,
  onDone,
}: {
  inspection: Inspection;
  brand: string;
  defaultName: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [note, setNote] = useState("");
  const [name, setName] = useState(defaultName);
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
      const res = await fetch(`/api/inspections/${inspection.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "resolve",
          note,
          resolvedBy: name,
          receiptDataUrl: receipt ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save resolution");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 px-5">
      <div className="w-full max-w-md rounded-xl bg-white p-6">
        <h2 className="text-lg font-bold text-slate-900">
          Resolve — {inspection.vanId} ({dateKey(inspection.createdAt)})
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Resolution details are required and become part of the van&apos;s permanent record.
        </p>
        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">What was done *</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="e.g. Replaced front left tire — Discount Tire, invoice #4482"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Resolved by *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
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
            <p className="mt-1 text-[11px] text-slate-400">
              Saved to this van&apos;s folder for cost tracking.
            </p>
          </div>
          {err && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button onClick={onClose} className="rounded-lg border border-slate-300 py-2.5 text-sm font-semibold text-slate-700">
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={busy || !note.trim() || !name.trim()}
              className="rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              style={{ background: brand }}
            >
              {busy ? "Saving…" : "Mark resolved"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- compare modal ---------- */

function CompareModal({ pair, onClose }: { pair: Inspection[]; onClose: () => void }) {
  const [a, b] = pair;
  const photoFor = (i: Inspection, slot: PhotoSlot) => i.photos.find((p) => p.slot === slot)?.url;
  const sameVan = a.vanId === b.vanId;

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-900/70 px-4 py-8">
      <div className="w-full max-w-4xl rounded-xl bg-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Side-by-side comparison</h2>
            <p className="text-sm text-slate-500">
              {sameVan
                ? `Van ${a.vanId} — angle by angle`
                : `Comparing ${a.vanId} and ${b.vanId}`}
            </p>
          </div>
          <button onClick={onClose} className="text-sm font-semibold text-slate-400 hover:text-slate-700">
            ✕ Close
          </button>
        </div>

        <div className="mt-4 grid grid-cols-[100px_1fr_1fr] items-center gap-2 text-sm">
          <div />
          {[a, b].map((i) => (
            <div key={i.id} className="rounded bg-slate-50 px-2 py-1.5 text-center">
              <span className="font-semibold text-slate-800">{dateKey(i.createdAt)}</span>{" "}
              <span className="text-slate-500">
                {timeOf(i.createdAt)} · {i.tripType}
              </span>
            </div>
          ))}
          {EXTERIOR_SLOTS.map((slot) => (
            <FragmentRow key={slot} slot={slot} a={photoFor(a, slot)} b={photoFor(b, slot)} />
          ))}
        </div>
      </div>
    </div>
  );
}

function FragmentRow({ slot, a, b }: { slot: PhotoSlot; a?: string; b?: string }) {
  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {SLOT_LABEL[slot]}
      </p>
      {[a, b].map((url, i) =>
        url ? (
          <a key={i} href={url} target="_blank">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={SLOT_LABEL[slot]} className="h-40 w-full rounded border border-slate-200 object-cover" />
          </a>
        ) : (
          <div key={i} className="flex h-40 items-center justify-center rounded border border-dashed border-slate-300 text-xs text-slate-400">
            No photo
          </div>
        )
      )}
    </>
  );
}
