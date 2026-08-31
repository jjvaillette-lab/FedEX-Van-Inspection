import Link from "next/link";
import { PLATFORM } from "@/lib/brand";

/* Dark brand theme — matches the landing page and /privacy */
const BG = "#0A1120";
const CARD = "rgba(255,255,255,0.04)";
const BORDER = "rgba(255,255,255,0.10)";

export const metadata = {
  title: `Terms and Conditions — ${PLATFORM.name}`,
  description: `Terms for ${PLATFORM.name}, including the SMS program.`,
};

/* Companion to /privacy — same structural pattern as the terms page Lelit
   Logistics runs, adapted to what LMA-the-platform actually does. Together
   these two pages are the URLs a 10DLC campaign registration points at for
   the platform's own brand. */

const H2 = "mt-10 text-lg font-bold text-white";
const P = "mt-3 text-[15px] leading-relaxed text-slate-400";

export default function TermsPage() {
  return (
    <div className="min-h-screen" style={{ background: BG }}>
      {/* Header */}
      <header className="border-b" style={{ borderColor: BORDER }}>
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5">
          <Link href="/" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/lma-icon.png" alt="" className="h-7 w-7" />
            <span className="font-semibold text-slate-200">{PLATFORM.name}</span>
          </Link>
          <Link href="/contact" className="text-sm text-slate-400 hover:text-white">
            Contact
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 pb-20 pt-12">
        <h1 className="text-3xl font-extrabold text-white">Terms and Conditions</h1>
        <p className="mt-2 text-sm text-slate-500">
          {PLATFORM.name} &mdash; Last updated: August 31, 2026
        </p>

        <h2 className={H2}>SMS program</h2>
        <p className={P}>
          {PLATFORM.name} sends SMS messages to prospective and current customers
          who provide a phone number &mdash; for example when requesting a demo
          through our website &mdash; for service purposes including responding to
          inquiries, scheduling demos, and communications related to your use of
          the platform. Consent is not a condition of purchase.
        </p>

        <h2 className={H2}>Message frequency</h2>
        <p className={P}>
          Message frequency varies based on your inquiry or customer relationship.
          Message and data rates may apply; contact your wireless provider for
          details about your plan.
        </p>

        <h2 className={H2}>Opt-out</h2>
        <p className={P}>
          Reply <strong className="text-slate-200">STOP</strong> to cancel at any
          time &mdash; you will receive one final confirmation message and no
          further texts. Reply <strong className="text-slate-200">HELP</strong>{" "}
          for help. No mobile information is shared with third parties or
          affiliates for marketing or promotional purposes.
        </p>

        <h2 className={H2}>Use of the platform</h2>
        <p className={P}>
          Use of the {PLATFORM.name} platform is governed by the service agreement
          between {PLATFORM.name} and the customer company. Each customer company
          is responsible for its own use of the platform, including the content of
          messages it composes and sends to its own applicants and employees.
        </p>

        <h2 className={H2}>Support</h2>
        <p className={P}>
          For support contact {PLATFORM.emails.contact} or use our{" "}
          <Link href="/contact" className="text-slate-200 underline hover:text-white">
            contact form
          </Link>
          .
        </p>

        <div
          className="mt-12 rounded-xl border px-5 py-4 text-sm text-slate-500"
          style={{ borderColor: BORDER, background: CARD }}
        >
          {PLATFORM.name} is an independent platform and is not affiliated with,
          sponsored by, or endorsed by Amazon.
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t" style={{ borderColor: BORDER }}>
        <div className="mx-auto flex max-w-3xl flex-wrap gap-x-5 gap-y-1 px-5 py-6 text-sm text-slate-400">
          <span>{PLATFORM.domain}</span>
          <Link href="/" className="hover:text-white">Home</Link>
          <Link href="/privacy" className="hover:text-white">Privacy Policy</Link>
          <Link href="/contact" className="hover:text-white">Contact</Link>
        </div>
      </footer>
    </div>
  );
}
