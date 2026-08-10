"use client";

import { useCallback, useRef, useState } from "react";
import { es } from "@/i18n";
import type { ChatMessage } from "@/lib/ai/types";

/**
 * The conversation, for as long as this browser session lasts.
 *
 * It is owned by ChatLauncher, which lives in the investor layout, so closing
 * the panel — or navigating between investor screens — leaves the thread
 * intact. Only "Nuevo chat" and a page reload clear it.
 *
 * NOTHING IS PERSISTED — not on the server (there is no history table) and not
 * here (no localStorage, no sessionStorage). A portfolio conversation is
 * exactly the kind of data that should not survive in a browser store, and
 * integrations.md asks for no history at all. Closing the tab ends it.
 *
 * The full history goes up with every request because the server cannot
 * remember it. That is what makes the chat multi-turn without state on the
 * server; the server still trims and caps whatever arrives.
 */

export const CHAT_ENDPOINT = "/api/chat";

export type ChatEntry = ChatMessage & { id: string };

export type ChatStatus = "idle" | "sending" | "error";

/** Mirrors lib/ai/limits.ts. A courtesy, not a control — the server decides. */
export const MAX_MESSAGE_CHARS = 1_000;

type ChatApiResponse = { reply?: string; error?: string; code?: string };

let sequence = 0;
const nextId = () => `m${++sequence}`;

export function useChat() {
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [starters, setStarters] = useState<string[]>([]);

  /** The message to resend if the last attempt failed. */
  const lastAttempt = useRef<{ text: string; history: ChatMessage[] } | null>(null);
  /** Guards the one-off chips fetch across reopens. */
  const startersRequested = useRef(false);

  const ask = useCallback(async (text: string, history: ChatMessage[]) => {
    lastAttempt.current = { text, history };
    setStatus("sending");
    setError(null);

    try {
      const response = await fetch(CHAT_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        // Only the turns. Identity and data are the server's business.
        body: JSON.stringify({ message: text, history }),
      });

      const payload = (await response
        .json()
        .catch(() => ({}))) as ChatApiResponse;

      if (!response.ok || !payload.reply) {
        setError(payload.error ?? es.chat.errors.generic);
        setStatus("error");
        return;
      }

      setMessages((current) => [
        ...current,
        { id: nextId(), role: "assistant", content: payload.reply! },
      ]);
      setStatus("idle");
      lastAttempt.current = null;
    } catch {
      // Offline, or the request never landed.
      setError(es.chat.errors.generic);
      setStatus("error");
    }
  }, []);

  /** Sends a message and appends it optimistically. */
  const send = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text || status === "sending") return;

      const history = messages.map(({ role, content }) => ({ role, content }));
      setMessages((current) => [
        ...current,
        { id: nextId(), role: "user", content: text },
      ]);
      void ask(text, history);
    },
    [ask, messages, status]
  );

  /**
   * Retries the message that failed. The user's turn is already on screen, so
   * it is not appended again — only the request is repeated.
   */
  const retry = useCallback(() => {
    const attempt = lastAttempt.current;
    if (!attempt || status === "sending") return;
    void ask(attempt.text, attempt.history);
  }, [ask, status]);

  /** "Nuevo chat": forgets everything and starts over. */
  const reset = useCallback(() => {
    lastAttempt.current = null;
    setMessages([]);
    setStatus("idle");
    setError(null);
  }, []);

  /**
   * Suggestion chips. Fetched once, when the panel first opens, so the layout
   * does not pay a query on every navigation. Failing is not worth reporting:
   * the empty state simply shows no chips.
   *
   * Idempotent, because the panel now opens and closes over a conversation that
   * outlives it — without the guard, every reopen would refetch the same chips.
   */
  const loadStarters = useCallback(async () => {
    if (startersRequested.current) return;
    startersRequested.current = true;

    try {
      const response = await fetch(CHAT_ENDPOINT);
      if (!response.ok) {
        startersRequested.current = false;
        return;
      }
      const payload = (await response.json()) as { starters?: string[] };
      if (Array.isArray(payload.starters)) setStarters(payload.starters);
    } catch {
      // No chips. The user can still type — and a retry is allowed, since
      // nothing was loaded.
      startersRequested.current = false;
    }
  }, []);

  return {
    messages,
    status,
    error,
    starters,
    send,
    retry,
    reset,
    loadStarters,
    isSending: status === "sending",
  };
}

export type UseChatResult = ReturnType<typeof useChat>;
