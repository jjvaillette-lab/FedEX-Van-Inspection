"use client";

import Link from "next/link";
import { useAuth } from "@/app/components/portal/AuthProvider";
import { MODULES, SECTIONS } from "@/lib/tenant";

export default function PortalOverview() {
  const { user, tenant } = useAuth();
  const brand = tenant.themeColor;
  const firstName = user?.name.split(" ")[0] ?? "there";

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 md:px-8 md:py-10">
      <p className="text-sm text-slate-500">Welcome back,</p>
      <h1 className="text-2xl font-extrabold text-slate-900 md:text-3xl">{firstName}</h1>
      <p className="mt-1 text-slate-500">Here's everything running at {tenant.name}.</p>

      {SECTIONS.map((section) => {
        const mods = MODULES.filter((m) => m.section === section);
        return (
          <div key={section} className="mt-9">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">{section}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {mods.map((m) => {
                const enabled = tenant.enabledModules.includes(m.key);
                const body = (
                  <>
                    <div className="flex items-start justify-between">
                      <span className="text-3xl">{m.icon}</span>
                      {enabled ? (
                        <span
                          className="rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white"
                          style={{ background: brand }}
                        >
                          Active
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                          Coming soon
                        </span>
                      )}
                    </div>
                    <h3 className="mt-3 font-bold text-slate-900">{m.name}</h3>
                    <p className="mt-1 text-sm text-slate-500">{m.description}</p>
                    {enabled && (
                      <span className="mt-3 inline-block text-sm font-semibold" style={{ color: brand }}>
                        Open →
                      </span>
                    )}
                  </>
                );

                const base = "rounded-2xl border bg-white p-5 transition";
                if (enabled && m.href) {
                  return (
                    <Link key={m.key} href={m.href} className={`${base} border-slate-200 hover:shadow-md`}>
                      {body}
                    </Link>
                  );
                }
                return (
                  <div key={m.key} className={`${base} border-dashed border-slate-200 opacity-75`}>
                    {body}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
