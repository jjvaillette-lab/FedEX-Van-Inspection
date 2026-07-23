import { getSupabase } from "./supabase";
import { DEFAULT_QUESTIONS, DEFAULT_SETTINGS } from "./questions";
import type { InspectionSettings, QuestionDef, TripType } from "./types";

/**
 * Owner-editable question set + inspection settings, stored in Supabase
 * (`questions`, `app_settings`). Falls back to the built-in defaults whenever
 * the tables don't exist yet, so the driver app always has a checklist.
 */

interface QuestionRow {
  id: string;
  label: string;
  category: string;
  hint: string | null;
  trip_type: string;
  input_type: string;
  dot_specific: boolean;
  enabled: boolean;
  sort_order: number;
}

function rowToDef(r: QuestionRow): QuestionDef {
  return {
    id: r.id,
    label: r.label,
    category: r.category,
    hint: r.hint ?? undefined,
    trip: (r.trip_type as QuestionDef["trip"]) || "pre",
    input: (r.input_type as QuestionDef["input"]) || "check",
    dotSpecific: r.dot_specific,
    enabled: r.enabled,
    sortOrder: r.sort_order,
  };
}

function defToRow(q: QuestionDef): QuestionRow {
  return {
    id: q.id,
    label: q.label,
    category: q.category,
    hint: q.hint ?? null,
    trip_type: q.trip,
    input_type: q.input,
    dot_specific: q.dotSpecific,
    enabled: q.enabled,
    sort_order: q.sortOrder,
  };
}

/** Load all questions; seeds the table with defaults on first use. `persisted`
 *  is false when the database tables aren't available (migration not run). */
export async function loadAllQuestions(): Promise<{ questions: QuestionDef[]; persisted: boolean }> {
  const supabase = getSupabase();
  if (!supabase) return { questions: DEFAULT_QUESTIONS, persisted: false };

  const { data, error } = await supabase.from("questions").select("*");
  if (error) return { questions: DEFAULT_QUESTIONS, persisted: false };

  if (!data || data.length === 0) {
    const { error: seedError } = await supabase
      .from("questions")
      .insert(DEFAULT_QUESTIONS.map(defToRow));
    if (seedError) return { questions: DEFAULT_QUESTIONS, persisted: false };
    return { questions: [...DEFAULT_QUESTIONS], persisted: true };
  }

  const questions = (data as QuestionRow[]).map(rowToDef);

  // Sync: defaults added in newer app versions (e.g. new DOT items) get
  // inserted into an already-seeded table so every tenant receives them.
  const missing = DEFAULT_QUESTIONS.filter((d) => !questions.some((q) => q.id === d.id));
  if (missing.length > 0) {
    const { error: syncError } = await supabase
      .from("questions")
      .insert(missing.map(defToRow));
    if (!syncError) questions.push(...missing);
  }

  questions.sort((a, b) => a.sortOrder - b.sortOrder);
  return { questions, persisted: true };
}

export async function saveQuestions(questions: QuestionDef[]): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Database not configured.");
  const { error } = await supabase.from("questions").upsert(questions.map(defToRow));
  if (error) {
    throw new Error(
      /relation|schema cache/i.test(error.message)
        ? "Database update required: run supabase/migration-v2.sql in the Supabase SQL editor."
        : `Save failed: ${error.message}`
    );
  }
}

export async function loadSettings(): Promise<{ settings: InspectionSettings; persisted: boolean }> {
  const supabase = getSupabase();
  if (!supabase) return { settings: { ...DEFAULT_SETTINGS }, persisted: false };
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "inspection")
    .maybeSingle();
  if (error) return { settings: { ...DEFAULT_SETTINGS }, persisted: false };
  return {
    settings: { ...DEFAULT_SETTINGS, ...((data?.value as Partial<InspectionSettings>) ?? {}) },
    persisted: true,
  };
}

export async function saveSettings(settings: InspectionSettings): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Database not configured.");
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key: "inspection", value: settings });
  if (error) {
    throw new Error(
      /relation|schema cache/i.test(error.message)
        ? "Database update required: run supabase/migration-v2.sql in the Supabase SQL editor."
        : `Save failed: ${error.message}`
    );
  }
}

/** The questions a driver actually sees for a given trip type. */
export async function questionsForTrip(trip: TripType): Promise<{
  questions: QuestionDef[];
  settings: InspectionSettings;
}> {
  const [{ questions }, { settings }] = await Promise.all([loadAllQuestions(), loadSettings()]);
  const filtered = questions
    .filter((q) => q.enabled)
    .filter((q) => q.trip === trip || q.trip === "both")
    .filter((q) => settings.dotMode || !q.dotSpecific)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  return { questions: filtered, settings };
}
