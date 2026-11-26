import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  configuredTiers,
  listConfiguredProviders,
  parseProvider,
  orderTiers,
  callTier,
  runChain,
  type Tier,
} from "./providers";

const ALL_KEYS = {
  GOOGLE_AI_API_KEY: "g",
  GROQ_API_KEY: "q",
  OPENROUTER_API_KEY: "o",
  ANTHROPIC_API_KEY: "a",
};

const names = (tiers: Tier[]) => tiers.map((t) => t.name);

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("listConfiguredProviders", () => {
  it("returns nothing when no keys are set", () => {
    expect(listConfiguredProviders({})).toEqual([]);
  });

  it("lists only providers with a key, in chain order", () => {
    expect(
      listConfiguredProviders({ ANTHROPIC_API_KEY: "a", GROQ_API_KEY: "q" })
    ).toEqual(["groq", "claude"]);
  });

  it("lists all four in order Gemini, Groq, OpenRouter, Claude", () => {
    expect(listConfiguredProviders(ALL_KEYS)).toEqual([
      "gemini",
      "groq",
      "openrouter",
      "claude",
    ]);
  });
});

describe("configuredTiers", () => {
  it("uses the default Claude model when ANTHROPIC_MODEL is unset", () => {
    const claude = configuredTiers({ ANTHROPIC_API_KEY: "a" })[0];
    expect(claude).toEqual({ name: "claude", key: "a", model: "claude-sonnet-5-5" });
  });

  it("lets ANTHROPIC_MODEL override the Claude model", () => {
    const claude = configuredTiers({ ANTHROPIC_API_KEY: "a", ANTHROPIC_MODEL: "custom" })[0];
    expect(claude.model).toBe("custom");
  });
});

describe("parseProvider", () => {
  it("accepts each known provider name", () => {
    for (const p of ["gemini", "groq", "openrouter", "claude"]) {
      expect(parseProvider(p)).toBe(p);
    }
  });

  it("returns null for auto, unknown, and non-string values", () => {
    for (const v of ["auto", "gpt", "", "__proto__", "toString", 42, null, undefined, {}, ["groq"]]) {
      expect(parseProvider(v)).toBeNull();
    }
  });
});

describe("orderTiers", () => {
  const all = configuredTiers(ALL_KEYS);

  it("keeps chain order when there is no preference", () => {
    expect(names(orderTiers(all, null))).toEqual(["gemini", "groq", "openrouter", "claude"]);
  });

  it("moves the preferred provider to the front, others keep their order", () => {
    expect(names(orderTiers(all, "openrouter"))).toEqual([
      "openrouter",
      "gemini",
      "groq",
      "claude",
    ]);
  });

  it("ignores a preferred provider that is not configured", () => {
    const some = configuredTiers({ GROQ_API_KEY: "q", OPENROUTER_API_KEY: "o" });
    expect(names(orderTiers(some, "claude"))).toEqual(["groq", "openrouter"]);
  });
});

describe("runChain", () => {
  const tiers = configuredTiers({ GOOGLE_AI_API_KEY: "g", GROQ_API_KEY: "q", ANTHROPIC_API_KEY: "a" });
  const msgs = [{ role: "user" as const, content: "שלום" }];
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns the first tier that succeeds", async () => {
    const call = vi.fn(async (t: Tier) => `from ${t.name}`);
    expect(await runChain(tiers, "sys", msgs, call)).toEqual({ text: "from gemini", model: "gemini" });
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("continues past a non-rate-limit error to the next tier", async () => {
    const call = vi.fn(async (t: Tier) => {
      if (t.name === "gemini") throw new Error("gemini 500");
      return `from ${t.name}`;
    });
    expect(await runChain(tiers, "sys", msgs, call)).toEqual({ text: "from groq", model: "groq" });
  });

  it("tries each tier once and returns null when all fail", async () => {
    const call = vi.fn(async (t: Tier): Promise<string> => {
      void t;
      throw new Error("network");
    });
    expect(await runChain(tiers, "sys", msgs, call)).toBeNull();
    expect(call.mock.calls.map((c) => c[0].name)).toEqual(["gemini", "groq", "claude"]);
  });
});

describe("callTier — Claude", () => {
  const claude: Tier = { name: "claude", key: "sk-test", model: "m-1" };
  const msgs = [
    { role: "user" as const, content: "hi" },
    { role: "assistant" as const, content: "shalom" },
    { role: "user" as const, content: "more" },
  ];

  it("posts to the Messages API with the required headers and body", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, { content: [{ type: "text", text: "ok" }] })
    );
    await callTier(claude, "SYS", msgs, fetchImpl as unknown as typeof fetch);

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({
      "x-api-key": "sk-test",
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    });
    expect(JSON.parse(init.body as string)).toEqual({
      model: "m-1",
      max_tokens: 1000,
      system: "SYS",
      messages: msgs,
    });
  });

  it("joins text blocks and skips non-text blocks", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, {
        content: [
          { type: "text", text: "שלום " },
          { type: "thinking", thinking: "hidden" },
          { type: "text", text: "עולם" },
        ],
      })
    );
    expect(await callTier(claude, "S", msgs, fetchImpl as unknown as typeof fetch)).toBe("שלום עולם");
  });

  it.each([429, 529, 500, 401])("rejects on HTTP %i", async (status) => {
    const fetchImpl = vi.fn(async () => jsonResponse(status, { error: {} }));
    await expect(callTier(claude, "S", msgs, fetchImpl as unknown as typeof fetch)).rejects.toThrow();
  });
});
