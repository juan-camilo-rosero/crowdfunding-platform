const KB = 1024;
const MB = 1024 * KB;

const megabytes = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });

/**
 * A file weight for people: "15,2 MB", "850 KB". Used where the app tells the
 * admin what optimising a photo saved.
 *
 * A real file under 1 KB reads "1 KB" rather than "0 KB", which would look
 * like an empty file.
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < MB) return `${Math.max(1, Math.round(bytes / KB))} KB`;
  return `${megabytes.format(bytes / MB)} MB`;
}
