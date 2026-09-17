import { createClient } from "@/lib/supabase/browser";
import {
  PHOTO_UPLOAD_TIMEOUT_MS,
  PROJECT_PHOTOS_BUCKET,
  buildPhotoPath,
} from "./photos";

/**
 * Uploading a photo FROM THE BROWSER, straight into Storage.
 *
 * Why not the Server Action that used to do this: the file had to travel inside
 * the action's request body, which crosses a serverless function with a request
 * limit far below our own 30 MB (4.5 MB on Vercel). Over that limit the
 * platform cuts the request off, the action never answers, and the caller sat
 * on an awaited promise that would never settle — the upload dialog froze on
 * "Subiendo…", refused to close because it thought work was in flight, and the
 * admin's only way out was a reload, which took every unsaved edit with it.
 *
 * Going direct removes that hop entirely. It is not a loophole: the browser
 * client carries the admin's own session, so the write is checked by
 * `project_photos_admin_insert` exactly as before — the service role key is
 * nowhere near this code. What the browser CANNOT do is update the project row,
 * which is why the urls are handed to a Server Action afterwards.
 *
 * Every call is also raced against a timeout, so a dead connection surfaces as
 * an error instead of a spinner nobody can dismiss.
 */

export type UploadedPhoto = { path: string; publicUrl: string };

export type DirectUploadResult =
  | { ok: true; uploaded: UploadedPhoto[] }
  | { ok: false; uploaded: UploadedPhoto[]; failedFile: string };

/** Rejects instead of hanging when the network never answers. */
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;

  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("upload-timeout")), ms);
    }),
  ]).finally(() => clearTimeout(timer)) as Promise<T>;
}

/**
 * Uploads files one by one, reporting progress between them.
 *
 * Sequential rather than parallel: the admin is usually on the connection of an
 * office, and six photos racing each other is what makes a slow upload look
 * frozen. It also means a failure names the file that failed.
 *
 * On failure the objects already uploaded are returned, NOT deleted — the
 * caller decides whether to keep them (it can still attach them) or roll back.
 */
export async function uploadPhotosToStorage(
  projectId: string,
  files: File[],
  onProgress?: (done: number, total: number) => void
): Promise<DirectUploadResult> {
  const supabase = createClient();
  const uploaded: UploadedPhoto[] = [];

  for (const [index, file] of files.entries()) {
    onProgress?.(index, files.length);

    const path = buildPhotoPath(projectId, file.name);

    try {
      const { error } = await withTimeout(
        supabase.storage
          .from(PROJECT_PHOTOS_BUCKET)
          .upload(path, file, { contentType: file.type, upsert: false }),
        PHOTO_UPLOAD_TIMEOUT_MS
      );

      if (error) return { ok: false, uploaded, failedFile: file.name };
    } catch {
      // Timeout, or a fetch that never resolved.
      return { ok: false, uploaded, failedFile: file.name };
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(PROJECT_PHOTOS_BUCKET).getPublicUrl(path);

    uploaded.push({ path, publicUrl });
  }

  onProgress?.(files.length, files.length);
  return { ok: true, uploaded };
}

/** Best-effort cleanup of objects whose row update never happened. */
export async function removeUploadedObjects(paths: string[]): Promise<void> {
  if (paths.length === 0) return;

  try {
    const supabase = createClient();
    await withTimeout(
      supabase.storage.from(PROJECT_PHOTOS_BUCKET).remove(paths),
      PHOTO_UPLOAD_TIMEOUT_MS
    );
  } catch {
    // An orphaned object in a bucket is not worth failing the flow over; the
    // row is the source of truth and it never pointed at these.
  }
}
