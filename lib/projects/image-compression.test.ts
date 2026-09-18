import { describe, expect, it, vi } from "vitest";
import {
  COMPRESSION,
  compressImage,
  normalizeImageType,
  planCompression,
  type CompressionDeps,
} from "./image-compression";

const MB = 1024 * 1024;

function fakeFile(name: string, { size = 5 * MB, type = "image/jpeg" } = {}) {
  const file = new File(["x"], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

/** Real bytes: the File built from it must carry the encoded size through. */
function fakeBlob(size: number, type: string) {
  return new Blob([new Uint8Array(Math.round(size))], { type });
}

/** Deps that decode to the given size and encode to a fixed-size blob. */
function fakeDeps({
  width = 4000,
  height = 3000,
  encodedSize = 1 * MB,
  supportsWebp = true,
}: {
  width?: number;
  height?: number;
  encodedSize?: number;
  supportsWebp?: boolean;
} = {}) {
  const close = vi.fn();
  const deps: CompressionDeps = {
    decode: vi.fn(async () => ({ width, height, source: {} as CanvasImageSource, close })),
    // A browser that cannot encode WebP hands back a PNG instead of failing.
    encode: vi.fn(async (_source, _w, _h, type: string) =>
      fakeBlob(encodedSize, type === "image/webp" && !supportsWebp ? "image/png" : type)
    ),
  };
  return { deps, close };
}

describe("normalizeImageType", () => {
  it("keeps a declared type", () => {
    expect(normalizeImageType({ name: "a.jpg", type: "image/jpeg" })).toBe("image/jpeg");
  });

  it("recognises HEIC by extension when the browser declares no type", () => {
    expect(normalizeImageType({ name: "IMG_0001.HEIC", type: "" })).toBe("image/heic");
    expect(normalizeImageType({ name: "foto.heif", type: "" })).toBe("image/heif");
  });

  it("leaves an unknown file unknown", () => {
    expect(normalizeImageType({ name: "planos.pdf", type: "application/pdf" })).toBe(
      "application/pdf"
    );
  });
});

describe("planCompression", () => {
  it("keeps a photo that is already light and within size", () => {
    expect(
      planCompression({ width: 1600, height: 1200, size: 800 * 1024, type: "image/jpeg" })
    ).toEqual({ action: "keep" });
  });

  it("scales a large photo down to the long-edge limit, keeping its proportions", () => {
    expect(
      planCompression({ width: 6000, height: 4000, size: 15 * MB, type: "image/jpeg" })
    ).toEqual({
      action: "compress",
      width: COMPRESSION.maxDimension,
      height: Math.round((4000 * COMPRESSION.maxDimension) / 6000),
    });
  });

  it("scales a portrait photo by its height", () => {
    const plan = planCompression({ width: 3000, height: 6000, size: 9 * MB, type: "image/jpeg" });
    expect(plan).toMatchObject({ height: COMPRESSION.maxDimension });
  });

  it("re-encodes a heavy photo that is already small in pixels, without upscaling", () => {
    expect(
      planCompression({ width: 2000, height: 1500, size: 6 * MB, type: "image/png" })
    ).toEqual({ action: "compress", width: 2000, height: 1500 });
  });

  it("always converts HEIC, which the bucket does not accept", () => {
    expect(
      planCompression({ width: 1000, height: 800, size: 300 * 1024, type: "image/heic" })
    ).toEqual({ action: "compress", width: 1000, height: 800 });
  });
});

describe("compressImage", () => {
  it("returns the original untouched when there is nothing to gain", async () => {
    const file = fakeFile("fachada.jpg", { size: 500 * 1024 });
    const { deps } = fakeDeps({ width: 1200, height: 900 });

    const result = await compressImage(file, deps);

    expect(result).toEqual({ ok: true, file, compressed: false });
    expect(deps.encode).not.toHaveBeenCalled();
  });

  it("encodes a 15 MB photo as WebP at the limit, renamed to match", async () => {
    const file = fakeFile("Fachada Norte.JPG", { size: 15 * MB });
    const { deps } = fakeDeps({ width: 6000, height: 4000, encodedSize: 1.8 * MB });

    const result = await compressImage(file, deps);

    expect(result.ok && result.compressed).toBe(true);
    if (result.ok) {
      expect(result.file.type).toBe("image/webp");
      expect(result.file.name).toBe("Fachada Norte.webp");
      expect(result.file.size).toBe(Math.round(1.8 * MB));
    }
    expect(deps.encode).toHaveBeenCalledWith(
      expect.anything(),
      COMPRESSION.maxDimension,
      1707,
      "image/webp",
      COMPRESSION.quality
    );
  });

  it("falls back to JPEG when the browser cannot encode WebP", async () => {
    const file = fakeFile("fachada.png", { size: 12 * MB, type: "image/png" });
    const { deps } = fakeDeps({ supportsWebp: false });

    const result = await compressImage(file, deps);

    expect(result.ok && result.file.type).toBe("image/jpeg");
    expect(result.ok && result.file.name).toBe("fachada.jpg");
  });

  it("keeps the original when re-encoding would make it bigger", async () => {
    const file = fakeFile("ya-optimizada.jpg", { size: 2 * MB });
    const { deps } = fakeDeps({ width: 2000, height: 1500, encodedSize: 3 * MB });

    const result = await compressImage(file, deps);

    expect(result).toEqual({ ok: true, file, compressed: false });
  });

  it("uploads the original when the browser cannot decode it but the bucket accepts it", async () => {
    const file = fakeFile("rara.jpg", { size: 8 * MB });
    const deps: CompressionDeps = {
      decode: vi.fn(async () => {
        throw new Error("decode failed");
      }),
      encode: vi.fn(),
    };

    expect(await compressImage(file, deps)).toEqual({ ok: true, file, compressed: false });
  });

  it("fails on a HEIC the browser cannot decode — there is nothing uploadable left", async () => {
    const file = fakeFile("IMG_0001.heic", { size: 3 * MB, type: "image/heic" });
    const deps: CompressionDeps = {
      decode: vi.fn(async () => {
        throw new Error("unsupported");
      }),
      encode: vi.fn(),
    };

    expect(await compressImage(file, deps)).toEqual({ ok: false, reason: "decode" });
  });

  it("refuses to even decode a file beyond the input ceiling", async () => {
    const file = fakeFile("gigante.jpg", { size: COMPRESSION.maxInputBytes + 1 });
    const { deps } = fakeDeps();

    expect(await compressImage(file, deps)).toEqual({ ok: false, reason: "tooLarge" });
    expect(deps.decode).not.toHaveBeenCalled();
  });

  it("falls back to the original when encoding fails outright", async () => {
    const file = fakeFile("fachada.jpg", { size: 9 * MB });
    const { deps, close } = fakeDeps();
    deps.encode = vi.fn(async () => {
      throw new Error("canvas too big");
    });

    expect(await compressImage(file, deps)).toEqual({ ok: true, file, compressed: false });
    // The decoded bitmap is released on the failure path too.
    expect(close).toHaveBeenCalled();
  });

  it("releases the decoded bitmap after a successful encode", async () => {
    const { deps, close } = fakeDeps();

    await compressImage(fakeFile("fachada.jpg", { size: 15 * MB }), deps);

    expect(close).toHaveBeenCalledTimes(1);
  });

  it("gives up with a timeout instead of hanging on a decode that never ends", async () => {
    vi.useFakeTimers();
    const deps: CompressionDeps = {
      decode: vi.fn(() => new Promise<never>(() => {})),
      encode: vi.fn(),
    };

    const pending = compressImage(fakeFile("colgada.jpg", { size: 9 * MB }), deps);
    await vi.advanceTimersByTimeAsync(COMPRESSION.timeoutMs + 1);

    // The original is still uploadable, so the timeout does not block the photo.
    const result = await pending;
    expect(result.ok && result.compressed).toBe(false);
    vi.useRealTimers();
  });
});
