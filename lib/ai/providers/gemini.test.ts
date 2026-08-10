import { beforeEach, describe, expect, it, vi } from "vitest";
import { es } from "@/i18n";

const generateContent = vi.fn();
const constructed: { apiKey?: string }[] = [];

// The SDK is mocked: these tests check OUR mapping and error handling, never
// Google's internals, and never touch the network.
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent };
    constructor(options: { apiKey?: string }) {
      constructed.push(options);
    }
  },
}));

const { createGeminiProvider } = await import("./gemini");

const provider = () => createGeminiProvider("test-key", "gemini-2.5-flash-lite");

const ok = (text: string | undefined) => ({ text });

beforeEach(() => {
  vi.clearAllMocks();
  constructed.length = 0;
  generateContent.mockResolvedValue(ok("respuesta"));
});

const ask = (
  messages: { role: "user" | "assistant"; content: string }[],
  system = "reglas del servidor"
) => provider().generateChatCompletion({ system, messages });

/** The arguments of the single call made. */
const sentArgs = () => generateContent.mock.calls[0][0];

describe("role mapping", () => {
  it("sends the user's turns as 'user'", async () => {
    await ask([{ role: "user", content: "hola" }]);

    expect(sentArgs().contents).toEqual([
      { role: "user", parts: [{ text: "hola" }] },
    ]);
  });

  it("maps assistant → model, which is what Gemini calls it", async () => {
    await ask([
      { role: "user", content: "uno" },
      { role: "assistant", content: "dos" },
      { role: "user", content: "tres" },
    ]);

    expect(sentArgs().contents.map((c: { role: string }) => c.role)).toEqual([
      "user",
      "model",
      "user",
    ]);
  });

  it("keeps the turns in order, with the newest last", async () => {
    await ask([
      { role: "user", content: "uno" },
      { role: "assistant", content: "dos" },
    ]);

    expect(sentArgs().contents.at(-1)).toEqual({
      role: "model",
      parts: [{ text: "dos" }],
    });
  });
});

describe("the system prompt", () => {
  it("travels in systemInstruction, NOT as a turn", async () => {
    await ask([{ role: "user", content: "hola" }], "no des asesoría");

    // A field, not a message: that is what stops a user turn from ever being
    // read as an instruction.
    expect(sentArgs().config.systemInstruction).toBe("no des asesoría");
    expect(JSON.stringify(sentArgs().contents)).not.toContain("no des asesoría");
  });
});

describe("stateless", () => {
  it("sends the WHOLE history on every call", async () => {
    const messages = [
      { role: "user" as const, content: "uno" },
      { role: "assistant" as const, content: "dos" },
      { role: "user" as const, content: "tres" },
    ];

    await ask(messages);
    expect(sentArgs().contents).toHaveLength(3);
  });

  it("never sends a conversation handle to Google", async () => {
    await ask([{ role: "user", content: "hola" }]);

    // The stateful interactions API would park the thread on Google's servers,
    // which is exactly the persistent history integrations.md forbids.
    const args = sentArgs();
    expect(args).not.toHaveProperty("previous_interaction_id");
    expect(args).not.toHaveProperty("previousInteractionId");
    expect(Object.keys(args).sort()).toEqual(["config", "contents", "model"]);
  });

  it("uses the model it was configured with", async () => {
    await ask([{ role: "user", content: "hola" }]);
    expect(sentArgs().model).toBe("gemini-2.5-flash-lite");
  });
});

describe("a usable answer", () => {
  it("comes back as ok, trimmed", async () => {
    generateContent.mockResolvedValue(ok("  respuesta  "));

    expect(await ask([{ role: "user", content: "hola" }])).toEqual({
      status: "ok",
      text: "respuesta",
    });
  });
});

describe("blocked or empty answers", () => {
  const expectFallback = async (response: unknown, reason: string) => {
    generateContent.mockResolvedValue(response);

    const result = await ask([{ role: "user", content: "hola" }]);

    expect(result.status).toBe("unavailable");
    if (result.status !== "unavailable") return;
    expect(result.text).toBe(es.chat.blockedReply);
    expect(result.reason).toBe(reason);
  };

  it("answers the Spanish fallback when a safety filter blocks the prompt", async () => {
    await expectFallback(
      { text: undefined, promptFeedback: { blockReason: "SAFETY" } },
      "SAFETY"
    );
  });

  it("answers the fallback when the candidate finishes on SAFETY", async () => {
    await expectFallback(
      { text: undefined, candidates: [{ finishReason: "SAFETY" }] },
      "SAFETY"
    );
  });

  it("answers the fallback on an empty reply with no explanation", async () => {
    await expectFallback({ text: "   " }, "empty response");
  });

  it("does NOT throw for any of these", async () => {
    generateContent.mockResolvedValue({ text: undefined });
    await expect(
      ask([{ role: "user", content: "hola" }])
    ).resolves.toBeDefined();
  });

  it("is a normal reply, not an error, so the panel shows no red box", async () => {
    generateContent.mockResolvedValue({ text: undefined });

    const result = await ask([{ role: "user", content: "hola" }]);
    // The route only 502s on "failed"; "unavailable" is answered as a turn.
    expect(result.status).not.toBe("failed");
  });
});

describe("failures", () => {
  it("turns a thrown SDK error into a failed result", async () => {
    generateContent.mockRejectedValue(new Error("invalid api key"));

    const result = await ask([{ role: "user", content: "hola" }]);

    expect(result.status).toBe("failed");
    if (result.status !== "failed") return;
    expect(result.reason).toBe("invalid api key");
  });

  it("survives a rejection that is not an Error", async () => {
    generateContent.mockRejectedValue("boom");

    const result = await ask([{ role: "user", content: "hola" }]);
    expect(result.status).toBe("failed");
  });
});

describe("the key", () => {
  it("is handed to the SDK and never returned or logged", async () => {
    const result = await ask([{ role: "user", content: "hola" }]);

    expect(constructed[0].apiKey).toBe("test-key");
    expect(JSON.stringify(result)).not.toContain("test-key");
  });
});
