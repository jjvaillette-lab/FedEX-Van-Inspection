import { getSupabase } from "./supabase";
import { DEFAULT_COMPANY_ID, loadSetting, missingCompanyColumn, saveSetting } from "./company";
import { DEFAULT_QUESTIONS, DEFAULT_SETTINGS } from "./questions";
import type { InspectionSettings, QuestionDef, TripType } from "./types";

/**
 * Owner-editable question set + inspection settings, stored per company in
 * Supabase (`questions`, `app_settings`). Falls back to the built-in defaults
 * whenever the tables don't exist yet, so the driver app always has a
 * checklist. Company scoping degrades to the legacy unscoped queries until
 * migration-v7 adds the company_id column.
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
  auto_inactive?: boolean;
  company_id?: string;
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
    // Pre-migration rows have no column: default safety checks to grounding.
    autoInactive: r.auto_inactive ?? r.input_type === "check",
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
    auto_inactive: q.autoInactive ?? q.input === "check",
    sort_order: q.sortOrder,
  };
}

/** Load a company's questions; seeds the table with defaults on first use.
 *  `persisted` is false when the database isn't available (migration not run). */
export async function loadAllQuestions(
  companyId: string = DEFAULT_COMPANY_ID
): Promise<{ questions: QuestionDef[]; persisted: boolean }> {
  const supabase = getSupabase();
  if (!supabase) return { questions: DEFAULT_QUESTIONS, persisted: false };

  let scoped = true;
  let { data, error } = await supabase.from("questions").select("*").eq("company_id", companyId);
  if (error && missingCompanyColumn(error.message)) {
    scoped = false;
    ({ data, error } = await supabase.from("questions").select("*"));
  }
  if (error) return { questions: DEFAULT_QUESTIONS, persisted: false };

  const insertRows = (defs: QuestionDef[]) =>
    defs.map((q) => (scoped ? { ...defToRow(q), company_id: companyId } : defToRow(q)));

  if (!data || data.length === 0) {
    let { error: seedError } = await supabase.from("questions").insert(insertRows(DEFAULT_QUESTIONS));
    if (seedError && missingCompanyColumn(seedError.message)) {
      ({ error: seedError } = await supabase
        .from("questions")
        .insert(DEFAULT_QUESTIONS.map(defToRow)));
    }
    if (seedError) return { questions: DEFAULT_QUESTIONS, persisted: false };
    return { questions: [...DEFAULT_QUESTIONS], persisted: true };
  }

  const questions = (data as QuestionRow[]).map(rowToDef);

  // Sync: defaults added in newer app versions (e.g. new DOT items) get
  // inserted into an already-seeded company so every tenant receives them.
  const missing = DEFAULT_QUESTIONS.filter((d) => !questions.some((q) => q.id === d.id));
  if (missing.length > 0) {
    const { error: syncError } = await supabase.from("questions").insert(insertRows(missing));
    if (!syncError) questions.push(...missing);
  }

  questions.sort((a, b) => a.sortOrder - b.sortOrder);
  return { questions, persisted: true };
}

export async function saveQuestions(
  companyId: string,
  questions: QuestionDef[]
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Database not configured.");
  let { error } = await supabase
    .from("questions")
    .upsert(questions.map((q) => ({ ...defToRow(q), company_id: companyId })));
  if (error && missingCompanyColumn(error.message)) {
    ({ error } = await supabase.from("questions").upsert(questions.map(defToRow)));
  }
  if (error) {
    throw new Error(
      /relation|schema cache|column/i.test(error.message)
        ? "Database update required: run supabase/migration-v7.sql in the Supabase SQL editor."
        : `Save failed: ${error.message}`
    );
  }
}

export async function loadSettings(
  companyId: string = DEFAULT_COMPANY_ID
): Promise<{ settings: InspectionSettings; persisted: boolean }> {
  const supabase = getSupabase();
  if (!supabase) return { settings: { ...DEFAULT_SETTINGS }, persisted: false };
  const { value, persisted } = await loadSetting<Partial<InspectionSettings>>(
    companyId,
    "inspection"
  );
  return { settings: { ...DEFAULT_SETTINGS, ...(value ?? {}) }, persisted };
}

export async function saveSettings(companyId: string, settings: InspectionSettings): Promise<void> {
  await saveSetting(companyId, "inspection", settings);
}

/** The questions a driver actually sees for a given trip type. */
export async function questionsForTrip(
  companyId: string,
  trip: TripType
): Promise<{
  questions: QuestionDef[];
  settings: InspectionSettings;
}> {
  const [{ questions }, { settings }] = await Promise.all([
    loadAllQuestions(companyId),
    loadSettings(companyId),
  ]);
  const filtered = questions
    .filter((q) => q.enabled)
    .filter((q) => q.trip === trip || q.trip === "both")
    .filter((q) => settings.dotMode || !q.dotSpecific)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  return { questions: filtered, settings };
}
