// ── Model providers ───────────────────────────────────────────────────────
// Pure provider logic for /api/chat and /api/models: which providers are
// configured (server env only — keys never leave this module's callers), how
// the chain is ordered, how each provider is called, and the fallback loop.

export const PROVIDER_NAMES = ["gemini", "groq", "openrouter", "claude"] as const;
export type ProviderName = (typeof PROVIDER_NAMES)[number];

export interface Tier {
  name: ProviderName;
  key: string;
  model: string;
}

export type Message = { role: "user" | "assistant"; content: string };

type Env = Record<string, string | undefined>;

export const DEFAULT_CLAUDE_MODEL = "claude-sonnet-5-5";

/** Configured tiers in chain order (Gemini → Groq → OpenRouter → Claude); keyless ones dropped. */
export function configuredTiers(env: Env = process.env): Tier[] {
  const all: Tier[] = [
    { name: "gemini", key: env.GOOGLE_AI_API_KEY ?? "", model: env.GEMINI_MODEL ?? "gemini-2.0-flash" },
    { name: "groq", key: env.GROQ_API_KEY ?? "", model: env.GROQ_MODEL ?? "llama-3.3-70b-versatile" },
    {
      name: "openrouter",
      key: env.OPENROUTER_API_KEY ?? "",
      model: env.OPENROUTER_MODEL ?? "meta-llama/llama-3.3-70b-instruct:free",
    },
    { name: "claude", key: env.ANTHROPIC_API_KEY ?? "", model: env.ANTHROPIC_MODEL ?? DEFAULT_CLAUDE_MODEL },
  ];
  return all.filter((t) => t.key !== "");
}

/** Provider names only — safe to send to the browser. */
export function listConfiguredProviders(env: Env = process.env): ProviderName[] {
  return configuredTiers(env).map((t) => t.name);
}

/** A known provider name, or null (= Auto) for anything else. */
export function parseProvider(value: unknown): ProviderName | null {
  return typeof value === "string" && (PROVIDER_NAMES as readonly string[]).includes(value)
    ? (value as ProviderName)
    : null;
}

/** Preferred tier first (if configured); the rest keep chain order. */
export function orderTiers(tiers: Tier[], preferred: ProviderName | null): Tier[] {
  const first = tiers.filter((t) => t.name === preferred);
  return [...first, ...tiers.filter((t) => t.name !== preferred)];
}

function failIfNotOk(name: ProviderName, res: Response, limitStatuses: number[]): void {
  if (limitStatuses.includes(res.status)) throw new Error(`${name} rate-limited/overloaded (${res.status})`);
  if (!res.ok) throw new Error(`${name} ${res.status}`);
}

/** One provider call. Throws on any HTTP or network failure. */
export async function callTier(
  tier: Tier,
  system: string,
  messages: Message[],
  fetchImpl: typeof fetch = fetch
): Promise<string> {
  if (tier.name === "gemini") {
    const res = await fetchImpl(
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
    failIfNotOk(tier.name, res, [429]);
    const data = await res.json();
    const parts: { text?: string }[] = data.candidates?.[0]?.content?.parts ?? [];
    return parts.map((p) => p.text ?? "").join("").trim();
  }

  if (tier.name === "claude") {
    const res = await fetchImpl("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": tier.key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({ model: tier.model, max_tokens: 1000, system, messages }),
    });
    failIfNotOk(tier.name, res, [429, 529]);
    const data = await res.json();
    const blocks: { type?: string; text?: string }[] = data.content ?? [];
    return blocks
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("")
      .trim();
  }

  // Groq / OpenRouter (OpenAI-compatible)
  const endpoint =
    tier.name === "groq"
      ? "https://api.groq.com/openai/v1/chat/completions"
      : "https://openrouter.ai/api/v1/chat/completions";
  const res = await fetchImpl(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tier.key}` },
    body: JSON.stringify({
      model: tier.model,
      max_tokens: 1000,
      messages: [{ role: "system", content: system }, ...messages],
    }),
  });
  failIfNotOk(tier.name, res, [429]);
  const data = await res.json();
  return (data.choices?.[0]?.message?.content ?? "").trim();
}

/** Try each tier once, in order; ANY error advances to the next. null = all failed. */
export async function runChain(
  tiers: Tier[],
  system: string,
  messages: Message[],
  call: typeof callTier = callTier
): Promise<{ text: string; model: ProviderName } | null> {
  for (const tier of tiers) {
    try {
      return { text: await call(tier, system, messages), model: tier.name };
    } catch (e) {
      console.error(`[chat] ${tier.name} failed, trying next:`, e instanceof Error ? e.message : e);
    }
  }
  return null;
}
