import { describe, expect, it } from "vitest";
import { classifyUploadError } from "./upload-errors";
import { TimeoutError } from "./with-timeout";

/**
 * Turning whatever Storage or the network threw into a reason the admin can
 * act on. "No pudimos subir la imagen" told nobody whether to retry, reload or
 * shrink the file.
 */
describe("classifyUploadError", () => {
  it("recognises our own timeout", () => {
    expect(classifyUploadError(new TimeoutError("upload"))).toBe("timeout");
  });

  it.each([
    new TypeError("Failed to fetch"),
    new TypeError("NetworkError when attempting to fetch resource."),
    new TypeError("Load failed"),
    { message: "fetch failed" },
  ])("recognises a dropped connection (%s)", (error) => {
    expect(classifyUploadError(error)).toBe("network");
  });

  it.each([
    { statusCode: "403", message: "new row violates row-level security policy" },
    { status: 401, message: "Unauthorized" },
    { message: "jwt expired" },
  ])("recognises a refused or expired session (%o)", (error) => {
    expect(classifyUploadError(error)).toBe("permission");
  });

  it.each([
    { statusCode: "413", message: "Payload too large" },
    { status: 413, message: "" },
    { message: "The object exceeded the maximum allowed size" },
  ])("recognises a file the server says is too big (%o)", (error) => {
    expect(classifyUploadError(error)).toBe("tooLarge");
  });

  it("says unknown rather than guessing", () => {
    expect(classifyUploadError(new Error("algo raro"))).toBe("unknown");
    expect(classifyUploadError(null)).toBe("unknown");
    expect(classifyUploadError("texto")).toBe("unknown");
  });
});
