# Hebrew Story Partner → Real App: Build Plan for Claude Code

_Updated: free-model runtime (Gemini Flash → Groq → OpenRouter fallback) + Google Cloud option + recommended Claude Code skills (Superpowers, frontend-design, security-auditor, Playwright)._

_A spec for turning the `hebrew-story-partner.jsx` artifact into a secure, deployed
web app. Hand this whole file to Claude Code as the brief._

> **Build vs. runtime — the cost split:** Claude (Claude Code) is the **builder** — it
> writes, debugs, and deploys this app. The deployed app's **runtime engine is a free
> model** (Gemini Flash, with automatic fallback — see the Model section). So the only
> AI cost is the one-time build; running the app is free.

---

## Recommended Claude Code skills/plugins for this build

Install these before/during the build. They compose cleanly and don't overlap — one for
process, one for UI, one for security, one for testing. (All are free. The frontend-design
and Playwright plugins are official Anthropic; Superpowers and the auditor are third-party
but MIT-licensed and in the official marketplace. Trust note: the marketplace is open, so
prefer official or well-starred sources and glance at the source before installing community
plugins.)

### 1. Superpowers — the process/discipline layer
`/plugin install superpowers@claude-plugins-official` (install globally / user-level).
Enforces a disciplined clarify→design→plan→code→verify workflow with subagent-driven
development, built-in code review, systematic debugging, and red/green TDD. This is what
makes an AI-built app actually *sound* rather than plausible — the self-review + TDD loops
guard against subtle bugs like a leaked key or a fallback path that doesn't fail safe.

> ⚠️ **IMPORTANT — skip the re-speccing phase.** This plan file IS the approved spec and
> design. Do NOT re-run the full clarify/brainstorm/design interview from scratch. Treat
> this document as the signed-off spec and jump to the **implementation-plan → code →
> verify** phases. Use Superpowers' discipline (TDD, self-review, YAGNI/DRY) on the build,
> not on re-deriving requirements I've already decided.

### 2. frontend-design (official Anthropic) — the aesthetics layer
Preserves and elevates the existing distinctive look (warm parchment palette, RTL Hebrew
typography) instead of flattening it into a generic AI chat UI during the port. Activates
automatically when building components/pages.

### 3. A security-auditor skill — the verification layer
Systematically checks the things that matter most here: that none of the three API keys
reach the frontend, that the passphrase gate and rate limiting actually work, and that the
fallback path fails safe. Complements Superpowers (process) by auditing the *result*. An
"AI Shipping Kit"-style auditor (intended-vs-implemented security gaps) is an especially apt
fit since this is an AI-built app.

### 4. Playwright (official Anthropic) — the testing layer
Gives Claude real browser control to verify flows on the running app: confirm the passphrase
gate blocks without the password, confirm vocab/story persistence, and **simulate a Gemini
rate-limit to confirm it falls back to Groq and the model indicator updates.** Use at the
testing phase before deploy.

### Optional / conditional
- **accessibility-auditor** (community) — good fit because Hebrew/RTL is where a11y bugs
  hide (focus order, labels, contrast). Add if you want correctness; skip to stay minimal.
- **A Cloud Run / GCP deployment skill** — ONLY if you choose the Google Cloud deploy option
  (Option 4). Handles Dockerfile, IAM, Secret Manager wiring. Not needed for Vercel.

### Deliberately NOT recommended
- The giant 150–300-skill mega-packs: noise, more trust surface, and context bloat for a
  small personal app. Four focused skills beat thirty.
- A component-library skill (shadcn/ui etc.): would risk homogenizing the hand-styled UI
  that gives this app its character.

---

## What we're building

A personal web app version of an existing React artifact: a live, AI-powered Hebrew
interactive-story tutor for a single bet-level learner (me). The artifact already exists
and works — this project is about making it a **standalone, secure, deployable app**, not
redesigning the experience.

**Existing features to preserve exactly:**
- Live conversation in Hebrew telling interactive stories with branching choices at
  bet-1/bet-2 level. (The artifact prototyped this against the Anthropic API; the shipped
  app uses a free model instead — see the Model section. The *experience* is identical.)
- A Hebrew/English support toggle (three levels: full English, light glosses, Hebrew-only).
- Tap-any-Hebrew-word-to-explain.
- A user vocabulary list that gets woven into the stories.
- Warm, patient tutor persona that gently corrects shaky Hebrew.

**New capabilities this app should add:**
- Sessions and vocab that **persist** (the artifact resets each time — fix that).
- Proper secret handling so the API key is never exposed.
- Deployable to a URL I can open on my phone or laptop.

---

## ⛔ The non-negotiable security rule

**The Anthropic API key must NEVER reach the browser.** The current artifact calls
`api.anthropic.com` directly from client code — that's fine inside Claude's sandbox but
unacceptable in a shipped app, because anyone could open dev tools and steal the key.

Every option below routes AI calls through a **backend/serverless function** that:
1. Holds the API key in a server-side environment variable (never in frontend code, never
   committed to git).
2. Receives the conversation from the frontend, adds the key, calls Anthropic, returns the
   response.
3. Is the only thing that can see the key.

This is the single most important requirement. If Claude Code proposes any design where the
key is in client-side code or a public env var (e.g. anything prefixed `VITE_`, `NEXT_PUBLIC_`,
`REACT_APP_`), reject it.

---

## Security & soundness checklist (applies to every option)

- [ ] **All three provider API keys** (Google AI Studio, Groq, OpenRouter) in server-side
      env vars only; `.env` in `.gitignore`; never logged.
- [ ] All model calls go through the backend, not the browser.
- [ ] **Rate limiting** on the backend route (per-IP or per-session) so a leaked URL can't
      run up a huge bill. Cap requests/minute and ideally a daily ceiling.
- [ ] **Access control** since this is personal: at minimum a shared passphrase / single-user
      auth, so the public URL isn't an open API proxy for the world.
- [ ] **Input limits**: cap message length and conversation history size sent to the API
      (protects cost and latency).
- [ ] **Output safety**: the system prompt already constrains the model to tutoring; keep it
      server-side so it can't be tampered with from the client.
- [ ] **CORS** locked to the app's own origin on the backend route.
- [ ] **No secrets in the repo**: provide a `.env.example` with blank placeholders.
- [ ] **HTTPS only** (all recommended hosts do this automatically).
- [ ] Dependencies pinned; run `npm audit` and fix high-severity issues.
- [ ] Graceful error handling: network/timeout/rate-limit errors show a friendly Hebrew+English
      message, never a raw stack trace or key.

---

## Architecture options

Four paths, simplest to most capable. My situation: I want **low cost, low friction, secure,
and it's basically single-user (me, maybe my girlfriend later).** Recommendation: **Option 1
(Vercel)** for fastest launch, or **Option 4 (Google Cloud)** if I want everything under one
Google roof.

### Option 1 — Next.js on Vercel  ⭐ recommended
**Shape:** One Next.js app. The React UI is the frontend; an API route
(`/app/api/chat/route.ts`) is the backend that holds the key and calls Anthropic. Deploy to
Vercel (free Hobby tier).

**Why it fits me:**
- Frontend + backend in one repo, one deploy, one mental model.
- Vercel injects the API key as a server-side env var — exactly the security model required.
- Free tier easily covers single-user use; scales if ever needed.
- Streaming responses are well-supported (story text can stream in like a chat).
- Easiest path to a clean phone-friendly URL.

**Cost:** Vercel free tier + Anthropic API usage (pennies at this volume).

**Tradeoffs:** Ties me to Vercel's conventions, but they're standard and well-documented.

---

### Option 2 — Vite (React) + a small serverless function
**Shape:** Keep the existing Vite/React artifact almost as-is for the frontend, add a single
serverless function (Vercel Functions, Netlify Functions, or Cloudflare Workers) for the
secure Anthropic proxy. Deploy frontend as static, function alongside.

**Why it might fit:**
- Least change to the existing artifact code — fastest lift-and-shift.
- Frontend is just static files; cheap and simple to host anywhere.

**Cost:** Static hosting (free) + serverless function (free tier) + API usage.

**Tradeoffs:** Two things to wire together (static site + function) and configure CORS
between them. Slightly more moving parts than Option 1's single app.

---

### Option 3 — React frontend + dedicated backend (Express/Hono/FastAPI)
**Shape:** A separate backend server (Node with Express or Hono, or Python with FastAPI)
that owns the key, does auth, rate limiting, and (optionally) a real database for persistence.
React frontend talks to it.

**Why it might fit:**
- Most control and the most room to grow (real DB, multiple users, accounts, analytics).
- Cleanest if this ever becomes more than a personal tool.

**Cost:** Needs a host that runs a persistent server (Railway, Render, Fly.io — small monthly
cost or limited free tier) + API usage.

**Tradeoffs:** Overkill for single-user right now. More to deploy, secure, and maintain.
Only worth it if I explicitly want multi-user or heavy persistence later.

---

### Option 4 — Google Cloud (Cloud Run + Secret Manager)
**Shape:** Frontend (Next.js or static React) and the secure model-proxy backend deployed to
**Cloud Run**; the three free API keys stored in **Secret Manager**; optionally **Vertex AI
Memory Bank** for persistent vocab/story history across devices.

**Why it might fit:**
- Claude Code has strong, current **Cloud Run / GCP deployment skills** that handle the fiddly
  parts (Dockerfile, IAM, Secret Manager wiring, cold-start tuning).
- If you're already drawn to Google, this keeps everything in one ecosystem — and since the
  app's primary model (Gemini) is also Google, model + hosting + secrets sit under one account
  and one (near-zero) bill.
- Generous always-free tiers on Cloud Run and Firestore.

**Cost:** Cloud Run free tier + free model tiers + Secret Manager (negligible).

**Tradeoffs:** More setup than Vercel — you own a GCP project, billing (card required even on
free tier), and IAM. The Claude Code skills make this *viable and clean*, but not *simpler than
Vercel*, which barely needs deployment expertise at all. Choose this as a deliberate "I want to
be in Google Cloud" decision, not for raw speed-to-launch.

---

**Quick steer:** Options 1 (Vercel) and 4 (Google Cloud) are the two strongest. Pick **Vercel**
for the absolute fastest secure launch with least to maintain; pick **Google Cloud** if you
want everything (model, hosting, secrets) under one Google roof and don't mind a bit more setup.
Either way the free-model fallback chain and all security rules are identical.

---

## Persistence (fixing the "resets every session" problem)

Match the store to the option:

- **Simplest (good for Option 1 & 2):** persist vocab list and last session to the browser's
  **localStorage**. Zero backend, instant, private to my device. Downside: not synced across
  devices. For a personal tool this is often enough.
- **Synced (any option):** a lightweight hosted store — Vercel KV, Cloudflare KV, or a free
  Postgres/SQLite (Neon, Turso). Needed only if I want my vocab on both phone and laptop.
- **Full DB (Option 3):** Postgres/SQLite via the backend if accounts/multi-user ever happen.

**Recommendation:** start with localStorage for vocab + a "resume last story" feature. Add a
synced store only if cross-device becomes a real need.

---

## Suggested build order for Claude Code

1. **Scaffold** the chosen stack (Option 1: `create-next-app`, TypeScript, app router).
2. **Port the UI** from `hebrew-story-partner.jsx` — keep the design, fonts, palette, RTL
   handling, support toggle, tap-to-explain, vocab drawer.
3. **Build the secure `/api/chat` route** with the **fallback chain**: reads the three
   provider keys from server env, holds the model-agnostic system prompt server-side, and
   implements `callModel(tier, messages)` for Gemini → Groq → OpenRouter. Advances tiers
   only on rate-limit errors; streams the reply back. Tracks and returns which model
   answered so the frontend can show the indicator.
4. **Repoint the frontend** to call `/api/chat` instead of any model API directly. Remove all
   direct model calls and any key from frontend code. **Add the small active-model indicator**
   (Gemini / Groq / OpenRouter) driven by what the backend reports.
5. **Add the security layer**: rate limiting, single-user passphrase auth, input/length caps,
   CORS lockdown, friendly error states.
6. **Add persistence**: localStorage for vocab list + resume-last-session.
7. **Env hygiene**: `.env.local` (gitignored) + `.env.example` with blanks. Document setup.
8. **Test**: verify no key (of the three) appears in any network request or bundle (dev tools
   → Network, and the built JS). Verify rate limit and auth actually block. **Verify the
   fallback chain** by simulating a 429 from Gemini and confirming it switches to Groq and the
   indicator updates. Run `npm audit`.
9. **Deploy** to Vercel; set the API key in the Vercel dashboard env vars; confirm HTTPS URL
   works on phone.
10. **README**: how to run locally, how to deploy, where the key goes, how the security model
    works.

---

## Things to tell Claude Code explicitly

- "This is a **single-user personal app**; prefer the simplest secure design over enterprise
  patterns."
- "The app's runtime engine is **free models only** — **Gemini Flash primary**, falling back
  to **Groq** then **OpenRouter** on rate-limit errors. Claude/Anthropic is NOT the runtime
  engine; it's only the tool building this."
- "**All three API keys stay server-side**; the frontend must never contain a key or call any
  model API directly. Verify this in the final build."
- "Implement the **fallback chain** so a rate-limit on one model silently advances to the next;
  non-rate-limit errors should surface, not trigger failover."
- "Show a **small active-model indicator** so I always know which model is answering."
- "Preserve the **Hebrew/RTL rendering, the support-level toggle, tap-to-explain, and the vocab
  weaving** from the source artifact."
- "Keep one **model-agnostic system prompt on the backend.**"
- "Use **streaming** so story text appears progressively."
- "Add **rate limiting and a simple passphrase gate** so a leaked URL can't be abused."
- "Give me a **`.env.example`** with all three blank key placeholders and a clear README; never
  commit real secrets."
- "Confirm **current model IDs, API formats, and free-tier limits** from each provider's docs
  before coding — don't trust strings in the plan."
- "Use the **Superpowers** workflow for discipline (TDD, self-review), but **treat this plan as
  the already-approved spec** — skip the clarify/design re-interview and go straight to the
  implementation-plan → code → verify phases."

---

## Model: free engine with automatic fallback

The deployed app runs on **free model tiers**, never a paid API. The backend implements a
**fallback chain** — if the primary model returns a rate-limit error, the backend
automatically retries the same request on the next model down the chain, with no
interruption to the user.

### The chain (in order)
1. **Primary — Google Gemini Flash** (via Google AI Studio).
   - Best Hebrew quality of the free options; handles RTL and nuance well.
   - ~1,500 requests/day free, 1M-token context, no credit card, no expiry.
   - This is the default for every request. At single-user volume the daily cap is never
     a real constraint — fallback exists for safety, not because we expect to hit it.
2. **Fallback 1 — Groq (Llama 3.3 70B versatile).**
   - Triggers only on a Gemini rate-limit (HTTP 429).
   - Very fast, separate free quota, no card. Hebrew is weaker than Gemini but acceptable
     as a temporary backup.
3. **Fallback 2 — OpenRouter (a free model slot).**
   - Last resort if both above are rate-limited.
   - One key, multiple free models behind an OpenAI-compatible API — flexible safety net.

### Fallback logic (be precise, Claude Code)
- Try the current tier. **Only an HTTP 429 / explicit rate-limit/quota error advances to the
  next tier.** Other errors (400 bad request, network/timeout, malformed response) must NOT
  trigger silent failover — surface them, so real bugs aren't masked by quietly switching
  models.
- Walk down the chain until one succeeds. If ALL tiers fail, return a friendly
  Hebrew+English error ("הסיפור נחתך לרגע — נסה שוב / The story paused — try again"), never
  a raw error or any key.
- Each provider has its own API key, all stored **server-side only** (same security rule as
  everything else). Three free keys: Google AI Studio, Groq, OpenRouter.
- Keep the **system prompt model-agnostic** and on the backend. It carries over near-verbatim
  from the artifact (tutor persona, bet-level constraints, story-with-choices format). Minor
  per-model tuning is fine, but one prompt should drive all three.
- Note the three providers speak slightly different API dialects (Gemini's format, Groq's
  OpenAI-compatible format, OpenRouter's OpenAI-compatible format). Abstract this behind one
  internal `callModel(tier, messages)` function so the chain logic stays clean.

### Transparency requirement (important for a learning app)
The user MUST be able to tell which model is currently answering, because Hebrew quality
differs between tiers and a learner needs to know how much to trust the output.
- Show a **small, unobtrusive indicator** of the active model (e.g. a tiny labelled dot:
  "Gemini" / "Groq" / "OpenRouter") somewhere quiet in the UI.
- The switch itself is still automatic and seamless — the story never stops — but the
  indicator updates so the user knows they're on a backup.
- Default state shows Gemini; it only changes when a fallback is in use.

### Keys to obtain (all free, no card)
- **Google AI Studio** key → ai.google.dev (primary).
- **Groq** key → console.groq.com (fallback 1).
- **OpenRouter** key → openrouter.ai (fallback 2).
Provide all three as server-side env vars with blank placeholders in `.env.example`.

### Confirm at build time
Model names, free-tier limits, and API formats change. Before building, Claude Code should
confirm the **current** model IDs and request formats from each provider's official docs
rather than hardcoding any string from this document — and confirm current free limits, since
providers adjusted quotas through 2025–2026.

---

## What success looks like

- I open a URL on my phone, pass a simple gate, and chat with my Hebrew story tutor.
- The app runs on **free models** — Gemini Flash by default, silently falling back to Groq then
  OpenRouter if rate-limited — so it costs me **nothing to run**, and a small indicator tells me
  which model is active.
- My vocab list and last story are still there when I come back.
- Opening dev tools reveals **no API key** (none of the three) anywhere.
- A friend opening the URL without the passphrase can't use it (and can't burn my free quotas).
- I can hand the repo back to Claude Code later to add features (audio/TTS, spaced-repetition
  export to Anki, multi-device sync) without re-architecting.

---

## Status & what's left (branch: `build-app`)

_Updated 2026-06-14. Core build is done and pushed; nothing deployed or live-tested yet._

### Done (committed on `build-app`, PR not yet opened)
- Next.js app scaffolded; the `hebrew-story-partner` artifact ported into `app/HebrewStoryPartner.jsx` (UI/RTL/palette/toggle/tap-to-explain/vocab all preserved).
- Secure `app/api/chat/route.ts`: free-model fallback chain **Gemini → Groq → OpenRouter** (only HTTP 429 advances; other errors surface), all keys server-side, server-side system prompt, input caps (40 turns / 8k chars), 400 on bad body.
- Security: passphrase gate (constant-time compare), per-IP rate limit (20/min) that runs **before** auth, trusted-IP derivation (`x-real-ip` / rightmost XFF). Auth extracted to `app/lib/auth.ts` as a one-file seam for future accounts.
- Active-model indicator in the header; `localStorage` persistence (`hsp_vocab`, `hsp_messages`, `hsp_pass`); passphrase `Gate` with rejection feedback.
- `.env.example`, README, `.gitignore` allows committing the example.

### Not done / next (roughly in priority order)
1. **Get keys + run it locally.** `cp .env.example .env.local`, set `APP_PASSPHRASE` + at least one provider key, `npm run dev`. Nothing has been run against real providers yet.
2. **Confirm current free model IDs** from each provider's docs (defaults are best-guesses: `gemini-2.0-flash`, `llama-3.3-70b-versatile`, `meta-llama/llama-3.3-70b-instruct:free`). Override via `GEMINI_MODEL` / `GROQ_MODEL` / `OPENROUTER_MODEL` if stale.
3. **Live-test the fallback chain** — verified by code review + build only, never a real 429. Plan suggested Playwright to simulate a Gemini rate-limit and confirm the indicator flips.
4. **Real-device / mobile test** — only the build is verified; no phone or Playwright mobile-viewport pass run yet.
5. **Open the PR** (`build-app` → `main`) — blocked in the build env (no `gh`/token); open via GitHub UI.
6. **Deploy to Vercel** — set env vars in the dashboard; confirm HTTPS URL on phone.

### Deliberately deferred (YAGNI until a real need)
- **Voice mode** — text-only today. Lazy path is the browser Web Speech API (no deps, no keys): `speechSynthesis` (`he-IL`) for read-aloud per story segment (the reliable, high-value half), and `SpeechRecognition` (`he-IL`) for speak-instead-of-type. Caveat: depends on OS/browser Hebrew voices — solid on iOS Safari/Chrome, patchy elsewhere; Hebrew recognition is rougher than TTS. Add read-aloud first.
- **Streaming** — UI renders whole story segments; non-streaming is simpler. Add when token-by-token is wanted (note: 3 provider dialects to handle).
- **Real auth / accounts** — only the `authenticate()` seam exists. Build a provider + login + user store only if publishing. Parked pending that decision.
- **Cross-device sync** — `localStorage` only (per-device). Add a hosted KV/DB if sync becomes a real need.
- **Brute-force lockout / backoff, per-user rate limits** — rate limit already bounds guessing; strong passphrase is the real defense for single-user.
- **Accessibility pass, automated tests** — not yet done.

### Known limitations
- Rate limiter is in-memory: resets on cold start, per-instance. Fine for single-user; swap for Vercel KV if ever multi-instance.
