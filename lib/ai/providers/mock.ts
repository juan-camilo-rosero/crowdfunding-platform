import { es } from "@/i18n";
import type { AiProvider, ChatCompletionResult } from "../types";

/**
 * Default provider: answers without calling anything.
 *
 * This is the point of the default, not a placeholder to remove later. The chat
 * must work end to end — auth, scoping, limits, UI — before a model exists and
 * whenever a key is missing or revoked. A missing key degrades the answer, it
 * never breaks the screen.
 */
export function createMockProvider(reason: string): AiProvider {
  return {
    name: "mock",
    async generateChatCompletion(): Promise<ChatCompletionResult> {
      // From i18n/ like every other string the user reads — the panel renders
      // it as an ordinary turn, so it is UI copy however it is produced.
      return { status: "unavailable", text: es.chat.unavailableReply, reason };
    },
  };
}
