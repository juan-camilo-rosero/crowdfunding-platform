"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  ImageIcon,
  RefreshCwIcon,
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
  adoptDefaultLoginSlides,
  deleteLoginSlide,
  reorderLoginSlides,
  replaceLoginSlideImage,
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
 * TWO STATES, told apart on purpose. While nothing is configured the login
 * falls back to four images that live INSIDE the app; they are shown here as a
 * preview, never as editable rows, and the screen says plainly that uploading
 * one own image replaces that whole set — the alternative ("my four photos got
 * deleted") is what the first version of this screen caused. The way out is
 * offered right there: adopt the four as ordinary slides and edit them one by
 * one.
 *
 * Uploading reuses the project photo pipeline wholesale — same validation,
 * same browser-side optimisation, same error handling — with the destination
 * folder `login/` and no Server Action fallback.
 */
export function LoginSlidesPanel({ slides, usingDefaults }: LoginSlidesPanelProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  /** What the next file picked is for: a new slide, or replacing one. */
  const pickerTarget = useRef<{ mode: "add" } | { mode: "replace"; id: string }>({
    mode: "add",
  });

  const [isBusy, setIsBusy] = useState(false);
  const [progress, setProgress] = useState<PipelineProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAdopting, setIsAdopting] = useState(false);
  /** Id of the slide whose caption was just saved, for the inline confirmation. */
  const [savedCaption, setSavedCaption] = useState<string | null>(null);
  const [removing, setRemoving] = useState<{ slide: LoginSlide; index: number } | null>(
    null
  );
  const [isRemoving, setIsRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  /** The pipeline, wired to this screen: no project row, no server fallback. */
  function pipelineDeps(attach: (urls: string[]) => Promise<{ ok: boolean; error?: string }>): PipelineDeps {
    return {
      compress: (file) => compressImage(file),
      uploadDirect: uploadPhotosToStorage,
      attach: async ({ urls }) => {
        const result = await attach(urls);
        return result.ok
          ? { ok: true, photos: urls }
          : { ok: false, error: result.error ?? t.errors.saveFailed };
      },
      removeObjects: removeUploadedObjects,
    };
  }

  async function handleFiles(files: File[]) {
    if (files.length === 0) return;

    const target = pickerTarget.current;
    setIsBusy(true);
    setError(null);
    setProgress({ phase: "optimizing", done: 0, total: files.length });

    try {
      const result = await runPhotoPipeline(
        LOGIN_SLIDES_FOLDER,
        // Replacing is one image, whatever the picker returned.
        target.mode === "replace" ? files.slice(0, 1) : files,
        pipelineDeps((urls) =>
          target.mode === "replace"
            ? replaceLoginSlideImage({ id: target.id, url: urls[0] })
            : addLoginSlides({ urls })
        ),
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
      pickerTarget.current = { mode: "add" };
    }
  }

  function pickFor(target: { mode: "add" } | { mode: "replace"; id: string }) {
    pickerTarget.current = target;
    inputRef.current?.click();
  }

  async function handleAdopt() {
    setIsAdopting(true);
    setError(null);
    try {
      const result = await adoptDefaultLoginSlides();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    } catch {
      setError(t.errors.saveFailed);
    } finally {
      setIsAdopting(false);
    }
  }

  /** Saves the caption only when it actually changed, and says so. */
  async function handleCaption(slide: LoginSlide, caption: string) {
    if (caption.trim() === (slide.caption ?? "")) return;

    setError(null);
    setSavedCaption(null);
    try {
      const result = await setLoginSlideCaption({ id: slide.id, caption });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSavedCaption(slide.id);
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
        <section className="flex flex-col gap-4 rounded-[10px] border border-line bg-surface p-5">
          <div className="flex flex-col gap-1">
            <p className="text-base font-medium text-ink-900">{t.empty}</p>
            <p className="max-w-3xl text-sm text-ink-500">{t.emptyHint}</p>
          </div>

          {/* A preview, not a list of rows: these cannot be edited, and showing
              them as editable rows is what made them look deletable. */}
          <ul className="flex flex-wrap gap-3">
            {slides.map((slide) => (
              <li
                key={slide.id}
                className="relative h-20 w-32 overflow-hidden rounded-[5px] border border-line bg-elevated"
              >
                <Image src={slide.imageUrl} alt="" fill sizes="128px" className="object-cover" />
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-1">
            <Button
              type="button"
              variant="secondary"
              className="w-fit"
              loading={isAdopting}
              loadingText={t.adopting}
              onClick={() => void handleAdopt()}
            >
              <ImageIcon data-icon="inline-start" aria-hidden="true" />
              {t.adopt}
            </Button>
            <p className="text-xs text-ink-400">{t.adoptHint}</p>
          </div>
        </section>
      ) : (
        <ul className="flex flex-col gap-3">
          {slides.map((slide, index) => {
            const number = String(index + 1);
            return (
              <li
                key={slide.id}
                className="flex flex-col gap-3 rounded-[10px] border border-line bg-elevated p-3 sm:flex-row sm:items-center"
              >
                {/* The image IS the control that changes it: clicking the
                    thumbnail or its button opens the picker for this slide. */}
                <button
                  type="button"
                  aria-label={t.replace.replace("{n}", number)}
                  disabled={isBusy}
                  onClick={() => pickFor({ mode: "replace", id: slide.id })}
                  className="group/img relative h-24 w-full shrink-0 cursor-pointer overflow-hidden rounded-[5px] bg-surface outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default sm:w-40"
                >
                  <Image
                    src={slide.imageUrl}
                    alt=""
                    fill
                    sizes="160px"
                    className="object-cover transition-opacity group-hover/img:opacity-60"
                    unoptimized={slide.imageUrl.startsWith("http")}
                  />
                  <span className="absolute inset-0 flex items-center justify-center gap-1.5 bg-ink-900/60 text-xs font-medium text-white opacity-0 transition-opacity group-hover/img:opacity-100 group-focus-visible/img:opacity-100">
                    <RefreshCwIcon className="size-3.5" aria-hidden="true" />
                    {t.replaceShort}
                  </span>
                </button>

                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <label
                    htmlFor={`caption-${slide.id}`}
                    className="flex items-center gap-2 text-sm font-medium text-ink-700"
                  >
                    {t.captionLabel.replace("{n}", number)}
                    {savedCaption === slide.id ? (
                      <span
                        role="status"
                        className="inline-flex items-center gap-1 text-xs font-normal text-ink-500"
                      >
                        <CheckIcon className="size-3.5" aria-hidden="true" />
                        {t.captionSaved}
                      </span>
                    ) : null}
                  </label>
                  <Input
                    id={`caption-${slide.id}`}
                    inputSize="xl"
                    maxLength={120}
                    defaultValue={slide.caption ?? ""}
                    placeholder={t.captionPlaceholder}
                    onFocus={() => setSavedCaption(null)}
                    onBlur={(event) => void handleCaption(slide, event.target.value)}
                    onKeyDown={(event) => {
                      // Enter saves, like leaving the field.
                      if (event.key === "Enter") event.currentTarget.blur();
                    }}
                  />
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isBusy}
                    onClick={() => pickFor({ mode: "replace", id: slide.id })}
                  >
                    <RefreshCwIcon data-icon="inline-start" aria-hidden="true" />
                    {t.replaceShort}
                  </Button>

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

                  {/* The login needs at least one image, so the only slide
                      left offers no way to remove it. */}
                  {slides.length > 1 ? (
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
                  ) : (
                    <span className="max-w-40 text-xs text-ink-400">{t.lastSlideHint}</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

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
          onClick={() => pickFor({ mode: "add" })}
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
            <p className="text-sm text-ink-500">{removing.slide.caption ?? ""}</p>
          </div>
        ) : null}
      </FormDialog>
    </div>
  );
}
