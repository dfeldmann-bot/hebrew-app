import { authenticate } from "../../lib/auth";

export const runtime = "nodejs";

// ponytail: rate limit resets on cold start / is per-instance; swap for Vercel KV if multi-instance.
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;

class RateLimitError extends Error {}

function checkRateLimit(ip: string): void {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return;
  }
  if (entry.count >= RATE_LIMIT_MAX) throw new RateLimitError();
  entry.count++;
}

function buildSystemPrompt(support: string, vocab: string[]) {
  const supportText = {
    heavy:
      "After each Hebrew line, give the full English translation on its own line, prefixed with '↳ '. Keep Hebrew sentences short and bet-1/bet-2 level (present tense mostly, simple past).",
    light:
      "Write mainly in Hebrew at bet-1/bet-2 level. Do NOT translate whole lines. Instead, after a paragraph, gloss 2-4 of the harder words in parentheses like (מילה = word). Keep sentences short.",
    none:
      "Write ONLY in Hebrew, bet-1/bet-2 level. No English at all unless the learner explicitly asks 'explain' or types in English. Keep sentences short and clear, present tense mostly.",
  }[support] ?? "";

  const vocabText =
    vocab && vocab.length
      ? `\n\nThe learner is currently studying these words/phrases — weave them naturally into the story when you can, to reinforce them: ${vocab.join(", ")}.`
      : "";

  return `You are a warm, patient Hebrew tutor running an INTERACTIVE STORY for an adult learner at bet (intermediate-beginner) level. They lived in Israel and are reactivating their listening comprehension. Their goal is UNDERSTANDING spoken/written Hebrew, not perfect production.

How the interactive story works:
- Tell the story in short, vivid segments (3-6 sentences each).
- End EVERY segment by offering the learner 2-3 concrete choices for what happens next, written in simple Hebrew, numbered. This keeps them engaged and making decisions.
- Stay at their level. Vocabulary should be high-frequency and everyday. Grammar should lean on present tense; introduce simple past gently.
- Be encouraging. If they make a mistake or write shaky Hebrew, gently model the correct version without lecturing.
- If they type "explain" or ask about a word/phrase (in English or Hebrew), pause the story and explain clearly in English: meaning, root if useful, and a simple example. Then offer to continue.
- Keep the emotional hook alive — make them care what happens next. Narrative + emotion is what makes vocabulary stick.

Language support setting: ${supportText}${vocabText}

Begin or continue based on the learner's message. Keep momentum and warmth.`;
}

function buildExplainPrompt() {
  return `You give a quick gloss for ONE Hebrew word or short phrase that the learner tapped. Reply with a SHORT, concise explanation in English: the translation first, then — only if genuinely helpful — the root or part of speech in a few words. One line, ~12 words max. No story, no greeting, no follow-up question, no extra Hebrew sentence. Just the gloss.`;
}

function buildAnalyzePrompt() {
  return `The learner tapped a Hebrew sentence to understand it in context. Reply with: first, a natural English translation of the whole sentence on one line. Then a compact word-by-word breakdown — one line per meaningful word, formatted "word — meaning" — giving each word's meaning AS USED IN THIS sentence (add a short root or grammar note only when it genuinely helps). Be concise. No story, no greeting, no follow-up question.`;
}

type Message = { role: "user" | "assistant"; content: string };

interface Tier {
  name: "gemini" | "groq" | "openrouter";
  key: string;
  model: string;
}

async function callTier(
  tier: Tier,
  system: string,
  messages: Message[]
): Promise<string> {
  if (tier.name === "gemini") {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${tier.model}:generateContent?key=${tier.key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents: messages.map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          })),
        }),
      }
    );
    if (res.status === 429) throw new RateLimitError();
    if (!res.ok) throw new Error(`Gemini ${res.status}`);
    const data = await res.json();
    const parts: { text?: string }[] =
      data.candidates?.[0]?.content?.parts ?? [];
    return parts
      .map((p) => p.text ?? "")
      .join("")
      .trim();
  }

  // Groq / OpenRouter (OpenAI-compatible)
  const endpoint =
    tier.name === "groq"
      ? "https://api.groq.com/openai/v1/chat/completions"
      : "https://openrouter.ai/api/v1/chat/completions";

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tier.key}`,
    },
    body: JSON.stringify({
      model: tier.model,
      max_tokens: 1000,
      messages: [{ role: "system", content: system }, ...messages],
    }),
  });
  if (res.status === 429) throw new RateLimitError();
  if (!res.ok) throw new Error(`${tier.name} ${res.status}`);
  const data = await res.json();
  return (data.choices?.[0]?.message?.content ?? "").trim();
}

export async function POST(req: Request): Promise<Response> {
  // 1. Rate limit FIRST — so failed-auth attempts are also counted (caps
  // passphrase brute-forcing at the per-window limit). Trust only the IP set by
  // the platform edge: x-real-ip (Vercel) or the RIGHTMOST x-forwarded-for entry
  // (the one the trusted proxy appended); the leftmost token is client-spoofable.
  // ponytail: an unknown bucket is shared, which is fine for a single-user app.
  const xff = req.headers.get("x-forwarded-for");
  const ip =
    req.headers.get("x-real-ip")?.trim() ||
    (xff ? xff.split(",").pop()!.trim() : "") ||
    "unknown";
  try {
    checkRateLimit(ip);
  } catch (e) {
    if (e instanceof RateLimitError)
      return Response.json({ error: "rate_limited" }, { status: 429 });
    throw e;
  }

  // 2. Authenticate — the single seam for adding real accounts later (app/lib/auth.ts)
  const auth = authenticate(req);
  if (!auth.ok) return Response.json({ error: "unauthorized" }, { status: 401 });

  // 3. Parse & sanitize body
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const support = String(body.support ?? "light");
  const vocab: string[] = Array.isArray(body.vocab)
    ? body.vocab.slice(0, 100).map(String)
    : [];
  const rawMessages: Message[] = Array.isArray(body.messages)
    ? body.messages.slice(-40).map((m: { role: unknown; content: unknown }) => ({
        role: (m.role === "assistant" ? "assistant" : "user") as
          | "user"
          | "assistant",
        content: String(m.content ?? "").slice(0, 8000),
      }))
    : [];

  // 4. Build system prompt server-side. "explain" mode = a tap-to-gloss popover
  // (concise, one-off); anything else = the interactive story.
  const system =
    body.mode === "explain"
      ? buildExplainPrompt()
      : body.mode === "analyze"
      ? buildAnalyzePrompt()
      : buildSystemPrompt(support, vocab);

  // 5. Fallback chain
  const tiers: Tier[] = (
    [
      {
        name: "gemini" as const,
        key: process.env.GOOGLE_AI_API_KEY ?? "",
        model: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
      },
      {
        name: "groq" as const,
        key: process.env.GROQ_API_KEY ?? "",
        model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
      },
      {
        name: "openrouter" as const,
        key: process.env.OPENROUTER_API_KEY ?? "",
        model:
          process.env.OPENROUTER_MODEL ??
          "meta-llama/llama-3.3-70b-instruct:free",
      },
    ] satisfies Tier[]
  ).filter((t) => t.key !== "");

  for (const tier of tiers) {
    try {
      const text = await callTier(tier, system, rawMessages);
      return Response.json({ text, model: tier.name });
    } catch (e) {
      if (e instanceof RateLimitError) continue; // advance to next tier
      console.error(`[chat] ${tier.name} error:`, e);
      break; // non-429 error: stop and return 502
    }
  }

  return Response.json({ error: "all_models_unavailable" }, { status: 502 });
}
