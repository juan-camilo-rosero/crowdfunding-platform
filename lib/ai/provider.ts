import "server-only";
import { createAnthropicProvider, DEFAULT_MODEL } from "./providers/anthropic";
import { createGeminiProvider } from "./providers/gemini";
import { createMockProvider } from "./providers/mock";
import type {
  AiProvider,
  ChatCompletionRequest,
  ChatCompletionResult,
} from "./types";

/**
 * Switchable chat provider, following lib/email/provider.ts.
 *
 * Chosen by AI_PROVIDER; defaults to a mock that answers "the assistant is not
 * available yet". That default is the point: the chat — auth, scoping, limits,
 * UI — must work end to end before any model is connected, and must keep
 * working if a key is missing or revoked.
 *
 * `server-only` makes it a build error to import this from a client component,
 * so the model API key cannot end up in a browser bundle by accident.
 *
 * Environment:
 *   AI_PROVIDER      "gemini" | "anthropic" | "mock" (default: inferred, below)
 *   GEMINI_API_KEY   server-only, never NEXT_PUBLIC_
 *   GEMINI_MODEL     required by the Gemini adapter; never hardcoded, because
 *                    the right model is an operational choice, not a code one
 *   AI_API_KEY       key for the Anthropic adapter (or a generic fallback)
 *   AI_MODEL         optional override of the Anthropic default model
 *
 * Adding a provider: one file in ./providers, one case below. No caller changes.
 */

let cached: AiProvider | null = null;
/**
 * The env that produced `cached`.
 *
 * Memoising on its own is a trap: Next reloads .env.local on change, but a
 * provider resolved before that edit keeps the old key until the server is
 * restarted — so fixing a misconfiguration appears to do nothing. Keying the
 * cache on the values means an env edit takes effect on the next request, while
 * still resolving once per configuration. (Learned the hard way in lib/email.)
 */
let cachedKey: string | null = null;

function envFingerprint(): string {
  return [
    process.env.AI_PROVIDER,
    process.env.AI_API_KEY,
    process.env.ANTHROPIC_API_KEY,
    process.env.AI_MODEL,
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_MODEL,
  ].join("|");
}

/** Generic key first, provider-specific as a fallback. */
function resolveApiKey(): string | undefined {
  return (
    process.env.AI_API_KEY?.trim() ||
    process.env.ANTHROPIC_API_KEY?.trim() ||
    undefined
  );
}

/**
 * Falls back to the mock and says why in the log.
 *
 * Without the log, a deployment that names a provider but is missing a variable
 * looks identical to one with no provider at all: the chat answers "not
 * available yet" and nothing explains it.
 */
function fallbackToMock(reason: string): AiProvider {
  console.info(`[ai] falling back to the mock provider — ${reason}`);
  return createMockProvider(reason);
}

function resolveProvider(): AiProvider {
  const configured = process.env.AI_PROVIDER?.trim().toLowerCase();

  // An explicit opt-out always wins, so a deployment can turn the model off
  // without removing its credentials.
  if (configured === "mock" || configured === "none") {
    return createMockProvider(`AI_PROVIDER=${configured}`);
  }

  // Gemini: its own key and model, both required. The model is deliberately not
  // defaulted — picking one silently would hide a misconfiguration behind a
  // model nobody chose, with its own cost and behaviour.
  if (configured === "gemini") {
    const geminiKey = process.env.GEMINI_API_KEY?.trim();
    const geminiModel = process.env.GEMINI_MODEL?.trim();

    if (!geminiKey) return fallbackToMock("GEMINI_API_KEY is not set");
    if (!geminiModel) return fallbackToMock("GEMINI_MODEL is not set");

    return createGeminiProvider(geminiKey, geminiModel);
  }

  const apiKey = resolveApiKey();
  const model = process.env.AI_MODEL?.trim() || DEFAULT_MODEL;

  // With no provider named, having a key is taken as the intent to use it.
  if ((configured === "anthropic" || !configured) && apiKey) {
    return createAnthropicProvider(apiKey, model);
  }

  if (configured === "anthropic" && !apiKey) {
    return fallbackToMock("AI_API_KEY is not set");
  }

  if (configured) {
    return fallbackToMock(`unknown AI_PROVIDER "${configured}"`);
  }

  return createMockProvider("no AI provider configured");
}

/** The active provider. Re-resolved whenever the relevant env changes. */
export function getAiProvider(): AiProvider {
  const key = envFingerprint();
  if (!cached || cachedKey !== key) {
    cached = resolveProvider();
    cachedKey = key;
  }
  return cached;
}

/** Test seam: drops the memoised provider. */
export function resetAiProvider(): void {
  cached = null;
  cachedKey = null;
}

/**
 * Produces one reply and NEVER lets a model problem reach the caller as a throw.
 *
 * This is the function features should use. Even though adapters promise not to
 * throw, this wraps them anyway: a bug in an adapter must not turn into a 500
 * on a screen the user is looking at.
 */
export async function generateChatCompletion(
  request: ChatCompletionRequest
): Promise<ChatCompletionResult> {
  const provider = getAiProvider();

  try {
    const result = await provider.generateChatCompletion(request);
    if (result.status === "failed") {
      console.error(`[ai:${provider.name}] failed — ${result.reason}`);
    }
    return result;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown error";
    console.error(`[ai:${provider.name}] threw — ${reason}`);
    return { status: "failed", reason };
  }
}

export type {
  AiProvider,
  ChatCompletionRequest,
  ChatCompletionResult,
} from "./types";
