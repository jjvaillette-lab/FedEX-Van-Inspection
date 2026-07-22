import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * Contact form handler.
 *
 * The destination address (CONTACT_EMAIL, e.g. a personal inbox) lives only in
 * server env — it is never sent to the browser, so the public can't harvest it.
 * Messages are stored in Supabase now; wiring auto-forward to CONTACT_EMAIL via
 * a mail provider (kept hidden) is a drop-in next step.
 */
export async function POST(request: Request) {
  const { name, email, message } = (await request.json().catch(() => ({}))) as {
    name?: string;
    email?: string;
    message?: string;
  };

  if (!name?.trim() || !message?.trim()) {
    return NextResponse.json({ error: "Please add your name and a message." }, { status: 400 });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Contact is temporarily unavailable." }, { status: 503 });
  }

  const { error } = await supabase.from("contact_messages").insert({
    name: name.trim(),
    email: (email ?? "").trim(),
    message: message.trim(),
    recipient: process.env.CONTACT_EMAIL ?? null, // server-side only
  });

  if (error) {
    return NextResponse.json({ error: "Could not send your message. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
