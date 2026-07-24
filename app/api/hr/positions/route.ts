import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { companyFromRequest } from "@/lib/company";
import { HIRING_MIGRATION_MSG, type PositionQuestion } from "@/lib/interview";

export const runtime = "nodejs";

interface PositionBody {
  id?: string;
  title?: string;
  description?: string;
  pay?: string;
  location?: string;
  questions?: PositionQuestion[];
  active?: boolean;
}

export async function GET(request: Request) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ positions: [], persisted: false });
  const companyId = await companyFromRequest(request);
  const { data, error } = await supabase
    .from("positions")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });
  if (error) {
    return NextResponse.json({ positions: [], persisted: false, error: HIRING_MIGRATION_MSG });
  }
  return NextResponse.json({ positions: data, persisted: true });
}

/** POST: create; PUT: update. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as PositionBody;
  if (!body.title?.trim()) {
    return NextResponse.json({ error: "Position title is required." }, { status: 400 });
  }
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  const companyId = await companyFromRequest(request);
  const { data, error } = await supabase
    .from("positions")
    .insert({
      company_id: companyId,
      title: body.title.trim(),
      description: body.description?.trim() || null,
      pay: body.pay?.trim() || null,
      location: body.location?.trim() || null,
      questions: (body.questions ?? []).filter((q) => q.text?.trim()),
    })
    .select()
    .single();
  if (error) {
    return NextResponse.json(
      { error: /relation|schema cache/i.test(error.message) ? HIRING_MIGRATION_MSG : error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ position: data }, { status: 201 });
}

export async function PUT(request: Request) {
  const body = (await request.json().catch(() => ({}))) as PositionBody;
  if (!body.id) return NextResponse.json({ error: "Missing position id." }, { status: 400 });
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  const companyId = await companyFromRequest(request);
  const patch: Record<string, unknown> = {};
  if (body.title?.trim()) patch.title = body.title.trim();
  if (body.description !== undefined) patch.description = body.description?.trim() || null;
  if (body.pay !== undefined) patch.pay = body.pay?.trim() || null;
  if (body.location !== undefined) patch.location = body.location?.trim() || null;
  if (body.questions) patch.questions = body.questions.filter((q) => q.text?.trim());
  if (typeof body.active === "boolean") patch.active = body.active;
  const { error } = await supabase
    .from("positions")
    .update(patch)
    .eq("id", body.id)
    .eq("company_id", companyId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
