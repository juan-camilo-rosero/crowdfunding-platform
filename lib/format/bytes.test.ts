import { describe, expect, it } from "vitest";
import { formatBytes } from "./bytes";

describe("formatBytes", () => {
  it("formats megabytes with one decimal, the es-CO way", () => {
    expect(formatBytes(15.2 * 1024 * 1024)).toBe("15,2 MB");
  });

  it("drops a trailing ,0", () => {
    expect(formatBytes(2 * 1024 * 1024)).toBe("2 MB");
  });

  it("uses kilobytes, rounded, below one megabyte", () => {
    expect(formatBytes(850 * 1024)).toBe("850 KB");
  });

  it("never says 0 KB for a small but real file", () => {
    expect(formatBytes(200)).toBe("1 KB");
  });

  it("says 0 KB for nothing, and survives nonsense", () => {
    expect(formatBytes(0)).toBe("0 KB");
    expect(formatBytes(Number.NaN)).toBe("0 KB");
    expect(formatBytes(-5)).toBe("0 KB");
  });
});
