"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ImageIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import { es } from "@/i18n";
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
import { ACCEPTED_IMAGE_TYPES } from "@/lib/projects/photos";
import { LOGIN_SLIDES_FOLDER, type LoginSlide } from "@/lib/site/login-slides";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/ui/form-dialog";
import { Input } from "@/components/ui/input";
import {
  addLoginSlides,
  deleteLoginSlide,
  reorderLoginSlides,
  setLoginSlideCaption,
} from "./actions";

const t = es.adminLogin;

const PICKER_ACCEPT = [
  ...ACCEPTED_IMAGE_TYPES,
  ...CONVERTIBLE_IMAGE_TYPES,
  ".heic",
  ".heif",
].join(",");

export type LoginSlidesPanelProps = {
  /** What the login shows right now: the configured slides, or the bundled ones. */
  slides: LoginSlide[];
  /** True while no slide is configured and the bundled images are in use. */
  usingDefaults: boolean;
};

/**
 * Admin screen for the login carousel.
 *
 * Uploading reuses the project photo pipeline wholesale — the same validation,
 * the same browser-side optimisation, the same error handling — with two
 * differences: the destination folder is `login/` instead of a project id, and
 * there is no Server Action fallback, because this screen has none. Reusing it
 * is deliberate: the upload path that was hardened against hangs and partial
 * failures is not worth writing a second time.
 *
 * While no slide exists the screen shows the bundled images as a preview and
 * offers only "add": there is nothing to order, rename or delete yet, and
 * pretending otherwise would promise edits the app cannot make to files that
 * ship inside it.
 */
export function LoginSlidesPanel({ slides, usingDefaults }: LoginSlidesPanelProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [isBusy, setIsBusy] = useState(false);
  const [progress, setProgress] = useState<PipelineProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<{ slide: LoginSlide; index: number } | null>(
    null
  );
  const [isRemoving, setIsRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  /** The pipeline, wired to this screen: no project row, no server fallback. */
  const deps: PipelineDeps = {
    compress: (file) => compressImage(file),
    uploadDirect: uploadPhotosToStorage,
    attach: async ({ urls }) => {
      const result = await addLoginSlides({ urls });
      return result.ok ? { ok: true, photos: urls } : { ok: false, error: result.error };
    },
    removeObjects: removeUploadedObjects,
  };

  async function handleFiles(files: File[]) {
    if (files.length === 0) return;

    setIsBusy(true);
    setError(null);
    setProgress({ phase: "optimizing", done: 0, total: files.length });

    try {
      const result = await runPhotoPipeline(
        LOGIN_SLIDES_FOLDER,
        files,
        deps,
        setProgress
      );

      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    } catch {
      setError(t.errors.saveFailed);
    } finally {
      setIsBusy(false);
      setProgress(null);
    }
  }

  /** Saves the caption only when it actually changed. */
  async function handleCaption(slide: LoginSlide, caption: string) {
    if (caption.trim() === (slide.caption ?? "")) return;

    setError(null);
    try {
      const result = await setLoginSlideCaption({ id: slide.id, caption });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    } catch {
      setError(t.errors.saveFailed);
    }
  }

  /** Sends the FULL new order, so no two slides can end up tied. */
  async function move(index: number, direction: -1 | 1) {
    const next = [...slides];
    const target = index + direction;
    [next[index], next[target]] = [next[target], next[index]];

    setError(null);
    try {
      const result = await reorderLoginSlides({ ids: next.map((slide) => slide.id) });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    } catch {
      setError(t.errors.saveFailed);
    }
  }

  async function handleRemove() {
    if (!removing) return;

    setIsRemoving(true);
    setRemoveError(null);
    try {
      const result = await deleteLoginSlide({ id: removing.slide.id });
      if (!result.ok) {
        setRemoveError(result.error);
        return;
      }
      setRemoving(null);
      router.refresh();
    } catch {
      setRemoveError(t.errors.saveFailed);
    } finally {
      setIsRemoving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {usingDefaults ? (
        <div className="flex flex-col gap-1 rounded-[10px] border border-line bg-surface px-5 py-4">
          <p className="text-base font-medium text-ink-900">{t.empty}</p>
          <p className="text-sm text-ink-500">{t.emptyHint}</p>
        </div>
      ) : null}

      <ul className="flex flex-col gap-3">
        {slides.map((slide, index) => {
          const number = String(index + 1);
          return (
            <li
              key={slide.id}
              className="flex flex-col gap-3 rounded-[10px] border border-line bg-elevated p-3 sm:flex-row sm:items-center"
            >
              <div className="relative h-24 w-full shrink-0 overflow-hidden rounded-[5px] bg-surface sm:w-40">
                <Image
                  src={slide.imageUrl}
                  alt=""
                  fill
                  sizes="160px"
                  className="object-cover"
                  unoptimized={slide.imageUrl.startsWith("http")}
                />
                {usingDefaults ? (
                  <span className="absolute top-1.5 left-1.5 rounded-[500px] bg-ink-900/80 px-2 py-0.5 text-xs font-medium text-white">
                    {t.usingDefaults}
                  </span>
                ) : null}
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <label
                  htmlFor={`caption-${slide.id}`}
                  className="text-sm font-medium text-ink-700"
                >
                  {t.captionLabel.replace("{n}", number)}
                </label>
                <Input
                  id={`caption-${slide.id}`}
                  inputSize="xl"
                  maxLength={120}
                  defaultValue={slide.caption ?? ""}
                  placeholder={t.captionPlaceholder}
                  disabled={usingDefaults}
                  onBlur={(event) => void handleCaption(slide, event.target.value)}
                />
              </div>

              {/* The bundled images are files inside the app: they can be
                  replaced by uploading, never reordered or deleted. */}
              {usingDefaults ? null : (
                <div className="flex shrink-0 items-center gap-1">
                  {index > 0 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t.moveUp.replace("{n}", number)}
                      onClick={() => void move(index, -1)}
                    >
                      <ArrowUpIcon aria-hidden="true" />
                    </Button>
                  ) : null}
                  {index < slides.length - 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t.moveDown.replace("{n}", number)}
                      onClick={() => void move(index, 1)}
                    >
                      <ArrowDownIcon aria-hidden="true" />
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="text-ink-400 hover:bg-destructive/10 hover:text-destructive"
                    aria-label={t.remove.replace("{n}", number)}
                    onClick={() => {
                      setRemoveError(null);
                      setRemoving({ slide, index });
                    }}
                  >
                    <Trash2Icon aria-hidden="true" />
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {progress ? (
        <p aria-live="polite" className="text-sm text-ink-500">
          {(progress.phase === "optimizing" ? t.progressOptimizing : t.progress)
            .replace("{n}", String(Math.min(progress.done + 1, progress.total)))
            .replace("{total}", String(progress.total))}
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded-[5px] bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
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
          loadingText={progress?.phase === "optimizing" ? t.optimizing : t.adding}
          onClick={() => inputRef.current?.click()}
        >
          <UploadIcon data-icon="inline-start" aria-hidden="true" />
          {t.add}
        </Button>

        <p className="text-xs text-ink-400">{t.hint}</p>
      </div>

      <FormDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
        title={t.remove.replace("{n}", String((removing?.index ?? 0) + 1))}
        onSubmit={handleRemove}
        submitLabel={t.remove.replace("{n}", String((removing?.index ?? 0) + 1))}
        submittingLabel={t.adding}
        isSubmitting={isRemoving}
        error={removeError}
      >
        {removing ? (
          <div className="flex items-center gap-3">
            <span className="relative h-20 w-32 shrink-0 overflow-hidden rounded-[5px] bg-surface">
              <Image
                src={removing.slide.imageUrl}
                alt=""
                fill
                sizes="128px"
                className="object-cover"
                unoptimized={removing.slide.imageUrl.startsWith("http")}
              />
            </span>
            <p className="text-sm text-ink-500">
              {removing.slide.caption ?? <ImageIcon className="size-4" aria-hidden="true" />}
            </p>
          </div>
        ) : null}
      </FormDialog>
    </div>
  );
}
