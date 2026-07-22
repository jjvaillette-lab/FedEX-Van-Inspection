"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/app/components/portal/AuthProvider";
import { IconArrowDown, IconArrowUp, IconPlus } from "@/app/components/icons";
import type { InspectionSettings, QuestionDef, TripType } from "@/lib/types";

/**
 * Owner checklist editor. The philosophy (per owner spec): load MORE questions
 * than needed and toggle off what a given operation doesn't use. DOT-specific
 * questions disappear for drivers in Non-DOT mode, but the owner always sees
 * everything here and can enable any of them.
 */
export default function ChecklistEditor() {
  const { user, tenant, hasPermission } = useAuth();
  const brand = tenant.themeColor;
  const canEdit = user?.role === "owner" || hasPermission("inspection.edit_questions");

  const [questions, setQuestions] = useState<QuestionDef[]>([]);
  const [settings, setSettings] = useState<InspectionSettings>({ dotMode: true, interiorPhotos: false });
  const [persisted, setPersisted] = useState(true);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [adding, setAdding] = useState<TripType | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [newCategory, setNewCategory] = useState("");

  useEffect(() => {
    fetch("/api/questions?all=1")
      .then((r) => r.json())
      .then((d) => {
        setQuestions(d.questions ?? []);
        if (d.settings) setSettings(d.settings);
        setPersisted(!!d.persisted);
      })
      .finally(() => setLoading(false));
  }, []);

  const mutate = (fn: (qs: QuestionDef[]) => QuestionDef[]) => {
    setQuestions(fn);
    setDirty(true);
    setMessage(null);
  };

  const move = (id: string, dir: -1 | 1) =>
    mutate((qs) => {
      const sorted = [...qs].sort((a, b) => a.sortOrder - b.sortOrder);
      const group = sorted.filter((q) => q.trip === sorted.find((x) => x.id === id)?.trip);
      const idx = group.findIndex((q) => q.id === id);
      const swap = group[idx + dir];
      if (!swap) return qs;
      const self = group[idx];
      return qs.map((q) =>
        q.id === self.id ? { ...q, sortOrder: swap.sortOrder } :
        q.id === swap.id ? { ...q, sortOrder: self.sortOrder } : q
      );
    });

  const addQuestion = (trip: TripType) => {
    const label = newLabel.trim();
    if (!label) return;
    const id = `custom_${label.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40)}_${Date.now() % 10000}`;
    const maxOrder = Math.max(0, ...questions.filter((q) => q.trip === trip).map((q) => q.sortOrder));
    mutate((qs) => [
      ...qs,
      {
        id,
        label,
        category: newCategory.trim() || "Custom",
        trip,
        input: "check",
        dotSpecific: false,
        enabled: true,
        sortOrder: maxOrder + 10,
      },
    ]);
    setNewLabel("");
    setNewCategory("");
    setAdding(null);
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/questions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions, settings }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setDirty(false);
      setMessage({ ok: true, text: "Checklist saved — drivers see the changes immediately." });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "Save failed" });
    } finally {
      setSaving(false);
    }
  };

  const groups = useMemo(() => {
    const sorted = [...questions].sort((a, b) => a.sortOrder - b.sortOrder);
    return [
      { trip: "pre" as TripType, title: "Pre-Trip questions", items: sorted.filter((q) => q.trip === "pre" || q.trip === "both") },
      { trip: "post" as TripType, title: "Post-Trip questions", items: sorted.filter((q) => q.trip === "post") },
    ];
  }, [questions]);

  if (!canEdit) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 text-center text-slate-500">
        You don&apos;t have access to edit the checklist. Ask an owner to grant it.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 md:px-8">
      <nav className="mb-1 flex items-center gap-2 text-sm text-slate-400">
        <Link href="/portal" className="hover:text-slate-600">Portal</Link>
        <span>/</span>
        <Link href="/portal/fleet" className="hover:text-slate-600">Fleet</Link>
        <span>/</span>
        <span className="text-slate-500">Checklist</span>
      </nav>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Inspection Checklist</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Edit, reorder, hide, or add questions. Hidden questions never reach drivers.
          </p>
        </div>
        <button
          onClick={save}
          disabled={saving || !dirty}
          className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          style={{ background: brand }}
        >
          {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
        </button>
      </div>

      {!persisted && (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          The checklist database isn&apos;t set up yet, so you&apos;re viewing the built-in defaults.
          Run <code className="font-mono">supabase/migration-v2.sql</code> in the Supabase SQL editor
          to enable editing.
        </p>
      )}
      {message && (
        <p
          className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
            message.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </p>
      )}

      {/* Company-level toggles */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-white p-4">
          <input
            type="checkbox"
            checked={settings.dotMode}
            onChange={(e) => {
              setSettings((s) => ({ ...s, dotMode: e.target.checked }));
              setDirty(true);
            }}
            className="mt-0.5 h-4 w-4"
            style={{ accentColor: brand }}
          />
          <span>
            <span className="block text-sm font-semibold text-slate-800">DOT operation</span>
            <span className="block text-xs text-slate-500">
              Off = Non-DOT mode: DOT-specific questions are hidden from drivers by default. You can
              still enable any question below.
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-white p-4">
          <input
            type="checkbox"
            checked={settings.interiorPhotos}
            onChange={(e) => {
              setSettings((s) => ({ ...s, interiorPhotos: e.target.checked }));
              setDirty(true);
            }}
            className="mt-0.5 h-4 w-4"
            style={{ accentColor: brand }}
          />
          <span>
            <span className="block text-sm font-semibold text-slate-800">Post-trip interior photos</span>
            <span className="block text-xs text-slate-500">
              Adds 3 required photos to every post-trip: Interior Cabin, Interior Cargo Area, and
              Fuel Gauge level.
            </span>
          </span>
        </label>
      </div>

      {loading ? (
        <p className="py-16 text-center text-slate-400">Loading…</p>
      ) : (
        groups.map((g) => (
          <section key={g.trip} className="mt-8">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">{g.title}</h2>
              <button
                onClick={() => setAdding(adding === g.trip ? null : g.trip)}
                className="inline-flex items-center gap-1.5 text-sm font-semibold"
                style={{ color: brand }}
              >
                <IconPlus size={15} /> Add question
              </button>
            </div>

            {adding === g.trip && (
              <div className="mb-3 rounded-lg border border-slate-300 bg-white p-4">
                <div className="grid gap-2 sm:grid-cols-[1fr_200px_auto]">
                  <input
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    placeholder="Question text (answered OK / Issue)"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                  />
                  <input
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="Category (optional)"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                  />
                  <button
                    onClick={() => addQuestion(g.trip)}
                    disabled={!newLabel.trim()}
                    className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                    style={{ background: brand }}
                  >
                    Add
                  </button>
                </div>
              </div>
            )}

            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              {g.items.map((q, idx) => (
                <div
                  key={q.id}
                  className={`flex items-center gap-3 px-4 py-2.5 ${idx > 0 ? "border-t border-slate-100" : ""} ${
                    !q.enabled ? "opacity-50" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={q.enabled}
                    title={q.enabled ? "Visible to drivers — uncheck to hide" : "Hidden from drivers"}
                    onChange={(e) =>
                      mutate((qs) => qs.map((x) => (x.id === q.id ? { ...x, enabled: e.target.checked } : x)))
                    }
                    className="h-4 w-4 shrink-0"
                    style={{ accentColor: brand }}
                  />
                  <input
                    value={q.label}
                    onChange={(e) =>
                      mutate((qs) => qs.map((x) => (x.id === q.id ? { ...x, label: e.target.value } : x)))
                    }
                    className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-2 py-1 text-sm text-slate-800 outline-none hover:border-slate-200 focus:border-slate-400 focus:bg-white"
                  />
                  <span className="hidden w-28 truncate text-xs text-slate-400 sm:block">{q.category}</span>
                  {q.input !== "check" && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-500">
                      {q.input}
                    </span>
                  )}
                  <button
                    onClick={() =>
                      mutate((qs) => qs.map((x) => (x.id === q.id ? { ...x, dotSpecific: !x.dotSpecific } : x)))
                    }
                    title="DOT-specific questions hide automatically in Non-DOT mode"
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                      q.dotSpecific ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    DOT
                  </button>
                  <div className="flex shrink-0 gap-0.5 text-slate-400">
                    <button onClick={() => move(q.id, -1)} className="rounded p-1 hover:bg-slate-100" title="Move up">
                      <IconArrowUp size={14} />
                    </button>
                    <button onClick={() => move(q.id, 1)} className="rounded p-1 hover:bg-slate-100" title="Move down">
                      <IconArrowDown size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))
      )}

      <p className="mt-6 text-xs text-slate-400">
        Tip: keep extra questions in the list and just toggle them off — turning one back on takes a
        single click and a save.
      </p>
    </div>
  );
}
