import type {
  AiProvider,
  ChatCompletionRequest,
  ChatCompletionResult,
} from "../types";

/**
 * Claude adapter (Anthropic Messages API).
 *
 * Written against the HTTP endpoint rather than the SDK: it is one POST, and it
 * keeps the dependency out of the server bundle. Adding OpenAI or Gemini means
 * another file exactly like this one plus a case in lib/ai/provider.ts —
 * nothing else in the app changes.
 *
 * The API key reaches this module from the server environment only. It is never
 * NEXT_PUBLIC_ and this file is only ever imported by provider.ts, which is
 * `server-only`.
 */

const ENDPOINT = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";

/** Enough for a grounded answer about a portfolio, short enough to stay quick. */
const MAX_TOKENS = 1024;
export const DEFAULT_MODEL = "claude-sonnet-5";

/** Anthropic takes the system prompt as a top-level field, not as a message. */
type AnthropicResponse = {
  content?: { type: string; text?: string }[];
  error?: { message?: string };
};

export function createAnthropicProvider(
  apiKey: string,
  model: string = DEFAULT_MODEL
): AiProvider {
  return {
    name: "anthropic",

    async generateChatCompletion(
      request: ChatCompletionRequest
    ): Promise<ChatCompletionResult> {
      try {
        const response = await fetch(ENDPOINT, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": API_VERSION,
          },
          body: JSON.stringify({
            model,
            max_tokens: MAX_TOKENS,
            // Authoritative and separate from the turns, so no user message can
            // be mistaken for an instruction.
            system: request.system,
            messages: request.messages.map((message) => ({
              role: message.role,
              content: message.content,
            })),
          }),
        });

        const payload = (await response.json()) as AnthropicResponse;

        if (!response.ok) {
          return {
            status: "failed",
            reason:
              payload.error?.message ?? `HTTP ${response.status}`,
          };
        }

        const text = (payload.content ?? [])
          .filter((block) => block.type === "text")
          .map((block) => block.text ?? "")
          .join("")
          .trim();

        if (!text) {
          return { status: "failed", reason: "empty response" };
        }

        return { status: "ok", text };
      } catch (error) {
        // A network blip must come back as a result, never as a throw.
        return {
          status: "failed",
          reason: error instanceof Error ? error.message : "unknown error",
        };
      }
    },
  };
}
