import { describe, expect, it } from "vitest";
import {
  PROJECT_PHOTOS_BUCKET,
  buildPhotoPath,
  isAcceptedImage,
  photoPathFromUrl,
} from "./photos";

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
