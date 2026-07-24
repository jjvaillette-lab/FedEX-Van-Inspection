import { getSupabase } from "./supabase";

/**
 * AI interview engine (server-side).
 *
 * With ANTHROPIC_API_KEY set, Claude conducts the interview: it asks the
 * position's questions one at a time, probes vague or interesting answers
 * with ONE follow-up, stays strictly job-related, and scores the finished
 * transcript. Without the key, the engine runs in scripted mode — it asks
 * the configured questions verbatim and the owner reviews un-scored
 * transcripts by hand. Same tables, same UI, zero vendor dependency.
 */

export interface PositionQuestion {
  id: string;
  text: string;
  /** Turned off by the owner — kept in the set, never asked. */
  off?: boolean;
  /** Owner saw a compliance warning and chose to keep the question. */
  overridden?: boolean;
}

export interface TranscriptTurn {
  role: "interviewer" | "candidate";
  text: string;
  at: string;
}

export interface PositionInfo {
  title: string;
  companyName: string;
  questions: PositionQuestion[];
}

export const aiConfigured = (): boolean => !!process.env.ANTHROPIC_API_KEY;

const MODEL = "claude-sonnet-5";

async function claude(system: string, messages: { role: "user" | "assistant"; content: string }[], maxTokens = 400): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    return data.content?.find((c) => c.type === "text")?.text ?? null;
  } catch {
    return null;
  }
}

/** The interview's opening message (disclosure included — always shown). */
export function openingMessage(p: PositionInfo, candidateName: string): string {
  const first = candidateName.split(/\s+/)[0];
  return (
    `Hi ${first}! Thanks for applying to the ${p.title} position at ${p.companyName}. ` +
    `I'm the automated interviewer — this chat takes about 10 minutes, and your answers are ` +
    `recorded and reviewed by the hiring team. Answer in your own words, as much or as little ` +
    `as you like. Ready? First question:\n\n${p.questions[0]?.text ?? "Tell me about yourself."}`
  );
}

const DONE = "[[DONE]]";

/**
 * Next interviewer turn. Returns the message plus whether the interview is
 * finished. Scripted fallback: walk the question list in order.
 */
export async function nextTurn(
  p: PositionInfo,
  transcript: TranscriptTurn[]
): Promise<{ message: string; done: boolean }> {
  // ---- AI mode ----
  const system =
    `You are a professional, friendly first-round phone-screen interviewer for ${p.companyName}, ` +
    `hiring for: ${p.title}. Conduct the interview over chat.\n` +
    `RULES:\n` +
    `- Work through these owner-configured questions IN ORDER, one per turn:\n` +
    p.questions.map((q, i) => `  ${i + 1}. ${q.text}`).join("\n") +
    `\n- If an answer is vague, concerning, or especially interesting, ask AT MOST ONE brief follow-up before moving on.\n` +
    `- Be warm and encouraging; acknowledge answers in a few words before the next question.\n` +
    `- Stay strictly job-related. NEVER ask about age beyond the configured minimum-age question, race, religion, national origin, disability, health, family status, or anything else off-limits in hiring.\n` +
    `- If the candidate asks something you don't know (pay details, schedule specifics), say the hiring team will cover it in the next step.\n` +
    `- After the final question is answered, thank them, say the team will review and be in touch, and end your message with ${DONE}\n` +
    `- Keep every message under 80 words.`;

  const messages = transcript.map((t) => ({
    role: t.role === "interviewer" ? ("assistant" as const) : ("user" as const),
    content: t.text,
  }));

  const ai = await claude(system, messages);
  if (ai) {
    const done = ai.includes(DONE);
    return { message: ai.replace(DONE, "").trim(), done };
  }

  // ---- scripted fallback ----
  const asked = transcript.filter((t) => t.role === "interviewer").length; // incl. opening
  if (asked < p.questions.length) {
    return { message: `Thanks! Next question:\n\n${p.questions[asked].text}`, done: false };
  }
  return {
    message: `That's everything — thank you for your time! The ${p.companyName} hiring team will review your answers and reach out about next steps.`,
    done: true,
  };
}

/** Score a completed interview. Null in scripted mode (owner reviews manually). */
export async function scoreInterview(
  p: PositionInfo,
  transcript: TranscriptTurn[]
): Promise<{ score: number; summary: string; redFlags: string[] } | null> {
  const system =
    `You are evaluating a first-round screening interview for ${p.companyName} — position: ${p.title}. ` +
    `Respond with ONLY a JSON object: {"score": 1-10, "summary": "3-4 sentence hiring summary", ` +
    `"redFlags": ["short flag", ...]}. Score 8-10 = strong hire signal, 5-7 = maybe, 1-4 = poor fit. ` +
    `Consider: meets stated requirements, relevant experience, communication, reliability signals, ` +
    `red flags (can't meet requirements, evasive answers, availability conflicts). Empty redFlags array if none.`;
  const convo = transcript.map((t) => `${t.role === "interviewer" ? "Q" : "A"}: ${t.text}`).join("\n");
  const raw = await claude(system, [{ role: "user", content: convo }], 600);
  if (!raw) return null;
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as { score?: number; summary?: string; redFlags?: string[] };
    if (typeof parsed.score !== "number") return null;
    return {
      score: Math.max(1, Math.min(10, Math.round(parsed.score))),
      summary: parsed.summary ?? "",
      redFlags: Array.isArray(parsed.redFlags) ? parsed.redFlags : [],
    };
  } catch {
    return null;
  }
}

/* ---- shared row mapping ---- */

export interface CandidateRow {
  id: string;
  created_at: string;
  company_id: string;
  position_id: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  status: string;
  interview_token: string;
  invited_at: string;
  started_at: string | null;
  completed_at: string | null;
  duration_secs: number | null;
  transcript: TranscriptTurn[];
  score: number | null;
  summary: string | null;
  red_flags: string[];
  notes: string | null;
}

export const HIRING_MIGRATION_MSG =
  "Database update required: run supabase/migration-v9.sql in the Supabase SQL editor.";

export async function loadPosition(
  positionId: string,
  companyName: string
): Promise<PositionInfo | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("positions")
    .select("title, questions")
    .eq("id", positionId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    title: data.title as string,
    companyName,
    // Off questions stay in the set but are never asked.
    questions: ((data.questions ?? []) as PositionQuestion[]).filter((q) => !q.off),
  };
}
