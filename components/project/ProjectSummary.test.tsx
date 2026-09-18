import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { es } from "@/i18n";

vi.mock("@/components/charts/ReturnRangeChart", () => ({
  ReturnRangeChart: () => <div data-testid="return-chart" />,
}));

const { ProjectSummary } = await import("./ProjectSummary");

const c = es.projectDetail.calculator;

const base = { description: "Una casa.", sellingPoints: null };

describe("what the summary offers to estimate", () => {
  it("runs the calculator on the project's real offer", () => {
    render(
      <ProjectSummary
        {...base}
        returnOffer={{ kind: "annual", terms: [{ months: 12, min: 10, max: 15 }] }}
      />
    );

    expect(screen.getByText(c.title)).toBeInTheDocument();
  });

  it("reads the offer as stored in the database (jsonb object)", () => {
    render(
      <ProjectSummary
        {...base}
        returnOffer={JSON.parse('{"kind":"total","min":20,"max":20,"months":null}')}
      />
    );

    expect(screen.getByText(c.title)).toBeInTheDocument();
  });

  it("shows NO calculator when the project has no offer — no made-up terms", () => {
    render(<ProjectSummary {...base} returnOffer={null} />);

    expect(screen.queryByText(c.title)).not.toBeInTheDocument();
  });

  it("shows no calculator for an offer it cannot read", () => {
    render(<ProjectSummary {...base} returnOffer={{ kind: "misterio" }} />);

    expect(screen.queryByText(c.title)).not.toBeInTheDocument();
  });

  it("explains a participation instead of computing a figure", () => {
    render(
      <ProjectSummary {...base} returnOffer={{ kind: "participation", percent: 8 }} />
    );

    expect(screen.queryByText(c.title)).not.toBeInTheDocument();
    expect(screen.getByText(c.participationTitle)).toBeInTheDocument();
    expect(
      screen.getByText(
        c.participationBody.replace("{offer}", "8% de participación en utilidades")
      )
    ).toBeInTheDocument();
  });

  it("hides every estimate on a project closed to investment", () => {
    render(
      <ProjectSummary
        {...base}
        closedToInvestment
        returnOffer={{ kind: "annual", terms: [{ months: 12, min: 10, max: 15 }] }}
      />
    );

    expect(screen.queryByText(c.title)).not.toBeInTheDocument();
  });

  it("hides the participation note too when closed", () => {
    render(
      <ProjectSummary
        {...base}
        closedToInvestment
        returnOffer={{ kind: "participation", percent: 8 }}
      />
    );

    expect(screen.queryByText(c.participationTitle)).not.toBeInTheDocument();
  });
});
