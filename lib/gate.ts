// Pre-launch access gate. Signs / verifies a short token stored in an httpOnly
// cookie so only people with the team password can reach the app. Uses Web
// Crypto (HMAC-SHA256) so the same code runs in both the Edge proxy and the
// Node route handler.

export const GATE_COOKIE = "lma_gate";

function secret(): string {
  return process.env.GATE_SECRET || process.env.PORTAL_PASSWORD || "lma-dev-secret";
}

const encoder = new TextEncoder();

async function hmacHex(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Create a gate token valid for `days` days. */
export async function signGate(days = 30): Promise<string> {
  const exp = Date.now() + days * 24 * 60 * 60 * 1000;
  const payload = `g.${exp}`;
  const sig = await hmacHex(payload);
  return `${payload}.${sig}`;
}

/** Verify a gate token: correct signature and not expired. */
export async function verifyGate(token?: string | null): Promise<boolean> {
  if (!token) return false;
  const lastDot = token.lastIndexOf(".");
  if (lastDot < 0) return false;
  const payload = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);
  if (!payload.startsWith("g.")) return false;
  const exp = Number(payload.slice(2));
  if (!exp || Date.now() > exp) return false;
  const expected = await hmacHex(payload);
  // Constant-time-ish comparison.
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}
