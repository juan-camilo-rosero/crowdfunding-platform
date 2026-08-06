/**
 * Project photos: the public bucket and the shape of what goes in it.
 *
 * `projects.main_photos` is a text[] of PUBLIC URLs, not storage paths — the
 * catalogue and the gallery hand them straight to <Image>, so the column has to
 * carry something a browser can fetch.
 */

export const PROJECT_PHOTOS_BUCKET = "project-photos";

/** What the browser may send. Anything else is refused before it is uploaded. */
export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;

/** Matches the bucket's own 30 MB ceiling, so the check fails early and clearly. */
export const MAX_PHOTO_BYTES = 30 * 1024 * 1024;

export type ProjectPhotosResult =
  | { ok: true; photos: string[] }
  | { ok: false; error: string };

/** True when the file is an image type the bucket accepts. */
export function isAcceptedImage(type: string): boolean {
  return (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(type);
}

/**
 * Storage path for a new photo: grouped by project, with a random prefix.
 *
 * The random prefix means two uploads of "fachada.jpg" never collide, and the
 * original name is kept behind it so the bucket stays browsable by a human.
 */
export function buildPhotoPath(projectId: string, fileName: string): string {
  const safe = fileName
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(-60);

  return `${projectId}/${crypto.randomUUID()}-${safe || "foto"}`;
}

/**
 * Object path inside the bucket for a stored public URL, or null when the URL
 * points somewhere else.
 *
 * Needed to delete: main_photos holds URLs, but the storage API removes by
 * path. A URL from another host is left alone rather than guessed at.
 */
export function photoPathFromUrl(url: string): string | null {
  const match = url.match(
    new RegExp(`/storage/v1/object/public/${PROJECT_PHOTOS_BUCKET}/(.+)$`)
  );
  return match ? decodeURIComponent(match[1].split("?")[0]) : null;
}
