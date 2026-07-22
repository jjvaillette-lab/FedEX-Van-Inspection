"use client";

import Link from "next/link";
import { PLATFORM } from "@/lib/brand";
import { useAuth } from "@/app/components/portal/AuthProvider";

const MODULES = [
  {
    section: "Fleet",
    icon: "🚐",
    items: [
      { t: "Vehicle Inspections", d: "Pre & post-trip DOT safety checks with guided photos, auto-flagged vans, and full driver accountability." },
      { t: "Maintenance & Costs", d: "Log every repair by van and see exactly what each vehicle costs you across the year." },
    ],
  },
  {
    section: "Operations",
    icon: "🗺️",
    items: [
      { t: "Dispatch", d: "Routes, assignments, and the daily moving parts in one place instead of scattered spreadsheets." },
    ],
  },
  {
    section: "Human Resources",
    icon: "👥",
    items: [
      { t: "Payroll & HR", d: "Drivers, onboarding, hours, and payroll — the back office, handled." },
    ],
  },
];

export default function Landing() {
  const { user } = useAuth();

  return (
    <div className="min-h-full bg-white text-slate-900">
      {/* Top bar */}
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/lma-mark.svg" alt="" className="h-8 w-8" />
            <span className="text-lg font-extrabold tracking-tight" style={{ color: PLATFORM.navy }}>
              Last Mile <span style={{ color: PLATFORM.amber }}>Assist</span>
            </span>
          </div>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/contact" className="font-semibold text-slate-600 hover:text-slate-900">Contact</Link>
            <Link
              href={user ? "/portal" : "/login"}
              className="rounded-lg px-4 py-2 font-semibold text-white"
              style={{ background: PLATFORM.navy }}
            >
              {user ? "Go to portal →" : "Log in"}
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-5 pt-16 pb-14 md:pt-24">
        <div className="max-w-3xl">
          <span
            className="inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider"
            style={{ background: "#FCECCB", color: "#7a531a" }}
          >
            For last-mile delivery contractors
          </span>
          <h1 className="mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight md:text-6xl" style={{ color: PLATFORM.navy }}>
            One portal to run your whole delivery operation.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-slate-600">{PLATFORM.subtagline}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="rounded-xl px-6 py-3.5 text-base font-semibold text-white shadow-lg"
              style={{ background: PLATFORM.navy }}
            >
              Log in
            </Link>
            <Link
              href="/contact"
              className="rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-base font-semibold text-slate-700"
            >
              Contact us
            </Link>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-3xl px-5 py-16 text-center">
          <h2 className="text-2xl font-extrabold md:text-3xl" style={{ color: PLATFORM.navy }}>
            Stop running your business across four different apps.
          </h2>
          <p className="mt-4 text-slate-600">
            Most contractors juggle separate tools for telematics, inspections, routing, and payroll —
            four logins, four bills, and nothing that talks to each other. Last Mile Assist brings it
            into a single system, so your team works in one place and you finally see the whole picture.
          </p>
        </div>
      </section>

      {/* What's inside */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="text-2xl font-extrabold md:text-3xl" style={{ color: PLATFORM.navy }}>What&apos;s inside</h2>
        <p className="mt-2 max-w-2xl text-slate-600">Modules for every corner of the operation — turn on what you need.</p>

        <div className="mt-8 space-y-8">
          {MODULES.map((m) => (
            <div key={m.section}>
              <div className="mb-3 flex items-center gap-2">
                <span className="text-2xl">{m.icon}</span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">{m.section}</h3>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {m.items.map((it) => (
                  <div key={it.t} className="rounded-2xl border border-slate-200 bg-white p-6">
                    <h4 className="font-bold" style={{ color: PLATFORM.navy }}>{it.t}</h4>
                    <p className="mt-1.5 text-sm text-slate-600">{it.d}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            { t: "Owner & manager roles", d: "You control exactly what each manager can see and do." },
            { t: "Instant alerts & reports", d: "Email/text on failures, plus detailed reporting across everything." },
            { t: "Your brand", d: "Your logo and colors carry across the whole portal and every report." },
          ].map((c) => (
            <div key={c.t} className="rounded-xl bg-slate-50 p-5">
              <h4 className="font-semibold text-slate-800">{c.t}</h4>
              <p className="mt-1 text-sm text-slate-500">{c.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Payoff */}
      <section className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="text-2xl font-extrabold md:text-3xl" style={{ color: PLATFORM.navy }}>Built to pay for itself</h2>
          <div className="mt-8 grid gap-8 md:grid-cols-4">
            {[
              { n: "10–20%", l: "less spent on fuel" },
              { n: "15–25%", l: "lower maintenance cost" },
              { n: "10–15 hrs", l: "of admin saved weekly" },
              { n: "1 login", l: "instead of four tools" },
            ].map((s) => (
              <div key={s.l}>
                <div className="text-4xl font-extrabold" style={{ color: PLATFORM.amber }}>{s.n}</div>
                <div className="mt-1 text-sm text-slate-600">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-5 py-16 text-center">
        <h2 className="text-2xl font-extrabold md:text-3xl" style={{ color: PLATFORM.navy }}>See it in action</h2>
        <p className="mx-auto mt-3 max-w-xl text-slate-600">
          Have questions or want a walkthrough for your operation? Get in touch — we&apos;d love to help.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href="/contact" className="rounded-xl px-6 py-3.5 font-semibold text-white shadow-lg" style={{ background: PLATFORM.navy }}>
            Contact us
          </Link>
          <Link href="/login" className="rounded-xl border border-slate-300 bg-white px-6 py-3.5 font-semibold text-slate-700">
            Log in
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-8 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/lma-mark.svg" alt="" className="h-6 w-6" />
            <span className="font-semibold text-slate-700">{PLATFORM.name}</span>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            <span>{PLATFORM.domain}</span>
            <Link href="/contact" className="hover:text-slate-800">Contact</Link>
            <Link href="/login" className="hover:text-slate-800">Log in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
