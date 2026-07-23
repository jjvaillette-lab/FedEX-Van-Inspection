import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { GATE_COOKIE, verifyGate } from "@/lib/gate";
import { getSupabase } from "@/lib/supabase";
import { loadAlertSettings, sendEmail } from "@/lib/notify";
import { listInspections } from "@/lib/storage";
import { combinedStops, dailyBonus, DEFAULT_OPS, type OpsSettings } from "@/lib/opstats";

export const runtime = "nodejs";

/**
 * Daily recap email — yesterday's driver stats + inspections, sent to the
 * alert recipient list. Triggered by the Vercel cron (vercel.json) with the
 * CRON_SECRET bearer, or manually by a signed-in team member.
 */

function yesterdayIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function authorized(request: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") === `Bearer ${secret}`) return true;
  const jar = await cookies();
  return verifyGate(jar.get(GATE_COOKIE)?.value);
}

export async function GET(request: Request) {
  if (!(await authorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = getSupabase();
  const y = yesterdayIso();
  const yDisplay = new Date(`${y}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "numeric",
    day: "numeric",
  });

  // Driver stats
  let statsLines: string[] = ["Driver stats: no data imported for yesterday."];
  if (supabase) {
    const { data: settingsRow } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "opstats")
      .maybeSingle();
    const ops: OpsSettings = { ...DEFAULT_OPS, ...((settingsRow?.value as Partial<OpsSettings>) ?? {}) };
    const { data } = await supabase.from("driver_stats").select("*").eq("date", y);
    if (data && data.length > 0) {
      const rows = data.map((r) => ({
        date: r.date as string,
        driver: r.driver as string,
        vehicle: null,
        route: null,
        vscanPkgs: r.vscan_pkgs as number,
        delStops: r.del_stops as number,
        puStops: r.pu_stops as number,
        diff: r.diff as number,
        actDelStops: r.act_del_stops as number,
        actDelPkgs: r.act_del_pkgs as number,
        actPuStops: r.act_pu_stops as number,
        actPuPkgs: r.act_pu_pkgs as number,
        miles: Number(r.miles) || 0,
        onRoadHours: Number(r.on_road_hours) || 0,
        onDutyHours: Number(r.on_duty_hours) || 0,
      }));
      const dispatched = rows.reduce((s, r) => s + r.vscanPkgs, 0);
      const delivered = rows.reduce((s, r) => s + r.actDelPkgs, 0);
      const stops = rows.reduce((s, r) => s + combinedStops(r), 0);
      const bonus = rows.reduce((s, r) => s + dailyBonus(r, ops), 0);
      const pct = dispatched > 0 ? ((delivered / dispatched) * 100).toFixed(1) : "—";
      const top = [...rows].sort((a, b) => combinedStops(b) - combinedStops(a)).slice(0, 3);
      statsLines = [
        `Drivers out: ${rows.length}`,
        `Packages: ${delivered.toLocaleString()} delivered of ${dispatched.toLocaleString()} dispatched (${pct}%)`,
        `Stops completed: ${stops.toLocaleString()}`,
        `Stop bonuses earned: $${bonus.toFixed(2)}`,
        `Top stops: ${top.map((r) => `${r.driver} (${combinedStops(r)})`).join(", ") || "—"}`,
      ];
    }
  }

  // Inspections
  const inspections = await listInspections().catch(() => []);
  const yInspections = inspections.filter(
    (i) => new Date(i.createdAt).toLocaleDateString("en-US") === new Date(`${y}T12:00:00`).toLocaleDateString("en-US")
  );
  const flagged = yInspections.filter((i) => i.status === "flagged").length;
  const incomplete = yInspections.filter((i) => i.status === "failed_inspection").length;
  const inspLines = [
    `Inspections: ${yInspections.length} (${flagged} with issues, ${incomplete} incomplete)`,
  ];

  const text = [
    `Daily recap — ${yDisplay}`,
    "",
    ...statsLines,
    "",
    ...inspLines,
    "",
    "Portal: https://www.lastmileassist.com/portal",
  ].join("\n");

  const { settings } = await loadAlertSettings();
  let sent = false;
  if (settings.emails.length > 0) {
    await sendEmail(settings.emails, `Daily recap — ${yDisplay}`, text);
    sent = true;
  }
  return NextResponse.json({ ok: true, sent, preview: text });
}
