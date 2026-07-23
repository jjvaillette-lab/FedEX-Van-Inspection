import { NextResponse } from "next/server";
import {
  loadAllQuestions,
  loadSettings,
  questionsForTrip,
  saveQuestions,
  saveSettings,
} from "@/lib/questionStore";
import { companyFromRequest } from "@/lib/company";
import type { InspectionSettings, QuestionDef } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const companyId = await companyFromRequest(request);

  // Owner editor: everything, including disabled + DOT-hidden questions.
  if (url.searchParams.get("all")) {
    const [{ questions, persisted }, { settings }] = await Promise.all([
      loadAllQuestions(companyId),
      loadSettings(companyId),
    ]);
    return NextResponse.json({ questions, settings, persisted });
  }

  // Driver app: active questions for one trip type.
  const trip = url.searchParams.get("trip") === "post" ? "post" : "pre";
  const { questions, settings } = await questionsForTrip(companyId, trip);
  return NextResponse.json({ questions, settings });
}

export async function PUT(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    questions?: QuestionDef[];
    settings?: InspectionSettings;
  };
  const companyId = await companyFromRequest(request);
  try {
    if (body.questions) await saveQuestions(companyId, body.questions);
    if (body.settings) await saveSettings(companyId, body.settings);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Save failed" },
      { status: 500 }
    );
  }
}
