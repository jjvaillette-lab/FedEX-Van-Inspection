"use client";

import Link from "next/link";
import { useAuth } from "@/app/components/portal/AuthProvider";

export default function FleetInspectionModule() {
  const { tenant, hasPermission, user } = useAuth();
  const brand = tenant.themeColor;
  const isOwner = user?.role === "owner";

  const actions = [
    {
      title: "Start Van Check",
      desc: "Run a pre or post-trip inspection: scan driver, scan van, checklist, photos.",
      href: "/inspection",
      icon: "📋",
      show: true,
    },
    {
      title: "Inspection Dashboard",
      desc: "Review completed inspections, flagged vans, and photo evidence.",
      href: "/dashboard",
      icon: "🗂️",
      show: hasPermission("inspection.review"),
    },
    {
      title: "Van QR Generator",
      desc: "Create and print a scannable QR code for each van (one-time setup).",
      href: "/vans",
      icon: "🔳",
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
      <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-900 md:text-3xl">
        <span>🚐</span> Vehicle Inspections
      </h1>
      <p className="mt-1 text-slate-500">DOT pre &amp; post-trip safety checks for {tenant.name}.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {actions.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="rounded-2xl border border-slate-200 bg-white p-6 transition hover:shadow-md"
          >
            <div className="text-3xl">{a.icon}</div>
            <h3 className="mt-3 text-lg font-bold text-slate-900">{a.title}</h3>
            <p className="mt-1 text-sm text-slate-500">{a.desc}</p>
            <span className="mt-3 inline-block text-sm font-semibold" style={{ color: brand }}>
              Open →
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
