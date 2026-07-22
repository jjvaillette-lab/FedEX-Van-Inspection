"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SAFETY_QUESTIONS, PHOTO_STEPS } from "@/lib/questions";
import type { Inspection } from "@/lib/types";

const QUESTION_LABEL = Object.fromEntries(SAFETY_QUESTIONS.map((q) => [q.id, q.label]));
const PHOTO_LABEL = Object.fromEntries(PHOTO_STEPS.map((p) => [p.slot, p.title]));

export default function DashboardPage() {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "flagged">("all");

  useEffect(() => {
    fetch("/api/inspections")
      .then((r) => r.json())
      .then((d) => setInspections(d.inspections ?? []))
      .catch(() => setInspections([]))
      .finally(() => setLoading(false));
  }, []);

  const flaggedCount = inspections.filter((i) => i.hasIssues).length;
  const shown = filter === "flagged" ? inspections.filter((i) => i.hasIssues) : inspections;

  return (
    <main className="mx-auto max-w-2xl px-5 pb-16">
      <header className="flex items-center gap-3 py-5">
        <Link href="/portal/fleet" className="text-slate-400">
          ‹ Back
        </Link>
        <h1 className="text-lg font-bold">Management Dashboard</h1>
      </header>

      <div className="mb-5 grid grid-cols-2 gap-3">
        <button
          onClick={() => setFilter("all")}
          className={`rounded-xl border p-4 text-left ${
            filter === "all" ? "border-sky-500 bg-sky-50" : "border-slate-200 bg-white"
          }`}
        >
          <p className="text-3xl font-extrabold text-slate-900">{inspections.length}</p>
          <p className="text-sm text-slate-500">Total inspections</p>
        </button>
        <button
          onClick={() => setFilter("flagged")}
          className={`rounded-xl border p-4 text-left ${
            filter === "flagged" ? "border-red-500 bg-red-50" : "border-slate-200 bg-white"
          }`}
        >
          <p className="text-3xl font-extrabold text-red-600">{flaggedCount}</p>
          <p className="text-sm text-slate-500">Flagged for review</p>
        </button>
      </div>

      {loading ? (
        <p className="py-16 text-center text-slate-400">Loading…</p>
      ) : shown.length === 0 ? (
        <p className="py-16 text-center text-slate-400">
          No inspections yet. Complete a van check to see it here.
        </p>
      ) : (
        <div className="space-y-3">
          {shown.map((insp) => {
            const issues = insp.answers.filter((a) => a.value === "issue");
            const open = openId === insp.id;
            return (
              <div
                key={insp.id}
                className={`overflow-hidden rounded-xl border bg-white ${
                  insp.hasIssues ? "border-red-300" : "border-slate-200"
                }`}
              >
                <button
                  onClick={() => setOpenId(open ? null : insp.id)}
                  className="flex w-full items-center justify-between gap-3 p-4 text-left"
                >
                  <div>
                    <p className="font-bold text-slate-900">Van {insp.vanId}</p>
                    <p className="text-sm text-slate-500">
                      {insp.driver.name ?? insp.driver.raw} ·{" "}
                      {new Date(insp.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {insp.hasIssues ? (
                    <span className="shrink-0 rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
                      ⚠ {issues.length} issue{issues.length === 1 ? "" : "s"}
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                      ✓ Passed
                    </span>
                  )}
                </button>

                {open && (
                  <div className="border-t border-slate-100 p-4">
                    {issues.length > 0 && (
                      <div className="mb-4">
                        <p className="mb-2 text-sm font-semibold text-red-700">Reported issues</p>
                        <ul className="space-y-1">
                          {issues.map((a) => (
                            <li
                              key={a.questionId}
                              className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800"
                            >
                              {QUESTION_LABEL[a.questionId] ?? a.questionId}
                              {a.note ? ` — ${a.note}` : ""}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {insp.photos.length > 0 && (
                      <div>
                        <p className="mb-2 text-sm font-semibold text-slate-600">Vehicle photos</p>
                        <div className="grid grid-cols-2 gap-2">
                          {insp.photos.map((ph) => (
                            <figure key={ph.slot}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={ph.url}
                                alt={PHOTO_LABEL[ph.slot] ?? ph.slot}
                                className="h-32 w-full rounded-lg object-cover"
                              />
                              <figcaption className="mt-1 text-center text-xs text-slate-500">
                                {PHOTO_LABEL[ph.slot] ?? ph.slot}
                              </figcaption>
                            </figure>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
