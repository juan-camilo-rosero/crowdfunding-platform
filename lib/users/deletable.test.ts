import { describe, expect, it } from "vitest";
import { deletionImpact, whyNotDeletable, type DeletionTarget } from "./deletable";

const target = (overrides: Partial<DeletionTarget> = {}): DeletionTarget => ({
  id: "u1",
  isAdmin: false,
  isInvestor: false,
  ...overrides,
});

describe("whyNotDeletable", () => {
  it("allows deleting an ordinary account", () => {
    expect(whyNotDeletable(target(), { callerId: "admin-1", adminCount: 2 })).toBeNull();
  });

  it("refuses deleting your own account", () => {
    expect(whyNotDeletable(target({ id: "me" }), { callerId: "me", adminCount: 3 })).toBe(
      "self"
    );
  });

  it("refuses deleting the last admin", () => {
    expect(
      whyNotDeletable(target({ isAdmin: true }), { callerId: "otro", adminCount: 1 })
    ).toBe("last-admin");
  });

  it("allows deleting an admin while another one remains", () => {
    expect(
      whyNotDeletable(target({ isAdmin: true }), { callerId: "otro", adminCount: 2 })
    ).toBeNull();
  });

  it("checks self before anything else: deleting yourself is never right", () => {
    // Last admin AND yourself: the message should talk about yourself.
    expect(whyNotDeletable(target({ id: "me", isAdmin: true }), { callerId: "me", adminCount: 1 })).toBe(
      "self"
    );
  });

  it("allows deleting an investor: their record survives the account", () => {
    expect(
      whyNotDeletable(target({ isInvestor: true }), { callerId: "admin-1", adminCount: 2 })
    ).toBeNull();
  });
});

describe("deletionImpact — what the admin is told before confirming", () => {
  it("lists what goes for a plain visitor", () => {
    expect(deletionImpact(target())).toEqual({
      keepsInvestorRecord: false,
      losesAccess: true,
    });
  });

  it("says the investor record stays when the account is linked", () => {
    expect(deletionImpact(target({ isInvestor: true }))).toEqual({
      keepsInvestorRecord: true,
      losesAccess: true,
    });
  });
});
