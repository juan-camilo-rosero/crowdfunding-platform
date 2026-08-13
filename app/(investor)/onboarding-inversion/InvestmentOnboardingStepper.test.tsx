import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { es } from "@/i18n";
import type { InvestmentOnboardingState } from "@/lib/onboarding/investment";
import { InvestmentOnboardingStepper } from "./InvestmentOnboardingStepper";

const verifyIdentity = vi.fn();
const signContract = vi.fn();

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

vi.mock("./actions", () => ({
  verifyIdentity: () => verifyIdentity(),
  signContract: () => signContract(),
}));

const state = (
  over: Partial<InvestmentOnboardingState> = {}
): InvestmentOnboardingState => ({
  applies: true,
  identity: "pendiente",
  contract: "pendiente",
  // What contractStage() yields in mock mode with nothing sent: the investor
  // signs inline. The real-provider stages get their own tests below.
  contractStage: "en-firma",
  signing: null,
  isComplete: false,
  config: { enabled: true, identityStepEnabled: true, contractStepEnabled: true, selfServiceSigning: true },
  ...over,
});

/** State with the identity step switched off by configuration. */
const identitySkipped = () =>
  state({
    identity: "omitido",
    config: { enabled: true, identityStepEnabled: false, contractStepEnabled: true, selfServiceSigning: true },
  });

const stepFor = (title: string) => screen.getByText(title).closest("li")!;

beforeEach(() => {
  vi.clearAllMocks();
  verifyIdentity.mockResolvedValue({ ok: true, status: "hecho" });
  signContract.mockResolvedValue({ ok: true, status: "hecho" });
});

describe("the stepper reflects what the server derived", () => {
  it("shows both steps pending at the start", () => {
    render(<InvestmentOnboardingStepper state={state()} />);

    for (const title of [
      es.investmentOnboarding.identity.title,
      es.investmentOnboarding.contract.title,
    ]) {
      expect(
        within(stepFor(title)).getByText(es.investmentOnboarding.status.pendiente)
      ).toBeInTheDocument();
    }
  });

  it("marks identity as done and drops its button", () => {
    render(<InvestmentOnboardingStepper state={state({ identity: "hecho" })} />);

    const step = within(stepFor(es.investmentOnboarding.identity.title));
    expect(step.getByText(es.investmentOnboarding.status.hecho)).toBeInTheDocument();
    expect(
      step.queryByRole("button", { name: es.investmentOnboarding.identity.action })
    ).not.toBeInTheDocument();
  });

  it("labels a skipped step as not applicable, not as pending", () => {
    render(<InvestmentOnboardingStepper state={identitySkipped()} />);

    const step = within(stepFor(es.investmentOnboarding.identity.title));
    expect(step.getByText(es.investmentOnboarding.status.omitido)).toBeInTheDocument();
    expect(step.getByText(es.investmentOnboarding.identity.skipped)).toBeInTheDocument();
  });

  it("is resumable: it renders from the state, holding no step of its own", () => {
    // Coming back mid-flow lands exactly where the facts say.
    render(<InvestmentOnboardingStepper state={state({ identity: "hecho" })} />);

    expect(
      screen.getByRole("button", { name: es.investmentOnboarding.contract.action })
    ).toBeInTheDocument();
  });
});

describe("order of the steps", () => {
  it("does not offer signing while identity is pending", () => {
    render(<InvestmentOnboardingStepper state={state()} />);

    expect(
      screen.queryByRole("button", { name: es.investmentOnboarding.contract.action })
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(es.investmentOnboarding.contract.blocked)
    ).toBeInTheDocument();
  });

  it("offers signing straight away when identity is skipped", () => {
    render(<InvestmentOnboardingStepper state={identitySkipped()} />);

    expect(
      screen.getByRole("button", { name: es.investmentOnboarding.contract.action })
    ).toBeInTheDocument();
  });
});

describe("running a step", () => {
  it("calls the action with NO arguments", async () => {
    const user = userEvent.setup();
    render(<InvestmentOnboardingStepper state={state()} />);

    await user.click(
      screen.getByRole("button", { name: es.investmentOnboarding.identity.action })
    );

    await waitFor(() => expect(verifyIdentity).toHaveBeenCalledTimes(1));
    // The client asks; it never states a result.
    expect(verifyIdentity).toHaveBeenCalledWith();
  });

  it("confirms an approval", async () => {
    const user = userEvent.setup();
    render(<InvestmentOnboardingStepper state={state()} />);

    await user.click(
      screen.getByRole("button", { name: es.investmentOnboarding.identity.action })
    );

    expect(
      await screen.findByText(es.investmentOnboarding.identity.approved)
    ).toBeInTheDocument();
  });

  it("shows a rejection and leaves the step retryable", async () => {
    verifyIdentity.mockResolvedValue({
      ok: true,
      status: "rechazado",
      message: es.investmentOnboarding.identity.rejected,
    });

    const user = userEvent.setup();
    render(<InvestmentOnboardingStepper state={state()} />);

    await user.click(
      screen.getByRole("button", { name: es.investmentOnboarding.identity.action })
    );

    expect(
      await screen.findByText(es.investmentOnboarding.identity.rejected)
    ).toBeInTheDocument();
    // A refusal is not a dead end: the button comes back once the transition
    // settles, so the person can try again.
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: es.investmentOnboarding.identity.action })
      ).toBeEnabled()
    );
  });

  it("shows a Spanish error without breaking when the provider fails", async () => {
    verifyIdentity.mockResolvedValue({
      ok: false,
      error: es.investmentOnboarding.errors.identityFailed,
    });

    const user = userEvent.setup();
    render(<InvestmentOnboardingStepper state={state()} />);

    await user.click(
      screen.getByRole("button", { name: es.investmentOnboarding.identity.action })
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      es.investmentOnboarding.errors.identityFailed
    );
  });

  it("signs the contract once identity is done", async () => {
    const user = userEvent.setup();
    render(<InvestmentOnboardingStepper state={state({ identity: "hecho" })} />);

    await user.click(
      screen.getByRole("button", { name: es.investmentOnboarding.contract.action })
    );

    await waitFor(() => expect(signContract).toHaveBeenCalledWith());
    expect(
      await screen.findByText(es.investmentOnboarding.contract.signed)
    ).toBeInTheDocument();
  });

  it("never uses language that promises a return", () => {
    render(<InvestmentOnboardingStepper state={state({ identity: "hecho" })} />);

    const label = es.investmentOnboarding.contract.action;
    expect(label).toBe("Firmar");
    expect(label).not.toMatch(/invertir|ganar|rentabilidad/i);
  });
});

describe("the contract stages a real provider adds", () => {
  it("says the team will send it when nothing has gone out", () => {
    render(
      <InvestmentOnboardingStepper
        state={state({ identity: "hecho", contractStage: "sin-enviar" })}
      />
    );

    expect(
      screen.getByText(es.investmentOnboarding.contract.awaitingSend)
    ).toBeInTheDocument();
    // Nothing for the investor to press: pressing it would fail.
    expect(
      screen.queryByRole("button", { name: es.investmentOnboarding.contract.action })
    ).not.toBeInTheDocument();
  });

  it("sends the investor to the provider when there is a signing URL", () => {
    render(
      <InvestmentOnboardingStepper
        state={state({
          identity: "hecho",
          contractStage: "en-firma",
          signing: {
            status: "enviado",
            signingUrl: "https://app.documenso.com/sign/abc",
            declinedReason: null,
            hasSignedDocument: false,
          },
        })}
      />
    );

    expect(
      screen.getByRole("link", { name: es.investmentOnboarding.contract.openSigning })
    ).toHaveAttribute("href", "https://app.documenso.com/sign/abc");
  });

  it("shows 'processing' between signing and the webhook landing", async () => {
    const user = userEvent.setup();
    render(
      <InvestmentOnboardingStepper
        state={state({ identity: "hecho", contractStage: "procesando" })}
      />
    );

    expect(
      screen.getByText(es.investmentOnboarding.contract.processing)
    ).toBeInTheDocument();

    // Refresh re-reads the server; it never asserts a state.
    await user.click(
      screen.getByRole("button", { name: new RegExp(es.investmentOnboarding.contract.refresh) })
    );
    expect(refresh).toHaveBeenCalled();
    expect(signContract).not.toHaveBeenCalled();
  });

  it("explains a rejection and offers no self-service retry", () => {
    render(
      <InvestmentOnboardingStepper
        state={state({ identity: "hecho", contractStage: "rechazado" })}
      />
    );

    expect(
      screen.getByText(es.investmentOnboarding.contract.declined)
    ).toBeInTheDocument();
    // Resending is the admin's act.
    expect(
      screen.queryByRole("button", { name: es.investmentOnboarding.contract.action })
    ).not.toBeInTheDocument();
  });

  it("explains an expiry and a cancellation the same way", () => {
    const { unmount } = render(
      <InvestmentOnboardingStepper
        state={state({ identity: "hecho", contractStage: "expirado" })}
      />
    );
    expect(
      screen.getByText(es.investmentOnboarding.contract.expired)
    ).toBeInTheDocument();
    unmount();

    render(
      <InvestmentOnboardingStepper
        state={state({ identity: "hecho", contractStage: "anulado" })}
      />
    );
    expect(
      screen.getByText(es.investmentOnboarding.contract.cancelled)
    ).toBeInTheDocument();
  });
});

describe("when everything is done", () => {
  const done = () =>
    state({ identity: "hecho", contract: "hecho", isComplete: true });

  it("says so soberly and points at the documents", () => {
    render(<InvestmentOnboardingStepper state={done()} />);

    expect(
      screen.getByText(es.investmentOnboarding.completeTitle)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: es.investmentOnboarding.goToDocuments })
    ).toHaveAttribute("href", "/documentos");
  });

  it("offers no action to run again", () => {
    render(<InvestmentOnboardingStepper state={done()} />);

    expect(
      screen.queryByRole("button", { name: es.investmentOnboarding.identity.action })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: es.investmentOnboarding.contract.action })
    ).not.toBeInTheDocument();
  });
});
