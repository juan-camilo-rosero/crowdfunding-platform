import { beforeEach, describe, expect, it } from "vitest";
import {
  consumeRateLimit,
  countUserMessages,
  isConversationLimitReached,
  MAX_HISTORY_MESSAGES,
  MAX_USER_MESSAGES_PER_CONVERSATION,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_MS,
  resetRateLimits,
  trimHistory,
} from "./limits";
import type { ChatMessage } from "./types";

const turns = (count: number): ChatMessage[] =>
  Array.from({ length: count }, (_, index) => ({
    role: index % 2 === 0 ? "user" : "assistant",
    content: `m${index}`,
  }));

beforeEach(resetRateLimits);

describe("history trimming", () => {
  it("leaves a short conversation alone", () => {
    const messages = turns(4);
    expect(trimHistory(messages)).toBe(messages);
  });

  it("keeps the MOST RECENT turns", () => {
    const messages = turns(MAX_HISTORY_MESSAGES + 6);
    const trimmed = trimHistory(messages);

    expect(trimmed).toHaveLength(MAX_HISTORY_MESSAGES);
    // Dropping the newest would answer a question the user is no longer asking.
    expect(trimmed.at(-1)).toEqual(messages.at(-1));
    expect(trimmed[0]).toEqual(messages[6]);
  });
});

describe("the conversation cap", () => {
  it("counts only the user's turns", () => {
    expect(countUserMessages(turns(10))).toBe(5);
  });

  it("allows a conversation right at the cap", () => {
    const messages: ChatMessage[] = Array.from(
      { length: MAX_USER_MESSAGES_PER_CONVERSATION },
      () => ({ role: "user", content: "x" })
    );
    expect(isConversationLimitReached(messages)).toBe(false);
  });

  it("blocks the one past it", () => {
    const messages: ChatMessage[] = Array.from(
      { length: MAX_USER_MESSAGES_PER_CONVERSATION + 1 },
      () => ({ role: "user", content: "x" })
    );
    expect(isConversationLimitReached(messages)).toBe(true);
  });
});

describe("the rate limit", () => {
  it("allows up to the maximum in one window", () => {
    for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
      expect(consumeRateLimit("user-1").allowed).toBe(true);
    }
  });

  it("refuses the next one, with a retry hint", () => {
    for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) consumeRateLimit("user-1");

    const verdict = consumeRateLimit("user-1");
    expect(verdict.allowed).toBe(false);
    expect(verdict.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("counts each user separately", () => {
    for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) consumeRateLimit("user-1");

    // One noisy session must not lock out everybody else.
    expect(consumeRateLimit("user-2").allowed).toBe(true);
  });

  it("forgets hits once the window has passed", () => {
    const start = 1_000_000;
    for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
      consumeRateLimit("user-1", start);
    }
    expect(consumeRateLimit("user-1", start).allowed).toBe(false);

    expect(
      consumeRateLimit("user-1", start + RATE_LIMIT_WINDOW_MS + 1).allowed
    ).toBe(true);
  });

  it("does not consume an allowance on a refused request", () => {
    const start = 1_000_000;
    for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
      consumeRateLimit("user-1", start);
    }
    // Hammering while blocked must not push the window forward forever.
    consumeRateLimit("user-1", start + 1_000);
    consumeRateLimit("user-1", start + 2_000);

    expect(
      consumeRateLimit("user-1", start + RATE_LIMIT_WINDOW_MS + 1).allowed
    ).toBe(true);
  });
});
