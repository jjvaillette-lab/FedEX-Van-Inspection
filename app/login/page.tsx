"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PLATFORM } from "@/lib/brand";
import { DEMO_USERS } from "@/lib/tenant";
import { useAuth } from "@/app/components/portal/AuthProvider";

export default function LoginPage() {
  const { login } = useAuth();
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
      // Verify the access password on the server (sets the private-session cookie).
      const res = await fetch("/api/gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        setError("Incorrect email or password.");
        return;
      }
      // Establish the account/role for this session.
      const result = await login(email);
      if (!result.ok) {
        setError(result.error ?? "No account found for that email.");
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

          {/* Quick account fill for the Stratford test company. */}
          <div className="mt-5 border-t border-slate-100 pt-4">
            <p className="text-xs font-medium text-slate-400">Stratford Delivery Corp — fill an account</p>
            <div className="mt-2 flex gap-2">
              {DEMO_USERS.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => { setEmail(u.email); setError(null); }}
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50"
                >
                  <span className="block font-semibold text-slate-800">{u.name}</span>
                  <span className="block text-xs capitalize text-slate-400">{u.role}</span>
                </button>
              ))}
            </div>
          </div>
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
