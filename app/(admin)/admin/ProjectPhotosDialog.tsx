"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ImageIcon, TrashIcon, UploadIcon } from "lucide-react";
import { es } from "@/i18n";
import { ACCEPTED_IMAGE_TYPES } from "@/lib/projects/photos";
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
import { removeProjectPhoto, uploadProjectPhotos } from "./photo-actions";

export type ProjectPhotosDialogProps = {
  projectId: string;
  projectName: string;
  initialPhotos: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Lets the trigger show the new count without a full reload. */
  onPhotosChange?: (photos: string[]) => void;
};

/**
 * Manages the photos of one project.
 *
 * Not built on FormDialog: that shell is for forms that submit once and close,
 * and this is a workspace — each upload and each removal is its own committed
 * action, so there is no "save" and nothing to cancel. It uses the same Dialog
 * primitive underneath, so the framing is identical.
 *
 * The list held here is whatever the server last confirmed, never an optimistic
 * guess: a photo that failed to upload must not appear as though it had.
 */
export function ProjectPhotosDialog({
  projectId,
  projectName,
  initialPhotos,
  open,
  onOpenChange,
  onPhotosChange,
}: ProjectPhotosDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const [photos, setPhotos] = useState<string[]>(initialPhotos);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function commit(next: string[]) {
    setPhotos(next);
    onPhotosChange?.(next);
  }

  async function handleFiles(files: File[]) {
    if (files.length === 0) return;

    setIsBusy(true);
    setError(null);

    const formData = new FormData();
    formData.append("projectId", projectId);
    files.forEach((file) => formData.append("files", file));

    const result = await uploadProjectPhotos(formData);

    setIsBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    commit(result.photos);
  }

  async function handleRemove(url: string) {
    setIsBusy(true);
    setError(null);

    const result = await removeProjectPhoto({ projectId, url });

    setIsBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    commit(result.photos);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // An upload in flight must not be abandoned halfway.
        if (isBusy && !next) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{es.admin.photos.title}</DialogTitle>
          <DialogDescription>
            {projectName} · {es.admin.photos.description}
          </DialogDescription>
        </DialogHeader>

        {photos.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-[5px] border border-line bg-surface px-6 py-10 text-center">
            <ImageIcon className="size-6 text-ink-400" aria-hidden="true" />
            <p className="text-base font-medium text-ink-900">
              {es.admin.photos.empty}
            </p>
            <p className="text-sm text-ink-500">{es.admin.photos.emptyHint}</p>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((url, index) => (
              <li
                key={url}
                className="group relative aspect-4/3 overflow-hidden rounded-[5px] border border-line bg-surface"
              >
                <Image
                  src={url}
                  alt=""
                  fill
                  sizes="200px"
                  className="object-cover"
                  // Uploaded to our own public bucket; Next cannot know its
                  // dimensions ahead of time, and optimising it again buys
                  // nothing here in the admin panel.
                  unoptimized
                />

                {/* The catalogue card uses main_photos[0]. */}
                {index === 0 ? (
                  <span className="absolute top-1.5 left-1.5 rounded-[500px] bg-brand px-2 py-0.5 text-xs font-medium text-brand-foreground">
                    {es.admin.photos.coverBadge}
                  </span>
                ) : null}

                <button
                  type="button"
                  onClick={() => handleRemove(url)}
                  disabled={isBusy}
                  aria-label={es.admin.photos.removeLabel}
                  className={cn(
                    "absolute top-1.5 right-1.5 flex size-7 cursor-pointer items-center justify-center rounded-[5px]",
                    "bg-elevated/90 text-ink-700 transition-colors hover:bg-destructive/10 hover:text-destructive",
                    "disabled:cursor-default disabled:opacity-50"
                  )}
                >
                  <TrashIcon className="size-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {error ? (
          <p
            role="alert"
            className="rounded-[5px] bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        ) : null}

        <p className="text-xs text-ink-400">{es.admin.photos.hint}</p>

        <DialogFooter className="sm:justify-between">
          {/* A hidden input behind a real Button: the native file control cannot
              be styled, and controls come from components/ui. */}
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPTED_IMAGE_TYPES.join(",")}
            className="hidden"
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              // Reset first, so picking the same file twice fires again.
              event.target.value = "";
              void handleFiles(files);
            }}
          />

          <Button
            type="button"
            variant="brand"
            loading={isBusy}
            loadingText={es.admin.photos.uploading}
            onClick={() => inputRef.current?.click()}
          >
            <UploadIcon data-icon="inline-start" aria-hidden="true" />
            {es.admin.photos.addLabel}
          </Button>

          <Button
            type="button"
            variant="ghost"
            disabled={isBusy}
            onClick={() => onOpenChange(false)}
          >
            {es.admin.photos.close}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
