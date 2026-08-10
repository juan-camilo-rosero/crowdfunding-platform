import { GoogleGenAI } from "@google/genai";
import { es } from "@/i18n";
import type {
  AiProvider,
  ChatCompletionRequest,
  ChatCompletionResult,
} from "../types";

/**
 * Gemini adapter (@google/genai).
 *
 * The ONLY file in the project that imports the Google SDK. Everything else —
 * the route handler, the context builder, the UI — talks to the AiProvider
 * interface and cannot tell which vendor is behind it.
 *
 * STATELESS ON PURPOSE. This uses `ai.models.generateContent`, which takes the
 * whole conversation on every call, NOT the stateful interactions API with
 * `previous_interaction_id`. That one would park the thread on Google's servers,
 * and integrations.md is explicit that this chatbot keeps no persistent history
 * — not in our database and, by the same reasoning, not in someone else's.
 *
 * The API key comes from the server environment only. This module is reached
 * exclusively through lib/ai/provider.ts, which is `server-only`, so the key
 * cannot end up in a browser bundle.
 */

/** Gemini names the assistant's turns "model". Ours are "assistant". */
function toGeminiContents(request: ChatCompletionRequest) {
  return request.messages.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }));
}

export function createGeminiProvider(apiKey: string, model: string): AiProvider {
  // One client per resolved configuration; provider.ts memoises this adapter.
  const ai = new GoogleGenAI({ apiKey });

  return {
    name: "gemini",

    async generateChatCompletion(
      request: ChatCompletionRequest
    ): Promise<ChatCompletionResult> {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: toGeminiContents(request),
          config: {
            // The system prompt is a FIELD, never a turn. That is what keeps a
            // user message from ever being read as an instruction, and it is
            // built on the server (lib/ai/system-prompt.ts) on every request.
            systemInstruction: request.system,
          },
        });

        const text = response.text?.trim();

        if (text) return { status: "ok", text };

        // Nothing usable: a safety filter tripped on the prompt or the answer,
        // or the model simply returned empty. Reported as a normal reply rather
        // than an error — the user asked something that will not be answered,
        // and a red error box would misdescribe that.
        const reason =
          response.promptFeedback?.blockReason ??
          response.candidates?.[0]?.finishReason ??
          "empty response";

        return {
          status: "unavailable",
          text: es.chat.blockedReply,
          reason: String(reason),
        };
      } catch (error) {
        // A bad key, a quota, a network blip. Never a throw — the endpoint
        // turns this into a 502 with Spanish copy and a retry.
        return {
          status: "failed",
          reason: error instanceof Error ? error.message : "unknown error",
        };
      }
    },
  };
}
