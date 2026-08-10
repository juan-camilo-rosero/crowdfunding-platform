import { z } from "zod";
import { MAX_MESSAGE_CHARS } from "./limits";
import type { ChatMessage } from "./types";

/**
 * What the client is allowed to send to /api/chat.
 *
 * Two things this schema does that matter for security:
 *
 *  - It is a WHITELIST. Zod strips unknown keys by default, so a payload
 *    carrying `investorId`, `context`, `system`, `userId` or anything else
 *    hopeful never reaches the handler. Identity and data come from the
 *    session; there is no field here through which to suggest otherwise.
 *  - `role` admits only "user" and "assistant". A client cannot smuggle in a
 *    "system" turn to sit alongside the server's own instructions.
 *
 * The assistant turns in `messages` ARE client-supplied — the server keeps no
 * history — so they are untrusted text. That is acceptable because they only
 * ever shape the wording of a reply that is still grounded in a context the
 * client cannot touch: the worst case is a user misleading themselves.
 */

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z
    .string()
    .trim()
    .min(1)
    .max(MAX_MESSAGE_CHARS),
});

export const chatRequestSchema = z.object({
  /** The new question. */
  message: z.string().trim().min(1).max(MAX_MESSAGE_CHARS),
  /**
   * This session's conversation so far, oldest first, WITHOUT the new message.
   * Optional: a first turn sends nothing.
   */
  history: z.array(messageSchema).max(200).default([]),
});

export type ChatRequestPayload = {
  message: string;
  history: ChatMessage[];
};

export type ParsedChatRequest =
  | { ok: true; payload: ChatRequestPayload }
  | { ok: false };

/** Parses an unknown body. Never throws; the caller decides the status code. */
export function parseChatRequest(body: unknown): ParsedChatRequest {
  const result = chatRequestSchema.safeParse(body);
  if (!result.success) return { ok: false };

  return {
    ok: true,
    payload: { message: result.data.message, history: result.data.history },
  };
}
