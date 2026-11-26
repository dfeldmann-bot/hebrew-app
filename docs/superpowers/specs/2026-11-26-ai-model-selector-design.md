# AI model selector — short design

Date: 2026-11-26 · Status: approved by owner in chat

## Intent

Gemini's free quota sometimes runs out mid-session. The learner wants to pick which
model answers, switch away from an exhausted one, and never be left with a broken
AI feature. When no model can be used, the AI parts must be visibly unavailable
rather than failing on every tap.

## Goals

- A model selector in the header: **Auto** plus every provider that is configured on the server.
- The chosen provider is tried first; if it fails, the others are tried in the usual order
  (Gemini → Groq → OpenRouter → Claude), so a dead quota never stops the story.
- The reply keeps showing which model actually answered (existing behaviour).
- If **no** provider is configured, or the device is offline, every AI feature
  (story chat, tap-a-word, tap-a-sentence) is disabled with a short plain message.
  Nothing AI-related is clickable in that state.
- Optional Claude provider, used only when `ANTHROPIC_API_KEY` is set on the server.

## Non-goals / anti-goals

- **No use of a Claude Pro/Max subscription.** A consumer subscription does not include
  API access, and there is no supported way for a web app to call Claude through it.
  Claude works only with a separate pay-as-you-go API key from the Anthropic Console.
  Without that key the Claude option does not appear at all — no dead option.
- API keys never reach the browser. The browser only learns *which* providers exist.
- No per-provider settings UI beyond the selector.

## Approaches considered

1. **Pick a model, try it first, fall back automatically** — chosen. Never stuck, still in control.
2. Strict choice, no fallback — rejected: a dead quota stops the story, the exact pain point.
3. Server-only env setting — rejected: can't switch from the phone mid-session.

## Design

- `GET /api/models` (same rate limit + passphrase auth as `/api/chat`) returns the list of
  configured provider names, e.g. `{ "providers": ["gemini", "groq"] }`. No keys, no models.
- `POST /api/chat` accepts optional `provider`. Valid and configured → moved to the front of
  the chain; otherwise ignored (Auto). Unknown values are ignored, not errors.
- Fallback continues to the next provider on **any** provider error (429, 5xx, network),
  not only 429 — the current code stops on non-429 errors, which strands the learner.
  If all fail: existing `all_models_unavailable` 502, shown as a clear message.
- Claude tier: direct `fetch` to the Anthropic Messages API (`x-api-key`,
  `anthropic-version: 2023-06-01`), system prompt in `system`, `max_tokens: 1000`.
  Model from `ANTHROPIC_MODEL`, default `claude-sonnet-5-5`.
- Client: selector values `auto` + configured providers; the choice is kept in
  `localStorage` (try/catch, falls back to `auto` if the stored provider is no longer
  configured). Sent as `provider` on every `/api/chat` call.
- Disabled state: when `/api/models` returns an empty list, or `navigator.onLine` is false
  (and on `offline`/`online` events), the chat input, send button, story choices and
  word/sentence taps are disabled, and one banner says why:
  "No AI model is available right now." / "You're offline — the AI needs internet."
- Docs: `.env.example` gains `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` with a note that this
  is a paid Console key, not a Pro subscription. `README.md` and the runtime-engine line in
  `PLAN.md` updated (Claude now optional at runtime).

## Left to the builder

- Exact selector placement and styling within the existing header and palette.
- Test setup: the repo has no test runner yet. Pure logic (provider ordering, provider
  validation, configured-provider listing) should be extracted and unit-tested; pick a
  light runner (e.g. Vitest) if one is needed.
