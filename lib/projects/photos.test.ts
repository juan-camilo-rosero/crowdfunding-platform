import { describe, expect, it } from "vitest";
import {
  MAX_PHOTO_BYTES,
  PROJECT_PHOTOS_BUCKET,
  buildPhotoPath,
  isAcceptedImage,
  photoPathFromUrl,
  rejectPhotoFile,
} from "./photos";

describe("rejectPhotoFile", () => {
  it("accepts an image of an allowed type and size", () => {
    expect(rejectPhotoFile({ type: "image/jpeg", size: 1024 })).toBeNull();
  });

  it("names the reason so the message can be specific", () => {
    expect(rejectPhotoFile({ type: "application/pdf", size: 1024 })).toBe("type");
    expect(
      rejectPhotoFile({ type: "image/jpeg", size: MAX_PHOTO_BYTES + 1 })
    ).toBe("size");
    expect(rejectPhotoFile({ type: "image/jpeg", size: 0 })).toBe("empty");
  });

  it("checks the file BEFORE anything is uploaded, so an empty file is caught first", () => {
    // An empty file of a forbidden type is empty: nothing left to upload.
    expect(rejectPhotoFile({ type: "text/plain", size: 0 })).toBe("empty");
  });

  it("allows exactly the ceiling, not one byte more", () => {
    expect(rejectPhotoFile({ type: "image/webp", size: MAX_PHOTO_BYTES })).toBeNull();
  });
});

describe("isAcceptedImage", () => {
  it("matches the bucket's own list", () => {
    expect(isAcceptedImage("image/png")).toBe(true);
    expect(isAcceptedImage("image/avif")).toBe(true);
    expect(isAcceptedImage("image/gif")).toBe(false);
  });
});

describe("photoPathFromUrl", () => {
  const base = `https://abc.supabase.co/storage/v1/object/public/${PROJECT_PHOTOS_BUCKET}`;

  it("reads back the object path of one of our own urls", () => {
    expect(photoPathFromUrl(`${base}/p-1/abc-fachada.jpg`)).toBe(
      "p-1/abc-fachada.jpg"
    );
  });

  it("refuses a url that is not in our bucket", () => {
    // This is what stops a crafted url from being attached to a project.
    expect(photoPathFromUrl("https://otro-sitio.com/foto.jpg")).toBeNull();
    expect(
      photoPathFromUrl("https://abc.supabase.co/storage/v1/object/public/otro/f.jpg")
    ).toBeNull();
  });
});

describe("buildPhotoPath", () => {
  it("groups by project and keeps the original name readable", () => {
    const path = buildPhotoPath("p-1", "Fachada Principal.JPG");

    expect(path.startsWith("p-1/")).toBe(true);
    expect(path.endsWith("fachada-principal.jpg")).toBe(true);
  });

  it("never collides for two uploads of the same file name", () => {
    expect(buildPhotoPath("p-1", "foto.jpg")).not.toBe(
      buildPhotoPath("p-1", "foto.jpg")
    );
  });
});
