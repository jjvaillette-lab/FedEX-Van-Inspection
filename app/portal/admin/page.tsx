"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/app/components/portal/AuthProvider";
import { IconShield } from "@/app/components/icons";

/**
 * LMA platform console — staff only. Every customer company at a glance,
 * one-step onboarding, support view-as (audited), and the error feed.
 */

interface CompanyRow {
  id: string;
  name: string;
  slug: string;
  themeColor: string;
  active: boolean;
  driverKey: string | null;
  createdAt: string;
  users: number;
  inspections: number;
  vans: number;
  lastActivity: string | null;
}

interface ErrorRow {
  id: string;
  at: string;
  source: string;
  message: string;
  url: string | null;
}

interface AuditRow {
  id: string;
  at: string;
  admin_email: string;
  action: string;
  company_id: string | null;
  detail: string | null;
}

const dt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-US") : "—");

export default function AdminConsolePage() {
  const { user, ready } = useAuth();
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [errors, setErrors] = useState<ErrorRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [created, setCreated] = useState<{
    companyId: string;
    driverKey: string;
    owner: { email: string; tempPassword: string } | null;
  } | null>(null);

  const reload = () => {
    Promise.all([
      fetch("/api/admin/companies").then((r) => r.json()),
      fetch("/api/admin/errors").then((r) => r.json()),
    ])
      .then(([c, e]) => {
        if (c.error) setMessage(c.error);
        setCompanies(c.companies ?? []);
        setErrors(e.errors ?? []);
        setAudit(e.audit ?? []);
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    if (ready && user?.platformAdmin) reload();
    else if (ready) setLoading(false);
  }, [ready, user?.platformAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  const viewAs = async (companyId: string) => {
    const res = await fetch("/api/admin/view-as", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId }),
    });
    if (res.ok) window.location.href = "/portal";
    else setMessage((await res.json()).error ?? "Couldn't start support view.");
  };

  const toggleActive = async (c: CompanyRow) => {
    await fetch("/api/admin/companies", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: c.id, active: !c.active }),
    });
    reload();
  };

  if (!ready) return null;
  if (!user?.platformAdmin) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 text-center text-slate-500">
        This area is for Last Mile Assist staff only.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:px-8">
      <nav className="mb-1 flex items-center gap-2 text-sm text-slate-400">
        <Link href="/portal" className="hover:text-slate-600">Portal</Link>
        <span>/</span>
        <span className="text-slate-500">Admin</span>
      </nav>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
            <IconShield size={24} /> Platform admin
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Every customer company, onboarding, and support access — all support views are logged.
          </p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white"
        >
          + Add company
        </button>
      </div>

      {message && (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {message}
        </p>
      )}

      {loading ? (
        <p className="py-16 text-center text-slate-400">Loading…</p>
      ) : (
        <>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {companies.map((c) => (
              <div key={c.id} className={`rounded-xl border bg-white p-4 ${c.active ? "border-slate-200" : "border-rose-200"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-xs font-extrabold text-white"
                      style={{ background: c.themeColor }}
                    >
                      {c.name.slice(0, 2).toUpperCase()}
                    </span>
                    <div>
                      <p className="font-bold text-slate-900">{c.name}</p>
                      <p className="text-[11px] text-slate-400">
                        {c.slug} · since {new Date(c.createdAt).toLocaleDateString("en-US")}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10.5px] font-bold uppercase ${
                      c.active
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-rose-200 bg-rose-50 text-rose-700"
                    }`}
                  >
                    {c.active ? "Active" : "Suspended"}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                  {[
                    { n: c.users, l: "Users" },
                    { n: c.vans, l: "Vans" },
                    { n: c.inspections, l: "DVIRs" },
                  ].map((s) => (
                    <div key={s.l} className="rounded-lg bg-slate-50 py-2">
                      <div className="text-sm font-bold tabular-nums text-slate-900">{s.n}</div>
                      <div className="text-[10px] text-slate-400">{s.l}</div>
                    </div>
                  ))}
                  <div className="rounded-lg bg-slate-50 px-1 py-2">
                    <div className="truncate text-[11px] font-semibold text-slate-700">
                      {c.lastActivity ? new Date(c.lastActivity).toLocaleDateString("en-US") : "—"}
                    </div>
                    <div className="text-[10px] text-slate-400">Last DVIR</div>
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-slate-400">
                  Driver code: <span className="font-mono text-slate-600">{c.driverKey ?? "env key"}</span>
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => viewAs(c.id)}
                    className="flex-1 rounded-lg bg-slate-900 py-2 text-xs font-bold text-white"
                  >
                    View as (support)
                  </button>
                  <button
                    onClick={() => toggleActive(c)}
                    className={`flex-1 rounded-lg border py-2 text-xs font-semibold ${
                      c.active
                        ? "border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100"
                        : "border-emerald-300 bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {c.active ? "Suspend" : "Reactivate"}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Errors + audit */}
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div>
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
                Recent server errors
              </h2>
              {errors.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-400">
                  No errors captured. 🎉
                </p>
              ) : (
                <div className="max-h-80 space-y-1.5 overflow-y-auto">
                  {errors.map((e) => (
                    <div key={e.id} className="rounded-lg border border-rose-100 bg-white px-3 py-2 text-[12px]">
                      <p className="font-semibold text-rose-700">{e.message.slice(0, 160)}</p>
                      <p className="text-[10.5px] text-slate-400">
                        {dt(e.at)} · {e.source}{e.url ? ` · ${e.url}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
                Support access log
              </h2>
              {audit.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-400">
                  No support actions logged yet.
                </p>
              ) : (
                <div className="max-h-80 space-y-1.5 overflow-y-auto">
                  {audit.map((a) => (
                    <div key={a.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px]">
                      <p className="text-slate-700">
                        <span className="font-semibold">{a.admin_email}</span>{" "}
                        {a.action.replace(/_/g, " ")}
                        {a.company_id ? ` — ${a.company_id}` : ""}
                      </p>
                      <p className="text-[10.5px] text-slate-400">{dt(a.at)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {addOpen && (
        <AddCompanyModal
          onClose={() => setAddOpen(false)}
          onDone={(res) => {
            setAddOpen(false);
            setCreated(res);
            reload();
          }}
        />
      )}

      {created && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-5">
          <div className="w-full max-w-md rounded-xl bg-white p-6">
            <h3 className="text-lg font-bold text-slate-900">Company created</h3>
            <div className="mt-4 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
              <p>
                <span className="text-slate-400">Company ID:</span>{" "}
                <span className="font-semibold text-slate-800">{created.companyId}</span>
              </p>
              <p>
                <span className="text-slate-400">Driver activation code:</span>{" "}
                <span className="font-mono font-bold text-slate-900">{created.driverKey}</span>
              </p>
              {created.owner && (
                <>
                  <p>
                    <span className="text-slate-400">Owner login:</span>{" "}
                    <span className="font-semibold text-slate-800">{created.owner.email}</span>
                  </p>
                  <p>
                    <span className="text-slate-400">Temporary password:</span>{" "}
                    <span className="font-mono font-bold text-slate-900">{created.owner.tempPassword}</span>
                  </p>
                </>
              )}
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              Shown once — hand these to the new owner. They should change the password in
              Settings after first sign-in.
            </p>
            <button
              onClick={() => setCreated(null)}
              className="mt-4 w-full rounded-lg bg-slate-900 py-2.5 text-sm font-semibold text-white"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AddCompanyModal({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: (r: { companyId: string; driverKey: string; owner: { email: string; tempPassword: string } | null }) => void;
}) {
  const [name, setName] = useState("");
  const [themeColor, setThemeColor] = useState("#0E7C5A");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, themeColor, ownerName, ownerEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Create failed");
      onDone({ companyId: data.companyId, driverKey: data.driverKey, owner: data.owner });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-5">
      <div className="w-full max-w-md rounded-xl bg-white p-6">
        <h3 className="text-lg font-bold text-slate-900">Add a customer company</h3>
        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Company name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Delivery LLC" className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Brand color</label>
            <input type="color" value={themeColor} onChange={(e) => setThemeColor(e.target.value)} className="h-10 w-20 cursor-pointer rounded border border-slate-300" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Owner name</label>
              <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Owner email</label>
              <input value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} className={inputCls} />
            </div>
          </div>
          <p className="text-[11px] text-slate-400">
            Owner fields are optional — leave blank to create the login later.
          </p>
          {err && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button onClick={onClose} className="rounded-lg border border-slate-300 py-2.5 text-sm font-semibold text-slate-700">
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={busy || !name.trim()}
              className="rounded-lg bg-slate-900 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              {busy ? "Creating…" : "Create company"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
