"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/app/components/portal/AuthProvider";
import BrandLogo from "@/app/components/portal/BrandLogo";
import { IconClipboard, IconVan } from "@/app/components/icons";

type State = "checking" | "activating" | "inactive" | "active" | "error";

/**
 * Driver device hub. The owner opens the activation link on each driver phone
 * once (or types the code); after that the device lands here and can only run
 * inspections — the portal is unreachable from a driver session (enforced
 * server-side in proxy.ts).
 */
export default function DriverHub() {
  const { tenant } = useAuth();
  const [state, setState] = useState<State>("checking");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const activate = async (key: string) => {
    setState("activating");
    setError(null);
    try {
      const res = await fetch("/api/driver-gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      if (res.ok) {
        window.history.replaceState({}, "", "/driver"); // drop ?key from the URL
        setState("active");
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Activation failed.");
        setState("inactive");
      }
    } catch {
      setError("Activation failed. Check the connection and try again.");
      setState("inactive");
    }
  };

  useEffect(() => {
    const key = new URLSearchParams(window.location.search).get("key");
    if (key) {
      void activate(key);
      return;
    }
    // No key in the URL — see if this device is already activated.
    fetch("/api/questions?trip=pre")
      .then((r) => setState(r.ok ? "active" : "inactive"))
      .catch(() => setState("inactive"));
  }, []);

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col px-5 pb-10">
      <header className="flex items-center gap-3 pt-10 pb-6">
        <BrandLogo tenant={tenant} size={44} />
        <div>
          <h1 className="text-lg font-bold leading-tight text-slate-900">{tenant.name}</h1>
          <p className="text-sm text-slate-500">Driver App</p>
        </div>
      </header>

      {(state === "checking" || state === "activating") && (
        <div className="flex flex-col items-center py-20">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-slate-500" />
          <p className="mt-4 text-sm text-slate-500">
            {state === "activating" ? "Activating this device…" : "Checking device…"}
          </p>
        </div>
      )}

      {state === "inactive" && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-bold text-slate-900">Activate this device</h2>
          <p className="mt-1 text-sm text-slate-500">
            Enter the activation code from your manager to set up this phone for inspections.
          </p>
          <input
            value={code}
            onChange={(e) => { setCode(e.target.value); setError(null); }}
            placeholder="Activation code"
            autoCapitalize="none"
            className="mt-4 w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
          />
          {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button
            onClick={() => void activate(code.trim())}
            disabled={!code.trim()}
            className="mt-4 w-full rounded-lg bg-slate-900 py-3 font-semibold text-white disabled:opacity-40"
          >
            Activate
          </button>
        </div>
      )}

      {state === "active" && (
        <>
          <Link
            href="/inspection"
            className="flex flex-col items-center rounded-2xl px-6 py-10 text-center text-white shadow-lg active:scale-[0.99]"
            style={{ background: tenant.themeColor }}
          >
            <IconClipboard size={40} />
            <span className="mt-3 text-xl font-bold">Start Van Check</span>
            <span className="mt-1 text-sm opacity-80">
              Scan your badge, scan the van, complete the checklist and photos.
            </span>
          </Link>

          <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-500">
                <IconVan size={17} />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-800">Pre-trip and post-trip</p>
                <p className="text-xs text-slate-500">
                  Scan the van at the start of your route and again when you return. Both are
                  required every day.
                </p>
              </div>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-slate-400">
            Tip: add this page to your home screen — Share → &quot;Add to Home Screen&quot; — so it
            opens like an app.
          </p>
        </>
      )}

      <p className="mt-auto pt-8 text-center text-[11px] text-slate-300">
        Powered by Last Mile Assist
      </p>
    </div>
  );
}
