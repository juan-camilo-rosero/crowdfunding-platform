import { describe, expect, it } from "vitest";
import {
  countPending,
  hasPending,
  mergeUpdate,
  restoreUpdates,
  toTableChanges,
  type PendingUpdates,
} from "./pending-changes";

describe("mergeUpdate", () => {
  it("keeps the last value typed into the same cell", () => {
    let pending: PendingUpdates = {};
    pending = mergeUpdate(pending, "row-1", "name", "Casa");
    pending = mergeUpdate(pending, "row-1", "name", "Casa Norte");

    expect(pending).toEqual({ "row-1": { name: "Casa Norte" } });
  });

  it("groups several cells of one row into a single update", () => {
    let pending: PendingUpdates = {};
    pending = mergeUpdate(pending, "row-1", "name", "Casa");
    pending = mergeUpdate(pending, "row-1", "city", "Rotonda");

    expect(toTableChanges(pending).updates).toEqual([
      { id: "row-1", values: { name: "Casa", city: "Rotonda" } },
    ]);
  });

  it("does not mutate the buffer it is given", () => {
    const pending: PendingUpdates = { "row-1": { name: "Casa" } };
    mergeUpdate(pending, "row-1", "city", "Rotonda");

    expect(pending).toEqual({ "row-1": { name: "Casa" } });
  });
});

describe("restoreUpdates", () => {
  it("puts a failed batch back so the next flush retries it", () => {
    const failed: PendingUpdates = { "row-1": { name: "Casa" } };

    expect(restoreUpdates({}, failed)).toEqual(failed);
  });

  it("never overwrites a value typed while the save was in flight", () => {
    const failed: PendingUpdates = { "row-1": { name: "Casa", city: "Rotonda" } };
    const typedMeanwhile: PendingUpdates = { "row-1": { name: "Casa Norte" } };

    expect(restoreUpdates(typedMeanwhile, failed)).toEqual({
      "row-1": { name: "Casa Norte", city: "Rotonda" },
    });
  });
});

describe("countPending", () => {
  it("counts cells, not rows", () => {
    const pending: PendingUpdates = {
      "row-1": { name: "Casa", city: "Rotonda" },
      "row-2": { name: "Lote" },
    };

    expect(countPending(pending)).toBe(3);
    expect(hasPending(pending)).toBe(true);
    expect(hasPending({})).toBe(false);
  });
});

describe("toTableChanges", () => {
  it("drops rows whose values were all removed", () => {
    expect(toTableChanges({ "row-1": {} })).toEqual({
      updates: [],
      inserts: [],
    });
  });

  it("never emits inserts: autosave only ever updates existing records", () => {
    const changes = toTableChanges({ "row-1": { name: "Casa" } });

    expect(changes.inserts).toEqual([]);
  });
});
