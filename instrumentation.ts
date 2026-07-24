import type { Instrumentation } from "next";

/**
 * Server error monitoring. Every uncaught server error is written to the
 * platform_errors table (shown in the Admin console) and emailed to platform
 * admins — throttled so an error storm sends one email per issue per hour,
 * not thousands. Must never throw: monitoring can't be a second outage.
 */

const emailedAt = new Map<string, number>();
const EMAIL_THROTTLE_MS = 60 * 60 * 1000;

export const onRequestError: Instrumentation.onRequestError = async (err, request) => {
  try {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? (err.stack ?? null) : null;

    const url = process.env.SUPABASE_URL?.trim();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!url || !key) return;

    // Direct REST insert — instrumentation also runs where the supabase-js
    // client may not be initialized.
    await fetch(`${url}/rest/v1/platform_errors`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        source: "server",
        message: message.slice(0, 2000),
        url: `${request.method} ${request.path}`.slice(0, 500),
        stack: stack?.slice(0, 4000) ?? null,
      }),
    }).catch(() => {});

    // Throttled alert email to platform admins.
    const throttleKey = message.slice(0, 120);
    const last = emailedAt.get(throttleKey) ?? 0;
    if (Date.now() - last < EMAIL_THROTTLE_MS) return;
    emailedAt.set(throttleKey, Date.now());

    const resendKey = process.env.RESEND_API_KEY;
    const to = process.env.CONTACT_EMAIL;
    if (!resendKey || !to) return;
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.CONTACT_FROM || "Last Mile Assist <onboarding@resend.dev>",
        to: [to],
        subject: `🔺 LMA server error: ${message.slice(0, 80)}`,
        text: [
          `A server error was captured on ${request.method} ${request.path}`,
          "",
          message,
          "",
          stack ? stack.slice(0, 1500) : "(no stack)",
          "",
          "Recent errors: https://www.lastmileassist.com/portal/admin",
        ].join("\n"),
      }),
    }).catch(() => {});
  } catch {
    /* never let monitoring break anything */
  }
};
