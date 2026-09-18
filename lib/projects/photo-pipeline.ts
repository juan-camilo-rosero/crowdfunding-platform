import { es } from "@/i18n";
import {
  COMPRESSION,
  isConvertibleImage,
  normalizeImageType,
  type CompressionResult,
} from "./image-compression";
import type { DirectUploadResult } from "./photo-upload";
import {
  MAX_PHOTO_BYTES,
  MAX_SERVER_UPLOAD_BYTES,
  isAcceptedImage,
  type ProjectPhotosResult,
} from "./photos";
import type { UploadFailure } from "./upload-errors";

/**
 * The whole path of a photo from "picked" to "on the project", as one function
 * that never throws and always says what happened.
 *
 *   1. preflight   refuse what cannot be a photo, naming the file;
 *   2. optimise    shrink each photo in the browser (image-compression.ts);
 *   3. upload      straight to Storage, one by one (photo-upload.ts);
 *   4. attach      write the urls on the project row (Server Action).
 *
 * The failures it is built around, from real incidents:
 *   · an upload failing on photo 3 of 5 used to DELETE photos 1 and 2 while
 *     telling the admin they had been saved. Now what uploaded is attached and
 *     kept, and the message says exactly that;
 *   · the remaining photos get one more chance through the Server Action when
 *     they are small enough to fit its request body;
 *   · if the project row cannot be updated, the uploaded objects are removed —
 *     the row is the source of truth, and a file nothing points at is rubbish.
 *
 * Every dependency is injected, so each of those paths is tested without a
 * browser or a network.
 */

const e = es.admin.photos.errors;

export type PipelineDeps = {
  compress: (file: File) => Promise<CompressionResult>;
  uploadDirect: (
    projectId: string,
    files: File[],
    onProgress?: (done: number, total: number) => void
  ) => Promise<DirectUploadResult>;
  attach: (input: { projectId: string; urls: string[] }) => Promise<ProjectPhotosResult>;
  uploadViaServer: (formData: FormData) => Promise<ProjectPhotosResult>;
  removeObjects: (paths: string[]) => Promise<void>;
};

export type PipelineProgress = {
  phase: "optimizing" | "uploading";
  /** Files finished in this phase. */
  done: number;
  total: number;
};

export type PipelineResult =
  | {
      ok: true;
      photos: string[];
      /** Weight as picked, and as uploaded: what optimising saved. */
      originalBytes: number;
      finalBytes: number;
      /** How many photos were actually re-encoded. */
      optimized: number;
    }
  | {
      ok: false;
      error: string;
      /**
       * The project's photo list when SOME photos made it before the failure,
       * so the dialog shows them; null when nothing changed.
       */
      photos: string[] | null;
    };

/** Why a picked file is refused before anything is read, or null. */
export function preflightPhoto(file: File): "type" | "size" | "empty" | null {
  if (file.size === 0) return "empty";
  const type = normalizeImageType(file);
  if (!isAcceptedImage(type) && !isConvertibleImage(type)) return "type";
  // The bucket's own ceiling is checked AFTER optimising: a 40 MB photo is
  // fine if it comes out at 3 MB. This one is about what a tab can decode.
  if (file.size > COMPRESSION.maxInputBytes) return "size";
  return null;
}

const named = (template: string, name: string) => template.replace("{archivo}", name);

function uploadMessage(reason: UploadFailure, name: string): string {
  switch (reason) {
    case "timeout":
      return named(e.uploadTimeout, name);
    case "network":
      return named(e.uploadNetwork, name);
    case "permission":
      return e.uploadPermission;
    case "tooLarge":
      return named(e.uploadTooLarge, name);
    default:
      return named(e.uploadFailedNamed, name);
  }
}

function savedSuffix(count: number): string {
  if (count === 0) return "";
  return ` ${count === 1 ? e.partialSavedOne : e.partialSaved.replace("{n}", String(count))}`;
}

export async function runPhotoPipeline(
  projectId: string,
  files: File[],
  deps: PipelineDeps,
  onProgress?: (progress: PipelineProgress) => void
): Promise<PipelineResult> {
  // What is already on the project if a later step fails.
  let savedPhotos: string[] | null = null;

  try {
    // 1 — preflight: all or nothing, before any work starts.
    for (const file of files) {
      const reason = preflightPhoto(file);
      if (!reason) continue;
      const template =
        reason === "type" ? e.badTypeNamed : reason === "size" ? e.tooLargeNamed : e.emptyNamed;
      return { ok: false, error: named(template, file.name), photos: null };
    }

    // 2 — optimise, one at a time (decoding in parallel is what runs a phone
    // out of memory).
    const prepared: { original: File; file: File; compressed: boolean }[] = [];
    for (const [index, original] of files.entries()) {
      onProgress?.({ phase: "optimizing", done: index, total: files.length });

      const result = await deps.compress(original);
      if (!result.ok) {
        const template = result.reason === "tooLarge" ? e.tooLargeNamed : e.decodeNamed;
        return { ok: false, error: named(template, original.name), photos: null };
      }
      if (result.file.size > MAX_PHOTO_BYTES) {
        return { ok: false, error: named(e.stillTooLargeNamed, original.name), photos: null };
      }
      prepared.push({ original, file: result.file, compressed: result.compressed });
    }
    onProgress?.({ phase: "optimizing", done: files.length, total: files.length });

    const summary = {
      originalBytes: prepared.reduce((sum, item) => sum + item.original.size, 0),
      finalBytes: prepared.reduce((sum, item) => sum + item.file.size, 0),
      optimized: prepared.filter((item) => item.compressed).length,
    };

    // 3 — upload straight to Storage.
    const upload = await deps.uploadDirect(
      projectId,
      prepared.map((item) => item.file),
      (done, total) => onProgress?.({ phase: "uploading", done, total })
    );

    if (upload.ok) {
      // 4 — attach everything in one row update.
      const attached = await deps.attach({
        projectId,
        urls: upload.uploaded.map((photo) => photo.publicUrl),
      });
      if (!attached.ok) {
        await deps.removeObjects(upload.uploaded.map((photo) => photo.path));
        return { ok: false, error: attached.error, photos: null };
      }
      return { ok: true, photos: attached.photos, ...summary };
    }

    // The upload stopped partway. What made it is kept: attached, not deleted.
    if (upload.uploaded.length > 0) {
      const attached = await deps.attach({
        projectId,
        urls: upload.uploaded.map((photo) => photo.publicUrl),
      });
      if (!attached.ok) {
        await deps.removeObjects(upload.uploaded.map((photo) => photo.path));
        return { ok: false, error: attached.error, photos: null };
      }
      savedPhotos = attached.photos;
    }

    // One more chance for the rest, through the Server Action — only for files
    // small enough to fit its request body; bigger ones would fail again after
    // travelling in full.
    const remaining = prepared.slice(upload.failedIndex);
    if (remaining.every((item) => item.file.size <= MAX_SERVER_UPLOAD_BYTES)) {
      const formData = new FormData();
      formData.append("projectId", projectId);
      remaining.forEach((item) => formData.append("files", item.file));

      const fallback = await deps.uploadViaServer(formData);
      if (fallback.ok) return { ok: true, photos: fallback.photos, ...summary };
    }

    const failedName = prepared[upload.failedIndex]?.original.name ?? "";
    return {
      ok: false,
      error: uploadMessage(upload.reason, failedName) + savedSuffix(upload.uploaded.length),
      photos: savedPhotos,
    };
  } catch (error) {
    console.error("[photos] pipeline failed", error);
    return { ok: false, error: e.unexpected, photos: savedPhotos };
  }
}
