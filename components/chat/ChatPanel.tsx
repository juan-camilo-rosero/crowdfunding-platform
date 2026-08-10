"use client";

import { useEffect, useRef } from "react";
import { PenSquareIcon, XIcon } from "lucide-react";
import { es } from "@/i18n";
import type { UseChatResult } from "@/hooks/use-chat";
import { Button } from "@/components/ui/button";
import { ChatComposer } from "./ChatComposer";
import { RichText } from "./RichText";

export type ChatPanelProps = {
  /** Owned by ChatLauncher, so the thread outlives this component. */
  chat: UseChatResult;
  onClose: () => void;
};

/**
 * The conversation panel.
 *
 * Right-anchored and full height on desktop (320px), full screen below md — a
 * 320px column on a phone is a letterbox, not a chat. A scrim dims the page
 * behind it, so the conversation reads as the thing in focus.
 *
 * Purely presentational: the conversation lives in ChatLauncher so that
 * closing the panel does not throw it away. Nothing is persisted anywhere
 * regardless — see hooks/use-chat.ts.
 */
export function ChatPanel({ chat, onClose }: ChatPanelProps) {
  const { messages, error, starters, send, retry, reset, isSending, loadStarters } =
    chat;

  const endRef = useRef<HTMLDivElement>(null);

  // Chips come from the server (they name a real project of this investor), so
  // they are fetched when the panel opens rather than on every navigation.
  useEffect(() => {
    void loadStarters();
  }, [loadStarters]);

  // Keep the newest turn in view.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, isSending]);

  const isEmpty = messages.length === 0;

  return (
    <aside
      role="dialog"
      aria-label={es.chat.conversation}
      className="fixed inset-0 z-50 flex flex-col border-neutral-200 bg-zinc-100 shadow-xl md:inset-y-0 md:right-0 md:left-auto md:w-80 md:border-l"
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <header className="flex items-center gap-1 border-b border-neutral-200 px-4 py-3">
        <h2 className="flex-1 text-base font-medium text-stone-900">
          {es.chat.title}
        </h2>

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={es.chat.newChat}
          onClick={reset}
        >
          <PenSquareIcon aria-hidden="true" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={es.chat.close}
          onClick={onClose}
        >
          <XIcon aria-hidden="true" />
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {isEmpty ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <p className="text-base font-medium text-ink-900">
                {es.chat.emptyTitle}
              </p>
              <p className="text-sm text-ink-500">{es.chat.emptyHint}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              {starters.map((starter) => (
                <Button
                  key={starter}
                  type="button"
                  variant="brand"
                  size="sm"
                  className="h-auto rounded-full px-3 py-1.5 text-left whitespace-normal"
                  disabled={isSending}
                  onClick={() => send(starter)}
                >
                  {starter}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <ol className="flex flex-col gap-4">
            {messages.map((message) =>
              message.role === "user" ? (
                <li key={message.id} className="flex justify-end">
                  <span className="sr-only">{es.chat.youSaid}: </span>
                  <p className="max-w-[85%] rounded-2xl bg-stone-900 px-3 py-2 text-sm whitespace-pre-wrap text-white">
                    {message.content}
                  </p>
                </li>
              ) : (
                // No bubble for the assistant: it reads as the panel talking,
                // not as a second person in the room.
                <li key={message.id}>
                  <span className="sr-only">{es.chat.assistantSaid}: </span>
                  {/* Models answer in Markdown whether or not asked; printing
                      the raw string left asterisks on screen. */}
                  <RichText content={message.content} />
                </li>
              )
            )}
          </ol>
        )}

        {isSending ? (
          <p aria-live="polite" className="mt-4 text-sm text-ink-400">
            {es.chat.typing}
          </p>
        ) : null}

        {error ? (
          <div role="alert" className="mt-4 flex flex-col items-start gap-2">
            <p className="text-sm text-ink-700">{error}</p>
            <Button type="button" variant="outline" size="sm" onClick={retry}>
              {es.chat.retry}
            </Button>
          </div>
        ) : null}

        <div ref={endRef} />
      </div>

      <div className="flex flex-col gap-2 border-t border-neutral-200 px-4 py-3">
        <ChatComposer onSend={send} disabled={isSending} />
        <p className="text-xs text-ink-400">{es.chat.disclaimer}</p>
      </div>
    </aside>
  );
}
