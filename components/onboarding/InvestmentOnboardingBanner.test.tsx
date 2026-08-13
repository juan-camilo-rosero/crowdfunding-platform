import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { es } from "@/i18n";
import type { InvestmentOnboardingState } from "@/lib/onboarding/investment";
import { InvestmentOnboardingBanner } from "./InvestmentOnboardingBanner";

const state = (
  over: Partial<InvestmentOnboardingState> = {}
): InvestmentOnboardingState => ({
  applies: true,
  identity: "pendiente",
  contract: "pendiente",
  contractStage: "sin-enviar",
  signing: null,
  isComplete: false,
  config: { enabled: true, identityStepEnabled: true, contractStepEnabled: true, selfServiceSigning: true },
  ...over,
});

describe("when it appears", () => {
  it("invites an investor with steps pending", () => {
    render(<InvestmentOnboardingBanner state={state()} />);

    expect(
      screen.getByText(es.investmentOnboarding.banner.title)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: new RegExp(es.investmentOnboarding.banner.action),
      })
    ).toHaveAttribute("href", "/onboarding-inversion");
  });

  it("still appears with one step already done", () => {
    render(<InvestmentOnboardingBanner state={state({ identity: "hecho" })} />);

    expect(
      screen.getByText(es.investmentOnboarding.banner.title)
    ).toBeInTheDocument();
  });
});

describe("when it disappears", () => {
  it("renders nothing once everything is done", () => {
    const { container } = render(
      <InvestmentOnboardingBanner
        state={state({ identity: "hecho", contract: "hecho", isComplete: true })}
      />
    );

    // The reward for finishing is that it goes away.
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing for someone the flow does not apply to", () => {
    const { container } = render(
      <InvestmentOnboardingBanner
        state={state({ applies: false, isComplete: true })}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when the flow is switched off by configuration", () => {
    const { container } = render(
      <InvestmentOnboardingBanner
        state={state({
          applies: false,
          isComplete: true,
          config: {
            enabled: false,
            identityStepEnabled: false,
            contractStepEnabled: false,
            selfServiceSigning: true,
          },
        })}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });
});

describe("it invites without blocking", () => {
  it("offers one way forward and nothing that traps the user", () => {
    render(<InvestmentOnboardingBanner state={state()} />);

    // No modal, and no dismissal that would leave the person with no way back.
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
