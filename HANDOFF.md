# Handoff — Hebrew Story Partner

For the next agent (or me) picking this up cold. Read this, then `PLAN.md`
(the full spec + a "Status & what's left" section at the bottom).

## What this is
A personal, single-user Next.js web app: an AI Hebrew tutor that tells
interactive branching stories at bet-1/bet-2 level. Runtime engine is **free
models with automatic fallback** (Gemini Flash → Groq → OpenRouter). Anthropic/
Claude is the *builder*, never the runtime.

## Current state (2026-06-14)
- Branch `build-app`, pushed to `origin`. **PR not opened** (build env had no
  `gh`/token — open it via the GitHub UI). `main` is just the initial commit.
- Core build complete: secure API route + fallback chain, passphrase gate, rate
  limiting, persistence, model indicator, env/README. **Never run against real
  providers and not deployed.** See `PLAN.md` → "Status & what's left".
- Recent commits on `build-app`: app build → security hardening (rate-limit
  before auth, trusted IP) → auth extracted to a seam.

## Where things live
- `app/HebrewStoryPartner.jsx` — the whole UI (client component). Inline styles,
  a `PALETTE` object, RTL handling, support toggle, tap-to-explain, vocab drawer.
  Persists to `localStorage` (`hsp_vocab`, `hsp_messages`, `hsp_pass`,
  `hsp_auth_error`). Calls `POST /api/chat` with an `x-app-passphrase` header.
- `app/api/chat/route.ts` — the ONLY place provider keys live. Order: rate-limit
  → authenticate → parse/sanitize → fallback chain. Returns `{ text, model }`.
- `app/lib/auth.ts` — `authenticate(req) -> { ok, user }`. **The single seam for
  real accounts later** — replace its body, nothing else changes.
- `app/Gate.jsx` — passphrase gate wrapping the app in `app/page.tsx`.
- `.env.example` — `APP_PASSPHRASE` + three provider keys + optional model
  overrides. Real keys go in `.env.local` (gitignored).
- `PLAN.md` — the approved spec. Don't re-litigate it; it's signed off.

## Run it
```bash
cp .env.example .env.local   # set APP_PASSPHRASE + >=1 provider key
npm install
npm run dev                  # localhost:3000; phone via the printed Network: URL (same wifi)
```
Verify build: `npm run build`. Typecheck: `npx tsc --noEmit`.

## Contracts (don't break these silently)
- `POST /api/chat` — req header `x-app-passphrase`; body `{ support, vocab,
  messages:[{role,content}] }`. Resp `200 {text,model}` / `401` / `429` / `400`
  / `502`. Only HTTP 429 from a provider advances the fallback chain.
- `support` ∈ `"heavy"|"light"|"none"` (must match the keys in
  `buildSystemPrompt` inside the route).
- localStorage keys above are shared between `Gate.jsx` and
  `HebrewStoryPartner.jsx` — keep them in sync.

## House rules (how the owner wants work done)
- **Ponytail / YAGNI:** laziest solution that actually works. No speculative
  abstractions, no deps for a few lines of code, shortest working diff. Mark
  deliberate simplifications with a `ponytail:` comment.
- **Never** put a provider key in client code or a `NEXT_PUBLIC_*`/`VITE_*` var.
  All model calls go through the backend. (Verify: `grep -r` the built
  `.next/static` for endpoints/keys after changes.)
- **Don't simplify away** security, input validation, or the auth boundary.
- **Commit/push only when asked.** Work on `build-app`, not `main`.
- The owner is using the app first to find real tweaks — prefer fixing the
  specific reported annoyance over speculative features.

## Likely next tasks (see PLAN.md for the full list)
1. Get real keys, run locally, confirm current free model IDs.
2. Live-test the fallback chain (Playwright can simulate a 429).
3. Mobile/real-device check.
4. Open the PR; deploy to Vercel.
Deferred until needed: streaming, real accounts (the `authenticate()` seam is
ready), cross-device sync, a11y pass, tests.
