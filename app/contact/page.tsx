"use client";

import { useState } from "react";
import Link from "next/link";
import { PLATFORM } from "@/lib/brand";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !message.trim()) return;
    setStatus("sending");
    setError(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });
      if (res.ok) setStatus("sent");
      else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not send your message. Please try again.");
        setStatus("idle");
      }
    } catch {
      setError("Could not send your message. Please try again.");
      setStatus("idle");
    }
  };

  return (
    <div className="min-h-full bg-white text-slate-900">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/lma-mark.svg" alt="" className="h-8 w-8" />
            <span className="text-lg font-extrabold tracking-tight" style={{ color: PLATFORM.navy }}>
              Last Mile <span style={{ color: PLATFORM.amber }}>Assist</span>
            </span>
          </Link>
          <Link href="/login" className="rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: PLATFORM.navy }}>
            Log in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-5 py-14">
        <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: PLATFORM.navy }}>Contact us</h1>
        <p className="mt-2 text-slate-600">
          Questions about Last Mile Assist, or want a walkthrough for your operation? Send us a note and
          we&apos;ll get back to you.
        </p>

        {status === "sent" ? (
          <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
            <div className="text-4xl">✓</div>
            <h2 className="mt-2 text-lg font-bold text-emerald-800">Message sent</h2>
            <p className="mt-1 text-sm text-emerald-700">Thanks, {name.split(" ")[0] || "there"} — we&apos;ll be in touch soon.</p>
            <Link href="/" className="mt-4 inline-block text-sm font-semibold text-emerald-800 underline">
              Back to home
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-8 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Your name</label>
              <input
                value={name}
                onChange={(e) => { setName(e.target.value); setError(null); }}
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">
                Your email <span className="text-slate-400">(so we can reply)</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Message</label>
              <textarea
                value={message}
                onChange={(e) => { setMessage(e.target.value); setError(null); }}
                rows={5}
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </div>
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <button
              type="submit"
              disabled={status === "sending" || !name.trim() || !message.trim()}
              className="w-full rounded-xl py-3 font-semibold text-white disabled:opacity-50"
              style={{ background: PLATFORM.navy }}
            >
              {status === "sending" ? "Sending…" : "Send message"}
            </button>
          </form>
        )}

        <p className="mt-8 text-center text-sm text-slate-400">
          <Link href="/" className="hover:text-slate-600">← Back to home</Link>
        </p>
      </main>
    </div>
  );
}
