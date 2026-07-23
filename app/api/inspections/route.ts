import { NextResponse } from "next/server";
import { saveInspection, listInspections } from "@/lib/storage";
import { notifyInspection } from "@/lib/notify";
import { loadAllQuestions } from "@/lib/questionStore";
import { getSupabase } from "@/lib/supabase";
import { companyFromRequest, missingCompanyColumn } from "@/lib/company";
import type { Inspection } from "@/lib/types";

/**
 * DVIR auto-grounding: an "issue" on any question flagged auto-inactive moves
 * the van to the Inactive list until an owner reactivates it. Never blocks
 * the driver's submission.
 */
async function autoGroundVan(inspection: Inspection, companyId: string): Promise<void> {
  try {
    const issues = inspection.answers.filter((a) => a.value === "issue");
    if (issues.length === 0) return;
    const { questions } = await loadAllQuestions(companyId);
    const grounding = issues
      .map((a) => questions.find((q) => q.id === a.questionId))
      .filter((q) => q && (q.autoInactive ?? q.input === "check"));
    if (grounding.length === 0) return;
    const supabase = getSupabase();
    if (!supabase) return;
    const labels = grounding.map((q) => q!.category).filter((v, i, arr) => arr.indexOf(v) === i);
    const row = {
      id: inspection.vanId,
      active: false,
      status_reason: `Auto — DVIR safety issue: ${labels.join(", ")} (${inspection.driver.name ?? inspection.driver.raw}, ${new Date(inspection.createdAt).toLocaleDateString("en-US")})`,
      status_changed_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("vans").upsert({ ...row, company_id: companyId });
    if (error && missingCompanyColumn(error.message)) {
      await supabase.from("vans").upsert(row);
    }
  } catch {
    /* grounding must never break a submission */
  }
}

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const vanId = url.searchParams.get("vanId") ?? undefined;
  const companyId = await companyFromRequest(request);
  const inspections = await listInspections(companyId, vanId);
  return NextResponse.json({ inspections });
}

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<Inspection> & {
    /** Client-computed: all required questions answered + required photos taken. */
    complete?: boolean;
    /** Driver explicitly ended the inspection early. */
    failed?: boolean;
  };

  if (!body.driver || !body.vanId || !Array.isArray(body.answers)) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const hasIssues = body.answers.some((a) => a.value === "issue");
  const complete = body.complete !== false && !body.failed;

  const inspection: Inspection = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    driver: body.driver,
    vanId: body.vanId,
    tripType: body.tripType === "post" ? "post" : "pre",
    cycle: typeof body.cycle === "number" && body.cycle > 0 ? body.cycle : 1,
    answers: body.answers,
    photos: body.photos ?? [],
    hasIssues,
    status: !complete ? "failed_inspection" : hasIssues ? "flagged" : "passed",
    resolution: null,
    comments: [],
  };

  const companyId = await companyFromRequest(request);
  try {
    await saveInspection(inspection, companyId);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Save failed" },
      { status: 500 }
    );
  }

  // Instant alerts + DVIR auto-grounding; never blocks the driver's submission.
  if (inspection.status !== "passed") {
    await Promise.all([
      notifyInspection(inspection, companyId),
      autoGroundVan(inspection, companyId),
    ]);
  }

  return NextResponse.json({ inspection }, { status: 201 });
}
