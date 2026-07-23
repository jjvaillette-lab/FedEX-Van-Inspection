"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PLATFORM } from "@/lib/brand";
import { useAuth } from "@/app/components/portal/AuthProvider";

export default function LoginPage() {
  const { loginWithPassword } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!email.trim() || !password) return;
    setBusy(true);
    setError(null);
    try {
      // Real account first; the shared team password still works during the
      // transition (handled server-side).
      const result = await loginWithPassword(email, password);
      if (!result.ok) {
        setError(result.error ?? "Incorrect email or password.");
        return;
      }
      const next = new URLSearchParams(window.location.search).get("next");
      router.replace(next && next.startsWith("/") ? next : "/portal");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center px-5 py-12" style={{ background: PLATFORM.navyDeep }}>
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/lma-mark.svg" alt="" className="h-9 w-9" />
          <span className="text-xl font-extrabold tracking-tight text-white">
            Last Mile <span style={{ color: PLATFORM.amber }}>Assist</span>
          </span>
        </Link>

        <div className="rounded-2xl bg-white p-7 shadow-2xl">
          <h1 className="text-xl font-bold text-slate-900">Sign in</h1>
          <p className="mt-1 text-sm text-slate-500">Welcome back. Enter your details to continue.</p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(null); }}
                placeholder="you@company.com"
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(null); }}
                placeholder="••••••••"
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </div>
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <button
              type="submit"
              disabled={busy || !email.trim() || !password}
              className="w-full rounded-lg py-3 font-semibold text-white disabled:opacity-50"
              style={{ background: PLATFORM.navy }}
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>

        </div>

        <p className="mt-6 text-center text-sm text-white/50">
          <Link href="/contact" className="text-white/70 hover:text-white">Contact us</Link>
          <span className="mx-2">·</span>
          <Link href="/" className="text-white/70 hover:text-white">Back to home</Link>
        </p>
      </div>
    </div>
  );
}
