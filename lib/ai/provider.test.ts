import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateChatCompletion, getAiProvider, resetAiProvider } from "./provider";
import { es } from "@/i18n";

// Stubbed so resolving the Gemini adapter never constructs a real SDK client.
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent: vi.fn() };
  },
}));

const ENV_KEYS = [
  "AI_PROVIDER",
  "AI_API_KEY",
  "ANTHROPIC_API_KEY",
  "AI_MODEL",
  "GEMINI_API_KEY",
  "GEMINI_MODEL",
] as const;

const original: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) {
    original[key] = process.env[key];
    delete process.env[key];
  }
  resetAiProvider();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (original[key] === undefined) delete process.env[key];
    else process.env[key] = original[key];
  }
  resetAiProvider();
  vi.unstubAllGlobals();
});

const request = { system: "reglas", messages: [{ role: "user" as const, content: "hola" }] };

describe("the default is the mock", () => {
  it("uses it when nothing is configured", () => {
    expect(getAiProvider().name).toBe("mock");
  });

  it("answers the canned Spanish reply instead of erroring", async () => {
    const result = await generateChatCompletion(request);

    // The whole feature has to work end to end before a model exists.
    expect(result.status).toBe("unavailable");
    if (result.status !== "unavailable") return;
    expect(result.text).toBe(es.chat.unavailableReply);
    expect(es.chat.unavailableReply).toMatch(/aún no está disponible/i);
  });

  it("falls back to the mock when a provider is named without a key", () => {
    process.env.AI_PROVIDER = "anthropic";
    resetAiProvider();

    expect(getAiProvider().name).toBe("mock");
  });

  it("falls back to the mock for an unknown provider name", () => {
    process.env.AI_PROVIDER = "some-vendor";
    process.env.AI_API_KEY = "k";
    resetAiProvider();

    expect(getAiProvider().name).toBe("mock");
  });
});

describe("switching provider", () => {
  it("uses the real adapter once a key is present", () => {
    process.env.AI_API_KEY = "k";
    resetAiProvider();

    expect(getAiProvider().name).toBe("anthropic");
  });

  it("honours an explicit opt-out even with a key", () => {
    process.env.AI_PROVIDER = "mock";
    process.env.AI_API_KEY = "k";
    resetAiProvider();

    expect(getAiProvider().name).toBe("mock");
  });

  it("re-resolves when the env changes, without a restart", () => {
    expect(getAiProvider().name).toBe("mock");

    process.env.AI_API_KEY = "k";
    // No resetAiProvider() here on purpose: the fingerprint must notice.
    expect(getAiProvider().name).toBe("anthropic");
  });
});

describe("failures never escape as throws", () => {
  it("turns a network error into a failed result", async () => {
    process.env.AI_API_KEY = "k";
    resetAiProvider();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));

    const result = await generateChatCompletion(request);

    expect(result.status).toBe("failed");
    if (result.status !== "failed") return;
    expect(result.reason).toBe("boom");
  });

  it("turns a non-200 into a failed result", async () => {
    process.env.AI_API_KEY = "k";
    resetAiProvider();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ error: { message: "rate limited" } }),
      })
    );

    const result = await generateChatCompletion(request);

    expect(result.status).toBe("failed");
    if (result.status !== "failed") return;
    expect(result.reason).toBe("rate limited");
  });

  it("survives an adapter that throws outright", async () => {
    process.env.AI_API_KEY = "k";
    resetAiProvider();
    const provider = getAiProvider();
    vi.spyOn(provider, "generateChatCompletion").mockImplementation(() => {
      throw new Error("adapter bug");
    });

    const result = await generateChatCompletion(request);
    expect(result.status).toBe("failed");
  });
});

describe("the real adapter", () => {
  it("sends the system prompt as a field, apart from the turns", async () => {
    process.env.AI_API_KEY = "secret-key";
    resetAiProvider();

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ content: [{ type: "text", text: "  respuesta  " }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateChatCompletion(request);

    expect(result).toEqual({ status: "ok", text: "respuesta" });

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body as string);
    // Keeping it out of `messages` is what stops a user turn from ever being
    // mistaken for an instruction.
    expect(body.system).toBe("reglas");
    expect(body.messages).toEqual([{ role: "user", content: "hola" }]);
    expect(init.headers["x-api-key"]).toBe("secret-key");
  });
});

describe("Gemini", () => {
  const configureGemini = () => {
    process.env.AI_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "gemini-key";
    process.env.GEMINI_MODEL = "gemini-2.5-flash-lite";
    resetAiProvider();
  };

  it("is used when AI_PROVIDER=gemini and both variables are set", () => {
    configureGemini();
    expect(getAiProvider().name).toBe("gemini");
  });

  it("falls back to the mock with no key", () => {
    configureGemini();
    delete process.env.GEMINI_API_KEY;
    resetAiProvider();

    expect(getAiProvider().name).toBe("mock");
  });

  it("falls back to the mock with no model, rather than guessing one", () => {
    configureGemini();
    delete process.env.GEMINI_MODEL;
    resetAiProvider();

    // Defaulting the model would hide a misconfiguration behind a model nobody
    // chose, with its own cost and behaviour.
    expect(getAiProvider().name).toBe("mock");
  });

  it("is NOT picked up just because its variables exist", () => {
    process.env.GEMINI_API_KEY = "gemini-key";
    process.env.GEMINI_MODEL = "gemini-2.5-flash-lite";
    resetAiProvider();

    // Switching provider is an explicit act.
    expect(getAiProvider().name).toBe("mock");
  });

  it("still honours the explicit opt-out", () => {
    configureGemini();
    process.env.AI_PROVIDER = "mock";
    resetAiProvider();

    expect(getAiProvider().name).toBe("mock");
  });

  it("re-resolves when the Gemini env changes", () => {
    configureGemini();
    expect(getAiProvider().name).toBe("gemini");

    delete process.env.GEMINI_API_KEY;
    // No resetAiProvider(): the fingerprint must notice on its own.
    expect(getAiProvider().name).toBe("mock");
  });
});

describe("only the adapter knows the vendor", () => {
  const read = (relative: string) =>
    fs.readFileSync(path.resolve(__dirname, relative), "utf8");

  it("the route handler does not import the Gemini SDK", () => {
    // The whole point of the abstraction: swapping vendor touches one file.
    expect(read("../../app/api/chat/route.ts")).not.toContain("@google/genai");
  });

  it("no client component imports it either", () => {
    for (const file of [
      "../../components/chat/ChatLauncher.tsx",
      "../../components/chat/ChatPanel.tsx",
      "../../components/chat/ChatComposer.tsx",
      "../../hooks/use-chat.ts",
    ]) {
      const source = read(file);
      expect(source).not.toContain("@google/genai");
      // Nor the provider module that would drag the key in with it.
      expect(source).not.toContain("lib/ai/provider");
    }
  });

  it("the key is never exposed under a NEXT_PUBLIC_ name", () => {
    const source = read("./providers/gemini.ts") + read("./provider.ts");
    expect(source).not.toContain("NEXT_PUBLIC_GEMINI");
  });
});
