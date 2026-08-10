"use client";

import { useState } from "react";
import { MessageCircleIcon } from "lucide-react";
import { es } from "@/i18n";
import { useChat } from "@/hooks/use-chat";
import { Button } from "@/components/ui/button";
import { Scrim } from "@/components/ui/scrim";
import { ChatPanel } from "./ChatPanel";

/**
 * The floating button, the scrim, and the panel it opens.
 *
 * THE CONVERSATION LIVES HERE, not in the panel. This component sits in the
 * investor layout and is never unmounted, so closing the panel — by the X, by
 * Escape, or by clicking the scrim — puts the thread away without discarding
 * it, and reopening finds it exactly as it was. Only "Nuevo chat" clears it.
 * Nothing is persisted beyond the page: a reload starts over, by design.
 *
 * The FAB hides while the panel is open: on a phone the panel is full screen,
 * and on desktop it would sit on top of the scrim. The panel has its own close
 * button, so nothing becomes unreachable.
 *
 * Rendered only for someone with the investor capability — the endpoint checks
 * that again on every request.
 */
export function ChatLauncher() {
  const [open, setOpen] = useState(false);
  const chat = useChat();

  const close = () => setOpen(false);

  if (!open) {
    return (
      <Button
        type="button"
        variant="brand"
        // 44px, fully round: a comfortable touch target that reads as a bubble.
        className="fixed right-4 bottom-24 z-50 size-11 rounded-full outline outline-neutral-200 md:right-6 md:bottom-6"
        aria-label={es.chat.open}
        onClick={() => setOpen(true)}
      >
        <MessageCircleIcon className="size-5" aria-hidden="true" />
      </Button>
    );
  }

  return (
    <>
      {/* Dims the page and doubles as the dismiss target. */}
      <Scrim className="z-40" label={es.chat.closeFromOutside} onClick={close} />
      <ChatPanel chat={chat} onClose={close} />
    </>
  );
}
