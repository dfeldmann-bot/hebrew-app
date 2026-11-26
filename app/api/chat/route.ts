import { guard } from "../../lib/guard";
import {
  configuredTiers,
  orderTiers,
  parseProvider,
  runChain,
  type Message,
} from "../../lib/providers";

export const runtime = "nodejs";

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

export async function POST(req: Request): Promise<Response> {
  // 1–2. Rate limit, then authenticate (shared with /api/models — app/lib/guard.ts)
  const denied = guard(req);
  if (denied) return denied;

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

  // 5. Fallback chain — the learner's preferred provider (if valid and
  // configured) goes first; unknown values mean Auto. Any provider error
  // advances to the next tier.
  const tiers = orderTiers(configuredTiers(), parseProvider(body.provider));
  const result = await runChain(tiers, system, rawMessages);
  if (result) return Response.json(result);

  return Response.json({ error: "all_models_unavailable" }, { status: 502 });
}
