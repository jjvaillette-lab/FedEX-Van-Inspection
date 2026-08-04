"use client";

import { useState } from "react";
import Link from "next/link";
import { PLATFORM } from "@/lib/brand";

const EMPLOYEE_RANGES = ["1–10", "11–25", "26–50", "51–100", "100+"];

/* Dark brand theme — matches the landing page */
const BLUE = "#1E88FF";
const AMBER = PLATFORM.amber;
const BG = "#0A1120";
const CARD = "rgba(255,255,255,0.04)";
const BORDER = "rgba(255,255,255,0.10)";
const GREEN = "#34D399";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [routes, setRoutes] = useState("");
  const [employees, setEmployees] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim() && company.trim() && email.trim() && phone.trim();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setStatus("sending");
    setError(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone,
          company,
          routes,
          employees,
          city,
          state,
          message,
        }),
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

  const inputCls =
    "w-full rounded-lg border px-4 py-2.5 text-white outline-none placeholder:text-slate-500 focus:border-[#1E88FF] focus:ring-2 focus:ring-[#1E88FF]/30";
  const inputStyle = { borderColor: BORDER, background: CARD };
  const labelCls = "mb-1 block text-sm font-medium text-slate-300";

  return (
    <div className="min-h-screen" style={{ background: BG, color: "#E8ECF5" }}>
      <header className="sticky top-0 z-40 border-b backdrop-blur-md" style={{ borderColor: BORDER, background: "rgba(10,17,32,0.82)" }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <Link href="/" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/lma-icon.png" alt="" className="h-9 w-9" />
            <span className="text-lg font-extrabold tracking-tight text-white">
              Last Mile <span style={{ color: AMBER }}>Assist</span>
            </span>
          </Link>
          <Link href="/login" className="rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-lg" style={{ background: BLUE }}>
            Log in
          </Link>
        </div>
      </header>

      <main className="relative mx-auto max-w-xl px-5 py-14">
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: `radial-gradient(ellipse 80% 40% at 50% -10%, ${BLUE}22, transparent)` }}
        />
        <div className="relative">
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Contact us</h1>
          <p className="mt-2 text-slate-400">
            Tell us a little about your operation and we&apos;ll reach out to walk you through the
            portal with your fleet in mind.
          </p>

          {status === "sent" ? (
            <div className="mt-8 rounded-2xl border p-6 text-center" style={{ borderColor: `${GREEN}55`, background: `${GREEN}10` }}>
              <div className="text-4xl" style={{ color: GREEN }}>✓</div>
              <h2 className="mt-2 text-lg font-bold text-white">Message sent</h2>
              <p className="mt-1 text-sm text-slate-300">
                Thanks, {name.split(" ")[0] || "there"} — we&apos;ll be in touch soon.
              </p>
              <Link href="/" className="mt-4 inline-block text-sm font-semibold underline" style={{ color: GREEN }}>
                Back to home
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-8 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Your name *</label>
                  <input value={name} onChange={(e) => { setName(e.target.value); setError(null); }} className={inputCls} style={inputStyle} />
                </div>
                <div>
                  <label className={labelCls}>Company name *</label>
                  <input value={company} onChange={(e) => { setCompany(e.target.value); setError(null); }} className={inputCls} style={inputStyle} />
                </div>
              </div>

              <div>
                <label className={labelCls}>
                  Your email * <span className="text-slate-500">(so we can reply)</span>
                </label>
                <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(null); }} className={inputCls} style={inputStyle} />
              </div>

              <div>
                <label className={labelCls}>Cell phone *</label>
                <input
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value.replace(/[^\d\s()+.-]/g, "")); setError(null); }}
                  placeholder="(860) 555-0123"
                  className={inputCls}
                  style={inputStyle}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Daily routes</label>
                  <input
                    inputMode="numeric"
                    value={routes}
                    onChange={(e) => setRoutes(e.target.value.replace(/[^\d]/g, ""))}
                    placeholder="e.g. 12"
                    className={inputCls}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label className={labelCls}>Employees</label>
                  <select
                    value={employees}
                    onChange={(e) => setEmployees(e.target.value)}
                    className={inputCls}
                    style={{ ...inputStyle, colorScheme: "dark" }}
                  >
                    <option value="">Select a range…</option>
                    {EMPLOYEE_RANGES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
                <div>
                  <label className={labelCls}>City</label>
                  <input value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} style={inputStyle} />
                </div>
                <div>
                  <label className={labelCls}>State</label>
                  <input
                    value={state}
                    onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))}
                    placeholder="CT"
                    className={inputCls}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>
                  Anything else? <span className="text-slate-500">(optional)</span>
                </label>
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} className={inputCls} style={inputStyle} />
              </div>

              {error && (
                <p className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "rgba(248,113,113,.4)", background: "rgba(248,113,113,.1)", color: "#FCA5A5" }}>
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={status === "sending" || !canSubmit}
                className="w-full rounded-xl py-3 font-semibold text-white shadow-lg disabled:opacity-50"
                style={{ background: BLUE }}
              >
                {status === "sending" ? "Sending…" : "Send message"}
              </button>
            </form>
          )}

          <p className="mt-8 text-center text-sm text-slate-500">
            <Link href="/" className="hover:text-slate-300">← Back to home</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
