import Link from "next/link";
import { PLATFORM } from "@/lib/brand";

/* Dark brand theme — matches the landing page */
const BG = "#0A1120";
const CARD = "rgba(255,255,255,0.04)";
const BORDER = "rgba(255,255,255,0.10)";

export const metadata = {
  title: `Privacy Policy — ${PLATFORM.name}`,
  description: `How ${PLATFORM.name} collects, uses, and protects personal information.`,
};

/* Adapted from the privacy policy Lelit Logistics runs at
   lelitlogistics.com/privacy — the structure and the SMS-program language
   (consent, STOP/HELP with a final confirmation, frequency, and the two
   no-third-party-sharing sentences) are kept close to that text, because that
   wording is what carrier/10DLC review expects to find. The data-collection
   and sharing sections describe what THIS site and platform actually do:
   Lelit's policy is an employer's (drug screens, DSP agreement duties) and
   restating those here would be claims about a business LMA does not run.

   Each customer's own instance additionally serves ITS OWN /about, /privacy
   and /terms under the customer's identity — this page covers the Last Mile
   Assist platform and marketing site only. */

const H2 = "mt-10 text-lg font-bold text-white";
const P = "mt-3 text-[15px] leading-relaxed text-slate-400";
const LI = "text-[15px] leading-relaxed text-slate-400";

export default function PrivacyPage() {
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
        <h1 className="text-3xl font-extrabold text-white">Privacy Policy</h1>
        <p className="mt-2 text-sm text-slate-500">
          {PLATFORM.name} &mdash; Last updated: August 28, 2026
        </p>

        <p className={P}>
          This Privacy Policy describes how {PLATFORM.name} (&ldquo;we,&rdquo;
          &ldquo;us,&rdquo; or &ldquo;our&rdquo;) collects, uses, and protects the
          personal information of visitors to this website, prospective customers,
          and users of our platform.
        </p>

        <h2 className={H2}>Information we collect</h2>
        <p className={P}>
          We collect personal information you voluntarily provide, including:
        </p>
        <ul className="mt-2 list-disc space-y-1.5 pl-6">
          <li className={LI}>
            Contact details you submit when requesting a demo or contacting us
            &mdash; name, company, email address, phone number, city and state,
            and the details of your message
          </li>
          <li className={LI}>
            Account information when you use our platform, such as your name,
            email address, and role
          </li>
          <li className={LI}>
            Information our customer companies enter into their own instance of
            the platform in the course of running their operations &mdash; we
            process that information on the customer&rsquo;s behalf, under the
            customer&rsquo;s own policies
          </li>
        </ul>

        <h2 className={H2}>How we use your information</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-6">
          <li className={LI}>To respond to your inquiry and schedule demos</li>
          <li className={LI}>To provide, operate, and support the platform</li>
          <li className={LI}>
            To send service communications related to your inquiry or your use of
            the platform
          </li>
          <li className={LI}>To comply with applicable laws and regulations</li>
        </ul>

        <h2 className={H2}>SMS / text messaging</h2>
        <p className={P}>
          If you provide your mobile phone number and consent to receive text
          messages (for example, when requesting a demo through our website),{" "}
          {PLATFORM.name} may send you SMS messages related to your inquiry or
          your use of our services. Consent is not a condition of purchase.
        </p>
        <ul className="mt-2 list-disc space-y-1.5 pl-6">
          <li className={LI}>
            Message frequency varies; messages are recurring while you have an
            active inquiry or customer relationship with us.
          </li>
          <li className={LI}>
            Message and data rates may apply. Contact your wireless provider for
            details about your plan.
          </li>
          <li className={LI}>
            Opt out at any time by replying <strong className="text-slate-200">STOP</strong>{" "}
            to any message. After you opt out, you will receive one final
            confirmation message and no further texts.
          </li>
          <li className={LI}>
            Need help? Reply <strong className="text-slate-200">HELP</strong> to any
            message or contact us at {PLATFORM.emails.contact}.
          </li>
        </ul>
        <p className={P}>
          No mobile information will be shared with third parties or affiliates
          for marketing or promotional purposes. All the above categories exclude
          text messaging originator opt-in data and consent; this information will
          not be shared with, or sold to, any third parties.
        </p>

        <h2 className={H2}>How we share information</h2>
        <p className={P}>
          We do not sell, trade, or rent your personal information to third
          parties. We share information only with the service providers that run
          our platform &mdash; hosting, database, email delivery, and text
          messaging providers &mdash; and as required by law. Information our
          customers enter into their own instance is processed on that
          customer&rsquo;s behalf and handled under their own policies.
        </p>

        <h2 className={H2}>Data security</h2>
        <p className={P}>
          We implement appropriate technical and organizational measures to
          protect your personal information against unauthorized access,
          alteration, disclosure, or destruction.
        </p>

        <h2 className={H2}>Your choices</h2>
        <p className={P}>
          You may request access to, correction of, or deletion of the personal
          information we hold about you, subject to legal and contractual
          obligations, by contacting us using the information below.
        </p>

        <h2 className={H2}>Contact us</h2>
        <p className={P}>
          Questions about this Privacy Policy? Contact us at{" "}
          {PLATFORM.emails.contact} or through our{" "}
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
          <Link href="/contact" className="hover:text-white">Contact</Link>
        </div>
      </footer>
    </div>
  );
}
