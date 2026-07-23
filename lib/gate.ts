// Pre-launch access gate. Signs / verifies a short token stored in an httpOnly
// cookie so only people with the team password can reach the app. Uses Web
// Crypto (HMAC-SHA256) so the same code runs in both the Edge proxy and the
// Node route handler.

export const GATE_COOKIE = "lma_gate";
/** Driver-device cookie: grants access ONLY to the inspection surface. */
export const DRIVER_COOKIE = "lma_driver";
/** Real user session cookie (Supabase Auth account): "u.{userId}.{exp}.{sig}". */
export const USER_COOKIE = "lma_user";

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

async function signToken(prefix: string, days: number): Promise<string> {
  const exp = Date.now() + days * 24 * 60 * 60 * 1000;
  const payload = `${prefix}.${exp}`;
  const sig = await hmacHex(payload);
  return `${payload}.${sig}`;
}

async function verifyToken(prefix: string, token?: string | null): Promise<boolean> {
  if (!token) return false;
  const lastDot = token.lastIndexOf(".");
  if (lastDot < 0) return false;
  const payload = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);
  if (!payload.startsWith(`${prefix}.`)) return false;
  const exp = Number(payload.slice(prefix.length + 1));
  if (!exp || Date.now() > exp) return false;
  const expected = await hmacHex(payload);
  // Constant-time-ish comparison.
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

/** Team (owner/manager) session — full access behind the gate. */
export const signGate = (days = 30) => signToken("g", days);
export const verifyGate = (token?: string | null) => verifyToken("g", token);

/** Driver-device session — inspection surface only, long-lived. */
export const signDriver = (days = 365) => signToken("d", days);
export const verifyDriver = async (token?: string | null) =>
  (await verifyDriverCompany(token)) !== null;

/* ---- company-aware tokens (multi-tenant) ---- */

/** Driver-device token bound to a company: "d.{companyId}.{exp}.{sig}". */
export async function signDriverFor(companyId: string, days = 365): Promise<string> {
  const exp = Date.now() + days * 24 * 60 * 60 * 1000;
  const payload = `d.${companyId}.${exp}`;
  return `${payload}.${await hmacHex(payload)}`;
}

/**
 * Verify a driver token and return which company it belongs to.
 * Legacy tokens ("d.{exp}.{sig}", minted before multi-tenant) map to the
 * original single tenant so existing activated phones keep working.
 */
export async function verifyDriverCompany(token?: string | null): Promise<string | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts[0] !== "d" || (parts.length !== 3 && parts.length !== 4)) return null;
  const sig = parts[parts.length - 1];
  const payload = parts.slice(0, -1).join(".");
  const exp = Number(parts[parts.length - 2]);
  if (!exp || Date.now() > exp) return null;
  if (!(await sigMatches(payload, sig))) return null;
  return parts.length === 4 ? parts[1] : "stratford";
}

/** Real user session: "u.{userId}.{exp}.{sig}" — returns the user id. */
export async function signUser(userId: string, days = 30): Promise<string> {
  const exp = Date.now() + days * 24 * 60 * 60 * 1000;
  const payload = `u.${userId}.${exp}`;
  return `${payload}.${await hmacHex(payload)}`;
}

export async function verifyUser(token?: string | null): Promise<string | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== "u") return null;
  const [, userId, expStr, sig] = parts;
  const exp = Number(expStr);
  if (!userId || !exp || Date.now() > exp) return null;
  if (!(await sigMatches(`u.${userId}.${expStr}`, sig))) return null;
  return userId;
}

async function sigMatches(payload: string, sig: string): Promise<boolean> {
  const expected = await hmacHex(payload);
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}
