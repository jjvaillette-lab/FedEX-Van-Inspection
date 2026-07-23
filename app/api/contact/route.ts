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
  routes?: string;
  employees?: string;
  city?: string;
  state?: string;
}

function detailsText(d: ContactDetails): string {
  const parts = [
    d.company && `Company: ${d.company}`,
    d.routes && `Daily routes: ${d.routes}`,
    d.employees && `Employees: ${d.employees}`,
    (d.city || d.state) && `Location: ${[d.city, d.state].filter(Boolean).join(", ")}`,
  ].filter(Boolean);
  return parts.join(" · ");
}

async function sendEmail(subject: string, text: string): Promise<{ sent: boolean; reason: string }> {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_EMAIL;
  if (!key) return { sent: false, reason: "no_api_key" };
  if (!to) return { sent: false, reason: "no_contact_email" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.CONTACT_FROM || "Last Mile Assist <onboarding@resend.dev>",
        to: [to],
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

  if (!body.name?.trim() || !body.email?.trim() || !body.company?.trim()) {
    return NextResponse.json(
      { error: "Please add your name, company, and email." },
      { status: 400 }
    );
  }

  const details: ContactDetails = {
    company: body.company?.trim(),
    routes: body.routes?.trim(),
    employees: body.employees?.trim(),
    city: body.city?.trim(),
    state: body.state?.trim(),
  };
  const note = body.message?.trim() ?? "";
  const summary = detailsText(details);

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Contact is temporarily unavailable." }, { status: 503 });
  }

  const baseRow = {
    name: body.name.trim(),
    email: body.email.trim(),
    recipient: process.env.CONTACT_EMAIL ?? null,
  };

  // Prefer the structured column; fold details into the message text when the
  // details column doesn't exist yet (migration-v3 optional).
  const { error } = await supabase
    .from("contact_messages")
    .insert({ ...baseRow, message: note || "(no message)", details });
  if (error) {
    if (/column|schema cache/i.test(error.message)) {
      const folded = [summary, note].filter(Boolean).join("\n") || "(no message)";
      const { error: legacyError } = await supabase
        .from("contact_messages")
        .insert({ ...baseRow, message: folded });
      if (legacyError) {
        return NextResponse.json(
          { error: "Could not send your message. Please try again." },
          { status: 500 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "Could not send your message. Please try again." },
        { status: 500 }
      );
    }
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
      .join("\n")
  );

  return NextResponse.json({ ok: true, emailed: emailResult.sent });
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
