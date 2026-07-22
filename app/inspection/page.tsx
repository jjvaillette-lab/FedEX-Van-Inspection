"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import BarcodeScanner from "@/app/components/BarcodeScanner";
import PhotoCapture from "@/app/components/PhotoCapture";
import { SAFETY_QUESTIONS, PHOTO_STEPS } from "@/lib/questions";
import { parseDriverBarcode } from "@/lib/driver";
import type { AnswerValue, Driver, InspectionPhoto, PhotoSlot } from "@/lib/types";

type Step = "driver" | "van" | "questions" | "photos" | "submitting" | "done";

interface SubmitResult {
  hasIssues: boolean;
  status: string;
}

export default function InspectionPage() {
  const [step, setStep] = useState<Step>("driver");
  const [driver, setDriver] = useState<Driver | null>(null);
  const [vanId, setVanId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, { value: AnswerValue; note?: string }>>({});
  const [photos, setPhotos] = useState<Partial<Record<PhotoSlot, string>>>({});
  const [photoIndex, setPhotoIndex] = useState(0);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const allAnswered = SAFETY_QUESTIONS.every((q) => answers[q.id]);
  const flaggedQuestions = useMemo(
    () => SAFETY_QUESTIONS.filter((q) => answers[q.id]?.value === "issue"),
    [answers]
  );

  const setAnswer = (id: string, value: AnswerValue) =>
    setAnswers((prev) => ({ ...prev, [id]: { ...prev[id], value } }));
  const setNote = (id: string, note: string) =>
    setAnswers((prev) => ({ ...prev, [id]: { ...prev[id], note } }));

  const currentPhotoStep = PHOTO_STEPS[photoIndex];
  const allPhotosDone = PHOTO_STEPS.every((p) => photos[p.slot]);

  async function submit() {
    setStep("submitting");
    setError(null);
    const payload = {
      driver,
      vanId,
      answers: SAFETY_QUESTIONS.map((q) => ({
        questionId: q.id,
        value: answers[q.id]?.value ?? "ok",
        note: answers[q.id]?.note,
      })),
      photos: PHOTO_STEPS.map<InspectionPhoto>((p) => ({
        slot: p.slot,
        url: photos[p.slot] ?? "",
      })).filter((p) => p.url),
    };
    try {
      const res = await fetch("/api/inspections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      setResult({ hasIssues: data.inspection.hasIssues, status: data.inspection.status });
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed");
      setStep("photos");
    }
  }

  const progress =
    step === "driver" ? 15 : step === "van" ? 30 : step === "questions" ? 55 : step === "photos" ? 85 : 100;

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col px-4 pb-10">
      {/* Header */}
      <header className="sticky top-0 z-10 -mx-4 flex items-center justify-between bg-slate-900 px-4 py-3 text-white">
        <Link href="/portal/fleet" className="text-sm text-slate-300">
          ✕ Exit
        </Link>
        <span className="text-sm font-semibold">Van Safety Check</span>
        <span className="w-10" />
      </header>
      {step !== "done" && step !== "submitting" && (
        <div className="-mx-4 h-1.5 bg-slate-200">
          <div className="h-full bg-sky-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}

      <div className="flex-1 pt-6">
        {/* STEP 1 — Driver barcode */}
        {step === "driver" && (
          <BarcodeScanner
            prompt="Scan your FedEx driver barcode"
            manualPlaceholder="Driver / route code"
            onScan={(value) => {
              setDriver(parseDriverBarcode(value));
              setStep("van");
            }}
          />
        )}

        {/* STEP 2 — Van QR */}
        {step === "van" && (
          <div>
            {driver && (
              <div className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
                Driver: <strong>{driver.name ?? driver.raw}</strong>
                {driver.route ? ` · Route ${driver.route}` : ""}
              </div>
            )}
            <BarcodeScanner
              prompt="Scan the van's QR code"
              manualPlaceholder="Van ID (e.g. VAN-014)"
              onScan={(value) => {
                setVanId(value.trim());
                setStep("questions");
              }}
            />
          </div>
        )}

        {/* STEP 3 — DOT safety questions */}
        {step === "questions" && (
          <div>
            <div className="mb-4 rounded-xl bg-slate-900 p-4 text-white">
              <p className="text-xs uppercase tracking-wide text-slate-400">Inspecting</p>
              <p className="text-lg font-bold">Van {vanId}</p>
              <p className="text-sm text-slate-300">
                {driver?.name ?? driver?.raw}
                {driver?.route ? ` · Route ${driver.route}` : ""}
              </p>
            </div>
            <h1 className="mb-1 text-xl font-bold">DOT Safety Checklist</h1>
            <p className="mb-4 text-sm text-slate-500">
              Mark each item. Tap <strong>Issue</strong> for anything that needs attention.
            </p>

            <div className="space-y-3">
              {SAFETY_QUESTIONS.map((q) => {
                const a = answers[q.id];
                return (
                  <div key={q.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      {q.category}
                    </p>
                    <p className="mt-0.5 font-medium text-slate-800">{q.label}</p>
                    {q.hint && <p className="mt-0.5 text-xs text-slate-400">{q.hint}</p>}
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setAnswer(q.id, "ok")}
                        className={`rounded-lg py-2.5 text-sm font-semibold ${
                          a?.value === "ok"
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        ✓ OK
                      </button>
                      <button
                        onClick={() => setAnswer(q.id, "issue")}
                        className={`rounded-lg py-2.5 text-sm font-semibold ${
                          a?.value === "issue"
                            ? "bg-red-600 text-white"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        ⚠ Issue
                      </button>
                    </div>
                    {a?.value === "issue" && (
                      <input
                        value={a.note ?? ""}
                        onChange={(e) => setNote(q.id, e.target.value)}
                        placeholder="Describe the issue (optional)"
                        className="mt-2 w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm outline-none"
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <button
              disabled={!allAnswered}
              onClick={() => setStep("photos")}
              className="mt-6 w-full rounded-xl bg-sky-600 py-4 text-lg font-semibold text-white disabled:opacity-40"
            >
              {allAnswered ? "Continue to Photos" : `Answer all ${SAFETY_QUESTIONS.length} items`}
            </button>
          </div>
        )}

        {/* STEP 4 — Guided photos */}
        {step === "photos" && (
          <div>
            <div className="mb-5 rounded-xl bg-sky-50 p-4 text-center text-sky-900">
              <p className="font-semibold">We require photos of the vehicle.</p>
              <p className="text-sm">Follow the prompts to take 4 pictures of the van.</p>
            </div>

            <PhotoCapture
              key={currentPhotoStep.slot}
              step={currentPhotoStep}
              index={photoIndex}
              total={PHOTO_STEPS.length}
              existing={photos[currentPhotoStep.slot]}
              onCapture={(dataUrl) =>
                setPhotos((prev) => ({ ...prev, [currentPhotoStep.slot]: dataUrl }))
              }
            />

            {/* Thumbnails / navigation */}
            <div className="mt-6 flex justify-center gap-2">
              {PHOTO_STEPS.map((p, i) => (
                <button
                  key={p.slot}
                  onClick={() => setPhotoIndex(i)}
                  className={`h-2.5 w-2.5 rounded-full ${
                    photos[p.slot] ? "bg-emerald-500" : i === photoIndex ? "bg-sky-500" : "bg-slate-300"
                  }`}
                  aria-label={p.title}
                />
              ))}
            </div>

            <div className="mt-6 flex gap-3">
              {photoIndex > 0 && (
                <button
                  onClick={() => setPhotoIndex((i) => i - 1)}
                  className="flex-1 rounded-xl border border-slate-300 bg-white py-3 font-medium text-slate-600"
                >
                  Back
                </button>
              )}
              {photoIndex < PHOTO_STEPS.length - 1 ? (
                <button
                  disabled={!photos[currentPhotoStep.slot]}
                  onClick={() => setPhotoIndex((i) => i + 1)}
                  className="flex-[2] rounded-xl bg-sky-600 py-3 font-semibold text-white disabled:opacity-40"
                >
                  Next Photo
                </button>
              ) : (
                <button
                  disabled={!allPhotosDone}
                  onClick={submit}
                  className="flex-[2] rounded-xl bg-emerald-600 py-3 font-semibold text-white disabled:opacity-40"
                >
                  {allPhotosDone ? "Finish & Submit" : "Take all 4 photos"}
                </button>
              )}
            </div>

            {error && (
              <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
            )}
          </div>
        )}

        {/* Submitting */}
        {step === "submitting" && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-sky-500" />
            <p className="mt-4 text-slate-500">Submitting inspection…</p>
          </div>
        )}

        {/* Done */}
        {step === "done" && result && (
          <div className="py-8 text-center">
            {result.hasIssues ? (
              <div>
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-100 text-4xl">
                  🚨
                </div>
                <h1 className="mt-4 text-2xl font-extrabold text-red-700">Report Van to Management</h1>
                <p className="mt-2 text-slate-600">
                  This van has {flaggedQuestions.length} reported issue
                  {flaggedQuestions.length === 1 ? "" : "s"}. Do <strong>not</strong> operate it until
                  cleared. Management has been notified.
                </p>
                <ul className="mx-auto mt-4 max-w-xs space-y-1 text-left text-sm">
                  {flaggedQuestions.map((q) => (
                    <li key={q.id} className="rounded-lg bg-red-50 px-3 py-2 text-red-800">
                      ⚠ {q.label}
                      {answers[q.id]?.note ? ` — ${answers[q.id]?.note}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div>
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-4xl">
                  ✓
                </div>
                <h1 className="mt-4 text-2xl font-extrabold text-emerald-700">Inspection Complete</h1>
                <p className="mt-2 text-slate-600">
                  Van {vanId} passed the DOT safety check. You&apos;re cleared to drive. Safe travels!
                </p>
              </div>
            )}
            <Link
              href="/portal/fleet"
              className="mt-8 inline-block w-full rounded-xl bg-slate-900 py-4 font-semibold text-white"
            >
              Done
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
