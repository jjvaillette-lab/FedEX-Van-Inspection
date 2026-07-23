"use client";

import Link from "next/link";
import { useAuth } from "@/app/components/portal/AuthProvider";
import { MODULE_ICONS, IconChevronRight } from "@/app/components/icons";
import { MODULES, SECTIONS } from "@/lib/tenant";

export default function PortalOverview() {
  const { user, tenant, canSeeSection } = useAuth();
  const brand = tenant.themeColor;
  const firstName = user?.name.split(" ")[0] ?? "there";

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 md:px-8 md:py-10">
      <p className="text-sm text-slate-500">Welcome back, {firstName}.</p>
      <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900">
        {tenant.name}
      </h1>

      {SECTIONS.filter(canSeeSection).map((section) => {
        const mods = MODULES.filter((m) => m.section === section);
        return (
          <div key={section} className="mt-8">
            <h2 className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              {section}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {mods.map((m) => {
                const enabled = tenant.enabledModules.includes(m.key);
                const Ic = MODULE_ICONS[m.icon];
                const body = (
                  <>
                    <div className="flex items-start justify-between">
                      <span
                        className="flex h-10 w-10 items-center justify-center rounded-lg"
                        style={
                          enabled
                            ? { background: `${brand}14`, color: brand }
                            : { background: "#f1f5f9", color: "#94a3b8" }
                        }
                      >
                        <Ic size={21} />
                      </span>
                      {enabled ? (
                        <span
                          className="rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide"
                          style={{ background: `${brand}14`, color: brand }}
                        >
                          Active
                        </span>
                      ) : (
                        <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-slate-400">
                          Coming soon
                        </span>
                      )}
                    </div>
                    <h3 className="mt-3 text-[15px] font-semibold text-slate-900">{m.name}</h3>
                    <p className="mt-1 text-[13px] leading-snug text-slate-500">{m.description}</p>
                    {enabled && (
                      <span
                        className="mt-3 inline-flex items-center gap-0.5 text-[13px] font-semibold"
                        style={{ color: brand }}
                      >
                        Open <IconChevronRight size={14} />
                      </span>
                    )}
                  </>
                );

                if (enabled && m.href) {
                  return (
                    <Link
                      key={m.key}
                      href={m.href}
                      className="rounded-lg border border-slate-200 bg-white p-5 transition-shadow hover:shadow-md"
                    >
                      {body}
                    </Link>
                  );
                }
                return (
                  <div key={m.key} className="rounded-lg border border-dashed border-slate-200 bg-white/60 p-5">
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
