"use client";

import { use, useEffect, useState } from "react";
import { useAuth } from "@/app/components/portal/AuthProvider";
import { PHOTO_STEPS, INTERIOR_STEPS } from "@/lib/questions";
import type { Inspection, QuestionDef } from "@/lib/types";

const SLOT_LABEL: Record<string, string> = Object.fromEntries([
  ...PHOTO_STEPS.map((p) => [p.slot, p.title]),
  ...INTERIOR_STEPS.map((p) => [p.slot, p.title]),
  ["optional_1", "Optional 1"],
  ["optional_2", "Optional 2"],
  ["optional_3", "Optional 3"],
  ["optional_4", "Optional 4"],
]);

/**
 * Printable Driver Vehicle Inspection Report (DVIR) — one per inspection,
 * including clean ones: checklist results, photo thumbnails, the driver's
 * certification and signature, and any resolution. Use the browser's
 * Print → Save as PDF for a permanent file.
 */
export default function DvirReport({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { tenant } = useAuth();
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [questions, setQuestions] = useState<QuestionDef[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/inspections").then((r) => r.json()),
      fetch("/api/questions?all=1").then((r) => r.json()),
    ])
      .then(([insp, q]) => {
        setInspection((insp.inspections ?? []).find((i: Inspection) => i.id === id) ?? null);
        setQuestions(q.questions ?? []);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="p-10 text-center text-slate-400">Loading report…</p>;
  if (!inspection) return <p className="p-10 text-center text-slate-500">Report not found.</p>;

  const i = inspection;
  const label = (qid: string) =>
    questions.find((q) => q.id === qid)?.label ?? qid.replace(/_/g, " ");
  const answered = i.answers.filter((a) => a.value !== "");
  const issues = answered.filter((a) => a.value === "issue");
  const signature = i.photos.find((p) => p.slot === "signature");
  const photos = i.photos.filter((p) => p.slot !== "signature");
  const when = new Date(i.createdAt);
  const statusLabel =
    i.status === "failed_inspection" ? "INCOMPLETE INSPECTION" :
    i.status === "flagged" ? "DEFECTS REPORTED" : "NO DEFECTS — PASSED";

  const resultText = (a: (typeof answered)[number]) =>
    a.value === "ok" ? "OK" :
    a.value === "issue" ? `ISSUE${a.note ? ` — ${a.note}` : ""}` :
    a.value;

  return (
    <div className="mx-auto max-w-3xl bg-white px-8 py-8 text-slate-900">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .avoid-break { break-inside: avoid; }
        }
      `}</style>

      {/* Toolbar */}
      <div className="no-print mb-6 flex items-center justify-between rounded-lg bg-slate-100 px-4 py-3">
        <button onClick={() => window.history.back()} className="text-sm font-semibold text-slate-600">
          ← Back
        </button>
        <button
          onClick={() => window.print()}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
          style={{ background: tenant.themeColor }}
        >
          Print / Save as PDF
        </button>
      </div>

      {/* Header */}
      <header className="border-b-2 border-slate-800 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-extrabold">Driver Vehicle Inspection Report (DVIR)</h1>
            <p className="text-sm text-slate-500">
              {tenant.name} · per FMCSA 49 CFR 396.11 / 396.13
            </p>
          </div>
          <span
            className={`rounded px-2.5 py-1 text-xs font-extrabold ${
              i.status === "passed" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
            }`}
          >
            {statusLabel}
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm sm:grid-cols-3">
          <p><span className="text-slate-400">Van:</span> <strong>{i.vanId}</strong></p>
          <p><span className="text-slate-400">Driver:</span> <strong>{i.driver.name ?? i.driver.raw}</strong></p>
          {i.driver.route && <p><span className="text-slate-400">Route:</span> {i.driver.route}</p>}
          <p><span className="text-slate-400">Trip:</span> {i.tripType === "pre" ? "Pre-Trip" : "Post-Trip"}{i.cycle > 1 ? ` (#${i.cycle} that day)` : ""}</p>
          <p><span className="text-slate-400">Date:</span> {when.toLocaleDateString("en-US")}</p>
          <p><span className="text-slate-400">Time:</span> {when.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</p>
        </div>
      </header>

      {/* Checklist */}
      <section className="avoid-break mt-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Inspection checklist</h2>
        {answered.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No checklist items were recorded.</p>
        ) : (
          <table className="mt-2 w-full border-collapse text-sm">
            <tbody>
              {answered.map((a) => (
                <tr key={a.questionId} className="border-b border-slate-200">
                  <td className="py-1.5 pr-4 text-slate-700">{label(a.questionId)}</td>
                  <td className={`py-1.5 text-right font-semibold ${a.value === "issue" ? "text-red-700" : "text-slate-800"}`}>
                    {resultText(a)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {issues.length === 0 && i.status !== "failed_inspection" && (
          <p className="mt-2 text-sm font-semibold text-emerald-700">
            No defects or deficiencies reported.
          </p>
        )}
      </section>

      {/* Photos */}
      {photos.length > 0 && (
        <section className="avoid-break mt-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            Photo evidence ({photos.length})
          </h2>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {photos.map((p) => (
              <figure key={p.slot}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={SLOT_LABEL[p.slot] ?? p.slot} className="h-24 w-full rounded border border-slate-300 object-cover" />
                <figcaption className="mt-0.5 text-center text-[10px] text-slate-500">
                  {SLOT_LABEL[p.slot] ?? p.slot}
                  {p.description ? ` — ${p.description}` : ""}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* Resolution */}
      {i.resolution && (
        <section className="avoid-break mt-6 rounded border border-emerald-300 bg-emerald-50 p-3 text-sm">
          <h2 className="font-bold text-emerald-800">Certified repairs / resolution</h2>
          <p className="mt-1 text-emerald-900">{i.resolution.note}</p>
          <p className="mt-1 text-xs text-emerald-700">
            Resolved by {i.resolution.resolvedBy} on {new Date(i.resolution.resolvedAt).toLocaleDateString("en-US")}
            {i.resolution.receiptUrl ? " · receipt on file" : ""}
          </p>
        </section>
      )}

      {/* Certification + signature */}
      <section className="avoid-break mt-6 border-t-2 border-slate-800 pt-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Driver certification</h2>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
          I certify that I have inspected this vehicle in accordance with FMCSA regulations 49 CFR
          396.11 / 396.13 and that this report is true and complete
          {issues.length > 0 ? ", including the defects reported above." : ", and no defects affecting safe operation were found."}{" "}
          The electronic signature below constitutes the driver&apos;s legal signature on this report.
        </p>
        <div className="mt-3 flex items-end justify-between gap-6">
          {signature ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={signature.url} alt="Driver signature" className="h-20 rounded border border-slate-300 bg-white" />
          ) : (
            <p className="text-sm italic text-slate-400">
              No signature on file{i.status === "failed_inspection" ? " (inspection was not completed)" : ""}.
            </p>
          )}
          <div className="text-right text-sm">
            <p className="font-semibold">{i.driver.name ?? i.driver.raw}</p>
            <p className="tabular-nums text-slate-500">{when.toLocaleDateString("en-US")}</p>
          </div>
        </div>
      </section>

      <p className="mt-8 text-center text-[10px] text-slate-400">
        Generated by Last Mile Assist · Report ID {i.id}
      </p>
    </div>
  );
}
