import { NextResponse } from "next/server";
import { saveInspection, listInspections } from "@/lib/storage";
import { notifyInspection } from "@/lib/notify";
import type { Inspection } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const vanId = url.searchParams.get("vanId") ?? undefined;
  const inspections = await listInspections(vanId);
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

  try {
    await saveInspection(inspection);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Save failed" },
      { status: 500 }
    );
  }

  // Instant alerts for anything that needs management's eyes; never blocks
  // the driver's submission.
  if (inspection.status !== "passed") {
    await notifyInspection(inspection);
  }

  return NextResponse.json({ inspection }, { status: 201 });
}
