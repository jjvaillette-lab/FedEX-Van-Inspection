"use client";

import Link from "next/link";
import { useAuth } from "@/app/components/portal/AuthProvider";
import {
  IconChart,
  IconChevronRight,
  IconFile,
  IconPhone,
  IconQr,
  IconWrench,
} from "@/app/components/icons";

export default function FleetInspectionModule() {
  const { tenant, hasPermission, user } = useAuth();
  const brand = tenant.themeColor;
  const isOwner = user?.role === "owner";

  const actions = [
    {
      title: "Add DVIR to Device",
      desc: "Set up a driver phone: QR code, install steps, and the Van Check home-screen app.",
      href: "/portal/fleet/device",
      icon: IconPhone,
      show: isOwner || hasPermission("inspection.edit_questions"),
    },
    {
      title: "Inspection Review",
      desc: "History by date, van, or driver — issues, photo evidence, resolutions, exports.",
      href: "/portal/fleet/inspections",
      icon: IconChart,
      show: hasPermission("inspection.review"),
    },
    {
      title: "Maintenance & Costs",
      desc: "Log repairs by van — mileage, cost, receipts — and see what each vehicle costs you.",
      href: "/portal/fleet/maintenance",
      icon: IconWrench,
      show: isOwner || hasPermission("fleet.maintenance"),
    },
    {
      title: "Inspection Checklist",
      desc: "Edit, hide, reorder, or add questions; DOT / Non-DOT mode; interior photos.",
      href: "/portal/fleet/questions",
      icon: IconFile,
      show: isOwner || hasPermission("inspection.edit_questions"),
    },
    {
      title: "Van QR Generator",
      desc: "Create and print a scannable QR code for each van (one-time setup).",
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

      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        {actions.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="rounded-lg border border-slate-200 bg-white p-5 transition-shadow hover:shadow-md"
          >
            <span
              className="flex h-10 w-10 items-center justify-center rounded-lg"
              style={{ background: `${brand}14`, color: brand }}
            >
              <a.icon size={21} />
            </span>
            <h3 className="mt-3 text-[15px] font-semibold text-slate-900">{a.title}</h3>
            <p className="mt-1 text-[13px] leading-snug text-slate-500">{a.desc}</p>
            <span
              className="mt-3 inline-flex items-center gap-0.5 text-[13px] font-semibold"
              style={{ color: brand }}
            >
              Open <IconChevronRight size={14} />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
