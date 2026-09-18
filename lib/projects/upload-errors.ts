import { TimeoutError } from "./with-timeout";

/** Why an upload failed, in terms of what the admin can do about it. */
export type UploadFailure = "timeout" | "network" | "permission" | "tooLarge" | "unknown";

function statusOf(error: Record<string, unknown>): number | null {
  const raw = error.status ?? error.statusCode;
  const status = typeof raw === "string" ? Number(raw) : raw;
  return typeof status === "number" && Number.isFinite(status) ? status : null;
}

/**
 * Classifies whatever an upload threw or returned.
 *
 * Storage errors arrive in several shapes across supabase-js versions (a
 * `status` number, a `statusCode` string, or only a message), and a dropped
 * connection surfaces as a TypeError whose wording differs per browser. This is
 * the one place that knows all of them, so the dialog can say "reload and sign
 * in again" instead of "something failed".
 */
export function classifyUploadError(error: unknown): UploadFailure {
  if (error instanceof TimeoutError) return "timeout";
  if (!error || typeof error !== "object") return "unknown";

  const record = error as Record<string, unknown>;
  const message = typeof record.message === "string" ? record.message.toLowerCase() : "";
  const status = statusOf(record);

  if (
    error instanceof TypeError ||
    /failed to fetch|networkerror|load failed|fetch failed|network/.test(message)
  ) {
    return "network";
  }
  if (
    status === 401 ||
    status === 403 ||
    /row-level security|unauthorized|not authorized|jwt|permission/.test(message)
  ) {
    return "permission";
  }
  if (status === 413 || /payload too large|maximum allowed size|too large/.test(message)) {
    return "tooLarge";
  }
  return "unknown";
}
