"use client";

import Link from "next/link";
import { useAuth } from "@/app/components/portal/AuthProvider";
import {
  IconChart,
  IconChevronRight,
  IconFile,
  IconPhone,
  IconQr,
} from "@/app/components/icons";

export default function FleetInspectionModule() {
  const { tenant, hasPermission, user } = useAuth();
  const brand = tenant.themeColor;
  const isOwner = user?.role === "owner";

  // The daily-use screens, front and center.
  const primary = [
    {
      title: "Inspection Review",
      desc: "History by date, van, or driver — issues, photo evidence, resolutions, exports.",
      href: "/portal/fleet/inspections",
      icon: IconChart,
      show: hasPermission("inspection.review"),
    },
    {
      title: "Inspection Checklist",
      desc: "Edit, hide, reorder, or add questions; DOT / Non-DOT mode; interior photos.",
      href: "/portal/fleet/questions",
      icon: IconFile,
      show: isOwner || hasPermission("inspection.edit_questions"),
    },
  ].filter((a) => a.show);

  // One-time / occasional setup, tucked below.
  const setup = [
    {
      title: "Add DVIR to Device",
      desc: "Set up a driver phone with the DVIR home-screen app.",
      href: "/portal/fleet/device",
      icon: IconPhone,
      show: isOwner || hasPermission("inspection.edit_questions"),
    },
    {
      title: "Van QR Generator",
      desc: "Print a scannable QR code for each van.",
      href: "/vans",
      icon: IconQr,
      show: isOwner || hasPermission("inspection.edit_questions"),
    },
  ].filter((a) => a.show);

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 md:px-8 md:py-10">
      <nav className="mb-1 flex items-center gap-2 text-sm text-slate-400">
        <Link href="/portal" className="hover:text-slate-600">Portal</Link>
        <span>/</span>
        <span className="text-slate-500">Fleet</span>
      </nav>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Vehicle Inspections</h1>
      <p className="mt-0.5 text-sm text-slate-500">
        Pre &amp; post-trip safety checks for {tenant.name}.
      </p>

      <div className="mt-7 grid gap-4 sm:grid-cols-2">
        {primary.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="rounded-xl border border-slate-200 bg-white p-6 transition-shadow hover:shadow-md"
          >
            <span
              className="flex h-12 w-12 items-center justify-center rounded-xl"
              style={{ background: `${brand}14`, color: brand }}
            >
              <a.icon size={26} />
            </span>
            <h3 className="mt-4 text-lg font-bold text-slate-900">{a.title}</h3>
            <p className="mt-1 text-[13.5px] leading-snug text-slate-500">{a.desc}</p>
            <span
              className="mt-4 inline-flex items-center gap-0.5 text-sm font-semibold"
              style={{ color: brand }}
            >
              Open <IconChevronRight size={15} />
            </span>
          </Link>
        ))}
      </div>

      {setup.length > 0 && (
        <>
          <p className="mt-10 mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
            One-time setup
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {setup.map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 transition-colors hover:bg-slate-50"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500">
                  <a.icon size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-semibold text-slate-700">{a.title}</span>
                  <span className="block truncate text-[11.5px] text-slate-400">{a.desc}</span>
                </span>
                <IconChevronRight size={14} className="shrink-0 text-slate-300" />
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
