"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/app/components/portal/AuthProvider";
import { IconAlert, IconPlus, IconUsers } from "@/app/components/icons";
import { checkInterviewQuestion } from "@/lib/questionCheck";

/**
 * HR › Hiring — positions with AI interview question sets, and the scored
 * candidate pipeline. Candidates interview via a chat link (invite text/email
 * or copied by the owner); scores, summaries, and transcripts land here.
 */

interface Question {
  id: string;
  text: string;
}

interface Position {
  id: string;
  title: string;
  description: string | null;
  pay: string | null;
  location: string | null;
  questions: Question[];
  active: boolean;
}

interface Candidate {
  id: string;
  created_at: string;
  position_id: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  status: string;
  interview_token: string;
  completed_at: string | null;
  duration_secs: number | null;
  transcript: { role: string; text: string; at: string }[];
  score: number | null;
  summary: string | null;
  red_flags: string[];
  notes: string | null;
}

/** Seed question set built from the owner's real Indeed posting. */
const DRIVER_TEMPLATE = {
  title: "FedEx Ground Delivery Driver",
  pay: "From $160/day + $1.35 per stop after 120",
  location: "Stratford, CT — Terminal: 495 Lordship Blvd",
  description:
    "Full-time delivery driver. No CDL required. 5–6 days a week including at least one weekend day. Paid training, PTO, weekly pay.",
  questions: [
    "Are you 21 years of age or older?",
    "Do you have a valid driver's license? Tell me about your driving record — any accidents or violations in the last 3 years?",
    "Do you have at least 1 year of delivery driving experience in the last 2 years? Tell me about where and what you delivered.",
    "This role requires passing a pre-employment background check and drug screening. Are you able to meet that requirement?",
    "The job involves lifting packages up to 100–150 lbs and climbing in and out of the truck all day. Are you comfortable with those physical demands?",
    "The schedule is 5–6 days a week and must include at least one weekend day. Does that work for you?",
    "Have you driven a cargo van or box truck before? What's the largest vehicle you've driven regularly?",
    "Tell me about a time you dealt with a difficult customer or a delivery that went wrong — what did you do?",
    "When could you start, and is there anything that would limit your availability for paid training?",
  ],
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  invited: { label: "Invited", cls: "border-sky-200 bg-sky-50 text-sky-700" },
  in_progress: { label: "In progress", cls: "border-amber-200 bg-amber-50 text-amber-800" },
  completed: { label: "Completed", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  hired: { label: "Hired ✓", cls: "border-emerald-600 bg-emerald-600 text-white" },
  rejected: { label: "Turned down", cls: "border-rose-200 bg-rose-50 text-rose-700" },
  archived: { label: "Archived", cls: "border-slate-200 bg-slate-50 text-slate-500" },
};

const dt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US") : "—");
const mins = (s: number | null) => (s == null ? "—" : `${Math.round(s / 60)}m`);

export default function HiringPage() {
  const { user, tenant, hasPermission, ready } = useAuth();
  const brand = tenant.themeColor;
  const canView = user?.role === "owner" || !!user?.admin || hasPermission("hr.hiring");

  const [positions, setPositions] = useState<Position[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [persisted, setPersisted] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [aiOn, setAiOn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<string>("all");
  const [editPos, setEditPos] = useState<Position | "new" | "template" | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [detail, setDetail] = useState<Candidate | null>(null);
  const [invite, setInvite] = useState<{ name: string; link: string; smsSent: boolean; emailSent: boolean } | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const reload = () => {
    Promise.all([
      fetch("/api/hr/positions").then((r) => r.json()),
      fetch("/api/hr/candidates").then((r) => r.json()),
    ])
      .then(([p, c]) => {
        setPositions(p.positions ?? []);
        setCandidates(c.candidates ?? []);
        setPersisted(p.persisted !== false && c.persisted !== false);
        setApiError(p.error ?? c.error ?? null);
        setAiOn(c.aiConfigured === true);
      })
      .finally(() => setLoading(false));
  };
  useEffect(reload, []);

  const posTitle = useMemo(() => {
    const m = new Map(positions.map((p) => [p.id, p.title]));
    return (id: string | null) => (id ? (m.get(id) ?? "—") : "—");
  }, [positions]);

  const shown = candidates.filter((c) => (tab === "all" ? c.status !== "archived" : c.status === tab));

  if (!ready) return null;
  if (!canView) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 text-center text-slate-500">
        You don&apos;t have access to Hiring. Ask an owner to grant it.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:px-8">
      <nav className="mb-1 flex items-center gap-2 text-sm text-slate-400">
        <Link href="/portal" className="hover:text-slate-600">Portal</Link>
        <span>/</span>
        <span className="text-slate-500">Human Resources</span>
      </nav>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
            <IconUsers size={24} /> Hiring
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Post positions, invite applicants, and let the AI interviewer screen them 24/7.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setImportOpen(true)}
            disabled={positions.filter((p) => p.active).length === 0}
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            Import CSV / Excel
          </button>
          <button
            onClick={() => setAddOpen(true)}
            disabled={positions.filter((p) => p.active).length === 0}
            className="rounded-lg px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: brand }}
          >
            + Add candidate
          </button>
        </div>
      </div>

      {(!persisted || apiError) && (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {apiError ?? "Database not configured."}
        </p>
      )}
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
      {persisted && !aiOn && (
        <p className="mt-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
          AI interviewing is in <strong>scripted mode</strong> — candidates get your exact
          questions and you review transcripts yourself. Add an ANTHROPIC_API_KEY to unlock
          smart follow-ups and automatic scoring.
        </p>
      )}

      {/* Positions */}
      <div className="mt-7 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Positions</h2>
        <div className="flex gap-2">
          {positions.length === 0 && persisted && (
            <button
              onClick={() => setEditPos("template")}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Use delivery-driver template
            </button>
          )}
          <button
            onClick={() => setEditPos("new")}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <IconPlus size={13} /> New position
          </button>
        </div>
      </div>
      {loading ? (
        <p className="mt-4 text-sm text-slate-400">Loading…</p>
      ) : positions.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-400">
          No positions yet — start from the delivery-driver template.
        </p>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {positions.map((p) => (
            <div key={p.id} className={`rounded-xl border bg-white p-4 ${p.active ? "border-slate-200" : "border-slate-200 opacity-60"}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-slate-900">{p.title}</p>
                  <p className="text-[11.5px] text-slate-400">
                    {[p.pay, p.location].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${p.active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
                  {p.active ? "Open" : "Closed"}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {p.questions.length} interview question{p.questions.length === 1 ? "" : "s"} ·{" "}
                {candidates.filter((c) => c.position_id === p.id && c.status !== "archived").length} candidates
              </p>
              <button
                onClick={() => setEditPos(p)}
                className="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Edit position &amp; questions
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Pipeline */}
      <div className="mt-9 flex flex-wrap items-center gap-2">
        <h2 className="mr-2 text-sm font-bold uppercase tracking-wide text-slate-500">Candidates</h2>
        {["all", "invited", "in_progress", "completed", "hired", "rejected", "archived"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${
              tab === t ? "text-white" : "border-slate-300 text-slate-600 hover:bg-slate-50"
            }`}
            style={tab === t ? { background: brand, borderColor: brand } : undefined}
          >
            {t === "all" ? "All active" : (STATUS_META[t]?.label ?? t)}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-400">
          No candidates here yet.
        </p>
      ) : (
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-slate-50 text-[10.5px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-bold">Candidate</th>
                <th className="hidden px-3 py-2.5 font-bold sm:table-cell">Position</th>
                <th className="px-3 py-2.5 font-bold">Status</th>
                <th className="px-3 py-2.5 font-bold">Score</th>
                <th className="hidden px-3 py-2.5 font-bold md:table-cell">Length</th>
                <th className="hidden px-3 py-2.5 font-bold md:table-cell">Added</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => {
                const meta = STATUS_META[c.status] ?? STATUS_META.invited;
                return (
                  <tr key={c.id} className="border-t border-slate-100">
                    <td className="px-4 py-2.5">
                      <span className="font-semibold text-slate-800">{c.name}</span>
                      <span className="block text-[11px] text-slate-400">{c.phone ?? c.email ?? ""}</span>
                    </td>
                    <td className="hidden px-3 py-2.5 text-slate-600 sm:table-cell">{posTitle(c.position_id)}</td>
                    <td className="px-3 py-2.5">
                      <span className={`rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${meta.cls}`}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {c.score != null ? (
                        <span className={`font-bold tabular-nums ${c.score >= 8 ? "text-emerald-600" : c.score >= 5 ? "text-amber-600" : "text-rose-600"}`}>
                          {c.score}/10
                        </span>
                      ) : c.status === "completed" ? (
                        <span className="text-[11px] text-slate-400">review</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="hidden px-3 py-2.5 tabular-nums text-slate-500 md:table-cell">{mins(c.duration_secs)}</td>
                    <td className="hidden px-3 py-2.5 tabular-nums text-slate-500 md:table-cell">{dt(c.created_at)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        onClick={() => setDetail(c)}
                        className="text-xs font-semibold"
                        style={{ color: brand }}
                      >
                        View →
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editPos && (
        <PositionModal
          brand={brand}
          position={editPos === "new" ? null : editPos === "template" ? null : editPos}
          template={editPos === "template"}
          onClose={() => setEditPos(null)}
          onSaved={() => {
            setEditPos(null);
            reload();
          }}
        />
      )}
      {importOpen && (
        <ImportCandidatesModal
          brand={brand}
          positions={positions.filter((p) => p.active)}
          existing={candidates}
          onClose={() => setImportOpen(false)}
          onDone={(msg) => {
            setImportOpen(false);
            setMessage(msg);
            reload();
          }}
        />
      )}
      {addOpen && (
        <AddCandidateModal
          brand={brand}
          positions={positions.filter((p) => p.active)}
          onClose={() => setAddOpen(false)}
          onDone={(r) => {
            setAddOpen(false);
            setInvite(r);
            reload();
          }}
        />
      )}
      {invite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-5">
          <div className="w-full max-w-md rounded-xl bg-white p-6">
            <h3 className="text-lg font-bold text-slate-900">Interview link ready</h3>
            <p className="mt-1.5 text-sm text-slate-600">
              {invite.smsSent
                ? `${invite.name} was texted the interview link.`
                : invite.emailSent
                  ? `${invite.name} was emailed the interview link.`
                  : `Send this link to ${invite.name} — text it from your phone or paste it into an email:`}
            </p>
            <p className="mt-3 break-all rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700">
              {invite.link}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                onClick={() => navigator.clipboard?.writeText(invite.link).catch(() => {})}
                className="rounded-lg border border-slate-300 py-2.5 text-sm font-semibold text-slate-700"
              >
                Copy link
              </button>
              <button
                onClick={() => setInvite(null)}
                className="rounded-lg py-2.5 text-sm font-semibold text-white"
                style={{ background: brand }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
      {detail && (
        <CandidateModal
          brand={brand}
          candidate={detail}
          positionTitle={posTitle(detail.position_id)}
          onClose={() => setDetail(null)}
          onChanged={() => {
            setDetail(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

/* ---------- position editor ---------- */

function PositionModal({
  brand,
  position,
  template,
  onClose,
  onSaved,
}: {
  brand: string;
  position: Position | null;
  template: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const seed = template ? DRIVER_TEMPLATE : null;
  const [title, setTitle] = useState(position?.title ?? seed?.title ?? "");
  const [pay, setPay] = useState(position?.pay ?? seed?.pay ?? "");
  const [location, setLocation] = useState(position?.location ?? seed?.location ?? "");
  const [description, setDescription] = useState(position?.description ?? seed?.description ?? "");
  const [questions, setQuestions] = useState<string[]>(
    position ? position.questions.map((q) => q.text) : (seed?.questions ?? [""])
  );
  const [active, setActive] = useState(position?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const qList = questions
        .map((t) => t.trim())
        .filter(Boolean)
        .map((text, i) => ({ id: `q${i + 1}`, text }));
      const body = { id: position?.id, title, pay, location, description, questions: qList, active };
      const res = await fetch("/api/hr/positions", {
        method: position ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 px-5 py-8">
      <div className="max-h-full w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6">
        <h3 className="text-lg font-bold text-slate-900">
          {position ? `Edit — ${position.title}` : "New position"}
        </h3>
        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Title *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Pay</label>
              <input value={pay} onChange={(e) => setPay(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Location</label>
              <input value={location} onChange={(e) => setLocation(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Short description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Interview questions (asked in order)
            </label>
            <div className="space-y-2">
              {questions.map((q, i) => {
                const warning = checkInterviewQuestion(q);
                return (
                  <div key={i}>
                    <div className="flex gap-2">
                      <textarea
                        value={q}
                        onChange={(e) => setQuestions(questions.map((x, j) => (j === i ? e.target.value : x)))}
                        rows={2}
                        className={`${inputCls} flex-1 ${
                          warning ? (warning.level === "illegal" ? "border-red-400" : "border-amber-400") : ""
                        }`}
                      />
                      <button
                        onClick={() => setQuestions(questions.filter((_, j) => j !== i))}
                        className="self-start rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-400 hover:text-red-600"
                      >
                        ✕
                      </button>
                    </div>
                    {warning && (
                      <div
                        className={`mt-1.5 rounded-lg border-2 px-3 py-2 text-xs ${
                          warning.level === "illegal"
                            ? "border-red-300 bg-white"
                            : "border-amber-300 bg-white"
                        }`}
                      >
                        <p className={`flex items-center gap-1.5 font-bold ${warning.level === "illegal" ? "text-red-700" : "text-amber-700"}`}>
                          <IconAlert size={13} />
                          {warning.level === "illegal"
                            ? "Don't ask this — likely illegal in hiring"
                            : "Possibly questionable — safer wording available"}
                        </p>
                        <p className="mt-1 text-slate-600">{warning.reason}</p>
                        {warning.suggestion && (
                          <>
                            <p className="mt-1.5 text-slate-700">
                              <span className="font-semibold">Suggested instead:</span> &ldquo;{warning.suggestion}&rdquo;
                            </p>
                            <button
                              onClick={() =>
                                setQuestions(questions.map((x, j) => (j === i ? warning.suggestion! : x)))
                              }
                              className="mt-1.5 rounded-md border border-slate-300 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Use suggestion
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              <button
                onClick={() => setQuestions([...questions, ""])}
                className="text-sm font-semibold"
                style={{ color: brand }}
              >
                + Add question
              </button>
            </div>
          </div>
          {position && (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4" style={{ accentColor: brand }} />
              Position is open (accepting candidates)
            </label>
          )}
          {err && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button onClick={onClose} className="rounded-lg border border-slate-300 py-2.5 text-sm font-semibold text-slate-700">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={busy || !title.trim() || questions.every((q) => !q.trim())}
              className="rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              style={{ background: brand }}
            >
              {busy ? "Saving…" : "Save position"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- bulk import (CSV / Excel, e.g. Indeed export) ---------- */

interface ImportRow {
  name: string;
  phone: string;
  email: string;
}

interface Duplicate {
  row: ImportRow;
  existing: Candidate;
  /** undefined = undecided; "ignore" = skip the new row; "replace" = archive old, import new */
  choice?: "ignore" | "replace";
}

const normName = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const phoneDigits = (s: string) => s.replace(/\D/g, "").slice(-10);

function ImportCandidatesModal({
  brand,
  positions,
  existing,
  onClose,
  onDone,
}: {
  brand: string;
  positions: Position[];
  existing: Candidate[];
  onClose: () => void;
  onDone: (msg: { ok: boolean; text: string }) => void;
}) {
  const [positionId, setPositionId] = useState(positions[0]?.id ?? "");
  const [fileName, setFileName] = useState<string | null>(null);
  const [clean, setClean] = useState<ImportRow[]>([]);
  const [dups, setDups] = useState<Duplicate[]>([]);
  const [parsedAny, setParsedAny] = useState(false);
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

      // Find the header row (Indeed exports: "name" or "first/last name", "email", "phone").
      let headerAt = -1;
      for (let i = 0; i < Math.min(grid.length, 10); i++) {
        const heads = (grid[i] ?? []).map((c) => cell(c).toLowerCase());
        if (heads.some((h) => /name/.test(h)) && heads.some((h) => /e-?mail|phone/.test(h))) {
          headerAt = i;
          break;
        }
      }
      if (headerAt < 0) {
        setErr('No candidate columns found — the file needs a "Name" column plus email or phone.');
        return;
      }
      const heads = (grid[headerAt] ?? []).map((c) => cell(c).toLowerCase());
      const col = (re: RegExp) => heads.findIndex((h) => re.test(h));
      const nameCol = col(/^(candidate )?(full )?name$/) >= 0 ? col(/^(candidate )?(full )?name$/) : col(/name/);
      const firstCol = col(/first ?name/);
      const lastCol = col(/last ?name/);
      const emailCol = col(/e-?mail/);
      const phoneCol = col(/phone|mobile/);

      const seen = new Set<string>();
      const rows: ImportRow[] = [];
      for (const r of grid.slice(headerAt + 1)) {
        let name = "";
        if (firstCol >= 0 || lastCol >= 0) {
          name = [firstCol >= 0 ? cell(r?.[firstCol]) : "", lastCol >= 0 ? cell(r?.[lastCol]) : ""]
            .filter(Boolean)
            .join(" ");
        }
        if (!name && nameCol >= 0) name = cell(r?.[nameCol]);
        if (!name) continue;
        const row: ImportRow = {
          name,
          phone: phoneCol >= 0 ? cell(r[phoneCol]) : "",
          email: emailCol >= 0 ? cell(r[emailCol]).toLowerCase() : "",
        };
        const key = normName(name) + "|" + row.email;
        if (seen.has(key)) continue; // duplicate inside the file itself
        seen.add(key);
        rows.push(row);
      }
      if (rows.length === 0) {
        setErr("No candidate rows found under the header row.");
        return;
      }

      // Cross-reference against everyone already in the pipeline (any status).
      const cleanRows: ImportRow[] = [];
      const dupRows: Duplicate[] = [];
      for (const row of rows) {
        const match = existing.find(
          (c) =>
            (row.email && c.email?.toLowerCase() === row.email) ||
            (row.phone && c.phone && phoneDigits(c.phone) === phoneDigits(row.phone) && phoneDigits(row.phone).length >= 7) ||
            normName(c.name) === normName(row.name)
        );
        if (match) dupRows.push({ row, existing: match });
        else cleanRows.push(row);
      }
      setClean(cleanRows);
      setDups(dupRows);
      setParsedAny(true);
    } catch {
      setErr("Couldn't read that file. Save it as .csv or .xlsx and try again.");
    }
  };

  const allResolved = dups.every((d) => d.choice);
  const toImport = clean.length + dups.filter((d) => d.choice === "replace").length;

  const doImport = async () => {
    setBusy(true);
    setErr(null);
    try {
      // Archive the old record wherever the owner chose "replace".
      for (const d of dups) {
        if (d.choice === "replace") {
          await fetch("/api/hr/candidates", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: d.existing.id, status: "archived" }),
          });
        }
      }
      const rows = [...clean, ...dups.filter((d) => d.choice === "replace").map((d) => d.row)];
      if (rows.length === 0) {
        onDone({ ok: true, text: "Nothing imported — every row was ignored as a duplicate." });
        return;
      }
      const res = await fetch("/api/hr/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positionId, candidates: rows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      onDone({
        ok: true,
        text: `Imported ${data.imported} candidate${data.imported === 1 ? "" : "s"}${
          dups.filter((d) => d.choice === "ignore").length > 0
            ? ` · ${dups.filter((d) => d.choice === "ignore").length} duplicate${dups.filter((d) => d.choice === "ignore").length === 1 ? "" : "s"} ignored`
            : ""
        }${data.invitesSent ? ` · ${data.invitesSent} invites sent` : " · open each candidate to copy their interview link"}`,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500";

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 px-5 py-8">
      <div className="max-h-full w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6">
        <h3 className="text-lg font-bold text-slate-900">Import candidates</h3>
        <p className="mt-1.5 text-sm text-slate-600">
          Upload the CSV or Excel export from Indeed (or any list with name, email, phone
          columns). Everyone is checked against your existing pipeline first.
        </p>

        <div className="mt-4">
          <label className="mb-1 block text-xs font-medium text-slate-500">Position *</label>
          <select value={positionId} onChange={(e) => setPositionId(e.target.value)} className={`${inputCls} bg-white`}>
            {positions.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            void parseFile(e.target.files?.[0] ?? undefined);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          className="mt-3 w-full rounded-lg border border-dashed border-slate-300 py-6 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          {fileName ? `Selected: ${fileName} — choose a different file` : "Choose a .csv or .xlsx file"}
        </button>

        {err && <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}

        {parsedAny && (
          <div className="mt-4 space-y-3">
            <p className="text-sm font-semibold text-slate-800">
              {clean.length} new candidate{clean.length === 1 ? "" : "s"} ready
              {dups.length > 0 ? ` · ${dups.length} possible duplicate${dups.length === 1 ? "" : "s"}` : ""}
            </p>

            {dups.length > 0 && (
              <div className="rounded-lg border-2 border-amber-300 bg-white p-3">
                <p className="flex items-center gap-1.5 text-sm font-bold text-amber-700">
                  <IconAlert size={15} /> Possible Duplicate Candidate{dups.length === 1 ? "" : "s"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  These names match people already in your pipeline. Decide each one before importing.
                </p>
                <div className="mt-2 space-y-2">
                  {dups.map((d, i) => {
                    const meta = STATUS_META[d.existing.status] ?? STATUS_META.invited;
                    return (
                      <div key={i} className="rounded-lg border border-slate-200 p-2.5">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
                          <span className="font-semibold text-slate-800">{d.row.name}</span>
                          <span className="text-[11px] text-slate-400">{d.row.email || d.row.phone}</span>
                        </div>
                        <p className="mt-1 flex flex-wrap items-center gap-2 text-[11.5px] text-slate-500">
                          Already in pipeline as <span className="font-semibold text-slate-700">{d.existing.name}</span>
                          <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${meta.cls}`}>{meta.label}</span>
                          {d.existing.score != null && <span className="font-bold">{d.existing.score}/10</span>}
                          <span>added {dt(d.existing.created_at)}</span>
                        </p>
                        <div className="mt-2 flex gap-2">
                          <button
                            onClick={() => setDups(dups.map((x, j) => (j === i ? { ...x, choice: "ignore" } : x)))}
                            className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold ${
                              d.choice === "ignore" ? "border-slate-700 bg-slate-700 text-white" : "border-slate-300 text-slate-600"
                            }`}
                          >
                            Ignore duplicate
                          </button>
                          <button
                            onClick={() => setDups(dups.map((x, j) => (j === i ? { ...x, choice: "replace" } : x)))}
                            className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold ${
                              d.choice === "replace" ? "border-amber-600 bg-amber-600 text-white" : "border-amber-300 text-amber-700"
                            }`}
                          >
                            Archive old &amp; import new
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={onClose} className="rounded-lg border border-slate-300 py-2.5 text-sm font-semibold text-slate-700">
            Cancel
          </button>
          <button
            onClick={doImport}
            disabled={busy || !parsedAny || !positionId || !allResolved}
            className="rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: brand }}
          >
            {busy
              ? "Importing…"
              : !parsedAny
                ? "Import"
                : !allResolved
                  ? "Decide duplicates first"
                  : `Import ${toImport} candidate${toImport === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- add candidate ---------- */

function AddCandidateModal({
  brand,
  positions,
  onClose,
  onDone,
}: {
  brand: string;
  positions: Position[];
  onClose: () => void;
  onDone: (r: { name: string; link: string; smsSent: boolean; emailSent: boolean }) => void;
}) {
  const [positionId, setPositionId] = useState(positions[0]?.id ?? "");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/hr/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, email, positionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Add failed");
      onDone({ name, link: data.link, smsSent: data.smsSent, emailSent: data.emailSent });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Add failed");
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500";

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 px-5">
      <div className="w-full max-w-md rounded-xl bg-white p-6">
        <h3 className="text-lg font-bold text-slate-900">Add candidate</h3>
        <p className="mt-1 text-sm text-slate-500">
          From an Indeed application (or anywhere) — they get a personal interview link.
        </p>
        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Position *</label>
            <select value={positionId} onChange={(e) => setPositionId(e.target.value)} className={`${inputCls} bg-white`}>
              {positions.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Full name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Mobile phone</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 203 555 0100" className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Email</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
            </div>
          </div>
          {err && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button onClick={onClose} className="rounded-lg border border-slate-300 py-2.5 text-sm font-semibold text-slate-700">
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={busy || !name.trim() || !positionId}
              className="rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              style={{ background: brand }}
            >
              {busy ? "Adding…" : "Add & create invite"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- candidate detail ---------- */

function CandidateModal({
  brand,
  candidate,
  positionTitle,
  onClose,
  onChanged,
}: {
  brand: string;
  candidate: Candidate;
  positionTitle: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [notes, setNotes] = useState(candidate.notes ?? "");
  const [busy, setBusy] = useState(false);
  const link = `${typeof window !== "undefined" ? window.location.origin : ""}/interview/${candidate.interview_token}`;

  const patch = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      await fetch("/api/hr/candidates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: candidate.id, ...body }),
      });
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 px-5 py-8">
      <div className="max-h-full w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">{candidate.name}</h3>
            <p className="text-xs text-slate-400">
              {positionTitle} · {candidate.phone ?? ""} {candidate.email ? `· ${candidate.email}` : ""}
            </p>
          </div>
          {candidate.score != null && (
            <span
              className={`rounded-lg px-2.5 py-1 text-lg font-extrabold tabular-nums ${
                candidate.score >= 8 ? "bg-emerald-50 text-emerald-700" : candidate.score >= 5 ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"
              }`}
            >
              {candidate.score}/10
            </span>
          )}
        </div>

        {candidate.summary && (
          <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-700">
            {candidate.summary}
          </p>
        )}
        {candidate.red_flags?.length > 0 && (
          <div className="mt-2 rounded-lg border-2 border-rose-300 bg-white px-3.5 py-2.5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-rose-600">Red flags</p>
            <ul className="mt-1 list-inside list-disc text-sm text-slate-700">
              {candidate.red_flags.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </div>
        )}

        {candidate.transcript?.length > 0 ? (
          <div className="mt-4 max-h-72 space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
            {candidate.transcript.map((t, i) => (
              <div key={i} className={`flex ${t.role === "candidate" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-[12.5px] leading-snug ${
                    t.role === "candidate" ? "text-white" : "border border-slate-200 bg-white text-slate-700"
                  }`}
                  style={t.role === "candidate" ? { background: brand } : undefined}
                >
                  {t.text}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-lg border border-dashed border-slate-300 px-4 py-5 text-center text-sm text-slate-400">
            Interview not started yet.
          </p>
        )}

        <div className="mt-3">
          <label className="mb-1 block text-xs font-medium text-slate-500">Your notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(candidate.status === "completed" || candidate.status === "rejected") && (
            <button
              onClick={() => patch({ status: "hired" })}
              disabled={busy}
              className="rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-40"
            >
              Mark hired
            </button>
          )}
          {(candidate.status === "completed" || candidate.status === "hired") && (
            <button
              onClick={() => patch({ status: "rejected" })}
              disabled={busy}
              className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-600 disabled:opacity-40"
            >
              Turn down
            </button>
          )}
          <button
            onClick={() => patch({ notes })}
            disabled={busy}
            className="rounded-lg px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-40"
            style={{ background: brand }}
          >
            Save notes
          </button>
          <button
            onClick={() => navigator.clipboard?.writeText(link).catch(() => {})}
            className="rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-semibold text-slate-700"
          >
            Copy interview link
          </button>
          {candidate.email && (
            <a
              href={`mailto:${candidate.email}?subject=${encodeURIComponent(`Next steps — ${positionTitle}`)}&body=${encodeURIComponent(`Hi ${candidate.name.split(" ")[0]},\n\nThanks for completing your first-round interview — we'd like to set up a time to talk. What does your availability look like this week?\n\n`)}`}
              className="rounded-lg border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-700"
            >
              Invite to meet
            </a>
          )}
          {candidate.status !== "archived" ? (
            <button
              onClick={() => patch({ status: "archived" })}
              disabled={busy}
              className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-600"
            >
              Archive
            </button>
          ) : (
            <button
              onClick={() => patch({ status: candidate.completed_at ? "completed" : "invited" })}
              disabled={busy}
              className="rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-semibold text-slate-700"
            >
              Restore
            </button>
          )}
          <button onClick={onClose} className="ml-auto rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-semibold text-slate-700">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
