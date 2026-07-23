"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/app/components/portal/AuthProvider";
import BrandLogo from "@/app/components/portal/BrandLogo";
import { MODULE_ICONS, IconGrid, IconSettings, IconLogout } from "@/app/components/icons";
import { MODULES, SECTIONS } from "@/lib/tenant";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const { ready, user, tenant, logout, hasPermission, canSeeSection } = useAuth();
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
  const canSettings =
    user.role === "owner" || hasPermission("settings.branding") || hasPermission("users.manage");

  const navItem = (active: boolean) =>
    `flex items-center gap-2.5 rounded-md px-3 py-2 text-[13.5px] transition-colors ${
      active ? "font-semibold" : "text-slate-600 hover:bg-slate-100"
    }`;
  const navStyle = (active: boolean) =>
    active ? { background: `${brand}14`, color: brand } : undefined;

  return (
    <div className="min-h-full bg-slate-50">
      <div className="mx-auto flex min-h-screen max-w-[1400px]">
        {/* Sidebar (desktop) */}
        <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
          <div className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-4">
            <BrandLogo tenant={tenant} size={32} />
            <div className="min-w-0">
              <div className="truncate text-[13.5px] font-bold text-slate-900">{tenant.name}</div>
              <div className="text-[11px] text-slate-400">Operations Portal</div>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-4">
            <Link href="/portal" className={navItem(pathname === "/portal")} style={navStyle(pathname === "/portal")}>
              <IconGrid size={17} /> Overview
            </Link>

            {SECTIONS.filter(canSeeSection).map((section) => {
              const mods = MODULES.filter((m) => m.section === section);
              return (
                <div key={section} className="mt-5">
                  <p className="px-3 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                    {section}
                  </p>
                  <div className="space-y-0.5">
                    {mods.map((m) => {
                      const enabled = tenant.enabledModules.includes(m.key);
                      const active = !!m.href && pathname.startsWith(m.href);
                      const Ic = MODULE_ICONS[m.icon];
                      const inner = (
                        <>
                          <Ic size={17} />
                          <span className="flex-1">{m.name}</span>
                          {!enabled && (
                            <span className="rounded border border-slate-200 px-1 py-px text-[9.5px] font-semibold uppercase tracking-wide text-slate-400">
                              Soon
                            </span>
                          )}
                        </>
                      );
                      if (enabled && m.href) {
                        return (
                          <Link key={m.key} href={m.href} className={navItem(active)} style={navStyle(active)}>
                            {inner}
                          </Link>
                        );
                      }
                      return (
                        <div key={m.key} className="flex cursor-not-allowed items-center gap-2.5 rounded-md px-3 py-2 text-[13.5px] text-slate-400">
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
                className={navItem(pathname.startsWith("/portal/settings"))}
                style={navStyle(pathname.startsWith("/portal/settings"))}
              >
                <IconSettings size={17} /> Settings
              </Link>
            )}
            <div className="mt-1 flex items-center justify-between rounded-md px-3 py-2">
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold text-slate-800">{user.name}</div>
                <div className="text-[11px] capitalize text-slate-400">{user.role}</div>
              </div>
              <button
                onClick={logout}
                title="Log out"
                className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <IconLogout size={16} />
              </button>
            </div>
          </div>
        </aside>

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
            <div className="flex items-center gap-2">
              <BrandLogo tenant={tenant} size={28} />
              <span className="text-sm font-bold text-slate-900">{tenant.name}</span>
            </div>
            <button onClick={logout} className="text-xs font-semibold text-slate-400">
              Log out
            </button>
          </header>

          <main className="flex-1">{children}</main>
        </div>
      </div>
    </div>
  );
}
