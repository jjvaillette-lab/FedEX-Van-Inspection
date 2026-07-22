"use client";

import type { Tenant } from "@/lib/tenant";

/**
 * Renders a customer's white-label logo. Priority:
 *  1. an uploaded logo (data URL),
 *  2. the seeded Stratford mark (test customer),
 *  3. an initials tile in the customer's theme color (generic fallback).
 */
export default function BrandLogo({ tenant, size = 36 }: { tenant: Tenant; size?: number }) {
  const radius = Math.round(size * 0.26);

  if (tenant.logoDataUri) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={tenant.logoDataUri}
        alt={tenant.name}
        width={size}
        height={size}
        style={{ width: size, height: size, borderRadius: radius, objectFit: "cover" }}
      />
    );
  }

  if (tenant.slug === "stratford") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src="/stratford-mark.svg" alt={tenant.name} width={size} height={size} style={{ width: size, height: size }} />;
  }

  const initials = tenant.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div
      aria-label={tenant.name}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: tenant.themeColor,
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 800,
        fontSize: size * 0.4,
      }}
    >
      {initials}
    </div>
  );
}
