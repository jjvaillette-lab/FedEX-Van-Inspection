"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/app/components/portal/AuthProvider";
import BrandLogo from "@/app/components/portal/BrandLogo";
import { MODULES, SECTIONS } from "@/lib/tenant";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const { ready, user, tenant, logout, hasPermission } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (ready && !user) router.replace("/login");
  }, [ready, user, router]);

  if (!ready || !user) {
    return (
      <div className="flex min-h-full items-center justify-center bg-slate-100 text-slate-400">
        Loading…
      </div>
    );
  }

  const brand = tenant.themeColor;
  const canSettings = hasPermission("settings.branding") || hasPermission("users.manage") || user.role === "owner";

  return (
    <div className="min-h-full bg-slate-100" style={{ ["--brand" as string]: brand }}>
      <div className="mx-auto flex min-h-full max-w-7xl">
        {/* Sidebar (desktop) */}
        <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
          <div className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-4">
            <BrandLogo tenant={tenant} size={34} />
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-slate-900">{tenant.name}</div>
              <div className="text-xs text-slate-400">Operations Portal</div>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-4">
            <Link
              href="/portal"
              className={`mb-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${
                pathname === "/portal" ? "text-white" : "text-slate-600 hover:bg-slate-50"
              }`}
              style={pathname === "/portal" ? { background: brand } : undefined}
            >
              <span>▦</span> Overview
            </Link>

            {SECTIONS.map((section) => {
              const mods = MODULES.filter((m) => m.section === section);
              return (
                <div key={section} className="mb-4">
                  <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    {section}
                  </p>
                  <div className="space-y-0.5">
                    {mods.map((m) => {
                      const enabled = tenant.enabledModules.includes(m.key);
                      const active = m.href && pathname.startsWith(m.href);
                      const inner = (
                        <span className="flex items-center gap-2.5">
                          <span className="text-base">{m.icon}</span>
                          <span className="flex-1">{m.name}</span>
                          {!enabled && (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-400">
                              Soon
                            </span>
                          )}
                        </span>
                      );
                      if (enabled && m.href) {
                        return (
                          <Link
                            key={m.key}
                            href={m.href}
                            className={`block rounded-lg px-3 py-2 text-sm ${
                              active ? "font-semibold text-white" : "text-slate-700 hover:bg-slate-50"
                            }`}
                            style={active ? { background: brand } : undefined}
                          >
                            {inner}
                          </Link>
                        );
                      }
                      return (
                        <div key={m.key} className="block cursor-not-allowed rounded-lg px-3 py-2 text-sm text-slate-400">
                          {inner}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>

          <div className="border-t border-slate-100 p-3">
            {canSettings && (
              <Link
                href="/portal/settings"
                className={`mb-1 block rounded-lg px-3 py-2 text-sm ${
                  pathname.startsWith("/portal/settings") ? "font-semibold text-white" : "text-slate-600 hover:bg-slate-50"
                }`}
                style={pathname.startsWith("/portal/settings") ? { background: brand } : undefined}
              >
                ⚙︎ Settings
              </Link>
            )}
            <div className="flex items-center justify-between rounded-lg px-3 py-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-800">{user.name}</div>
                <div className="text-xs capitalize text-slate-400">{user.role}</div>
              </div>
              <button onClick={logout} className="text-xs font-semibold text-slate-400 hover:text-slate-700">
                Log out
              </button>
            </div>
          </div>
        </aside>

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Mobile top bar */}
          <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
            <div className="flex items-center gap-2">
              <BrandLogo tenant={tenant} size={30} />
              <span className="text-sm font-bold text-slate-900">{tenant.name}</span>
            </div>
            <button onClick={logout} className="text-xs font-semibold text-slate-400">Log out</button>
          </header>

          <main className="flex-1">{children}</main>
        </div>
      </div>
    </div>
  );
}
