/**
 * Chat with a language model, provider-agnostic.
 *
 * The rest of the app talks to these shapes and never to a vendor SDK, the same
 * way lib/email/types.ts hides the mail vendor. Swapping Claude for OpenAI or
 * Gemini means writing one adapter file, not touching any caller.
 */

/** A turn in the conversation. The system prompt is NOT one of these. */
export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ChatCompletionRequest = {
  /**
   * Behaviour rules. Always built on the server (lib/ai/system-prompt.ts) and
   * never influenced by the client.
   */
  system: string;
  /** Conversation so far, oldest first, ending with the new user message. */
  messages: ChatMessage[];
};

/**
 * What came back. Never throws — see AiProvider.
 *
 * `unavailable` is a first-class outcome, not a failure: with no provider
 * configured the chat is expected to answer politely rather than error, so the
 * UI can be built and used end to end before any model is connected.
 */
export type ChatCompletionResult =
  | { status: "ok"; text: string }
  | { status: "unavailable"; text: string; reason: string }
  | { status: "failed"; reason: string };

export type AiProvider = {
  /** Provider name, for logs. Never shown to the user. */
  readonly name: string;
  /**
   * Produces one reply. MUST NOT throw: every failure comes back as a result,
   * so a caller can never be broken by the model layer.
   */
  generateChatCompletion: (
    request: ChatCompletionRequest
  ) => Promise<ChatCompletionResult>;
  /**
   * Token-by-token variant. Optional on purpose: the door is open for a
   * streaming UI later without forcing every adapter to implement it today.
   * A caller must check for its presence and fall back to the method above.
   */
  generateChatCompletionStream?: (
    request: ChatCompletionRequest
  ) => AsyncIterable<string>;
};
