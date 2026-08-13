import { describe, expect, it } from "vitest";
import {
  deriveInvestmentOnboardingState,
  fetchInvestmentOnboardingState,
  type InvestmentOnboardingFacts,
  type OnboardingClient,
} from "./investment";
import type { InvestmentOnboardingConfig } from "./investment-config";

const ALL_ON: InvestmentOnboardingConfig = {
  enabled: true,
  identityStepEnabled: true,
  contractStepEnabled: true,
  selfServiceSigning: true,
};

const facts = (over: Partial<InvestmentOnboardingFacts> = {}): InvestmentOnboardingFacts => ({
  isInvestor: true,
  identityVerified: false,
  hasSignedContract: false,
  ...over,
});

const derive = (
  over: Partial<InvestmentOnboardingFacts> = {},
  config: InvestmentOnboardingConfig = ALL_ON
) => deriveInvestmentOnboardingState(facts(over), config);

describe("who is in the flow", () => {
  it("does not apply to someone without an investor link", () => {
    // Eligibility comes from the link the admin created, nothing else.
    const state = derive({ isInvestor: false });

    expect(state.applies).toBe(false);
    expect(state.isComplete).toBe(true);
  });

  it("applies to a linked investor who has done neither step", () => {
    const state = derive();

    expect(state.applies).toBe(true);
    expect(state.identity).toBe("pendiente");
    expect(state.contract).toBe("pendiente");
    expect(state.isComplete).toBe(false);
  });
});

describe("progress derivation", () => {
  it("marks identity done from users.identity_verified", () => {
    expect(derive({ identityVerified: true }).identity).toBe("hecho");
  });

  it("marks the contract done from the existence of the document", () => {
    expect(derive({ hasSignedContract: true }).contract).toBe("hecho");
  });

  it("handles the mixed case: one done, one pending", () => {
    const state = derive({ identityVerified: true });

    expect(state.identity).toBe("hecho");
    expect(state.contract).toBe("pendiente");
    expect(state.isComplete).toBe(false);
  });

  it("is complete only when BOTH are done", () => {
    const state = derive({ identityVerified: true, hasSignedContract: true });

    expect(state.isComplete).toBe(true);
  });
});

describe("the skip flags", () => {
  it("switches the flow off entirely", () => {
    const state = derive({}, { ...ALL_ON, enabled: false });

    expect(state.applies).toBe(false);
    // Nothing pending means no banner and no stepper.
    expect(state.isComplete).toBe(true);
  });

  it("marks a skipped step as omitido, not pendiente", () => {
    const state = derive({}, { ...ALL_ON, identityStepEnabled: false });

    expect(state.identity).toBe("omitido");
    expect(state.contract).toBe("pendiente");
  });

  it("counts a skipped step as done, so the flow can finish", () => {
    // Otherwise a deployment without Truora would hold every investor in an
    // unfinishable onboarding forever.
    const state = derive(
      { hasSignedContract: true },
      { ...ALL_ON, identityStepEnabled: false }
    );

    expect(state.isComplete).toBe(true);
  });

  it("is complete out of the box when both steps are skipped", () => {
    const state = derive(
      {},
      {
        enabled: false,
        identityStepEnabled: false,
        contractStepEnabled: false,
        selfServiceSigning: true,
      }
    );

    expect(state.applies).toBe(false);
    expect(state.isComplete).toBe(true);
  });
});

type Call = { table: string; method: string; args: unknown[] };

function mockClient(byTable: Record<string, unknown[]>) {
  const calls: Call[] = [];
  const client = {
    from: (table: string) => {
      const builder: Record<string, unknown> = {};
      for (const method of ["select", "eq", "in", "limit"]) {
        builder[method] = (...args: unknown[]) => {
          calls.push({ table, method, args });
          return builder;
        };
      }
      builder.then = (resolve: (value: unknown) => unknown) =>
        Promise.resolve({ data: byTable[table] ?? [], error: null }).then(resolve);
      return builder;
    },
  } as unknown as OnboardingClient;
  return { client, calls };
}

describe("reading the facts", () => {
  it("scopes the contract lookup to the caller's investor ids", async () => {
    const { client, calls } = mockClient({
      users: [{ identity_verified: true }],
      documents: [{ id: "doc-1" }],
    });

    const state = await fetchInvestmentOnboardingState(client, "user-1", ["inv-1"], ALL_ON);

    expect(calls).toContainEqual({
      table: "documents",
      method: "in",
      args: ["investor_id", ["inv-1"]],
    });
    expect(calls).toContainEqual({
      table: "users",
      method: "eq",
      args: ["id", "user-1"],
    });
    expect(state.isComplete).toBe(true);
  });

  it("only counts a document of type contrato", async () => {
    const probe = mockClient({ users: [], documents: [] });
    await fetchInvestmentOnboardingState(probe.client, "user-1", ["inv-1"], ALL_ON);

    expect(probe.calls).toContainEqual({
      table: "documents",
      method: "eq",
      args: ["doc_type", "contrato"],
    });
  });

  it("does not query at all without an investor link", async () => {
    const { client, calls } = mockClient({ users: [], documents: [] });

    const state = await fetchInvestmentOnboardingState(client, "user-1", [], ALL_ON);

    expect(calls).toEqual([]);
    expect(state.applies).toBe(false);
  });

  it("reads a missing flag as not verified", async () => {
    const { client } = mockClient({ users: [{ identity_verified: null }], documents: [] });

    const state = await fetchInvestmentOnboardingState(client, "user-1", ["inv-1"], ALL_ON);

    expect(state.identity).toBe("pendiente");
  });
});
