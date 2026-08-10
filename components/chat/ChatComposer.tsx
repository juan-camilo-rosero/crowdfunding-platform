"use client";

import { useState, type KeyboardEvent } from "react";
import { ArrowUpIcon } from "lucide-react";
import { es } from "@/i18n";
import { MAX_MESSAGE_CHARS } from "@/hooks/use-chat";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export type ChatComposerProps = {
  onSend: (text: string) => void;
  disabled?: boolean;
};

/**
 * The message box.
 *
 * Enter sends, Shift+Enter breaks the line — the convention every chat uses, so
 * doing anything else would be the surprise. The field is a Textarea rather
 * than an Input precisely so the second half of that is possible.
 */
export function ChatComposer({ onSend, disabled = false }: ChatComposerProps) {
  const [value, setValue] = useState("");

  const canSend = value.trim().length > 0 && !disabled;

  function submit() {
    if (!canSend) return;
    onSend(value);
    setValue("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    submit();
  }

  return (
    <div className="flex items-end gap-2 rounded-[10px] border border-neutral-200 bg-stone-50 p-2">
      <Textarea
        textareaSize="compact"
        rows={1}
        // The server caps this too; here it just stops the user mid-word
        // instead of after a rejected request.
        maxLength={MAX_MESSAGE_CHARS}
        className="border-transparent bg-transparent focus-visible:border-transparent focus-visible:ring-0"
        placeholder={es.chat.placeholder}
        aria-label={es.chat.placeholder}
        value={value}
        disabled={disabled}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
      />

      <Button
        type="button"
        variant="brand"
        size="icon-sm"
        className="rounded-[5px]"
        aria-label={es.chat.send}
        disabled={!canSend}
        onClick={submit}
      >
        <ArrowUpIcon aria-hidden="true" />
      </Button>
    </div>
  );
}
