import { createHash, timingSafeEqual } from "crypto";

// ── Authentication boundary ──────────────────────────────────────────────
// The single seam for auth. Today it's one shared passphrase (single-user).
// To publish with real accounts, replace the BODY of authenticate() — verify a
// session cookie / JWT / OAuth token and return that user's id. Callers only
// depend on the { ok, user } shape, so the route and rate limiter don't change.
// The browser currently sends its credential via the `x-app-passphrase` header
// (see app/Gate.jsx); swap that for a login flow + cookie when you add accounts.
export type Auth = { ok: true; user: string } | { ok: false; user: null };

export function authenticate(req: Request): Auth {
  const expected = process.env.APP_PASSPHRASE;
  if (!expected) return { ok: false, user: null };

  const given = req.headers.get("x-app-passphrase") ?? "";
  // SHA-256 both sides to a fixed length, then constant-time compare.
  const a = Buffer.from(createHash("sha256").update(expected).digest("hex"));
  const b = Buffer.from(createHash("sha256").update(given).digest("hex"));
  if (!timingSafeEqual(a, b)) return { ok: false, user: null };

  return { ok: true, user: "owner" };
}
