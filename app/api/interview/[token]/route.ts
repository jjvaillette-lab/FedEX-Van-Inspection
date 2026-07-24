import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { tenantFor } from "@/lib/company";
import { loadAlertSettings, sendEmail } from "@/lib/notify";
import {
  loadPosition,
  nextTurn,
  openingMessage,
  scoreInterview,
  type CandidateRow,
  type TranscriptTurn,
} from "@/lib/interview";

export const runtime = "nodejs";

/**
 * Candidate-facing interview API. Public route, gated by the unguessable
 * invite token — same trust model as the driver activation link. Candidates
 * can only ever see and write their own interview.
 */

async function candidateByToken(token: string): Promise<CandidateRow | null> {
  const supabase = getSupabase();
  if (!supabase || !token || token.length < 16) return null;
  const { data, error } = await supabase
    .from("candidates")
    .select("*")
    .eq("interview_token", token)
    .maybeSingle();
  if (error || !data) return null;
  return data as CandidateRow;
}

export async function GET(
  request: Request,
  ctx: { params: Promise<{ token: string }> }
) {
  const { token } = await ctx.params;
  const c = await candidateByToken(token);
  if (!c) return NextResponse.json({ error: "Interview not found." }, { status: 404 });
  const tenant = await tenantFor(c.company_id);
  return NextResponse.json({
    company: { name: tenant.name, themeColor: tenant.themeColor },
    candidateName: c.name,
    status: c.status,
    transcript: c.transcript ?? [],
  });
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ token: string }> }
) {
  const { token } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as {
    action?: "start" | "message";
    message?: string;
  };
  const c = await candidateByToken(token);
  if (!c) return NextResponse.json({ error: "Interview not found." }, { status: 404 });
  if (c.status === "archived") {
    return NextResponse.json({ error: "This interview link is no longer active." }, { status: 410 });
  }

  const supabase = getSupabase()!;
  const tenant = await tenantFor(c.company_id);
  const position = c.position_id ? await loadPosition(c.position_id, tenant.name) : null;
  if (!position || position.questions.length === 0) {
    return NextResponse.json(
      { error: "This interview isn't set up yet — please contact the hiring team." },
      { status: 409 }
    );
  }

  const now = () => new Date().toISOString();
  const transcript: TranscriptTurn[] = [...(c.transcript ?? [])];

  // Start (idempotent): first interviewer message.
  if (body.action === "start" || transcript.length === 0) {
    if (transcript.length === 0) {
      transcript.push({ role: "interviewer", text: openingMessage(position, c.name), at: now() });
      await supabase
        .from("candidates")
        .update({ transcript, status: "in_progress", started_at: now() })
        .eq("id", c.id);
    }
    return NextResponse.json({ transcript, done: c.status === "completed" });
  }

  if (c.status === "completed") {
    return NextResponse.json({ transcript, done: true });
  }

  const message = body.message?.trim();
  if (!message) return NextResponse.json({ error: "Empty message." }, { status: 400 });
  if (message.length > 4000) {
    return NextResponse.json({ error: "Please keep answers under 4000 characters." }, { status: 400 });
  }
  // Guard against runaway conversations.
  if (transcript.length > 120) {
    return NextResponse.json({ error: "This interview has ended." }, { status: 410 });
  }

  transcript.push({ role: "candidate", text: message, at: now() });
  const turn = await nextTurn(position, transcript);
  transcript.push({ role: "interviewer", text: turn.message, at: now() });

  const patch: Record<string, unknown> = { transcript };
  if (turn.done) {
    patch.status = "completed";
    patch.completed_at = now();
    const startedAt = c.started_at ?? transcript[0]?.at;
    if (startedAt) {
      patch.duration_secs = Math.max(
        0,
        Math.round((Date.now() - new Date(startedAt).getTime()) / 1000)
      );
    }
    const result = await scoreInterview(position, transcript);
    if (result) {
      patch.score = result.score;
      patch.summary = result.summary;
      patch.red_flags = result.redFlags;
    }
  }
  await supabase.from("candidates").update(patch).eq("id", c.id);

  // Tell the hiring team the moment an interview finishes (never blocks).
  if (turn.done) {
    try {
      const { settings } = await loadAlertSettings(c.company_id);
      if (settings.emails.length > 0) {
        const scoreLine = patch.score
          ? `AI score: ${patch.score}/10 — ${patch.summary}`
          : "Transcript ready for review (AI scoring not enabled yet).";
        await sendEmail(
          settings.emails,
          `Interview completed — ${c.name} (${position.title})`,
          `${c.name} just finished their first-round interview for ${position.title}.\n\n${scoreLine}\n\nReview: https://www.lastmileassist.com/portal/hr`
        );
      }
    } catch {
      /* notification is best-effort */
    }
  }

  return NextResponse.json({ transcript, done: turn.done });
}
