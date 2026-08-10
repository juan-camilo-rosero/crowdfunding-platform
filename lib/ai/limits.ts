import type { ChatMessage } from "./types";

/**
 * Server-side limits for the chat.
 *
 * All of them are enforced HERE, in the route handler's path. The client has
 * its own copies of some of these numbers for a nicer experience (a disabled
 * send button beats a rejected request), but nothing depends on the client
 * honouring them — a hand-rolled POST hits exactly the same checks.
 */

/** One message. Longer than a paragraph is not a question, it is a payload. */
export const MAX_MESSAGE_CHARS = 1_000;

/**
 * Turns kept from the history the client sends. The rest is dropped, oldest
 * first, so a long conversation degrades into a shorter one instead of failing.
 */
export const MAX_HISTORY_MESSAGES = 30;

/**
 * User messages allowed in ONE conversation.
 *
 * Honest about what this is: the server has no memory (there is no history
 * table and none is being created), so it counts the messages the client
 * presents. Someone who edits their payload can reset that counter — which is
 * why the real ceiling is the rate limit below, and why this cap is about
 * keeping a runaway conversation cheap, not about stopping an attacker.
 */
export const MAX_USER_MESSAGES_PER_CONVERSATION = 25;

/** Requests per user per window. THIS is the abuse ceiling. */
export const RATE_LIMIT_MAX_REQUESTS = 20;
export const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;

/**
 * Keeps the most recent turns and drops the rest.
 *
 * Trimming from the front preserves what the conversation is currently about;
 * dropping the newest messages would answer a question the user is no longer
 * asking.
 */
export function trimHistory(
  messages: ChatMessage[],
  max: number = MAX_HISTORY_MESSAGES
): ChatMessage[] {
  return messages.length <= max ? messages : messages.slice(-max);
}

export function countUserMessages(messages: ChatMessage[]): number {
  return messages.filter((message) => message.role === "user").length;
}

/** True when this conversation has already used up its allowance. */
export function isConversationLimitReached(
  messages: ChatMessage[],
  max: number = MAX_USER_MESSAGES_PER_CONVERSATION
): boolean {
  return countUserMessages(messages) > max;
}

/**
 * Sliding-window rate limiter, in memory.
 *
 * Per process, so on Vercel each instance keeps its own counters and the real
 * ceiling is looser than the number suggests. That is a deliberate trade: it
 * costs nothing, needs no table, and stops the case that actually matters — one
 * session hammering the endpoint. If the platform ever needs a hard global
 * limit it moves to Redis or a Postgres counter behind this same function, with
 * no caller changes.
 */
const hits = new Map<string, number[]>();

export type RateLimitVerdict = {
  allowed: boolean;
  /** Seconds until the next request would be accepted. 0 when allowed. */
  retryAfterSeconds: number;
};

export function consumeRateLimit(
  userId: string,
  now: number = Date.now()
): RateLimitVerdict {
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const recent = (hits.get(userId) ?? []).filter(
    (timestamp) => timestamp > windowStart
  );

  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    hits.set(userId, recent);
    const oldest = recent[0];
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((oldest + RATE_LIMIT_WINDOW_MS - now) / 1000)
      ),
    };
  }

  recent.push(now);
  hits.set(userId, recent);
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Test seam: forgets every counter. */
export function resetRateLimits(): void {
  hits.clear();
}
