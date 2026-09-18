import { beforeEach, describe, expect, it, vi } from "vitest";
import { es } from "@/i18n";
import { COMPRESSION } from "./image-compression";
import {
  preflightPhoto,
  runPhotoPipeline,
  type PipelineDeps,
  type PipelineProgress,
} from "./photo-pipeline";
import { MAX_PHOTO_BYTES, MAX_SERVER_UPLOAD_BYTES } from "./photos";

const e = es.admin.photos.errors;
const MB = 1024 * 1024;
const BUCKET = "https://abc.supabase.co/storage/v1/object/public/project-photos";

function file(name: string, { size = 1 * MB, type = "image/jpeg" } = {}) {
  const item = new File(["x"], name, { type });
  Object.defineProperty(item, "size", { value: size });
  return item;
}

const urlOf = (name: string) => `${BUCKET}/p-1/${name}`;

/** Deps where everything works; each test breaks the one part it is about. */
function makeDeps(): PipelineDeps & { [K in keyof PipelineDeps]: ReturnType<typeof vi.fn> } {
  return {
    compress: vi.fn(async (input: File) => ({ ok: true, file: input, compressed: false })),
    // Reports progress per file, as the real one does.
    uploadDirect: vi.fn(
      async (
        _projectId: string,
        files: File[],
        onProgress?: (done: number, total: number) => void
      ) => {
        files.forEach((_, index) => onProgress?.(index, files.length));
        onProgress?.(files.length, files.length);
        return {
          ok: true,
          uploaded: files.map((item) => ({
            path: `p-1/${item.name}`,
            publicUrl: urlOf(item.name),
          })),
        };
      }
    ),
    attach: vi.fn(async ({ urls }: { urls: string[] }) => ({ ok: true, photos: urls })),
    uploadViaServer: vi.fn(async () => ({ ok: true, photos: ["server"] })),
    removeObjects: vi.fn(async () => {}),
  } as never;
}

let deps: ReturnType<typeof makeDeps>;
beforeEach(() => {
  deps = makeDeps();
});

describe("preflightPhoto — refused before anything is read", () => {
  it("accepts the bucket's formats and HEIC", () => {
    expect(preflightPhoto(file("a.jpg"))).toBeNull();
    expect(preflightPhoto(file("a.png", { type: "image/png" }))).toBeNull();
    expect(preflightPhoto(file("IMG_1.heic", { type: "image/heic" }))).toBeNull();
    // HEIC with no declared type, as several browsers report it.
    expect(preflightPhoto(file("IMG_2.HEIC", { type: "" }))).toBeNull();
  });

  it("names the reason for everything else", () => {
    expect(preflightPhoto(file("a.gif", { type: "image/gif" }))).toBe("type");
    expect(preflightPhoto(file("a.pdf", { type: "application/pdf" }))).toBe("type");
    expect(preflightPhoto(file("a.jpg", { size: 0 }))).toBe("empty");
    expect(preflightPhoto(file("a.jpg", { size: COMPRESSION.maxInputBytes + 1 }))).toBe("size");
  });

  it("lets a heavy photo through: optimisation is what brings it down", () => {
    expect(preflightPhoto(file("a.jpg", { size: 40 * MB }))).toBeNull();
  });
});

describe("the happy path", () => {
  it("optimises, uploads and attaches, reporting both phases in order", async () => {
    const progress: PipelineProgress[] = [];
    deps.compress.mockImplementation(async (input: File) => ({
      ok: true,
      compressed: true,
      file: file(input.name.replace(".jpg", ".webp"), { size: 1 * MB, type: "image/webp" }),
    }));

    const result = await runPhotoPipeline(
      "p-1",
      [file("a.jpg", { size: 15 * MB }), file("b.jpg", { size: 9 * MB })],
      deps,
      (event) => progress.push(event)
    );

    expect(result).toEqual({
      ok: true,
      photos: [urlOf("a.webp"), urlOf("b.webp")],
      originalBytes: 24 * MB,
      finalBytes: 2 * MB,
      optimized: 2,
    });
    expect(progress[0]).toEqual({ phase: "optimizing", done: 0, total: 2 });
    expect(progress.some((event) => event.phase === "uploading")).toBe(true);
    // Never back to optimising once uploading started.
    const firstUpload = progress.findIndex((event) => event.phase === "uploading");
    expect(progress.slice(firstUpload).every((event) => event.phase === "uploading")).toBe(true);
  });

  it("uploads files one after the other, in the order picked", async () => {
    await runPhotoPipeline("p-1", [file("a.jpg"), file("b.jpg")], deps);

    const sent = deps.uploadDirect.mock.calls[0][1] as File[];
    expect(sent.map((item) => item.name)).toEqual(["a.jpg", "b.jpg"]);
  });
});

describe("refusals before any upload", () => {
  it("stops on an invalid file and names it; nothing is read or sent", async () => {
    const result = await runPhotoPipeline(
      "p-1",
      [file("buena.jpg"), file("mala.gif", { type: "image/gif" })],
      deps
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("mala.gif");
    expect(deps.compress).not.toHaveBeenCalled();
    expect(deps.uploadDirect).not.toHaveBeenCalled();
  });

  it("stops when a photo cannot be read, naming it", async () => {
    deps.compress.mockResolvedValueOnce({ ok: false, reason: "decode" });

    const result = await runPhotoPipeline(
      "p-1",
      [file("IMG_1.heic", { type: "image/heic" })],
      deps
    );

    expect(result).toEqual({
      ok: false,
      error: e.decodeNamed.replace("{archivo}", "IMG_1.heic"),
      photos: null,
    });
    expect(deps.uploadDirect).not.toHaveBeenCalled();
  });

  it("stops when a photo is still over the limit after optimising", async () => {
    deps.compress.mockImplementation(async (input: File) => ({
      ok: true,
      compressed: false,
      file: input,
    }));

    const result = await runPhotoPipeline(
      "p-1",
      [file("enorme.jpg", { size: MAX_PHOTO_BYTES + 1 })],
      deps
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(e.stillTooLargeNamed.replace("{archivo}", "enorme.jpg"));
    }
    expect(deps.uploadDirect).not.toHaveBeenCalled();
  });

  it("never throws: an exploding compressor becomes a message", async () => {
    deps.compress.mockRejectedValueOnce(new Error("boom"));

    const result = await runPhotoPipeline("p-1", [file("a.jpg")], deps);

    expect(result).toEqual({ ok: false, error: e.unexpected, photos: null });
  });
});

describe("when the upload fails partway (the bug this replaces)", () => {
  it("KEEPS the photos that did upload and says so truthfully", async () => {
    deps.uploadDirect.mockResolvedValueOnce({
      ok: false,
      uploaded: [
        { path: "p-1/a.jpg", publicUrl: urlOf("a.jpg") },
        { path: "p-1/b.jpg", publicUrl: urlOf("b.jpg") },
      ],
      failedIndex: 2,
      reason: "network",
    });
    // The remaining file is too big for the fallback, so the error stands.
    const big = file("c.jpg", { size: MAX_SERVER_UPLOAD_BYTES + 1 });

    const result = await runPhotoPipeline("p-1", [file("a.jpg"), file("b.jpg"), big], deps);

    // The two uploads were attached, not deleted.
    expect(deps.attach).toHaveBeenCalledWith({
      projectId: "p-1",
      urls: [urlOf("a.jpg"), urlOf("b.jpg")],
    });
    expect(deps.removeObjects).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: false,
      error:
        e.uploadNetwork.replace("{archivo}", "c.jpg") +
        " " +
        e.partialSaved.replace("{n}", "2"),
      photos: [urlOf("a.jpg"), urlOf("b.jpg")],
    });
  });

  it("uses the singular when one photo was saved", async () => {
    deps.uploadDirect.mockResolvedValueOnce({
      ok: false,
      uploaded: [{ path: "p-1/a.jpg", publicUrl: urlOf("a.jpg") }],
      failedIndex: 1,
      reason: "timeout",
    });

    const result = await runPhotoPipeline(
      "p-1",
      [file("a.jpg"), file("b.jpg", { size: MAX_SERVER_UPLOAD_BYTES + 1 })],
      deps
    );

    expect(!result.ok && result.error).toBe(
      e.uploadTimeout.replace("{archivo}", "b.jpg") + " " + e.partialSavedOne
    );
  });

  it("sends only the REMAINING small photos through the fallback", async () => {
    deps.uploadDirect.mockResolvedValueOnce({
      ok: false,
      uploaded: [{ path: "p-1/a.jpg", publicUrl: urlOf("a.jpg") }],
      failedIndex: 1,
      reason: "unknown",
    });
    deps.uploadViaServer.mockResolvedValueOnce({ ok: true, photos: ["a", "b"] });

    const result = await runPhotoPipeline("p-1", [file("a.jpg"), file("b.jpg")], deps);

    const formData = deps.uploadViaServer.mock.calls[0][0] as FormData;
    expect((formData.getAll("files") as File[]).map((item) => item.name)).toEqual(["b.jpg"]);
    expect(formData.get("projectId")).toBe("p-1");
    expect(result).toMatchObject({ ok: true, photos: ["a", "b"] });
  });

  it("reports the original reason when the fallback also fails, keeping what was saved", async () => {
    deps.uploadDirect.mockResolvedValueOnce({
      ok: false,
      uploaded: [],
      failedIndex: 0,
      reason: "permission",
    });
    deps.uploadViaServer.mockResolvedValueOnce({ ok: false, error: e.notAdmin });

    const result = await runPhotoPipeline("p-1", [file("a.jpg")], deps);

    expect(result).toEqual({ ok: false, error: e.uploadPermission, photos: null });
  });

  it("names a file too big for the server as such", async () => {
    deps.uploadDirect.mockResolvedValueOnce({
      ok: false,
      uploaded: [],
      failedIndex: 0,
      reason: "tooLarge",
    });

    const result = await runPhotoPipeline(
      "p-1",
      [file("a.jpg", { size: MAX_SERVER_UPLOAD_BYTES + 1 })],
      deps
    );

    expect(!result.ok && result.error).toBe(e.uploadTooLarge.replace("{archivo}", "a.jpg"));
  });
});

describe("when the project row cannot be updated", () => {
  it("removes the uploaded objects, so no file is left that nothing points at", async () => {
    deps.attach.mockResolvedValueOnce({ ok: false, error: e.saveFailed });

    const result = await runPhotoPipeline("p-1", [file("a.jpg"), file("b.jpg")], deps);

    expect(deps.removeObjects).toHaveBeenCalledWith(["p-1/a.jpg", "p-1/b.jpg"]);
    expect(result).toEqual({ ok: false, error: e.saveFailed, photos: null });
  });

  it("also after a partial upload", async () => {
    deps.uploadDirect.mockResolvedValueOnce({
      ok: false,
      uploaded: [{ path: "p-1/a.jpg", publicUrl: urlOf("a.jpg") }],
      failedIndex: 1,
      reason: "network",
    });
    deps.attach.mockResolvedValueOnce({ ok: false, error: e.saveFailed });

    const result = await runPhotoPipeline(
      "p-1",
      [file("a.jpg"), file("b.jpg", { size: MAX_SERVER_UPLOAD_BYTES + 1 })],
      deps
    );

    expect(deps.removeObjects).toHaveBeenCalledWith(["p-1/a.jpg"]);
    expect(result).toEqual({ ok: false, error: e.saveFailed, photos: null });
  });
});
