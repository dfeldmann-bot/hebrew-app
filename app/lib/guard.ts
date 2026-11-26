import { authenticate } from "./auth";

// ── Request guard shared by every /api route ─────────────────────────────
// Rate limit FIRST — so failed-auth attempts are also counted (caps passphrase
// brute-forcing at the per-window limit) — then authenticate(). One map, so
// /api/chat and /api/models share the same per-IP budget.

// ponytail: rate limit resets on cold start / is per-instance; swap for Vercel KV if multi-instance.
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return false;
  }
  if (entry.count >= RATE_LIMIT_MAX) return true;
  entry.count++;
  return false;
}

/** Returns an error Response to send back, or null if the request may proceed. */
export function guard(req: Request): Response | null {
  // Trust only the IP set by the platform edge: x-real-ip (Vercel) or the
  // RIGHTMOST x-forwarded-for entry (the one the trusted proxy appended); the
  // leftmost token is client-spoofable.
  // ponytail: an unknown bucket is shared, which is fine for a single-user app.
  const xff = req.headers.get("x-forwarded-for");
  const ip =
    req.headers.get("x-real-ip")?.trim() ||
    (xff ? xff.split(",").pop()!.trim() : "") ||
    "unknown";
  if (isRateLimited(ip)) return Response.json({ error: "rate_limited" }, { status: 429 });

  // The single seam for adding real accounts later (app/lib/auth.ts)
  const auth = authenticate(req);
  if (!auth.ok) return Response.json({ error: "unauthorized" }, { status: 401 });

  return null;
}
