# סיפור · Hebrew Story Partner

A personal, single-user web app: a live AI Hebrew tutor that tells interactive
branching stories at bet-1/bet-2 level. Hebrew/English support toggle,
tap-any-word-to-explain, and a vocabulary list woven into the stories.

The runtime engine is **free models with automatic fallback** — Gemini Flash →
Groq → OpenRouter — plus an **optional Claude tier** that is used only if you add a
paid Anthropic API key (see below).

See `PLAN.md` for the full spec.

## Setup

1. Copy the env template and fill it in:
   ```bash
   cp .env.example .env.local
   ```
   - `APP_PASSPHRASE` — required; the gate that protects your free quotas.
   - At least one provider key (`GOOGLE_AI_API_KEY`, `GROQ_API_KEY`,
     `OPENROUTER_API_KEY`). All free, no credit card. Missing tiers are skipped.
   - Optional: `ANTHROPIC_API_KEY` (and `ANTHROPIC_MODEL`, default
     `claude-sonnet-5-5`) to add Claude as a fourth tier. **This must be a paid,
     pay-as-you-go API key from the Anthropic Console** (console.anthropic.com).
     A Claude Pro/Max subscription **cannot** be used — consumer plans don't include
     API access and there is no supported way for a web app to use one. Without the
     key, the Claude option simply doesn't appear.

2. Install and run:
   ```bash
   npm install
   npm run dev
   ```
   Open http://localhost:3000, enter your passphrase, start a story.

3. Tests (pure provider logic, no real API calls): `npm test`.

## Choosing the model

The header has a small selector: **Auto** plus every provider configured on the
server (the browser learns only provider *names*, from `GET /api/models`).

- The chosen provider is tried first; if it fails for **any** reason (rate limit,
  overload, server error, network) the others are tried in the usual order
  Gemini → Groq → OpenRouter → Claude, so a used-up quota never stops the story.
- The dot next to the selector shows which model actually answered.
- If every provider fails, the story shows a clear "try again" message.
- If no provider is configured, or the device is offline, every AI feature
  (story chat, tap-a-word, analyze-a-sentence) is disabled and a banner says why.

## Security model

- **No key reaches the browser.** All model calls go through `app/api/chat/route.ts`
  (provider logic in `app/lib/providers.ts`), which holds the keys in server-side env
  vars and builds the system prompt server-side. `/api/models` returns names only.
- **Passphrase gate** on every request (constant-time compare); a leaked URL can't
  be used without it.
- **Rate limit** (20 req/min per IP, in-memory, shared by `/api/chat` and
  `/api/models` via `app/lib/guard.ts`) and input caps (last 40 turns, 8k chars each)
  cap abuse and cost.
- `.env.local` is gitignored; `.env.example` holds blank placeholders only.

## Persistence

Vocab list, conversation and model choice persist in the browser's `localStorage`
(keys `hsp_vocab`, `hsp_messages`, `hsp_pass`, `hsp_provider`) — private to your
device, no backend store.

## Deploy

Deploy to Vercel (or any Node host). Set `APP_PASSPHRASE` and your provider key(s)
as environment variables in the host's dashboard — never commit real keys.

## Not yet built

Streaming responses (the UI renders whole story segments), and cross-device sync
(persistence is per-device localStorage).
