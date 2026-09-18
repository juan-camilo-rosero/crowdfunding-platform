"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ImageIcon, StarIcon, TrashIcon, UploadIcon } from "lucide-react";
import { es } from "@/i18n";
import { formatBytes } from "@/lib/format";
import {
  CONVERTIBLE_IMAGE_TYPES,
  compressImage,
} from "@/lib/projects/image-compression";
import {
  runPhotoPipeline,
  type PipelineDeps,
  type PipelineProgress,
} from "@/lib/projects/photo-pipeline";
import {
  removeUploadedObjects,
  uploadPhotosToStorage,
} from "@/lib/projects/photo-upload";
import {
  ACCEPTED_IMAGE_TYPES,
  type ProjectPhotosResult,
} from "@/lib/projects/photos";
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
import {
  attachProjectPhotos,
  removeProjectPhoto,
  setProjectCoverPhoto,
  uploadProjectPhotos,
} from "@/app/(admin)/admin/photo-actions";

/** The real steps of the pipeline; tests replace the modules behind them. */
const PIPELINE_DEPS: PipelineDeps = {
  compress: (file) => compressImage(file),
  uploadDirect: uploadPhotosToStorage,
  attach: attachProjectPhotos,
  uploadViaServer: uploadProjectPhotos,
  removeObjects: removeUploadedObjects,
};

/**
 * What the picker offers: the bucket's formats plus HEIC, which is converted
 * on the way. Extensions too, because several systems label HEIC with no type.
 */
const PICKER_ACCEPT = [
  ...ACCEPTED_IMAGE_TYPES,
  ...CONVERTIBLE_IMAGE_TYPES,
  ".heic",
  ".heif",
].join(",");

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
 * Manages the photos of one project. Used from the admin grid AND from the
 * project page in the catalogue, which is why it lives here rather than under
 * app/(admin).
 *
 * Not built on FormDialog: that shell is for forms that submit once and close,
 * and this is a workspace — each upload and each removal is its own committed
 * action, so there is no "save" and nothing to cancel. It uses the same Dialog
 * primitive underneath, so the framing is identical.
 *
 * The list held here is whatever the server last confirmed, never an optimistic
 * guess: a photo that failed to upload must not appear as though it had.
 *
 * THE FAILURE MODE THIS FIXES: an upload that never answered left the dialog
 * on "Subiendo…" forever, and since it refused to close while it believed work
 * was in flight, the only way out was reloading the page — which threw away
 * every edit made in the grid behind it. Three things changed: the file goes
 * straight to Storage (no serverless body limit to hit), every call is wrapped
 * so a rejection becomes a message instead of a frozen promise, and the dialog
 * can always be closed.
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
  const [progress, setProgress] = useState<PipelineProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** What optimising saved, after a successful upload. */
  const [note, setNote] = useState<string | null>(null);

  function commit(next: string[]) {
    setPhotos(next);
    onPhotosChange?.(next);
  }

  /**
   * Every server call goes through here. A Server Action can REJECT — a lost
   * connection, a body the platform refused, a crash on the server — and an
   * unguarded `await` on a rejected action is what froze this dialog.
   */
  async function run(action: () => Promise<ProjectPhotosResult>) {
    setIsBusy(true);
    setError(null);
    setNote(null);

    try {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      commit(result.photos);
    } catch {
      setError(es.admin.photos.errors.unexpected);
    } finally {
      setIsBusy(false);
      setProgress(null);
    }
  }

  async function handleFiles(files: File[]) {
    if (files.length === 0) return;

    setIsBusy(true);
    setError(null);
    setNote(null);
    setProgress({ phase: "optimizing", done: 0, total: files.length });

    try {
      // Refuse, optimise, upload, attach — see lib/projects/photo-pipeline.ts.
      // It never throws and always says what happened.
      const result = await runPhotoPipeline(projectId, files, PIPELINE_DEPS, setProgress);

      if (result.ok) {
        commit(result.photos);
        if (result.optimized > 0) {
          const template =
            result.optimized === 1
              ? es.admin.photos.optimizedNoteOne
              : es.admin.photos.optimizedNote.replace("{n}", String(result.optimized));
          setNote(
            template
              .replace("{from}", formatBytes(result.originalBytes))
              .replace("{to}", formatBytes(result.finalBytes))
          );
        }
        return;
      }

      // Some photos may have made it before the failure: show them, since
      // they ARE on the project now, and let the message say which did not.
      if (result.photos) commit(result.photos);
      setError(result.error);
    } catch {
      setError(es.admin.photos.errors.unexpected);
    } finally {
      setIsBusy(false);
      setProgress(null);
    }
  }

  return (
    <Dialog
      open={open}
      // Closing is ALWAYS allowed. An upload in flight keeps going and commits
      // on its own; being unable to leave a dialog is how unsaved work in the
      // screen behind it got lost.
      onOpenChange={onOpenChange}
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
          <ul className="grid max-h-[45vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3 scrollbar-thin">
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

                {/* Only offered where it would change something. */}
                {index !== 0 ? (
                  <button
                    type="button"
                    onClick={() =>
                      void run(() => setProjectCoverPhoto({ projectId, url }))
                    }
                    disabled={isBusy}
                    aria-label={es.admin.photos.makeCoverLabel}
                    title={es.admin.photos.makeCoverLabel}
                    className={cn(
                      "absolute top-1.5 left-1.5 flex size-7 cursor-pointer items-center justify-center rounded-[5px]",
                      "bg-elevated/90 text-ink-700 transition-colors hover:bg-brand hover:text-brand-foreground",
                      "disabled:cursor-default disabled:opacity-50"
                    )}
                  >
                    <StarIcon className="size-3.5" aria-hidden="true" />
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() =>
                    void run(() => removeProjectPhoto({ projectId, url }))
                  }
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

        {/* Which step, which file of how many: a single spinner over six
            photos says nothing about whether it is moving. */}
        {progress ? (
          <p aria-live="polite" className="text-sm text-ink-500">
            {(progress.phase === "optimizing"
              ? es.admin.photos.progressOptimizing
              : es.admin.photos.progress
            )
              .replace("{n}", String(Math.min(progress.done + 1, progress.total)))
              .replace("{total}", String(progress.total))}
          </p>
        ) : null}

        {note ? (
          <p role="status" className="text-sm text-ink-500">
            {note}
          </p>
        ) : null}

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
            accept={PICKER_ACCEPT}
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
            loadingText={
              progress?.phase === "optimizing"
                ? es.admin.photos.optimizing
                : es.admin.photos.uploading
            }
            onClick={() => inputRef.current?.click()}
          >
            <UploadIcon data-icon="inline-start" aria-hidden="true" />
            {es.admin.photos.addLabel}
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            {es.admin.photos.close}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
