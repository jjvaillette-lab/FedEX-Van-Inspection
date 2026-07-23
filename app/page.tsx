"use client";

import Link from "next/link";
import { PLATFORM } from "@/lib/brand";
import { useAuth } from "@/app/components/portal/AuthProvider";
import {
  IconChart,
  IconCheckCircle,
  IconClipboard,
  IconFile,
  IconGauge,
  IconRoute,
  IconUsers,
  IconVan,
  IconWrench,
} from "@/app/components/icons";

/* ---------------- content ---------------- */

const SERVICES = [
  {
    bucket: "Fleet",
    items: [
      {
        icon: IconVan,
        t: "Vehicle Inspections",
        d: "Pre & post-trip checks with guided photo evidence. Incomplete or failed checks flag management automatically — before the van leaves the yard.",
      },
      {
        icon: IconWrench,
        t: "Maintenance Tracking & Van ROI",
        d: "Log every repair by van — mileage, date, cost, receipts — and see exactly what each vehicle is costing you over its life.",
      },
    ],
  },
  {
    bucket: "Operations",
    items: [
      {
        icon: IconRoute,
        t: "Route Monitoring",
        d: "Keep eyes on routes and daily service levels without chasing texts and phone calls.",
      },
      {
        icon: IconGauge,
        t: "Package Count & Failed-Delivery Review",
        d: "Review daily counts and deep-dive failed deliveries so you don't leave money on the table.",
      },
      {
        icon: IconFile,
        t: "Invoice Review",
        d: "Put your settlement and vendor invoices under a second set of eyes, every cycle.",
      },
    ],
  },
  {
    bucket: "Back Office",
    items: [
      {
        icon: IconChart,
        t: "Reporting & Cloud Storage Suite",
        d: "Full reporting across everything the platform touches, with every record, photo, and document stored securely and searchable forever.",
      },
      {
        icon: IconUsers,
        t: "Employee Management",
        d: "Driver records, accountability, and team oversight in one place — built for how contractor teams actually run.",
      },
    ],
  },
];

const PAIN_POINTS = [
  {
    q: "Spending 2–3 hours a day on van inspections and filing?",
    a: "We cut it to almost zero. Drivers scan, shoot, and submit — the paperwork files itself.",
  },
  {
    q: "Compiling FedEx spreadsheets to track packages and driver performance?",
    a: "Our system does it automatically — counts, trends, and driver performance without the copy-paste.",
  },
  {
    q: "Paying an admin to manage team performance manually?",
    a: "The portal removes the need for additional staff — a subscription that typically pays for itself in the first month.",
  },
  {
    q: "Trying to figure out when that van damage happened?",
    a: "Twice-daily photo inspections are filed in the cloud by van and driver — look back to any day, anytime.",
  },
  {
    q: "Scrambling to pull records for an audit or insurance claim?",
    a: "Every inspection, photo, and receipt is searchable in seconds — not a weekend in the filing cabinet.",
  },
  {
    q: "Chasing drivers to confirm their checks got done?",
    a: "Missed or failed checks flag management on their own. No texts, no follow-ups.",
  },
];

const CUSTOMERS = [
  { name: "Stratford Delivery Corp", blurb: "Daily pre & post-trip inspections across the fleet, with photo evidence on every van." },
  { name: "Prime Transport", blurb: "Replaced paper inspection binders with one searchable, permanent record." },
  { name: "Lelit Logistics", blurb: "Catches vehicle issues before vans leave the yard each morning." },
  { name: "PTRN Transport", blurb: "Maintenance and repair history tracked van by van." },
  { name: "Abex", blurb: "Route and delivery reporting pulled into a single dashboard." },
];

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

/* ---------------- page ---------------- */

export default function Landing() {
  const { user } = useAuth();
  const navy = PLATFORM.navy;

  return (
    <div className="min-h-full bg-white text-slate-900">
      {/* Top bar */}
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/lma-mark.svg" alt="" className="h-8 w-8" />
            <span className="text-lg font-extrabold tracking-tight" style={{ color: navy }}>
              Last Mile <span style={{ color: PLATFORM.amber }}>Assist</span>
            </span>
          </div>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/contact" className="font-semibold text-slate-600 hover:text-slate-900">Contact</Link>
            <Link
              href={user ? "/portal" : "/login"}
              className="rounded-lg px-4 py-2 font-semibold text-white"
              style={{ background: navy }}
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
            Built for FedEx independent service providers
          </span>
          <h1 className="mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight md:text-6xl" style={{ color: navy }}>
            Your delivery operation, running smoother.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-slate-600">
            Last Mile Assist streamlines vehicle inspections, fleet maintenance, and the daily
            back office for last-mile contractors — fewer apps, less paperwork, lower overhead.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/contact"
              className="rounded-xl px-6 py-3.5 text-base font-semibold text-white shadow-lg"
              style={{ background: navy }}
            >
              Talk to us
            </Link>
            <Link
              href="/login"
              className="rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-base font-semibold text-slate-700"
            >
              Log in
            </Link>
          </div>
        </div>
      </section>

      {/* The admin-hours pitch */}
      <section className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <div className="max-w-3xl">
            <h2 className="text-2xl font-extrabold md:text-3xl" style={{ color: navy }}>
              The hours are where it hurts.
            </h2>
            <p className="mt-3 text-slate-600">
              Most contractors don&apos;t lose their week to driving — they lose it to
              administration: paperwork, spreadsheets, chasing confirmations, and paying extra
              hands just to keep up. Sound familiar?
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {PAIN_POINTS.map((p) => (
              <div key={p.q} className="rounded-2xl border border-slate-200 bg-white p-6">
                <h3 className="font-bold leading-snug" style={{ color: navy }}>{p.q}</h3>
                <p className="mt-2.5 flex gap-2 text-sm text-slate-600">
                  <IconCheckCircle size={17} className="mt-0.5 shrink-0" style={{ color: PLATFORM.amber }} />
                  <span>{p.a}</span>
                </p>
              </div>
            ))}
          </div>

          <div className="mt-10 grid gap-8 text-center sm:grid-cols-3">
            {[
              { n: "10–15 hrs", l: "of weekly admin time recovered" },
              { n: "1 login", l: "instead of a stack of tools and binders" },
              { n: "0 paper forms", l: "riding around in your vans" },
            ].map((s) => (
              <div key={s.l}>
                <div className="text-4xl font-extrabold" style={{ color: PLATFORM.amber }}>{s.n}</div>
                <div className="mt-1 text-sm text-slate-600">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="text-2xl font-extrabold md:text-3xl" style={{ color: navy }}>What we do</h2>
        <p className="mt-2 max-w-2xl text-slate-600">
          Practical tools for every corner of a delivery business — turn on what your operation needs.
        </p>

        <div className="mt-8 space-y-8">
          {SERVICES.map((b) => (
            <div key={b.bucket}>
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">{b.bucket}</h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {b.items.map((it) => (
                  <div key={it.t} className="rounded-2xl border border-slate-200 bg-white p-6">
                    <span
                      className="flex h-10 w-10 items-center justify-center rounded-lg"
                      style={{ background: `${navy}12`, color: navy }}
                    >
                      <it.icon size={21} />
                    </span>
                    <h4 className="mt-3 font-bold" style={{ color: navy }}>{it.t}</h4>
                    <p className="mt-1.5 text-sm text-slate-600">{it.d}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Custom builds */}
        <div
          className="mt-10 flex flex-col items-start justify-between gap-4 rounded-2xl p-7 text-white md:flex-row md:items-center"
          style={{ background: navy }}
        >
          <div>
            <h3 className="text-lg font-bold">Need something specific to your operation?</h3>
            <p className="mt-1 text-sm text-white/75">
              We design and build custom tools for your business — if you track it on a
              spreadsheet today, we can probably turn it into a button.
            </p>
          </div>
          <Link
            href="/contact"
            className="shrink-0 rounded-lg px-5 py-2.5 text-sm font-bold"
            style={{ background: PLATFORM.amber, color: "#3b2a08" }}
          >
            Tell us what you need
          </Link>
        </div>
      </section>

      {/* Sneak peek */}
      <section className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="text-2xl font-extrabold md:text-3xl" style={{ color: navy }}>A look inside</h2>
          <p className="mt-2 max-w-2xl text-slate-600">
            The owner portal on your desk, the driver app in the van.
          </p>

          <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1.6fr_1fr]">
            {/* Portal home mock */}
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
              <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                <span className="ml-3 text-[11px] text-slate-400">portal.lastmileassist.com</span>
              </div>
              <div className="flex">
                {/* Mini sidebar */}
                <div className="hidden w-40 shrink-0 border-r border-slate-100 p-3 sm:block">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md text-[9px] font-extrabold text-white" style={{ background: navy }}>AD</span>
                    <span className="text-[11px] font-bold text-slate-800">Atlas Delivery</span>
                  </div>
                  <div className="mt-3 space-y-1 text-[10.5px] font-medium">
                    <div className="rounded px-2 py-1 font-semibold" style={{ background: `${navy}14`, color: navy }}>Overview</div>
                    <p className="px-2 pt-1 text-[8.5px] font-bold uppercase tracking-wider text-slate-300">Operations</p>
                    <div className="px-2 py-1 text-slate-500">Dispatch</div>
                    <p className="px-2 pt-1 text-[8.5px] font-bold uppercase tracking-wider text-slate-300">Fleet</p>
                    <div className="px-2 py-1 text-slate-500">Vehicle Inspections</div>
                    <div className="px-2 py-1 text-slate-500">Maintenance &amp; Costs</div>
                    <p className="px-2 pt-1 text-[8.5px] font-bold uppercase tracking-wider text-slate-300">Human Resources</p>
                    <div className="px-2 py-1 text-slate-500">Employee Management</div>
                  </div>
                </div>
                {/* Overview cards */}
                <div className="min-w-0 flex-1 p-4">
                  <p className="text-[10px] text-slate-400">Welcome back, Alex.</p>
                  <p className="text-sm font-bold text-slate-900">Atlas Delivery Co</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {[
                      { t: "Vehicle Inspections", s: "42 checks this week", icon: IconVan },
                      { t: "Maintenance & Costs", s: "3 repairs logged", icon: IconWrench },
                      { t: "Dispatch", s: "14 routes today", icon: IconRoute },
                      { t: "Employee Management", s: "23 team members", icon: IconUsers },
                    ].map((c) => (
                      <div key={c.t} className="rounded-lg border border-slate-200 p-2.5">
                        <div className="flex items-center justify-between">
                          <span className="flex h-6 w-6 items-center justify-center rounded-md" style={{ background: `${navy}12`, color: navy }}>
                            <c.icon size={13} />
                          </span>
                          <span className="rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase" style={{ background: `${navy}14`, color: navy }}>
                            Active
                          </span>
                        </div>
                        <p className="mt-1.5 text-[11px] font-semibold leading-tight text-slate-800">{c.t}</p>
                        <p className="text-[9.5px] text-slate-400">{c.s}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Driver app mock */}
            <div className="mx-auto w-full max-w-[240px]">
              <div className="overflow-hidden rounded-[2rem] border-[6px] border-slate-800 bg-white shadow-xl">
                <div className="px-4 pb-5 pt-4" style={{ background: navy }}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-white/70">Driver App</p>
                  <p className="text-sm font-bold text-white">Pre-Trip · Van 12</p>
                </div>
                <div className="space-y-2 p-3">
                  {[
                    { t: "Tires & wheels" },
                    { t: "Brakes" },
                    { t: "Lights & signals" },
                    { t: "Photos: 4 of 4" },
                  ].map((row) => (
                    <div key={row.t} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                      <span className="text-[11px] font-medium text-slate-700">{row.t}</span>
                      <IconCheckCircle size={15} className="text-emerald-500" />
                    </div>
                  ))}
                  <div className="rounded-lg py-2.5 text-center text-[12px] font-bold text-white" style={{ background: navy }}>
                    Submit inspection
                  </div>
                </div>
              </div>
              <p className="mt-3 text-center text-xs text-slate-400">
                Drivers scan the van&apos;s QR code — no logins, no training curve.
              </p>
            </div>
          </div>

          {/* Fleet drill-down mock */}
          <div className="mt-8 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
              <span className="ml-3 text-[11px] text-slate-400">portal.lastmileassist.com/fleet</span>
            </div>
            <div className="p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] text-slate-400">Portal / Fleet</p>
                  <p className="text-sm font-bold text-slate-900">Fleet</p>
                </div>
                <span className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                  Export CSV
                </span>
              </div>

              {/* Fleet tabs */}
              <div className="mt-3 flex gap-1 border-b border-slate-200 text-[11.5px] font-semibold">
                {["Inspections", "Maintenance", "Vans", "Reports"].map((t, i) => (
                  <span
                    key={t}
                    className={`rounded-t-md px-3 py-1.5 ${i === 0 ? "border-b-2 text-slate-900" : "text-slate-400"}`}
                    style={i === 0 ? { borderColor: navy, color: navy } : undefined}
                  >
                    {t}
                  </span>
                ))}
              </div>

              {/* Sorting / filters */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <div className="flex rounded-lg border border-slate-300 p-0.5 text-[10.5px] font-medium">
                  {["All", "By Date", "By Van", "By Driver"].map((v, i) => (
                    <span
                      key={v}
                      className={`rounded-md px-2.5 py-1 ${i === 2 ? "text-white" : "text-slate-500"}`}
                      style={i === 2 ? { background: navy } : undefined}
                    >
                      {v}
                    </span>
                  ))}
                </div>
                <span className="rounded-lg border border-slate-300 px-2.5 py-1 text-[10.5px] text-slate-400">
                  Search van, driver, route…
                </span>
                <span className="rounded-lg border border-slate-300 px-2.5 py-1 text-[10.5px] text-slate-500">
                  All statuses ▾
                </span>
              </div>

              {/* Rows */}
              <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 text-[11.5px]">
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <span className="w-14 font-semibold text-slate-800">Van 04</span>
                  <span className="w-20 text-slate-500">T. Alvarez</span>
                  <span className="hidden flex-1 text-slate-400 sm:block">Today · 6:48 AM</span>
                  <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[9.5px] font-bold text-sky-700">PRE</span>
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9.5px] font-semibold text-emerald-700">Passed</span>
                </div>

                {/* Expanded drill-down row */}
                <div className="border-t border-slate-100">
                  <div className="flex items-center gap-3 bg-slate-50 px-3 py-2.5">
                    <span className="w-14 font-semibold text-slate-800">Van 07</span>
                    <span className="w-20 text-slate-500">D. Lopez</span>
                    <span className="hidden flex-1 text-slate-400 sm:block">Today · 6:54 AM</span>
                    <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[9.5px] font-bold text-sky-700">PRE</span>
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9.5px] font-semibold text-amber-800">1 issue</span>
                  </div>
                  <div className="grid gap-3 border-t border-slate-100 bg-slate-50/60 px-3 py-3 sm:grid-cols-[1fr_1.4fr]">
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-wide text-red-600">Driver-reported issue</p>
                      <p className="mt-1 rounded border border-red-100 bg-red-50 px-2 py-1.5 text-[11px] text-red-800">
                        Brakes — soft pedal on startup
                      </p>
                      <span className="mt-2 inline-block rounded px-2.5 py-1 text-[10px] font-semibold text-white" style={{ background: navy }}>
                        Resolve issue
                      </span>
                      <p className="mt-1.5 text-[9px] text-slate-400">
                        Resolutions record who fixed it, when, and the receipt.
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Photos (4) — captured on every check</p>
                      <div className="mt-1 grid grid-cols-4 gap-1.5">
                        {[
                          { l: "Driver Side", s: "/silhouettes/van-driver-side.svg" },
                          { l: "Back", s: "/silhouettes/van-back.svg" },
                          { l: "Passenger", s: "/silhouettes/van-passenger-side.svg" },
                          { l: "Front", s: "/silhouettes/van-front.svg" },
                        ].map((p) => (
                          <figure key={p.l}>
                            <div className="flex h-14 items-center justify-center rounded border border-slate-200 bg-gradient-to-b from-slate-200 to-slate-300 p-1.5">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={p.s} alt="" className="max-h-full opacity-60" />
                            </div>
                            <figcaption className="mt-0.5 text-center text-[8.5px] text-slate-500">{p.l}</figcaption>
                          </figure>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 border-t border-slate-100 px-3 py-2.5">
                  <span className="w-14 font-semibold text-slate-800">Van 21</span>
                  <span className="w-20 text-slate-500">J. Chen</span>
                  <span className="hidden flex-1 text-slate-400 sm:block">Yesterday · 6:11 PM</span>
                  <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[9.5px] font-bold text-indigo-700">POST</span>
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9.5px] font-semibold text-emerald-700">Passed</span>
                </div>
              </div>
              <p className="mt-2 text-[10px] text-slate-400">
                Sort by date, van, or driver — drill into any check for photos, issues, and resolutions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Customers */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="text-2xl font-extrabold md:text-3xl" style={{ color: navy }}>
          Operators running on Last Mile Assist
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CUSTOMERS.map((c) => (
            <div key={c.name} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-extrabold text-white"
                  style={{ background: navy }}
                >
                  {initials(c.name)}
                </span>
                <h3 className="font-bold text-slate-900">{c.name}</h3>
              </div>
              <p className="mt-3 text-sm text-slate-600">{c.blurb}</p>
            </div>
          ))}
          <div className="flex items-center justify-center rounded-2xl border border-dashed border-slate-300 p-5 text-center">
            <div>
              <p className="font-semibold text-slate-700">Your operation next?</p>
              <Link href="/contact" className="mt-1 inline-block text-sm font-semibold" style={{ color: navy }}>
                Get in touch →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-5 py-16 text-center">
          <h2 className="text-2xl font-extrabold md:text-3xl" style={{ color: navy }}>
            See it on your own fleet
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-600">
            Tell us about your operation and we&apos;ll walk you through the portal with your vans in mind.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href="/contact" className="rounded-xl px-6 py-3.5 font-semibold text-white shadow-lg" style={{ background: navy }}>
              Contact us
            </Link>
            <Link href="/login" className="rounded-xl border border-slate-300 bg-white px-6 py-3.5 font-semibold text-slate-700">
              Log in
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200">
        <div className="mx-auto max-w-6xl px-5 py-8 text-sm text-slate-500">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
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
          <p className="mt-4 text-xs text-slate-400">
            Last Mile Assist is an independent platform and is not affiliated with, sponsored by,
            or endorsed by FedEx.
          </p>
        </div>
      </footer>
    </div>
  );
}
