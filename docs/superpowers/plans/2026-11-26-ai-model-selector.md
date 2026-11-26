# AI Model Selector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the learner pick which configured AI provider answers first (with automatic fallback), add an optional Claude provider, and visibly disable every AI feature when no provider is configured or the device is offline.

**Architecture:** Pure provider logic (config listing, validation, ordering, per-provider HTTP call, fallback loop) moves out of the route into `app/lib/providers.ts` and is unit-tested with a mocked `fetch`. The rate-limit + `authenticate()` preamble moves into `app/lib/guard.ts` so `/api/chat` and the new `GET /api/models` share it. The client fetches `/api/models` once, keeps the choice in `localStorage`, sends it as `provider`, and derives a single `aiDisabled` flag from the provider list and `navigator.onLine`.

**Tech Stack:** Next.js 16 route handlers (Node runtime), React 19 client component with inline styles, Vitest (new devDependency).

**Spec:** `docs/superpowers/specs/2026-11-26-ai-model-selector-design.md`

## Global Constraints

- Chain order: Gemini → Groq → OpenRouter → Claude. Preferred provider (if valid and configured) moves to the front; others keep that order.
- Unknown / unconfigured `provider` values are ignored (Auto), never an error.
- Fallback advances on **any** provider error (429, 5xx, network). All fail → `502 { error: "all_models_unavailable" }`.
- Claude only when `ANTHROPIC_API_KEY` is set. Plain `fetch` to `https://api.anthropic.com/v1/messages`, headers `x-api-key`, `anthropic-version: 2023-06-01`, `content-type: application/json`; body `{ model, max_tokens: 1000, system, messages }`; text from `content[].text`. Model `process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5"`. 429 and 529 = rate-limit/overload.
- `GET /api/models` → `{ providers: ProviderName[] }` — names only, no keys, no models. Same rate limit + `authenticate()` as `/api/chat`.
- Banner copy verbatim: "No AI model is available right now." / "You're offline — the AI needs internet."
- `localStorage` access wrapped in try/catch. No keys in client code.
- Claude key is a paid Anthropic Console API key; a Claude Pro/Max subscription cannot be used.
- House rules: ponytail/YAGNI, no extra deps beyond Vitest, no real API calls in tests.

## Review Focus

- Stored `hsp_provider` names a provider later removed from the server → selector falls back to Auto (client: validated against `/api/models` list).
- `provider` sent as non-string (number, object, `"__proto__"`) → ignored, Auto order (test in Task 1).
- Preferred provider fails → remaining providers still tried in canonical order, preferred not retried (test in Task 1).
- Claude returns a mix of `text` and non-text content blocks → only text joined (test in Task 1).
- `/api/models` request fails (429/500/network) while online → do not disable AI (unknown ≠ empty); chat still reports its own errors. Only an explicit empty list disables.

---

### Task 1: Provider module + Vitest

**Files:**
- Create: `app/lib/providers.ts`, `app/lib/providers.test.ts`
- Modify: `package.json` (add `vitest` devDependency, `"test": "vitest run"`)

**Interfaces:**
- Produces:
  - `PROVIDER_NAMES = ["gemini","groq","openrouter","claude"] as const`; `type ProviderName`
  - `interface Tier { name: ProviderName; key: string; model: string }`
  - `type Message = { role: "user" | "assistant"; content: string }`
  - `configuredTiers(env?: Record<string,string|undefined>): Tier[]` — canonical order, keyless tiers dropped, default models as in the current route plus `claude-sonnet-5-5`.
  - `listConfiguredProviders(env?): ProviderName[]`
  - `parseProvider(value: unknown): ProviderName | null`
  - `orderTiers(tiers: Tier[], preferred: ProviderName | null): Tier[]`
  - `callTier(tier, system, messages, fetchImpl = fetch): Promise<string>` — throws on any non-OK.
  - `runChain(tiers, system, messages, call = callTier): Promise<{ text: string; model: ProviderName } | null>`

- [ ] **Step 1: Install Vitest, add `npm test` script.**
- [ ] **Step 2: Write failing tests** — `listConfiguredProviders({})` → `[]`; with GROQ + ANTHROPIC keys → `["groq","claude"]`; `parseProvider("groq")` → `"groq"`, `"auto"`/`"x"`/`42`/`"__proto__"` → `null`; `orderTiers(all, "openrouter")` names → `["openrouter","gemini","groq","claude"]`; preferred not configured → unchanged; `runChain` where first call rejects with `Error("500")` → second tier's text returned; all reject → `null`; Claude `callTier` with mocked fetch asserts URL, the three headers, body `{model, max_tokens:1000, system, messages}`, joins `content[].text` and skips non-text blocks; Claude 529 → rejects; `ANTHROPIC_MODEL` overrides default model.
- [ ] **Step 3: Run `npm test`** — expect FAIL (module missing).
- [ ] **Step 4: Implement `app/lib/providers.ts`** — move `callTier` from the route, add the Claude branch; `parseProvider` uses `PROVIDER_NAMES.includes`.
- [ ] **Step 5: Run `npm test`** — expect PASS.
- [ ] **Step 6: Commit** `feat: extract provider chain with Claude tier and preferred ordering`.

### Task 2: Shared guard, `/api/chat` wiring, `GET /api/models`

**Files:**
- Create: `app/lib/guard.ts`, `app/api/models/route.ts`
- Modify: `app/api/chat/route.ts`

**Interfaces:**
- Consumes: Task 1 exports.
- Produces: `guard(req: Request): Response | null` (429 `rate_limited` / 401 `unauthorized`, else `null`); `GET /api/models` → `{ providers }`; `POST /api/chat` reads `body.provider`.

- [ ] **Step 1:** Move rate-limit map, `checkRateLimit`, trusted-IP derivation and `authenticate()` call into `guard()` (one shared map for both routes).
- [ ] **Step 2:** Chat route: `const r = guard(req); if (r) return r;` then `runChain(orderTiers(configuredTiers(), parseProvider(body.provider)), …)`; `null` → 502 `all_models_unavailable`. Log each failure with `console.error`.
- [ ] **Step 3:** Models route: `export const runtime = "nodejs"`; `GET` → guard, then `Response.json({ providers: listConfiguredProviders() })`.
- [ ] **Step 4:** `npm test && npx tsc --noEmit` pass. Commit `feat: add /api/models and preferred provider on /api/chat`.

### Task 3: Client selector + disabled state

**Files:** Modify `app/HebrewStoryPartner.jsx`

- [ ] **Step 1:** `MODEL_LABELS.claude = "Claude"`. State `providers` (`null` = unknown), `choice` (`"auto"` default, from `hsp_provider` in try/catch), `online` (init `true`, set from `navigator.onLine` in effect, `online`/`offline` listeners).
- [ ] **Step 2:** On mount `GET /api/models` with `x-app-passphrase`; 401 → same handling as chat; OK → `setProviders(data.providers)`; other failures leave `null`. When providers load and `choice` not in list → `"auto"`.
- [ ] **Step 3:** `<select>` in the header next to the model indicator, options Auto + configured providers, palette-styled; persists to `hsp_provider` (try/catch). Every `/api/chat` body gains `provider: choice`.
- [ ] **Step 4:** `aiDisabled = !online || (providers !== null && providers.length === 0)`. Disable input, send, starters, selector; word spans lose onClick/pointer/underline; analyze button hidden; banner under header with the exact copy (offline message wins). `send`/`explainWord`/`analyzeSentence` early-return when disabled.
- [ ] **Step 5:** `npm run lint` passes. Commit `feat: model selector and offline/no-model disabled state`.

### Task 4: Docs + verification

**Files:** `.env.example`, `README.md`, `PLAN.md`, `HANDOFF.md` (contract lines only)

- [ ] **Step 1:** `.env.example`: `ANTHROPIC_API_KEY=` and `# ANTHROPIC_MODEL=claude-sonnet-5-5` with the paid-Console-key / not-Pro note.
- [ ] **Step 2:** README: selector, optional Claude (paid, not Pro), any-error fallback, `/api/models`, `hsp_provider`, `npm test`. PLAN runtime-engine line + fallback rule + status. HANDOFF contract (`provider`, any-error fallback, `/api/models`, `hsp_provider`).
- [ ] **Step 3:** `npm test`, `npm run lint`, `npm run build` (throwaway `.env.local` only if needed). Grep `.next/static` for key names / provider endpoints. Commit `docs: document model selector and optional Claude provider`.
