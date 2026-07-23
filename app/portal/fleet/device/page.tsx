"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/app/components/portal/AuthProvider";
import { IconCamera, IconPhone, IconQr, IconShield } from "@/app/components/icons";

/**
 * Driver device setup: how the DVIR app gets onto each phone. Inspections are
 * phone-only — this page gives the QR/link, the install steps, and what to
 * expect on first use.
 */
export default function AddDvirDevice() {
  const { user, tenant, hasPermission } = useAuth();
  const brand = tenant.themeColor;
  const canView = user?.role === "owner" || !!user?.admin || hasPermission("inspection.edit_questions");

  const [info, setInfo] = useState<{ url: string; key: string } | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!canView) return;
    fetch("/api/driver-key")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Unavailable");
        setInfo(data);
        const QRCode = (await import("qrcode")).default;
        setQr(await QRCode.toDataURL(data.url, { width: 480, margin: 2 }));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Unavailable"));
  }, [canView]);

  if (!canView) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 text-center text-slate-500">
        You don&apos;t have access to device setup. Ask an owner to grant it.
      </div>
    );
  }

  const copy = async () => {
    if (!info) return;
    try {
      await navigator.clipboard.writeText(info.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  const steps = [
    { t: "Open the link on the driver's phone", d: "Scan the QR code with the phone's camera, or text/email the activation link and tap it." },
    { t: "Add it to the home screen", d: "In the browser: Share → \"Add to Home Screen.\" It installs as the Van Check app — no app store needed." },
    { t: "Open the Van Check icon", d: "If it asks for the activation code on first launch, enter it once. The device stays activated for a year." },
    { t: "Run the first check", d: "The phone will ask to allow the camera the first time — tap Allow. After that it's scan, checklist, photos, sign, done." },
  ];

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 md:px-8">
      <nav className="mb-1 flex items-center gap-2 text-sm text-slate-400">
        <Link href="/portal" className="hover:text-slate-600">Portal</Link>
        <span>/</span>
        <Link href="/portal/fleet" className="hover:text-slate-600">Fleet</Link>
        <span>/</span>
        <span className="text-slate-500">Add DVIR to Device</span>
      </nav>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Add DVIR to a Device</h1>
      <p className="mt-0.5 text-sm text-slate-500">
        Inspections are done on driver phones. Set up each phone once — about a minute per device.
      </p>

      <div className="mt-7 grid gap-5 lg:grid-cols-[auto_1fr]">
        {/* QR + link */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center lg:w-72">
          {error ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-800">{error}</p>
          ) : !info ? (
            <p className="py-16 text-sm text-slate-400">Loading…</p>
          ) : (
            <>
              {qr && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qr} alt="Driver activation QR code" className="mx-auto h-52 w-52 rounded-lg border border-slate-200" />
              )}
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Scan with the driver&apos;s phone
              </p>
              <button
                onClick={copy}
                className="mt-3 w-full rounded-lg py-2.5 text-sm font-semibold text-white"
                style={{ background: brand }}
              >
                {copied ? "Copied ✓" : "Copy activation link"}
              </button>
              <p className="mt-3 break-all rounded-lg bg-slate-50 px-3 py-2 text-left font-mono text-[11px] text-slate-500">
                {info.url}
              </p>
              <p className="mt-2 text-left text-xs text-slate-400">
                Activation code (type manually if needed):{" "}
                <span className="font-mono text-slate-600">{info.key}</span>
              </p>
            </>
          )}
        </div>

        {/* Steps + notes */}
        <div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <IconPhone size={20} /> Set up in four steps
            </h2>
            <ol className="mt-4 space-y-4">
              {steps.map((s, i) => (
                <li key={s.t} className="flex gap-3">
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ background: brand }}
                  >
                    {i + 1}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-slate-800">{s.t}</span>
                    <span className="block text-sm text-slate-500">{s.d}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 text-slate-800">
                <IconShield size={17} />
                <p className="text-sm font-semibold">Locked to inspections</p>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Driver devices can only run van checks — they can never open this portal, review
                data, or change settings.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 text-slate-800">
                <IconCamera size={17} />
                <p className="text-sm font-semibold">Works on any phone</p>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                iPhone and Android, no app store. Old phones fall back to the built-in camera
                automatically.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 sm:col-span-2">
              <div className="flex items-center gap-2 text-slate-800">
                <IconQr size={17} />
                <p className="text-sm font-semibold">Don&apos;t forget the van codes</p>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Drivers scan a QR code on each van to start a check. Print them once from the{" "}
                <Link href="/vans" className="font-semibold underline" style={{ color: brand }}>
                  Van QR Generator
                </Link>{" "}
                and mount them inside the driver door.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
