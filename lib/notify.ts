import { getSupabase } from "./supabase";
import { DEFAULT_COMPANY_ID, loadSetting, saveSetting } from "./company";
import type { AlertSettings, Inspection } from "./types";

/**
 * Instant alerts for flagged / incomplete inspections.
 *
 * Recipients live in app_settings (key "alerts") and are managed by the owner
 * in Settings. Email goes out via Resend when RESEND_API_KEY + CONTACT_EMAIL
 * sender config exist; SMS goes out via Twilio when TWILIO_ACCOUNT_SID /
 * TWILIO_AUTH_TOKEN / TWILIO_FROM exist. Missing providers never break an
 * inspection submission — alerts simply skip.
 */

export const DEFAULT_ALERTS: AlertSettings = {
  emailEnabled: false,
  emails: [],
  smsEnabled: false,
  phones: [],
};

export function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}
export function smsConfigured(): boolean {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM);
}

export async function loadAlertSettings(
  companyId: string = DEFAULT_COMPANY_ID
): Promise<{ settings: AlertSettings; persisted: boolean }> {
  const supabase = getSupabase();
  if (!supabase) return { settings: { ...DEFAULT_ALERTS }, persisted: false };
  const { value, persisted } = await loadSetting<Partial<AlertSettings>>(companyId, "alerts");
  return { settings: { ...DEFAULT_ALERTS, ...(value ?? {}) }, persisted };
}

export async function saveAlertSettings(companyId: string, settings: AlertSettings): Promise<void> {
  await saveSetting(companyId, "alerts", settings);
}

export async function sendEmail(to: string[], subject: string, text: string): Promise<void> {
  if (!emailConfigured() || to.length === 0) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.CONTACT_FROM || "Last Mile Assist <onboarding@resend.dev>",
      to,
      subject,
      text,
    }),
  }).catch(() => {});
}

async function sendSms(to: string[], body: string): Promise<void> {
  if (!smsConfigured() || to.length === 0) return;
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
  await Promise.all(
    to.map((phone) =>
      fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          From: process.env.TWILIO_FROM!,
          To: phone,
          Body: body,
        }),
      }).catch(() => {})
    )
  );
}

/** Fire instant alerts for a just-submitted flagged/incomplete inspection. */
export async function notifyInspection(
  i: Inspection,
  companyId: string = DEFAULT_COMPANY_ID
): Promise<void> {
  try {
    const { settings } = await loadAlertSettings(companyId);
    const issues = i.answers.filter((a) => a.value === "issue");
    const trip = i.tripType === "pre" ? "Pre-Trip" : "Post-Trip";
    const statusLabel = i.status === "failed_inspection" ? "INCOMPLETE INSPECTION" : "ISSUES REPORTED";
    const when = new Date(i.createdAt).toLocaleString("en-US");

    const lines = [
      `${statusLabel} — ${i.vanId}`,
      `Driver: ${i.driver.name ?? i.driver.raw}${i.driver.route ? ` · Route ${i.driver.route}` : ""}`,
      `${trip} · ${when}`,
      "",
      ...(issues.length > 0
        ? ["Reported issues:", ...issues.map((a) => `• ${a.questionId.replace(/_/g, " ")}${a.note ? ` — ${a.note}` : ""}`)]
        : i.status === "failed_inspection"
          ? ["The inspection was not completed. Partial answers and photos were recorded."]
          : []),
      "",
      "Review: https://www.lastmileassist.com/portal/fleet/inspections",
    ];
    const text = lines.join("\n");

    const jobs: Promise<void>[] = [];
    if (settings.emailEnabled) {
      jobs.push(sendEmail(settings.emails, `⚠ ${i.vanId}: ${statusLabel.toLowerCase()} (${trip})`, text));
    }
    if (settings.smsEnabled) {
      const sms = `LMA alert — ${statusLabel}: ${i.vanId}, ${i.driver.name ?? i.driver.raw}, ${trip}. ${issues.length} issue(s). Check the portal.`;
      jobs.push(sendSms(settings.phones, sms));
    }
    await Promise.all(jobs);
  } catch {
    /* alerts must never break a submission */
  }
}
