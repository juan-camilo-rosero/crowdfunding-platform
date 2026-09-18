import { MAX_PHOTO_BYTES, isAcceptedImage } from "./photos";
import { withTimeout } from "./with-timeout";

/**
 * Shrinking a photo in the browser BEFORE it is uploaded.
 *
 * A phone photo is 4000–6000px and 5–15 MB; the gallery never shows it wider
 * than a screen. Uploading it whole cost the admin a slow upload on an office
 * connection, cost every investor a heavy download, and pushed files towards
 * the platform limits that made uploads fail. Scaled to 2560px on the long edge
 * and re-encoded at high quality, the same photo lands at 0.5–2 MB with no
 * difference anyone can see at gallery size.
 *
 * Quality comes first, which is why this is conservative:
 *   · a photo already light and within size is NOT touched (no generation loss);
 *   · it is never upscaled;
 *   · the re-encode is kept only when it is actually smaller;
 *   · if the browser cannot decode or encode, the ORIGINAL goes up as long as
 *     the bucket accepts it — optimisation is a bonus, never a gate.
 *
 * The browser work (decode, draw, encode) sits behind `CompressionDeps`, so the
 * decisions here are tested without a canvas.
 */

export const COMPRESSION = {
  /** Long edge in px: sharp on a 4K screen's gallery, a fraction of the weight. */
  maxDimension: 2560,
  /** WebP/JPEG quality: visually lossless for photographs. */
  quality: 0.85,
  /** Below this, and within maxDimension, a photo is left exactly as it is. */
  keepBelowBytes: 1.5 * 1024 * 1024,
  /**
   * Largest file we even try to decode. Beyond it the decoded bitmap alone can
   * exhaust a phone's memory and crash the tab — a hard failure, where a clear
   * message is better.
   */
  maxInputBytes: 80 * 1024 * 1024,
  /** A decode + encode takes a second or two; a minute means it is stuck. */
  timeoutMs: 45_000,
} as const;

/** iPhones shoot HEIC; the bucket does not take it, but a browser may decode it. */
export const CONVERTIBLE_IMAGE_TYPES = ["image/heic", "image/heif"] as const;

/** Output formats, in order of preference. WebP keeps transparency and weighs less. */
const OUTPUT_TYPES = ["image/webp", "image/jpeg"] as const;

const EXTENSION: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
};

export type DecodedImage = {
  width: number;
  height: number;
  source: CanvasImageSource;
  /** Releases the decoded pixels. Always called, success or not. */
  close: () => void;
};

export type CompressionDeps = {
  decode: (file: Blob) => Promise<DecodedImage>;
  /** Resolves to null (or a blob of another type) when the format is unsupported. */
  encode: (
    source: CanvasImageSource,
    width: number,
    height: number,
    type: string,
    quality: number
  ) => Promise<Blob | null>;
};

export type CompressionResult =
  | { ok: true; file: File; compressed: boolean }
  | { ok: false; reason: "decode" | "tooLarge" };

/**
 * The file's real type. Several browsers report HEIC with an EMPTY type, so the
 * extension decides for those.
 */
export function normalizeImageType(file: { name: string; type: string }): string {
  if (file.type) return file.type;
  const extension = file.name.toLowerCase().split(".").pop();
  if (extension === "heic") return "image/heic";
  if (extension === "heif") return "image/heif";
  return file.type;
}

export function isConvertibleImage(type: string): boolean {
  return (CONVERTIBLE_IMAGE_TYPES as readonly string[]).includes(type);
}

export type CompressionPlan =
  | { action: "keep" }
  | { action: "compress"; width: number; height: number };

/** What to do with an image of this size, weight and type. Pure. */
export function planCompression(info: {
  width: number;
  height: number;
  size: number;
  type: string;
}): CompressionPlan {
  const longEdge = Math.max(info.width, info.height);
  const fitsAlready = longEdge <= COMPRESSION.maxDimension;

  if (fitsAlready && info.size <= COMPRESSION.keepBelowBytes && isAcceptedImage(info.type)) {
    return { action: "keep" };
  }

  const scale = fitsAlready ? 1 : COMPRESSION.maxDimension / longEdge;
  return {
    action: "compress",
    width: Math.round(info.width * scale),
    height: Math.round(info.height * scale),
  };
}

function renamed(name: string, type: string): string {
  const base = name.replace(/\.[^.]+$/, "") || "foto";
  return `${base}.${EXTENSION[type]}`;
}

/**
 * Optimises one photo. Resolves — it never throws — with the file to upload,
 * or with the reason there is none.
 */
export async function compressImage(
  file: File,
  deps: CompressionDeps = browserCompressionDeps
): Promise<CompressionResult> {
  const type = normalizeImageType(file);
  // What goes up if optimisation cannot help: the file as picked, when the
  // bucket takes it and it is within the limit.
  const original: CompressionResult | null =
    isAcceptedImage(type) && file.size <= MAX_PHOTO_BYTES
      ? { ok: true, file, compressed: false }
      : null;

  if (file.size > COMPRESSION.maxInputBytes) return { ok: false, reason: "tooLarge" };

  let decoded: DecodedImage;
  try {
    decoded = await withTimeout(deps.decode(file), COMPRESSION.timeoutMs, "decode");
  } catch {
    return original ?? { ok: false, reason: "decode" };
  }

  try {
    const plan = planCompression({
      width: decoded.width,
      height: decoded.height,
      size: file.size,
      type,
    });
    if (plan.action === "keep") return original ?? { ok: false, reason: "decode" };

    for (const outputType of OUTPUT_TYPES) {
      let blob: Blob | null;
      try {
        blob = await withTimeout(
          deps.encode(decoded.source, plan.width, plan.height, outputType, COMPRESSION.quality),
          COMPRESSION.timeoutMs,
          "encode"
        );
      } catch {
        // A broken encoder will not do better with another format.
        break;
      }
      // An unsupported format comes back as PNG rather than as an error.
      if (!blob || blob.type !== outputType || blob.size === 0) continue;

      // Worth it only if it is lighter — or if the original cannot go up at all.
      if (original && blob.size >= file.size) return original;

      return {
        ok: true,
        compressed: true,
        file: new File([blob], renamed(file.name, outputType), {
          type: outputType,
          lastModified: file.lastModified,
        }),
      };
    }

    return original ?? { ok: false, reason: "decode" };
  } finally {
    decoded.close();
  }
}

// ── Browser implementation ─────────────────────────────────────────────────

/**
 * The real decode/encode. Not unit-tested (jsdom has no canvas); kept small
 * so the part that is not tested has as little logic as possible.
 */
export const browserCompressionDeps: CompressionDeps = {
  async decode(file) {
    if (typeof createImageBitmap === "function") {
      try {
        // "from-image" applies the EXIF rotation: a portrait phone photo
        // stays portrait instead of arriving on its side.
        const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
        return {
          width: bitmap.width,
          height: bitmap.height,
          source: bitmap,
          close: () => bitmap.close(),
        };
      } catch {
        // Some formats decode in <img> but not in createImageBitmap.
      }
    }

    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.decoding = "async";
      image.src = url;
      await image.decode();
      return {
        width: image.naturalWidth,
        height: image.naturalHeight,
        source: image,
        close: () => URL.revokeObjectURL(url),
      };
    } catch (error) {
      URL.revokeObjectURL(url);
      throw error;
    }
  },

  async encode(source, width, height, type, quality) {
    const draw = (context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) => {
      // JPEG has no transparency: without a fill, transparent areas turn black.
      if (type === "image/jpeg") {
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, width, height);
      }
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(source, 0, 0, width, height);
    };

    if (typeof OffscreenCanvas !== "undefined") {
      const canvas = new OffscreenCanvas(width, height);
      const context = canvas.getContext("2d");
      if (!context) return null;
      draw(context);
      return canvas.convertToBlob({ type, quality });
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return null;
    draw(context);
    return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
  },
};
