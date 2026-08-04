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
  IconShield,
  IconUsers,
  IconVan,
  IconWrench,
} from "@/app/components/icons";

/* ---------------- palette (dark brand theme) ---------------- */

const BLUE = "#1E88FF"; // logo pin blue
const AMBER = PLATFORM.amber;
const BG = "#0A1120"; // page background
const CARD = "rgba(255,255,255,0.04)";
const BORDER = "rgba(255,255,255,0.10)";
const GREEN = "#34D399";
const RED = "#F87171";
const PURPLE = "#A78BFA";

/* ---------------- content (from the LMA product walkthrough) ---------------- */

const SERVICES = [
  {
    bucket: "Recruiting & Hiring",
    items: [
      {
        icon: IconUsers,
        t: "Candidate Pipeline",
        d: "Applicants flow in from Indeed or CSV and move through First Contact → Interview → Hired on one board — with bulk actions and two-way SMS on every candidate card.",
      },
      {
        icon: IconClipboard,
        t: "Interviews & Onboarding",
        d: "Track every interview outcome with reasons, then run background checks and drug tests through a single board — lab ordering, expiration warnings, and an eligibility gate before activation.",
      },
      {
        icon: IconChart,
        t: "Training & First Day",
        d: "Every new hire moves through a visual journey — Registration, Roster, Day 1, Day 2, Active Driver — with check-in capture and automatic reminder texts.",
      },
    ],
  },
  {
    bucket: "Daily Operations",
    items: [
      {
        icon: IconRoute,
        t: "Daily Dispatch",
        d: "Import the day's routes from Amazon, let AI Dispatch pair drivers, vans, and phones, and manage openers, closers, sweeps, and VTO — with live route data beside the board.",
      },
      {
        icon: IconGauge,
        t: "Scheduling & Attendance",
        d: "Staff the week against Amazon targets with one-click Sling import, then print per-driver occurrence reports — VTOs, call-outs, lates, no-shows, and write-ups over any date range.",
      },
      {
        icon: IconVan,
        t: "Fleet, Repairs & Gear",
        d: "Every van's rental countdown, inspections, gas card, and repair tickets — plus phone and accessory inventories — with expiring rentals surfacing in your alerts automatically.",
      },
    ],
  },
  {
    bucket: "Performance",
    items: [
      {
        icon: IconChart,
        t: "Performance Hub + AI",
        d: "Six weeks of scorecard history in one view — tier movement, worst-of leaderboards, coaching priorities, and an AI projection of next week's DSP score with a concrete strategy.",
      },
      {
        icon: IconFile,
        t: "Weekly Driver Scorecards",
        d: "Drop in the weekly Amazon reports and every driver gets a personal scorecard — ranked, tiered, and delivered by SMS, Sling, or email in one click.",
      },
      {
        icon: IconShield,
        t: "Delivery Review & Safety",
        d: "Audit recipient-required deliveries stop by stop, and pull Netradyne and Amazon safety events into coaching — sent straight to Sling.",
      },
    ],
  },
  {
    bucket: "Money & Compliance",
    items: [
      {
        icon: IconShield,
        t: "Payroll Pre-Check",
        d: "Cross-check timecards against Flex data before payroll runs — meal and hour violations, incomplete punches, and wage-theft flags, with a copy-paste fix list.",
      },
      {
        icon: IconWrench,
        t: "Fleet Payments",
        d: "Forecast your monthly Amazon van invoice to the line and reconcile prepaid capacity against actual usage — know when Amazon owes you.",
      },
      {
        icon: IconFile,
        t: "Route Payments",
        d: "Verify every week's route receipt — hourly base, per-package, pickups, and training — and catch routes the Work Summary forgot to pay before the receipt posts.",
      },
    ],
  },
];

const PAIN_POINTS = [
  {
    q: "Spending scorecard day buried in eight Amazon reports?",
    a: "Upload them once — driver scorecards, rankings, and tiers generate themselves and send in one click.",
  },
  {
    q: "Wondering if Amazon's Work Summary paid every route you ran?",
    a: "Day-of route capture is reconciled against the weekly statement — unpaid routes get flagged before the receipt posts.",
  },
  {
    q: "Chasing 2,000 applicants across job boards, texts, and sticky notes?",
    a: "One pipeline from application to first day — with SMS templates that update candidate status automatically.",
  },
  {
    q: "Finding payroll problems after the checks already went out?",
    a: "Payroll Pre-Check flags meal violations, missing punches, and wage-theft risks before payroll runs — not after.",
  },
  {
    q: "Paying an admin to manage hiring and performance manually?",
    a: "The portal removes the need for additional staff — a subscription that typically pays for itself in the first month.",
  },
  {
    q: "Scrambling to pull records for an Amazon audit?",
    a: "Every driver document, inspection, and receipt is searchable in seconds — not a weekend in the filing cabinet.",
  },
];

/* ---------------- small building blocks ---------------- */

function Chip({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold"
      style={{ color, borderColor: `${color}55`, background: `${color}14` }}
    >
      {children}
    </span>
  );
}

function FrameBar({ url }: { url: string }) {
  return (
    <div className="flex items-center gap-1.5 border-b px-4 py-2.5" style={{ borderColor: BORDER, background: "rgba(255,255,255,0.03)" }}>
      <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
      <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
      <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
      <span className="ml-3 text-[11px] text-slate-400">{url}</span>
    </div>
  );
}

function StatTile({ n, l, c }: { n: string; l: string; c: string }) {
  return (
    <div className="rounded-lg border p-2.5 text-center" style={{ borderColor: BORDER, background: CARD }}>
      <p className="text-lg font-extrabold tabular-nums" style={{ color: c }}>{n}</p>
      <p className="text-[8.5px] font-bold uppercase tracking-wide text-slate-500">{l}</p>
    </div>
  );
}

/* ---------------- page ---------------- */

export default function Landing() {
  const { user } = useAuth();

  return (
    <div className="min-h-full" style={{ background: BG, color: "#E8ECF5" }}>
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b backdrop-blur-md" style={{ borderColor: BORDER, background: "rgba(10,17,32,0.82)" }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/lma-icon.png" alt="" className="h-9 w-9" />
            <span className="text-lg font-extrabold tracking-tight text-white">
              Last Mile <span style={{ color: AMBER }}>Assist</span>
            </span>
          </div>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/contact" className="font-semibold text-slate-300 hover:text-white">Contact</Link>
            <Link
              href={user ? "/portal" : "/login"}
              className="rounded-lg px-4 py-2 font-semibold text-white shadow-lg"
              style={{ background: BLUE }}
            >
              {user ? "Go to portal →" : "Log in"}
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              `radial-gradient(ellipse 55% 45% at 80% -10%, ${BLUE}2E, transparent), radial-gradient(ellipse 45% 35% at -5% 108%, ${AMBER}1A, transparent)`,
          }}
        />
        <div className="relative mx-auto max-w-6xl px-5 pt-16 pb-14 md:pt-24">
          <div className="max-w-3xl">
            <span
              className="inline-block rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider"
              style={{ borderColor: `${AMBER}55`, background: `${AMBER}14`, color: AMBER }}
            >
              Built for Amazon DSP owners
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight text-white md:text-6xl">
              The operating system for your Amazon DSP.
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-slate-300">
              Recruiting, scheduling, fleet, scorecards, payroll compliance, and Amazon payment
              auditing — one command center, built on 15+ years of combined DSP experience.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Chip color={BLUE}>Recruiting &amp; Hiring</Chip>
              <Chip color={GREEN}>Scheduling &amp; Attendance</Chip>
              <Chip color={AMBER}>Fleet &amp; Repairs</Chip>
              <Chip color={PURPLE}>Scorecards + AI Coaching</Chip>
              <Chip color={RED}>Payroll Compliance</Chip>
              <Chip color="#60A5FA">Amazon Payment Audit</Chip>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/contact"
                className="rounded-xl px-6 py-3.5 text-base font-semibold text-white shadow-lg"
                style={{ background: BLUE }}
              >
                Talk to us
              </Link>
              <Link
                href="/login"
                className="rounded-xl border px-6 py-3.5 text-base font-semibold text-slate-200"
                style={{ borderColor: BORDER, background: CARD }}
              >
                Log in
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* The admin-hours pitch */}
      <section className="border-y" style={{ borderColor: BORDER, background: "rgba(255,255,255,0.02)" }}>
        <div className="mx-auto max-w-6xl px-5 py-16">
          <div className="max-w-3xl">
            <h2 className="text-2xl font-extrabold text-white md:text-3xl">The hours are where it hurts.</h2>
            <p className="mt-3 text-slate-400">
              Most DSP owners don&apos;t lose their week to routes — they lose it to
              administration: reports, spreadsheets, hiring churn, and paying extra hands just to
              keep up. Sound familiar?
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {PAIN_POINTS.map((p) => (
              <div key={p.q} className="rounded-2xl border p-6" style={{ borderColor: BORDER, background: CARD }}>
                <h3 className="font-bold leading-snug text-white">{p.q}</h3>
                <p className="mt-2.5 flex gap-2 text-sm text-slate-400">
                  <IconCheckCircle size={17} className="mt-0.5 shrink-0" style={{ color: AMBER }} />
                  <span>{p.a}</span>
                </p>
              </div>
            ))}
          </div>

          <div className="mt-10 grid gap-8 text-center sm:grid-cols-3">
            {[
              { line: "Clients report saving 60+ hours of admin time — every week", sub: "$22.50/hr × 60 hrs = $1,350 a week — $5,400 a month back" },
              { line: "1 portal to run your entire enterprise", sub: null },
              { line: "All documents captured & stored in the cloud", sub: null },
            ].map((s) => (
              <div key={s.line}>
                <div className="text-2xl font-extrabold leading-snug md:text-[1.7rem]" style={{ color: AMBER }}>
                  {s.line}
                </div>
                {s.sub && (
                  <p className="mt-2 text-sm font-semibold tabular-nums text-slate-300">{s.sub}</p>
                )}
              </div>
            ))}
          </div>

          {/* VAS comparison */}
          <div className="mt-14 overflow-hidden rounded-2xl border" style={{ borderColor: `${RED}44`, background: "rgba(255,255,255,0.02)" }}>
            <div className="border-b px-7 py-6" style={{ borderColor: BORDER, background: `linear-gradient(100deg, ${RED}1A, transparent)` }}>
              <h2 className="text-2xl font-extrabold text-white md:text-3xl">
                Are you paying for multiple Amazon Value Added Services (VAS)?
              </h2>
              <p className="mt-2 max-w-2xl text-slate-400">
                Most stations are stacking separate vendors for work one system should do. Add
                yours up:
              </p>
            </div>
            <div className="grid gap-0 lg:grid-cols-[1.4fr_1fr]">
              <div className="divide-y" style={{ borderColor: BORDER }}>
                {[
                  { s: "Scorecard review", p: "$25 / week", m: "$100 / mo" },
                  { s: "Fleet billing review", p: "$200 / month", m: "$200 / mo" },
                  { s: "Onboarding support & interview scheduling", p: "$250 / week", m: "$1,000 / mo" },
                  { s: "Backend dispatch support", p: "$100 / week", m: "$400 / mo" },
                  { s: "Communication (texting service)", p: "$250 / month", m: "$250 / mo" },
                ].map((row) => (
                  <div key={row.s} className="flex items-center justify-between gap-3 px-7 py-4" style={{ borderColor: BORDER }}>
                    <span className="text-sm font-semibold text-slate-200">{row.s}</span>
                    <span className="flex items-center gap-3">
                      <span className="hidden text-xs text-slate-500 sm:block">{row.p}</span>
                      <span
                        className="rounded-full border px-3 py-1 text-sm font-extrabold tabular-nums"
                        style={{ color: RED, borderColor: `${RED}55`, background: `${RED}12` }}
                      >
                        {row.m}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex flex-col justify-center gap-4 border-t p-7 lg:border-l lg:border-t-0" style={{ borderColor: BORDER }}>
                <div className="text-center">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">That&apos;s</p>
                  <p className="text-5xl font-extrabold tabular-nums" style={{ color: RED }}>$1,950+</p>
                  <p className="mt-1 text-sm font-bold text-slate-300">every month in VAS fees alone</p>
                </div>
                <div className="rounded-xl border p-4 text-center" style={{ borderColor: `${AMBER}55`, background: `${AMBER}10` }}>
                  <p className="text-sm font-bold leading-snug" style={{ color: AMBER }}>
                    Add the $5,400/month in admin payroll to the $1,950 in VAS fees — that&apos;s
                    $7,350+ every month on the table. And one missed route payment or van
                    reimbursement can cost you thousands more: that alone can pay for this
                    system for the entire year.
                  </p>
                </div>
                <Link
                  href="/contact"
                  className="rounded-xl px-6 py-3 text-center font-semibold text-white shadow-lg"
                  style={{ background: BLUE }}
                >
                  See what you&apos;d replace →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="text-2xl font-extrabold text-white md:text-3xl">What we do</h2>
        <p className="mt-2 max-w-2xl text-slate-400">
          Every corner of a DSP business, in one system — turn on what your operation needs.
        </p>

        <div className="mt-8 space-y-8">
          {SERVICES.map((b) => (
            <div key={b.bucket}>
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">{b.bucket}</h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {b.items.map((it) => (
                  <div key={it.t} className="rounded-2xl border p-6" style={{ borderColor: BORDER, background: CARD }}>
                    <span
                      className="flex h-10 w-10 items-center justify-center rounded-lg"
                      style={{ background: `${BLUE}1F`, color: BLUE }}
                    >
                      <it.icon size={21} />
                    </span>
                    <h4 className="mt-3 font-bold text-white">{it.t}</h4>
                    <p className="mt-1.5 text-sm text-slate-400">{it.d}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Platform: your own instance */}
        <div
          className="mt-10 grid gap-4 rounded-2xl border p-7 sm:grid-cols-2"
          style={{ borderColor: BORDER, background: "rgba(255,255,255,0.02)" }}
        >
          <div className="flex gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg" style={{ background: `${BLUE}1F`, color: BLUE }}>
              <IconShield size={24} />
            </span>
            <div>
              <h3 className="text-lg font-bold text-white">Your own instance. Your own data.</h3>
              <p className="mt-1.5 text-sm text-slate-400">
                Every DSP runs on its own dedicated instance with its own database — your
                candidates, drivers, and financials are never pooled with anyone else&apos;s.
                Sensitive company info sits behind a PIN-locked, encrypted vault, with Touch ID
                on the finance modules.
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg" style={{ background: `${BLUE}1F`, color: BLUE }}>
              <IconGauge size={24} />
            </span>
            <div>
              <h3 className="text-lg font-bold text-white">Connected to your stack.</h3>
              <p className="mt-1.5 text-sm text-slate-400">
                Amazon roster and live route sync, Sling schedules and messaging, Indeed applicant
                import, Netradyne safety events, lab drug-test workflows, and built-in SMS — it
                works like an app and installs to your dock.
              </p>
            </div>
          </div>
        </div>

        {/* Custom builds */}
        <div
          className="mt-10 flex flex-col items-start justify-between gap-4 rounded-2xl border p-7 md:flex-row md:items-center"
          style={{ borderColor: `${BLUE}44`, background: `linear-gradient(100deg, ${BLUE}22, rgba(255,255,255,0.02))` }}
        >
          <div>
            <h3 className="text-lg font-bold text-white">Need something specific to your operation?</h3>
            <p className="mt-1 text-sm text-slate-400">
              We design and build custom tools for your business — if you track it on a
              spreadsheet today, we can probably turn it into a button.
            </p>
          </div>
          <Link
            href="/contact"
            className="shrink-0 rounded-lg px-5 py-2.5 text-sm font-bold"
            style={{ background: AMBER, color: "#3b2a08" }}
          >
            Tell us what you need
          </Link>
        </div>
      </section>

      {/* Sneak peek — from the product walkthrough (sample data) */}
      <section className="border-t" style={{ borderColor: BORDER, background: "rgba(255,255,255,0.02)" }}>
        <div className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="text-2xl font-extrabold text-white md:text-3xl">A look inside</h2>
          <p className="mt-2 max-w-2xl text-slate-400">
            Your operational command center, every morning. All data shown is sample data.
          </p>

          <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1.6fr_1fr]">
            {/* Command center mock */}
            <div className="overflow-hidden rounded-xl border shadow-2xl" style={{ borderColor: BORDER, background: "#0D1526" }}>
              <FrameBar url="app.lastmileassist.com" />
              <div className="p-4">
                <div
                  className="rounded-lg border px-3.5 py-2.5"
                  style={{ borderColor: BORDER, background: `linear-gradient(100deg, ${BLUE}2A, transparent)` }}
                >
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Tuesday, August 4</p>
                  <p className="text-sm font-extrabold text-white">Good morning, Alex</p>
                </div>
                <div className="mt-2.5 grid grid-cols-3 gap-2">
                  <StatTile n="18" l="Routes Today" c="#fff" />
                  <StatTile n="12" l="Interviews" c="#fff" />
                  <StatTile n="0" l="Critical Alerts" c={GREEN} />
                </div>
                <div className="mt-2.5 rounded-lg border" style={{ borderColor: BORDER, background: CARD }}>
                  <p className="border-b px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-slate-500" style={{ borderColor: BORDER }}>
                    🔔 Needs Attention
                  </p>
                  {[
                    { n: "Rosa Delgado", s: "Background + drug cleared — ready for activation", b: "Activate" },
                    { n: "Kylie Trench", s: "Training tomorrow 8:00 AM · DSM3", b: "Open" },
                    { n: "Harper Nguyen", s: "New applicant — needs first contact", b: "Contact" },
                  ].map((r) => (
                    <div key={r.n} className="flex items-center justify-between gap-2 border-b px-3 py-2 last:border-0" style={{ borderColor: BORDER }}>
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-semibold text-slate-200">{r.n}</p>
                        <p className="truncate text-[9px] text-slate-500">{r.s}</p>
                      </div>
                      <span
                        className="shrink-0 rounded-md border px-2 py-1 text-[9px] font-bold"
                        style={{ color: "#9CC5FF", borderColor: `${BLUE}66`, background: `${BLUE}1C` }}
                      >
                        {r.b}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-2.5 grid grid-cols-5 gap-1.5 text-center">
                  {[
                    { s: "Applied", n: "24" },
                    { s: "Interview", n: "31" },
                    { s: "Drug Test", n: "6" },
                    { s: "Training", n: "3" },
                    { s: "Ready", n: "3" },
                  ].map((st) => (
                    <div key={st.s} className="rounded-md border py-1.5" style={{ borderColor: BORDER, background: CARD }}>
                      <p className="text-[12px] font-extrabold text-white">{st.n}</p>
                      <p className="text-[7.5px] font-bold uppercase tracking-wide text-slate-500">{st.s}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* SMS phone mock */}
            <div className="mx-auto w-full max-w-[240px]">
              <div className="overflow-hidden rounded-[2rem] border-[6px] border-slate-700 shadow-2xl" style={{ background: "#0D1526" }}>
                <div className="px-4 pb-4 pt-4" style={{ background: BLUE }}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-white/80">Hiring Inbox</p>
                  <p className="text-sm font-bold text-white">Harper Nguyen · SMS</p>
                </div>
                <div className="space-y-2 p-3 text-[10.5px] leading-snug">
                  <div className="max-w-[85%] rounded-xl rounded-bl-sm border px-2.5 py-1.5 text-slate-300" style={{ borderColor: BORDER, background: CARD }}>
                    Hi! I just applied for the Delivery Driver position.
                  </div>
                  <div className="ml-auto max-w-[85%] rounded-xl rounded-br-sm px-2.5 py-1.5 text-white" style={{ background: BLUE }}>
                    Hi Harper! Thanks for applying to Summit Delivery Co. Pick an interview slot:
                    Wed 2:00 · Thu 10:00 · Fri 2:00
                  </div>
                  <div className="max-w-[85%] rounded-xl rounded-bl-sm border px-2.5 py-1.5 text-slate-300" style={{ borderColor: BORDER, background: CARD }}>
                    Wednesday at 2 works!
                  </div>
                  <div className="rounded-lg border px-2.5 py-1.5 text-center text-[9px] font-bold" style={{ borderColor: `${GREEN}55`, background: `${GREEN}14`, color: GREEN }}>
                    Status → Interview Confirmed · Wed, Aug 5 · 2:00 PM
                  </div>
                </div>
              </div>
              <p className="mt-3 text-center text-xs text-slate-500">
                Templates fill themselves and update candidate status automatically.
              </p>
            </div>
          </div>

          {/* Scorecards + Payroll mocks */}
          <div className="mt-8 grid items-start gap-8 lg:grid-cols-2">
            {/* Driver scorecards mock */}
            <div className="overflow-hidden rounded-xl border shadow-2xl" style={{ borderColor: BORDER, background: "#0D1526" }}>
              <FrameBar url="app.lastmileassist.com/scorecards" />
              <div className="p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] text-slate-500">Performance / Scorecards</p>
                    <p className="text-sm font-bold text-white">Week of Jul 20 – Jul 26</p>
                  </div>
                  <span className="rounded-lg px-2.5 py-1 text-[10px] font-bold text-white" style={{ background: BLUE }}>
                    📨 Send All Scorecards
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-4 gap-2">
                  <StatTile n="42" l="Drivers" c="#60A5FA" />
                  <StatTile n="19" l="Perfect Weeks" c={GREEN} />
                  <StatTile n="6" l="Safety Hits" c={RED} />
                  <StatTile n="11" l="CDF Hits" c={AMBER} />
                </div>

                <div className="mt-3 overflow-hidden rounded-lg border text-[11px]" style={{ borderColor: BORDER }}>
                  {[
                    { d: "Marcus Bell", m: "412 pkgs · #1/42 ▲2", dcr: "100%", score: "100.0", tier: "Platinum", c: "#60A5FA" },
                    { d: "Tanya Rivers", m: "1,038 pkgs · #2/42 ▲12", dcr: "100%", score: "100.0", tier: "Platinum", c: "#60A5FA" },
                    { d: "Chris Dunmore", m: "932 pkgs · #20/42 ▼6", dcr: "100%", score: "97.4", tier: "Silver", c: "#9AA4BD" },
                  ].map((r, i) => (
                    <div key={r.d} className={`flex items-center gap-2 px-3 py-2 ${i ? "border-t" : ""}`} style={{ borderColor: BORDER }}>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-200">{r.d}</p>
                        <p className="text-[9px] text-slate-500">{r.m}</p>
                      </div>
                      <span className="w-12 text-right tabular-nums text-slate-400">{r.dcr}</span>
                      <span className="w-12 text-right font-bold tabular-nums" style={{ color: GREEN }}>{r.score}</span>
                      <span
                        className="w-16 rounded-full border px-1.5 py-0.5 text-center text-[8.5px] font-bold"
                        style={{ color: r.c, borderColor: `${r.c}55`, background: `${r.c}14` }}
                      >
                        {r.tier}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[10px] text-slate-500">
                  Eight Amazon reports in, a personal scorecard for every driver out — sent by
                  SMS, Sling, or email in one click.
                </p>
              </div>
            </div>

            {/* Payroll pre-check mock */}
            <div className="overflow-hidden rounded-xl border shadow-2xl" style={{ borderColor: BORDER, background: "#0D1526" }}>
              <FrameBar url="app.lastmileassist.com/payroll-pre-check" />
              <div className="p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] text-slate-500">Money &amp; Compliance</p>
                    <p className="text-sm font-bold text-white">Payroll Pre-Check</p>
                  </div>
                  <span className="rounded-lg px-2.5 py-1 text-[10px] font-bold text-white" style={{ background: BLUE }}>
                    Upload Payroll CSV
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <StatTile n="2" l="Violations" c={RED} />
                  <StatTile n="6" l="Warnings" c={AMBER} />
                  <StatTile n="3" l="Wage Theft Flags" c={PURPLE} />
                </div>

                <div className="mt-3 space-y-1.5 text-[11px]">
                  {[
                    { t: "Flex / payroll lunch mismatch", n: "1", c: RED },
                    { t: "Worked (deliveries in Flex) but not in payroll", n: "3", c: PURPLE },
                    { t: "Incomplete punch — no clock-out", n: "1", c: AMBER },
                  ].map((row) => (
                    <div key={row.t} className="flex items-center justify-between rounded-lg border px-3 py-2" style={{ borderColor: BORDER, background: CARD }}>
                      <span className="font-medium text-slate-300">{row.t}</span>
                      <span
                        className="rounded-full border px-2 py-0.5 text-[9.5px] font-bold"
                        style={{ color: row.c, borderColor: `${row.c}55`, background: `${row.c}14` }}
                      >
                        {row.n}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[10px] text-slate-500">
                  Timecards cross-checked against Flex before payroll runs — with a copy-paste fix
                  list for whoever processes payroll.
                </p>
              </div>
            </div>
          </div>

          {/* Performance Hub + Fleet mocks */}
          <div className="mt-8 grid items-start gap-8 lg:grid-cols-2">
            {/* Performance Hub mock */}
            <div className="overflow-hidden rounded-xl border shadow-2xl" style={{ borderColor: BORDER, background: "#0D1526" }}>
              <FrameBar url="app.lastmileassist.com/performance-hub" />
              <div className="p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] text-slate-500">Performance / Hub</p>
                    <p className="text-sm font-bold text-white">Performance Hub · 6 weeks</p>
                  </div>
                  <span
                    className="rounded-full border px-2.5 py-1 text-[9.5px] font-bold"
                    style={{ color: "#9CC5FF", borderColor: `${BLUE}66`, background: `${BLUE}1C` }}
                  >
                    Fantastic+
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-lg border p-3 text-center" style={{ borderColor: BORDER, background: CARD }}>
                    <p className="text-[8.5px] font-bold uppercase tracking-wide text-slate-500">DSP Score</p>
                    <p className="text-2xl font-extrabold text-white">94</p>
                  </div>
                  <div className="rounded-lg border p-3" style={{ borderColor: BORDER, background: CARD }}>
                    <p className="text-center text-[8.5px] font-bold uppercase tracking-wide text-slate-500">Tiers</p>
                    <div className="mt-1.5 flex items-end justify-center gap-2">
                      {[
                        { n: 16, h: 30, c: "#60A5FA", l: "Plat" },
                        { n: 3, h: 8, c: AMBER, l: "Gold" },
                        { n: 9, h: 18, c: "#9AA4BD", l: "Silv" },
                        { n: 14, h: 26, c: RED, l: "Bron" },
                      ].map((t) => (
                        <div key={t.l} className="text-center">
                          <div className="mx-auto w-4 rounded-sm" style={{ height: t.h, background: t.c }} />
                          <p className="mt-0.5 text-[8px] font-bold text-slate-400">{t.n}</p>
                          <p className="text-[7px] text-slate-600">{t.l}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-2.5 rounded-lg border px-3 py-2.5" style={{ borderColor: `${BLUE}44`, background: `${BLUE}10` }}>
                  <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "#9CC5FF" }}>✨ AI Projection</p>
                  <p className="mt-1 text-[10.5px] leading-snug text-slate-300">
                    Next week: <b className="text-white">93.5</b> — CDF concentration in two bronze
                    drivers will drag the average. Strategy: ride-alongs for Kowalski &amp; Osei,
                    recognize 8 Driver Stars in Sling.
                  </p>
                </div>

                <div className="mt-2.5 space-y-1.5 text-[11px]">
                  {[
                    { d: "Sam Kowalski", s: "8 CDFs · bottom 4 of 6 weeks", n: "79", c: RED },
                    { d: "Victor Osei", s: "6 CDFs · 4 safety events", n: "84", c: RED },
                  ].map((r) => (
                    <div key={r.d} className="flex items-center justify-between rounded-lg border px-3 py-2" style={{ borderColor: BORDER, background: CARD }}>
                      <div>
                        <p className="font-semibold text-slate-200">🎯 {r.d}</p>
                        <p className="text-[9px] text-slate-500">{r.s}</p>
                      </div>
                      <span className="text-sm font-extrabold tabular-nums" style={{ color: r.c }}>{r.n}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[10px] text-slate-500">
                  Six weeks of history, worst-of leaderboards, and an AI plan to move next
                  week&apos;s score.
                </p>
              </div>
            </div>

            {/* Fleet & repairs mock */}
            <div className="overflow-hidden rounded-xl border shadow-2xl" style={{ borderColor: BORDER, background: "#0D1526" }}>
              <FrameBar url="app.lastmileassist.com/fleet" />
              <div className="p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] text-slate-500">Operations / Fleet</p>
                    <p className="text-sm font-bold text-white">Fleet — 26 vehicles</p>
                  </div>
                  <div className="flex gap-1.5">
                    <span className="rounded-full border px-2 py-0.5 text-[9px] font-bold" style={{ color: GREEN, borderColor: `${GREEN}55`, background: `${GREEN}12` }}>24 Active</span>
                    <span className="rounded-full border px-2 py-0.5 text-[9px] font-bold" style={{ color: RED, borderColor: `${RED}55`, background: `${RED}12` }}>2 Grounded</span>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border p-3" style={{ borderColor: BORDER, background: CARD }}>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[12px] font-bold text-white">SD #01</span>
                      <span className="rounded-full border px-1.5 py-0.5 text-[8px] font-bold uppercase" style={{ color: GREEN, borderColor: `${GREEN}55`, background: `${GREEN}12` }}>Active</span>
                    </div>
                    <p className="mt-0.5 text-[9.5px] text-slate-500">2025 Ram ProMaster · plate 7TR482</p>
                    <p className="mt-1.5 text-[10px] text-slate-400">
                      Rental ends <b className="text-slate-200">in 27d</b> · Inspected <b style={{ color: GREEN }}>✓ 8/2</b>
                    </p>
                  </div>
                  <div className="rounded-lg border p-3" style={{ borderColor: `${RED}44`, background: CARD }}>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[12px] font-bold text-white">SD #02</span>
                      <span className="rounded-full border px-1.5 py-0.5 text-[8px] font-bold uppercase" style={{ color: RED, borderColor: `${RED}55`, background: `${RED}12` }}>Rental ends today</span>
                    </div>
                    <p className="mt-0.5 text-[9.5px] text-slate-500">2024 Ram ProMaster · plate 7TR518</p>
                    <p className="mt-1.5 rounded border px-1.5 py-1 text-[9px]" style={{ borderColor: `${RED}44`, background: `${RED}0F`, color: "#FCA5A5" }}>
                      ⚠ 1 repair pending — Airbag light on (HIGH)
                    </p>
                  </div>
                </div>

                <div className="mt-2.5 space-y-1.5 text-[11px]">
                  {[
                    { v: "SD #04", t: "Front tires worn — replace both", p: "HIGH", c: RED, w: "today" },
                    { v: "SD #11", t: "Wiper blades misaligned", p: "PART ORDERED", c: PURPLE, w: "2 days" },
                  ].map((r) => (
                    <div key={r.t} className="flex items-center justify-between rounded-lg border px-3 py-2" style={{ borderColor: BORDER, background: CARD }}>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-bold text-slate-300">{r.v}</span>
                        <span className="font-medium text-slate-300">{r.t}</span>
                      </div>
                      <span className="flex items-center gap-2">
                        <span className="rounded-full border px-2 py-0.5 text-[8.5px] font-bold" style={{ color: r.c, borderColor: `${r.c}55`, background: `${r.c}12` }}>{r.p}</span>
                        <span className="hidden text-[9px] text-slate-500 sm:block">{r.w}</span>
                      </span>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[10px] text-slate-500">
                  Rental countdowns, QR-code inspections, and repair tickets — expiring vans
                  surface in your alerts before they cost you money.
                </p>
              </div>
            </div>
          </div>

          {/* Payments strip */}
          <div className="mt-8 overflow-hidden rounded-xl border shadow-2xl" style={{ borderColor: BORDER, background: "#0D1526" }}>
            <FrameBar url="app.lastmileassist.com/route-payments" />
            <div className="grid gap-4 p-4 sm:grid-cols-3 sm:p-5">
              <div className="rounded-lg border p-3 text-center" style={{ borderColor: `${BLUE}44`, background: `${BLUE}12` }}>
                <p className="text-[8.5px] font-bold uppercase tracking-wider" style={{ color: "#9CC5FF" }}>Estimated Receipt · W32</p>
                <p className="mt-1 text-xl font-extrabold text-white">$7,617.88</p>
                <p className="text-[9px] text-slate-500">20 routes · 190 hours · 5,214 packages</p>
              </div>
              <div className="rounded-lg border p-3 text-center" style={{ borderColor: `${GREEN}44`, background: `${GREEN}0F` }}>
                <p className="text-[8.5px] font-bold uppercase tracking-wider" style={{ color: GREEN }}>Reconciliation — August</p>
                <p className="mt-1 text-xl font-extrabold" style={{ color: GREEN }}>+$212.16</p>
                <p className="text-[9px] text-slate-500">Amazon owes you — caught automatically</p>
              </div>
              <div className="rounded-lg border p-3 text-center" style={{ borderColor: `${RED}44`, background: `${RED}0F` }}>
                <p className="text-[8.5px] font-bold uppercase tracking-wider" style={{ color: RED }}>Payment Verification</p>
                <p className="mt-1 text-xl font-extrabold text-white">1 route unpaid</p>
                <p className="text-[9px] text-slate-500">Missing from the Work Summary — flagged before the receipt posts</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t" style={{ borderColor: BORDER, background: `linear-gradient(100deg, ${BLUE}1C, rgba(255,255,255,0.02))` }}>
        <div className="mx-auto max-w-6xl px-5 py-16 text-center">
          <h2 className="text-2xl font-extrabold text-white md:text-3xl">See it live on your own station&apos;s data</h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-400">
            A 30-minute walkthrough with your roster and last week&apos;s scorecard reports is the
            fastest way to see what Last Mile Assist finds — most stations discover unpaid routes
            or payroll flags in the first session.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href="/contact" className="rounded-xl px-6 py-3.5 font-semibold text-white shadow-lg" style={{ background: BLUE }}>
              Book a demo
            </Link>
            <Link
              href="/login"
              className="rounded-xl border px-6 py-3.5 font-semibold text-slate-200"
              style={{ borderColor: BORDER, background: CARD }}
            >
              Log in
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t" style={{ borderColor: BORDER }}>
        <div className="mx-auto max-w-6xl px-5 py-8 text-sm text-slate-400">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/lma-icon.png" alt="" className="h-6 w-6" />
              <span className="font-semibold text-slate-200">{PLATFORM.name}</span>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              <span>{PLATFORM.domain}</span>
              <Link href="/contact" className="hover:text-white">Contact</Link>
              <Link href="/login" className="hover:text-white">Log in</Link>
            </div>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Last Mile Assist is an independent platform and is not affiliated with, sponsored by,
            or endorsed by Amazon. All product data shown above is sample data.
          </p>
        </div>
      </footer>
    </div>
  );
}
