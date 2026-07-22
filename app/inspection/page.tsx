"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BarcodeScanner from "@/app/components/BarcodeScanner";
import PhotoCapture from "@/app/components/PhotoCapture";
import MultiPhotoCapture from "@/app/components/MultiPhotoCapture";
import { useAuth } from "@/app/components/portal/AuthProvider";
import { PHOTO_STEPS, INTERIOR_STEPS, OPTIONAL_SLOTS, type PhotoStep } from "@/lib/questions";
import { parseDriverBarcode } from "@/lib/driver";
import {
  IconAlert,
  IconCamera,
  IconCheckCircle,
  IconXCircle,
} from "@/app/components/icons";
import type {
  Driver,
  Inspection,
  InspectionPhoto,
  PhotoSlot,
  QuestionDef,
  TripType,
} from "@/lib/types";

type Step =
  | "driver"
  | "van"
  | "trip_check" // deciding pre vs post, or prompting about a new cycle
  | "questions"
  | "photos"
  | "optional"
  | "submitting"
  | "done";

interface SubmitResult {
  status: Inspection["status"];
  tripType: TripType;
}

const dateKey = (iso: string) => new Date(iso).toLocaleDateString("en-US");

export default function InspectionPage() {
  const router = useRouter();
  const { user } = useAuth();
  // Portal users came from the portal; driver devices go back to the driver hub.
  const homeHref = user ? "/portal/fleet" : "/driver";
  const [step, setStep] = useState<Step>("driver");
  const [driver, setDriver] = useState<Driver | null>(null);
  const [vanId, setVanId] = useState<string | null>(null);

  const [tripType, setTripType] = useState<TripType>("pre");
  const [cycle, setCycle] = useState(1);
  const [showCyclePrompt, setShowCyclePrompt] = useState(false);

  const [questions, setQuestions] = useState<QuestionDef[]>([]);
  const [interiorOn, setInteriorOn] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [answers, setAnswers] = useState<Record<string, { value: string; note?: string }>>({});
  const [photos, setPhotos] = useState<Partial<Record<PhotoSlot, string>>>({});
  const [photoDescriptions, setPhotoDescriptions] = useState<Partial<Record<PhotoSlot, string>>>({});
  const [optionalIndex, setOptionalIndex] = useState(0);

  const [result, setResult] = useState<SubmitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmFail, setConfirmFail] = useState(false);

  /* ---------- trip detection ---------- */

  const beginTrip = useCallback(async (trip: TripType, cycleNum: number) => {
    setTripType(trip);
    setCycle(cycleNum);
    setLoadError(null);
    // A trip truly starts here — reset the form once, so answers and photos
    // survive every later step change all the way to submit.
    setAnswers({});
    setPhotos({});
    setPhotoDescriptions({});
    setOptionalIndex(0);
    try {
      const res = await fetch(`/api/questions?trip=${trip}`);
      const data = await res.json();
      setQuestions(data.questions ?? []);
      setInteriorOn(trip === "post" && !!data.settings?.interiorPhotos);
      setStep("questions");
    } catch {
      setLoadError("Could not load the checklist. Check your connection and try again.");
      setStep("trip_check");
    }
  }, []);

  const detectTrip = useCallback(
    async (van: string) => {
      setStep("trip_check");
      setLoadError(null);
      try {
        const res = await fetch(`/api/inspections?vanId=${encodeURIComponent(van)}`);
        const data = await res.json();
        const today = dateKey(new Date().toISOString());
        // Failed inspections stay on record but don't complete a cycle — a
        // driver who re-scans after a failure repeats the same trip type.
        const todays: Inspection[] = (data.inspections ?? []).filter(
          (i: Inspection) =>
            dateKey(i.createdAt) === today && i.status !== "failed_inspection"
        );
        const pres = todays.filter((i) => i.tripType === "pre").length;
        const posts = todays.filter((i) => i.tripType === "post").length;

        if (pres === 0) return void beginTrip("pre", 1);
        if (posts < pres) return void beginTrip("post", pres);
        // Full cycle(s) complete — ask before starting another.
        setCycle(pres + 1);
        setShowCyclePrompt(true);
      } catch {
        // Offline/first-use: default to pre-trip rather than blocking the driver.
        void beginTrip("pre", 1);
      }
    },
    [beginTrip]
  );

  /* ---------- questions ---------- */

  const requiredQuestions = useMemo(
    () => questions.filter((q) => q.input !== "text"),
    [questions]
  );
  const allAnswered = requiredQuestions.every((q) => {
    const a = answers[q.id];
    return a && a.value !== "";
  });
  const flagged = useMemo(
    () => questions.filter((q) => answers[q.id]?.value === "issue"),
    [questions, answers]
  );

  const setAnswer = (id: string, value: string) =>
    setAnswers((prev) => ({ ...prev, [id]: { ...prev[id], value } }));
  const setNote = (id: string, note: string) =>
    setAnswers((prev) => ({ ...prev, [id]: { ...prev[id], note } }));

  /* ---------- photos ---------- */

  const requiredSteps: PhotoStep[] = useMemo(
    () => (interiorOn ? [...PHOTO_STEPS, ...INTERIOR_STEPS] : PHOTO_STEPS),
    [interiorOn]
  );
  const allPhotosDone = requiredSteps.every((p) => photos[p.slot]);

  const optionalTaken = OPTIONAL_SLOTS.filter((s) => photos[s]).length;

  /* ---------- submit ---------- */

  async function submit(opts: { failed: boolean }) {
    setStep("submitting");
    setError(null);
    const complete = allAnswered && allPhotosDone && !opts.failed;

    const answerList = questions.map((q) => ({
      questionId: q.id,
      value: answers[q.id]?.value ?? "",
      note: answers[q.id]?.note,
    }));
    const photoList: InspectionPhoto[] = (
      [...requiredSteps.map((p) => p.slot), ...OPTIONAL_SLOTS] as PhotoSlot[]
    )
      .filter((slot) => photos[slot])
      .map((slot) => ({
        slot,
        url: photos[slot]!,
        description: photoDescriptions[slot]?.trim() || undefined,
      }));

    try {
      const res = await fetch("/api/inspections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driver,
          vanId,
          tripType,
          cycle,
          answers: answerList,
          photos: photoList,
          complete,
          failed: opts.failed || !complete,
        }),
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      setResult({ status: data.inspection.status, tripType });
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed");
      setStep(opts.failed ? "questions" : "photos");
    }
  }

  /* ---------- helpers ---------- */

  const tripLabel = tripType === "pre" ? "Pre-Trip" : "Post-Trip";
  const progress =
    step === "driver" ? 12 : step === "van" ? 25 : step === "trip_check" ? 32 :
    step === "questions" ? 55 : step === "photos" ? 75 : step === "optional" ? 90 : 100;

  /* ---------- render ---------- */

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col px-4 pb-10">
      <header className="sticky top-0 z-10 -mx-4 flex items-center justify-between bg-slate-900 px-4 py-3 text-white">
        <Link href={homeHref} className="text-sm text-slate-300">
          ✕ Exit
        </Link>
        <span className="text-sm font-semibold">
          {step === "driver" || step === "van" ? "Van Inspection" : `${tripLabel} Inspection`}
          {cycle > 1 && step !== "driver" && step !== "van" ? ` · #${cycle}` : ""}
        </span>
        {(step === "questions" || step === "photos" || step === "optional") ? (
          <button onClick={() => setConfirmFail(true)} className="text-xs font-medium text-red-300">
            End early
          </button>
        ) : (
          <span className="w-10" />
        )}
      </header>
      {step !== "done" && step !== "submitting" && (
        <div className="-mx-4 h-1 bg-slate-200">
          <div className="h-full bg-sky-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}

      {/* End-early confirmation */}
      {confirmFail && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/60 px-6">
          <div className="w-full max-w-sm rounded-xl bg-white p-6">
            <h2 className="text-lg font-bold text-slate-900">End this inspection?</h2>
            <p className="mt-2 text-sm text-slate-600">
              Everything entered so far will be saved, but the inspection will be recorded as a{" "}
              <strong className="text-red-700">FAILED INSPECTION</strong> for this van.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                onClick={() => setConfirmFail(false)}
                className="rounded-lg border border-slate-300 py-2.5 text-sm font-semibold text-slate-700"
              >
                Keep going
              </button>
              <button
                onClick={() => {
                  setConfirmFail(false);
                  void submit({ failed: true });
                }}
                className="rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white"
              >
                End & record failure
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 pt-6">
        {/* STEP — driver barcode */}
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

        {/* STEP — van QR */}
        {step === "van" && (
          <div>
            {driver && (
              <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                Driver: <strong>{driver.name ?? driver.raw}</strong>
                {driver.route ? ` · Route ${driver.route}` : ""}
              </div>
            )}
            <BarcodeScanner
              prompt="Scan the van's QR code"
              manualPlaceholder="Van ID (e.g. VAN-014)"
              onScan={(value) => {
                const van = value.trim();
                setVanId(van);
                void detectTrip(van);
              }}
            />
          </div>
        )}

        {/* STEP — deciding trip type */}
        {step === "trip_check" && (
          <div className="pt-10 text-center">
            {showCyclePrompt ? (
              <div className="mx-auto max-w-sm rounded-xl border border-slate-200 bg-white p-6 text-left">
                <h2 className="text-lg font-bold text-slate-900">
                  This van has already been inspected today
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  Van {vanId} has a completed pre-trip and post-trip for today. Would you like to
                  start a new inspection? A new post-trip will also be required.
                </p>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <button
                    onClick={() => router.push(homeHref)}
                    className="rounded-lg border border-slate-300 py-2.5 text-sm font-semibold text-slate-700"
                  >
                    No, exit
                  </button>
                  <button
                    onClick={() => {
                      setShowCyclePrompt(false);
                      void beginTrip("pre", cycle);
                    }}
                    className="rounded-lg bg-slate-900 py-2.5 text-sm font-semibold text-white"
                  >
                    Yes, start new
                  </button>
                </div>
              </div>
            ) : loadError ? (
              <div className="mx-auto max-w-sm">
                <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">{loadError}</p>
                <button
                  onClick={() => vanId && void detectTrip(vanId)}
                  className="mt-4 w-full rounded-lg bg-slate-900 py-3 font-semibold text-white"
                >
                  Try again
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center py-16">
                <div className="h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-sky-500" />
                <p className="mt-4 text-sm text-slate-500">Checking today&apos;s inspections…</p>
              </div>
            )}
          </div>
        )}

        {/* STEP — questions */}
        {step === "questions" && (
          <div>
            <div className="mb-4 rounded-xl bg-slate-900 p-4 text-white">
              <p className="text-xs uppercase tracking-wide text-slate-400">
                {tripLabel} inspection{cycle > 1 ? ` · #${cycle} today` : ""}
              </p>
              <p className="text-lg font-bold">Van {vanId}</p>
              <p className="text-sm text-slate-300">
                {driver?.name ?? driver?.raw}
                {driver?.route ? ` · Route ${driver.route}` : ""}
              </p>
            </div>

            <div className="space-y-3">
              {questions.map((q) => {
                const a = answers[q.id];
                return (
                  <div key={q.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      {q.category}
                    </p>
                    <p className="mt-0.5 font-medium text-slate-800">{q.label}</p>
                    {q.hint && <p className="mt-0.5 text-xs text-slate-400">{q.hint}</p>}

                    {q.input === "check" && (
                      <>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <button
                            onClick={() => setAnswer(q.id, "ok")}
                            className={`rounded-lg py-2.5 text-sm font-semibold ${
                              a?.value === "ok" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            ✓ OK
                          </button>
                          <button
                            onClick={() => setAnswer(q.id, "issue")}
                            className={`rounded-lg py-2.5 text-sm font-semibold ${
                              a?.value === "issue" ? "bg-red-600 text-white" : "bg-slate-100 text-slate-600"
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
                      </>
                    )}

                    {q.input === "yesno" && (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {(["yes", "no"] as const).map((v) => (
                          <button
                            key={v}
                            onClick={() => setAnswer(q.id, v)}
                            className={`rounded-lg py-2.5 text-sm font-semibold capitalize ${
                              a?.value === v ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    )}

                    {q.input === "number" && (
                      <input
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={a?.value ?? ""}
                        onChange={(e) => setAnswer(q.id, e.target.value.replace(/[^\d]/g, ""))}
                        placeholder="0"
                        className="mt-3 w-full rounded-lg border border-slate-300 px-4 py-3 text-lg tabular-nums outline-none focus:border-slate-500"
                      />
                    )}

                    {q.input === "text" && (
                      <textarea
                        value={a?.value ?? ""}
                        onChange={(e) => setAnswer(q.id, e.target.value)}
                        rows={3}
                        placeholder="Type here (optional)"
                        className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
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
              {allAnswered
                ? "Continue to Photos"
                : `Answer all ${requiredQuestions.length} items`}
            </button>
          </div>
        )}

        {/* STEP — required photos (one continuous camera session) */}
        {step === "photos" && (
          <div>
            <div className="mb-5 rounded-xl border border-sky-100 bg-sky-50 p-4 text-center text-sky-900">
              <p className="font-semibold">We require photos of the vehicle.</p>
              <p className="text-sm">
                Open the camera once — it walks you through all {requiredSteps.length} shots.
              </p>
            </div>

            <MultiPhotoCapture
              steps={requiredSteps}
              photos={photos}
              onCapture={(slot, dataUrl) => setPhotos((prev) => ({ ...prev, [slot]: dataUrl }))}
            />

            <button
              disabled={!allPhotosDone}
              onClick={() => setStep("optional")}
              className="mt-6 w-full rounded-xl bg-sky-600 py-4 text-lg font-semibold text-white disabled:opacity-40"
            >
              {allPhotosDone ? "Continue" : `Take all ${requiredSteps.length} photos`}
            </button>

            {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          </div>
        )}

        {/* STEP — optional report photos */}
        {step === "optional" && (
          <div>
            <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4 text-center">
              <p className="font-semibold text-slate-900">Anything else to report?</p>
              <p className="mt-1 text-sm text-slate-500">
                You can add up to 4 optional photos of anything you want management to see —
                damage, worn parts, anything. Skipping this never fails the inspection.
              </p>
            </div>

            {optionalTaken < OPTIONAL_SLOTS.length && (
              <PhotoCapture
                key={OPTIONAL_SLOTS[optionalIndex]}
                step={{
                  slot: OPTIONAL_SLOTS[optionalIndex],
                  title: `Optional Photo ${optionalIndex + 1}`,
                  instruction: "Capture anything you feel you need to report.",
                }}
                index={optionalIndex}
                total={OPTIONAL_SLOTS.length}
                existing={photos[OPTIONAL_SLOTS[optionalIndex]]}
                description={photoDescriptions[OPTIONAL_SLOTS[optionalIndex]]}
                onDescription={(text) =>
                  setPhotoDescriptions((prev) => ({ ...prev, [OPTIONAL_SLOTS[optionalIndex]]: text }))
                }
                onCapture={(dataUrl) =>
                  setPhotos((prev) => ({ ...prev, [OPTIONAL_SLOTS[optionalIndex]]: dataUrl }))
                }
              />
            )}

            {photos[OPTIONAL_SLOTS[optionalIndex]] && optionalIndex < OPTIONAL_SLOTS.length - 1 && (
              <button
                onClick={() => setOptionalIndex((i) => i + 1)}
                className="mt-4 w-full rounded-lg border border-slate-300 bg-white py-2.5 text-sm font-semibold text-slate-700"
              >
                + Add another photo
              </button>
            )}

            <button
              onClick={() => void submit({ failed: false })}
              className="mt-6 w-full rounded-xl bg-emerald-600 py-4 text-lg font-semibold text-white"
            >
              {optionalTaken > 0 ? "Finish & Submit" : "Skip & Submit"}
            </button>
            {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
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
            {result.status === "failed_inspection" ? (
              <div>
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-100 text-red-600">
                  <IconXCircle size={44} />
                </div>
                <h1 className="mt-4 text-2xl font-extrabold text-red-700">FAILED INSPECTION</h1>
                <p className="mt-2 text-slate-600">
                  This {tripLabel.toLowerCase()} was not completed. Everything entered has been
                  recorded and the van is flagged for management review.
                </p>
              </div>
            ) : result.status === "flagged" ? (
              <div>
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-100 text-red-600">
                  <IconAlert size={42} />
                </div>
                <h1 className="mt-4 text-2xl font-extrabold text-red-700">Report Van to Management</h1>
                <p className="mt-2 text-slate-600">
                  This van has {flagged.length} reported issue{flagged.length === 1 ? "" : "s"}. Do{" "}
                  <strong>not</strong> operate it until cleared. Management has been notified.
                </p>
                <ul className="mx-auto mt-4 max-w-xs space-y-1 text-left text-sm">
                  {flagged.map((q) => (
                    <li key={q.id} className="rounded-lg bg-red-50 px-3 py-2 text-red-800">
                      ⚠ {q.label}
                      {answers[q.id]?.note ? ` — ${answers[q.id]?.note}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div>
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <IconCheckCircle size={44} />
                </div>
                <h1 className="mt-4 text-2xl font-extrabold text-emerald-700">
                  {tripLabel} Complete
                </h1>
                <p className="mt-2 text-slate-600">
                  {tripType === "pre"
                    ? `Van ${vanId} passed the pre-trip check. You're cleared to drive — remember the post-trip when you return.`
                    : `Van ${vanId} post-trip recorded. You're all set for the day.`}
                </p>
              </div>
            )}
            <Link
              href={homeHref}
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
