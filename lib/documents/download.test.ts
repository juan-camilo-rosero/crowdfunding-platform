import { describe, expect, it } from "vitest";
import { resolveDownloadTarget } from "./download";

/**
 * The download endpoint's entitlement is the RLS row read, tested separately.
 * What this file covers is the OTHER half: deciding where a file lives without
 * ever trusting a path from the client.
 */
describe("resolveDownloadTarget", () => {
  it("passes an external Drive link straight through", () => {
    const url = "https://drive.google.com/file/d/abc123/view";
    expect(resolveDownloadTarget(url)).toEqual({ kind: "external", url });
  });

  it("passes any other external host through", () => {
    const url = "https://example.com/mock/deed.pdf";
    expect(resolveDownloadTarget(url)).toEqual({ kind: "external", url });
  });

  it("treats a bare path as an object in the private bucket", () => {
    expect(resolveDownloadTarget("proyecto-1/escritura.pdf")).toEqual({
      kind: "storage",
      path: "proyecto-1/escritura.pdf",
    });
  });

  it("tolerates a leading slash", () => {
    expect(resolveDownloadTarget("/proyecto-1/escritura.pdf")).toEqual({
      kind: "storage",
      path: "proyecto-1/escritura.pdf",
    });
  });

  it("strips an accidental bucket prefix", () => {
    expect(resolveDownloadTarget("documents/proyecto-1/a.pdf")).toEqual({
      kind: "storage",
      path: "proyecto-1/a.pdf",
    });
  });

  it("unwraps a Storage URL back into a path, because private objects 404", () => {
    expect(
      resolveDownloadTarget(
        "https://abc.supabase.co/storage/v1/object/public/documents/proyecto-1/a.pdf"
      )
    ).toEqual({ kind: "storage", path: "proyecto-1/a.pdf" });
  });

  it("unwraps an already-signed Storage URL too, dropping its stale token", () => {
    expect(
      resolveDownloadTarget(
        "https://abc.supabase.co/storage/v1/object/sign/documents/x/a.pdf?token=expired"
      )
    ).toEqual({ kind: "storage", path: "x/a.pdf" });
  });

  it("reports a missing file instead of inventing a target", () => {
    expect(resolveDownloadTarget(null)).toEqual({ kind: "missing" });
    expect(resolveDownloadTarget("")).toEqual({ kind: "missing" });
    expect(resolveDownloadTarget("   ")).toEqual({ kind: "missing" });
  });

  it("does not mistake another bucket's URL for the documents bucket", () => {
    const url =
      "https://abc.supabase.co/storage/v1/object/public/project-photos/a.jpg";
    expect(resolveDownloadTarget(url)).toEqual({ kind: "external", url });
  });
});
