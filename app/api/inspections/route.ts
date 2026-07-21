import { NextResponse } from "next/server";
import { saveInspection, listInspections } from "@/lib/storage";
import type { Inspection } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  const inspections = await listInspections();
  return NextResponse.json({ inspections });
}

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<Inspection>;

  if (!body.driver || !body.vanId || !Array.isArray(body.answers)) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const hasIssues = body.answers.some((a) => a.value === "issue");

  const inspection: Inspection = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    driver: body.driver,
    vanId: body.vanId,
    answers: body.answers,
    photos: body.photos ?? [],
    hasIssues,
    status: hasIssues ? "reported_to_management" : "submitted",
  };

  await saveInspection(inspection);
  return NextResponse.json({ inspection }, { status: 201 });
}
