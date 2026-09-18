"use client";

import { useState } from "react";
import { PencilIcon } from "lucide-react";
import { es } from "@/i18n";
import {
  describeReturnOffer,
  draftToOffer,
  offerToDraft,
  parseReturnOffer,
  serializeReturnOffer,
  type ReturnOfferDraft,
} from "@/lib/projects/return-offer";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ReturnOfferEditor } from "@/components/project/ReturnOfferEditor";

const t = es.returnOffer;

export type ReturnOfferCellProps = {
  /** The stored offer (jsonb object) or the JSON string of a local edit. */
  value: unknown;
  /** Legacy free text shown, muted, while there is no offer. */
  fallbackValue?: unknown;
  /** Receives the canonical JSON, or "" to withdraw the offer. */
  onCommit: (value: string) => void;
  readOnly?: boolean;
};

/**
 * Grid cell for `type: "returnOffer"`.
 *
 * Reads as the label the catalogue prints. Editing happens in a dialog, not in
 * the 41px cell: an offer is several numbers with a structure, and cramming
 * that into a cell is how the old free text got typed in the first place.
 *
 * Nothing is committed until "Guardar retorno", nothing if the offer did not
 * change, and never while it is invalid — the dialog stays open on the reason.
 */
export function ReturnOfferCell({
  value,
  fallbackValue,
  onCommit,
  readOnly = false,
}: ReturnOfferCellProps) {
  const offer = parseReturnOffer(value);
  const label = describeReturnOffer(offer);
  const legacy =
    !offer && typeof fallbackValue === "string" ? fallbackValue.trim() : "";

  const [draft, setDraft] = useState<ReturnOfferDraft | null>(null);
  const [error, setError] = useState<string | null>(null);

  function open() {
    if (readOnly) return;
    setDraft(offerToDraft(offer));
    setError(null);
  }

  function close() {
    setDraft(null);
    setError(null);
  }

  function save() {
    if (!draft) return;
    const result = draftToOffer(draft);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const next = serializeReturnOffer(result.offer);
    if (next !== serializeReturnOffer(offer)) onCommit(next);
    close();
  }

  return (
    <>
      <div
        onDoubleClick={open}
        className={cn(
          "group/cell flex h-full items-center gap-1 px-6.25 text-base text-ink-700",
          !readOnly && "cursor-text hover:bg-surface"
        )}
      >
        <span className={cn("min-w-0 truncate", !label && legacy && "text-ink-400 italic")}>
          {label || (legacy ? t.legacy.replace("{text}", legacy) : "")}
        </span>

        {readOnly ? null : (
          <button
            type="button"
            onClick={open}
            aria-label={`${t.edit}: ${label || legacy || es.admin.emptyValue}`}
            className={cn(
              "ml-auto flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-[5px]",
              "text-ink-400 opacity-0 transition-[opacity,background-color,color] outline-none",
              "hover:bg-line hover:text-ink-900",
              "group-hover/cell:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50"
            )}
          >
            <PencilIcon className="size-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      {draft ? (
        <Dialog open onOpenChange={(next) => (next ? null : close())}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t.title}</DialogTitle>
              <DialogDescription>{t.description}</DialogDescription>
            </DialogHeader>

            <ReturnOfferEditor
              draft={draft}
              onDraftChange={(next) => {
                setDraft(next);
                setError(null);
              }}
            />

            {error ? (
              <p
                role="alert"
                className="rounded-[5px] bg-destructive/10 px-4 py-3 text-sm text-destructive"
              >
                {error}
              </p>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={close}>
                {t.cancel}
              </Button>
              <Button type="button" variant="brand" onClick={save}>
                {t.save}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
