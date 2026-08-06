/**
 * Where a document's file actually lives.
 *
 * `documents.file_url` holds two different things depending on how the file was
 * loaded (database-schema.md says "Storage o Drive"):
 *
 *   · an absolute external URL — Google Drive, or any other host. Handed back
 *     as it is; there is nothing to sign.
 *   · an object path inside the PRIVATE `documents` bucket. Cannot be linked
 *     to directly, so it has to be exchanged for a short-lived signed URL.
 *
 * The distinction is made here, on a string that came from a row the caller was
 * already allowed to read — never from anything the client sent.
 */

/** The private bucket holding uploaded documents. */
export const DOCUMENTS_BUCKET = "documents";

/** How long a download link stays valid, in seconds. */
export const SIGNED_URL_TTL_SECONDS = 60;

export type DownloadTarget =
  | { kind: "external"; url: string }
  | { kind: "storage"; path: string }
  | { kind: "missing" };

/**
 * Classifies a stored file_url.
 *
 * A URL that points at this project's own Storage is unwrapped back into an
 * object path rather than passed through: those links 404 for a private bucket,
 * so signing them is the only thing that works.
 */
export function resolveDownloadTarget(
  fileUrl: string | null | undefined
): DownloadTarget {
  const value = fileUrl?.trim();
  if (!value) return { kind: "missing" };

  if (!/^https?:\/\//i.test(value)) {
    // A bare path is an object in the bucket. Leading slashes and an accidental
    // "documents/" prefix are both tolerated.
    const path = value.replace(/^\/+/, "").replace(/^documents\//, "");
    return path ? { kind: "storage", path } : { kind: "missing" };
  }

  // ".../storage/v1/object/(public|sign|authenticated)/documents/<path>"
  const storageMatch = value.match(
    /\/storage\/v1\/object\/(?:public\/|sign\/|authenticated\/)?documents\/(.+)$/i
  );
  if (storageMatch) {
    const path = storageMatch[1].split("?")[0];
    return path ? { kind: "storage", path } : { kind: "missing" };
  }

  return { kind: "external", url: value };
}
