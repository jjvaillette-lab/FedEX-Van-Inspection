import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { companyFromRequest } from "@/lib/company";
import { sendEmail, emailConfigured, smsConfigured } from "@/lib/notify";
import { aiConfigured, HIRING_MIGRATION_MSG } from "@/lib/interview";

export const runtime = "nodejs";

async function sendInviteSms(phone: string, body: string): Promise<boolean> {
  if (!smsConfigured() || !phone) return false;
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ From: process.env.TWILIO_FROM!, To: phone, Body: body }),
  }).catch(() => null);
  return !!res?.ok;
}

export async function GET(request: Request) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ candidates: [], persisted: false });
  const companyId = await companyFromRequest(request);
  const { data, error } = await supabase
    .from("candidates")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json({ candidates: [], persisted: false, error: HIRING_MIGRATION_MSG });
  }
  return NextResponse.json({
    candidates: data,
    persisted: true,
    aiConfigured: aiConfigured(),
    smsConfigured: smsConfigured(),
  });
}

/** POST: add a candidate (or a bulk import batch) and send interview invites. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    phone?: string;
    email?: string;
    positionId?: string;
    /** Bulk import (CSV/Excel from Indeed etc.): [{name, phone, email}] */
    candidates?: { name?: string; phone?: string; email?: string }[];
  };

  if (Array.isArray(body.candidates)) {
    if (!body.positionId) {
      return NextResponse.json({ error: "Pick a position for the import." }, { status: 400 });
    }
    const rows = body.candidates
      .filter((c) => c.name?.trim())
      .map((c) => ({
        name: c.name!.trim(),
        phone: c.phone?.trim() || null,
        email: c.email?.trim() || null,
        position_id: body.positionId,
        interview_token: crypto.randomUUID().replace(/-/g, ""),
      }));
    if (rows.length === 0) {
      return NextResponse.json({ error: "No candidates with names found." }, { status: 400 });
    }
    const supabase = getSupabase();
    if (!supabase) return NextResponse.json({ error: "Database not configured." }, { status: 503 });
    const companyId = await companyFromRequest(request);
    const { data, error } = await supabase
      .from("candidates")
      .insert(rows.map((r) => ({ ...r, company_id: companyId })))
      .select("id, name, phone, email, interview_token");
    if (error) {
      return NextResponse.json(
        { error: /relation|schema cache/i.test(error.message) ? HIRING_MIGRATION_MSG : error.message },
        { status: 500 }
      );
    }

    // Invites go out where channels are configured (SMS first, else email).
    const origin = new URL(request.url).origin;
    const { data: pos } = await supabase
      .from("positions")
      .select("title")
      .eq("id", body.positionId)
      .maybeSingle();
    const title = (pos?.title as string) ?? "our open position";
    let invitesSent = 0;
    for (const c of data ?? []) {
      const link = `${origin}/interview/${c.interview_token}`;
      const text =
        `Hi ${(c.name as string).split(/\s+/)[0]} — thanks for applying to the ${title} role! ` +
        `Your first-round interview is ready. It's a ~10 minute chat you can do anytime: ${link}`;
      if (c.phone && (await sendInviteSms(c.phone as string, text))) invitesSent++;
      else if (c.email && emailConfigured()) {
        await sendEmail([c.email as string], `Your interview with us — ${title}`, text);
        invitesSent++;
      }
    }
    return NextResponse.json({ ok: true, imported: rows.length, invitesSent }, { status: 201 });
  }

  if (!body.name?.trim() || !body.positionId) {
    return NextResponse.json({ error: "Candidate name and position are required." }, { status: 400 });
  }
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  const companyId = await companyFromRequest(request);

  const token = crypto.randomUUID().replace(/-/g, "");
  const { data, error } = await supabase
    .from("candidates")
    .insert({
      company_id: companyId,
      position_id: body.positionId,
      name: body.name.trim(),
      phone: body.phone?.trim() || null,
      email: body.email?.trim() || null,
      interview_token: token,
    })
    .select()
    .single();
  if (error) {
    return NextResponse.json(
      { error: /relation|schema cache/i.test(error.message) ? HIRING_MIGRATION_MSG : error.message },
      { status: 500 }
    );
  }

  const origin = new URL(request.url).origin;
  const link = `${origin}/interview/${token}`;
  const { data: pos } = await supabase
    .from("positions")
    .select("title")
    .eq("id", body.positionId)
    .maybeSingle();
  const title = (pos?.title as string) ?? "our open position";

  const inviteText =
    `Hi ${body.name.trim().split(/\s+/)[0]} — thanks for applying to the ${title} role! ` +
    `Your first-round interview is ready. It's a ~10 minute chat you can do anytime, day or night: ${link}`;

  let smsSent = false;
  let emailSent = false;
  if (body.phone?.trim()) smsSent = await sendInviteSms(body.phone.trim(), inviteText);
  if (body.email?.trim() && emailConfigured()) {
    await sendEmail([body.email.trim()], `Your interview with us — ${title}`, inviteText);
    emailSent = true;
  }

  return NextResponse.json({ candidate: data, link, smsSent, emailSent }, { status: 201 });
}

/** PATCH: status changes + notes. */
export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    status?: string;
    notes?: string;
  };
  if (!body.id) return NextResponse.json({ error: "Missing candidate id." }, { status: 400 });
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  const companyId = await companyFromRequest(request);
  const patch: Record<string, unknown> = {};
  if (
    body.status &&
    ["invited", "in_progress", "completed", "hired", "rejected", "archived"].includes(body.status)
  ) {
    patch.status = body.status;
  }
  if (body.notes !== undefined) patch.notes = body.notes;
  const { error } = await supabase
    .from("candidates")
    .update(patch)
    .eq("id", body.id)
    .eq("company_id", companyId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
