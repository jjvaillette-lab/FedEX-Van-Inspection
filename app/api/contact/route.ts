import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * Contact form handler.
 *
 * Every submission is stored in Supabase (contact_messages). If RESEND_API_KEY
 * is configured, a copy is also emailed to CONTACT_EMAIL — both values live in
 * server env only, so the destination address is never exposed to visitors.
 * GET (team session only — enforced by proxy.ts) powers the portal inbox.
 */

interface ContactDetails {
  company?: string;
  phone?: string;
  routes?: string;
  employees?: string;
  city?: string;
  state?: string;
}

function detailsText(d: ContactDetails): string {
  const parts = [
    d.company && `Company: ${d.company}`,
    d.phone && `Cell: ${d.phone}`,
    d.routes && `Daily routes: ${d.routes}`,
    d.employees && `Employees: ${d.employees}`,
    (d.city || d.state) && `Location: ${[d.city, d.state].filter(Boolean).join(", ")}`,
  ].filter(Boolean);
  return parts.join(" · ");
}

// Leads go to Jason. lastmileassist.com is a verified sending domain in
// Resend, so any recipient works and mail comes from the brand address.
const LEAD_EMAIL = "jjvaillette@gmail.com";

async function sendEmail(subject: string, text: string, replyTo?: string): Promise<{ sent: boolean; reason: string }> {
  const key = process.env.RESEND_API_KEY;
  const to = LEAD_EMAIL;
  if (!key) return { sent: false, reason: "no_api_key" };
  if (!to) return { sent: false, reason: "no_contact_email" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.CONTACT_FROM || "Last Mile Assist <leads@lastmileassist.com>",
        to: [to],
        // Reply lands with the LEAD, not with leads@ (which has no inbox).
        // Without this, hitting Reply on a lead email sent the response into
        // a void and the prospect never heard back.
        ...(replyTo ? { reply_to: replyTo } : {}),
        subject,
        text,
      }),
    });
    if (res.ok) return { sent: true, reason: "sent" };
    const body = await res.text().catch(() => "");
    return { sent: false, reason: `resend_${res.status}: ${body.slice(0, 160)}` };
  } catch (e) {
    return { sent: false, reason: `fetch_error: ${e instanceof Error ? e.message.slice(0, 100) : "?"}` };
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    email?: string;
    message?: string;
  } & ContactDetails;

  if (!body.name?.trim() || !body.email?.trim() || !body.company?.trim() || !body.phone?.trim()) {
    return NextResponse.json(
      { error: "Please add your name, company, email, and cell phone." },
      { status: 400 }
    );
  }

  const details: ContactDetails = {
    company: body.company?.trim(),
    phone: body.phone?.trim(),
    routes: body.routes?.trim(),
    employees: body.employees?.trim(),
    city: body.city?.trim(),
    state: body.state?.trim(),
  };
  const note = body.message?.trim() ?? "";
  const summary = detailsText(details);

  /* Storage is BEST-EFFORT; the email is the lead channel that matters.
     This used to be the other way round: any Supabase failure returned 500
     before sendEmail was ever reached, so when the free-tier project paused
     from inactivity (its hostname stopped resolving entirely), every
     submission errored and every lead was silently lost — nothing stored,
     nothing emailed, and the visitor told to "try again" against a dead
     database. Found 2026-08-28 when the form had been failing for an unknown
     stretch. Now the insert failure is recorded and the email still goes
     out; the visitor only sees an error when BOTH channels failed. */
  const supabase = getSupabase();
  let stored = false;
  let storeReason = "no_supabase_env";
  if (supabase) {
    const baseRow = {
      name: body.name.trim(),
      email: body.email.trim(),
      recipient: LEAD_EMAIL,
    };
    // Prefer the structured column; fold details into the message text when
    // the details column doesn't exist yet (migration-v3 optional).
    const { error } = await supabase
      .from("contact_messages")
      .insert({ ...baseRow, message: note || "(no message)", details });
    if (!error) {
      stored = true;
      storeReason = "stored";
    } else if (/column|schema cache/i.test(error.message)) {
      const folded = [summary, note].filter(Boolean).join("\n") || "(no message)";
      const { error: legacyError } = await supabase
        .from("contact_messages")
        .insert({ ...baseRow, message: folded });
      stored = !legacyError;
      storeReason = legacyError ? `supabase: ${legacyError.message.slice(0, 120)}` : "stored_legacy";
    } else {
      storeReason = `supabase: ${error.message.slice(0, 120)}`;
    }
    if (!stored) console.warn("contact not stored:", storeReason);
  }

  const emailResult = await sendEmail(
    `New lead: ${details.company} (${body.name.trim()})`,
    [
      `Name: ${body.name.trim()}`,
      `Email: ${body.email.trim()}`,
      summary,
      "",
      note || "(no message)",
    ]
      .filter((l) => l !== undefined)
      .join("\n"),
    body.email.trim()
  );

  if (!emailResult.sent) {
    console.warn("contact email not sent:", emailResult.reason);
  }

  // Only when NEITHER channel worked did the lead actually go nowhere.
  if (!stored && !emailResult.sent) {
    return NextResponse.json(
      { error: "Could not send your message. Please try again." },
      { status: 500 }
    );
  }

  // Debug readout (reasons only, never the recipient/key): /api/contact?debug=1
  const debug = new URL(request.url).searchParams.get("debug") === "1";
  return NextResponse.json(
    debug
      ? { ok: true, emailed: emailResult.sent, emailReason: emailResult.reason, stored, storeReason }
      : { ok: true, emailed: emailResult.sent }
  );
}

export async function GET() {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ messages: [] });
  const { data, error } = await supabase
    .from("contact_messages")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ messages: [] });
  return NextResponse.json({
    messages: data,
    emailConfigured: !!(process.env.RESEND_API_KEY && process.env.CONTACT_EMAIL),
  });
}
