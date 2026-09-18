import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { es } from "@/i18n";
import type { ReturnOffer } from "@/lib/projects/return-offer";

// Recharts measures a real layout jsdom does not have; the chart's own
// rendering is not what these tests are about.
vi.mock("@/components/charts/ReturnRangeChart", () => ({
  ReturnRangeChart: () => <div data-testid="return-chart" />,
}));

const { ReturnCalculator } = await import("./ReturnCalculator");

const c = es.projectDetail.calculator;

const ANNUAL: ReturnOffer = {
  kind: "annual",
  terms: [
    { months: 6, min: 8, max: 12 },
    { months: 12, min: 10, max: 15 },
  ],
};

/** The figure shown under a label ("Rendimiento total estimado", …). */
const figureFor = (label: string) =>
  screen.getByText(label).nextElementSibling?.textContent;

describe("annual offer", () => {
  it("says which offer the numbers come from", () => {
    render(<ReturnCalculator offer={ANNUAL} />);

    expect(
      screen.getByText(c.basedOn.replace("{offer}", "8%–15% anual · 6 a 12 meses"))
    ).toBeInTheDocument();
  });

  it("computes the first term on the default amount, from the project's own rates", () => {
    render(<ReturnCalculator offer={ANNUAL} />);

    // $10,000 × 8–12% × 6/12 = $400–$600; over 6 months, $67–$100 a month.
    expect(figureFor(c.totalLabel)).toBe("entre $400 y $600");
    expect(figureFor(c.monthlyLabel)).toBe("entre $67 y $100");
  });

  it("recomputes for another term", async () => {
    const user = userEvent.setup();
    render(<ReturnCalculator offer={ANNUAL} />);

    await user.click(screen.getByRole("button", { name: "12 meses" }));

    expect(figureFor(c.totalLabel)).toBe("entre $1,000 y $1,500");
  });

  it("recomputes for another amount", async () => {
    const user = userEvent.setup();
    render(<ReturnCalculator offer={ANNUAL} />);

    const amount = screen.getByLabelText(c.amountLabel);
    await user.clear(amount);
    await user.type(amount, "20000");

    expect(figureFor(c.totalLabel)).toBe("entre $800 y $1,200");
  });

  it("asks for an amount instead of showing zeros", async () => {
    const user = userEvent.setup();
    render(<ReturnCalculator offer={ANNUAL} />);

    await user.clear(screen.getByLabelText(c.amountLabel));

    expect(screen.getByText(c.amountEmpty)).toBeInTheDocument();
    expect(screen.queryByText(c.totalLabel)).not.toBeInTheDocument();
  });

  it("shows a single figure for a fixed rate, not 'entre $X y $X'", () => {
    render(
      <ReturnCalculator
        offer={{ kind: "annual", terms: [{ months: 12, min: 12, max: 12 }] }}
      />
    );

    expect(figureFor(c.totalLabel)).toBe("$1,200");
  });

  it("does not offer a choice when there is only one term", () => {
    render(
      <ReturnCalculator
        offer={{ kind: "annual", terms: [{ months: 12, min: 12, max: 12 }] }}
      />
    );

    expect(screen.queryByRole("button", { name: "12 meses" })).not.toBeInTheDocument();
    expect(screen.getByText("12 meses")).toBeInTheDocument();
  });
});

describe("total-at-exit offer", () => {
  const TOTAL: ReturnOffer = { kind: "total", min: 18, max: 22, months: 18 };

  it("applies the total percentage to the amount", () => {
    render(<ReturnCalculator offer={TOTAL} />);

    expect(figureFor(c.totalLabel)).toBe("entre $1,800 y $2,200");
    expect(figureFor(c.monthlyLabel)).toBe("entre $100 y $122");
    expect(screen.getByTestId("return-chart")).toBeInTheDocument();
  });

  it("shows the estimated term as a fact, not as a choice", () => {
    render(<ReturnCalculator offer={TOTAL} />);

    expect(screen.queryByRole("button", { name: "18 meses" })).not.toBeInTheDocument();
    expect(screen.getByText("18 meses")).toBeInTheDocument();
  });

  it("invents no monthly figure and no curve when the project gives no term", () => {
    render(<ReturnCalculator offer={{ kind: "total", min: 20, max: 20, months: null }} />);

    expect(figureFor(c.totalLabel)).toBe("$2,000");
    expect(screen.queryByText(c.monthlyLabel)).not.toBeInTheDocument();
    expect(screen.queryByTestId("return-chart")).not.toBeInTheDocument();
    expect(screen.getByText(c.noTermNote)).toBeInTheDocument();
  });
});

describe("always", () => {
  it("keeps the disclaimer in view", () => {
    render(<ReturnCalculator offer={ANNUAL} />);

    expect(screen.getByText(c.disclaimer)).toBeInTheDocument();
  });
});
