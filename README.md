# סיפור · Hebrew Story Partner

A personal, single-user web app: a live AI Hebrew tutor that tells interactive
branching stories at bet-1/bet-2 level. Hebrew/English support toggle,
tap-any-word-to-explain, and a vocabulary list woven into the stories.

The runtime engine is **free models with automatic fallback** — Gemini Flash →
Groq → OpenRouter. The Anthropic/Claude API is not used at runtime.

See `PLAN.md` for the full spec.

## Setup

1. Copy the env template and fill it in:
   ```bash
   cp .env.example .env.local
   ```
   - `APP_PASSPHRASE` — required; the gate that protects your free quotas.
   - At least one provider key (`GOOGLE_AI_API_KEY`, `GROQ_API_KEY`,
     `OPENROUTER_API_KEY`). All free, no credit card. Missing tiers are skipped.

2. Install and run:
   ```bash
   npm install
   npm run dev
   ```
   Open http://localhost:3000, enter your passphrase, start a story.

## Security model

- **No key reaches the browser.** All model calls go through `app/api/chat/route.ts`,
  which holds the keys in server-side env vars and builds the system prompt server-side.
- **Passphrase gate** on every request (constant-time compare); a leaked URL can't
  be used without it.
- **Rate limit** (20 req/min per IP, in-memory) and input caps (last 40 turns,
  8k chars each) cap abuse and cost.
- `.env.local` is gitignored; `.env.example` holds blank placeholders only.

## Persistence

Vocab list and conversation persist in the browser's `localStorage` (keys
`hsp_vocab`, `hsp_messages`, `hsp_pass`) — private to your device, no backend store.

## Deploy

Deploy to Vercel (or any Node host). Set `APP_PASSPHRASE` and your provider key(s)
as environment variables in the host's dashboard — never commit real keys.

## Not yet built

Streaming responses (the UI renders whole story segments), and cross-device sync
(persistence is per-device localStorage).
