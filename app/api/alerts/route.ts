import { NextResponse } from "next/server";
import {
  emailConfigured,
  loadAlertSettings,
  saveAlertSettings,
  smsConfigured,
} from "@/lib/notify";
import { companyFromRequest } from "@/lib/company";
import type { AlertSettings } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { settings, persisted } = await loadAlertSettings(await companyFromRequest(request));
  return NextResponse.json({
    settings,
    persisted,
    emailConfigured: emailConfigured(),
    smsConfigured: smsConfigured(),
  });
}

export async function PUT(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { settings?: AlertSettings };
  if (!body.settings) return NextResponse.json({ error: "Invalid settings" }, { status: 400 });
  try {
    await saveAlertSettings(await companyFromRequest(request), {
      emailEnabled: !!body.settings.emailEnabled,
      emails: (body.settings.emails ?? []).map((e) => e.trim()).filter(Boolean),
      smsEnabled: !!body.settings.smsEnabled,
      phones: (body.settings.phones ?? []).map((p) => p.trim()).filter(Boolean),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Save failed" },
      { status: 500 }
    );
  }
}
