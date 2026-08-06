import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { es } from "@/i18n";
import {
  ProjectMyInvestment,
  type ProjectContribution,
} from "./ProjectMyInvestment";

const POSITION = {
  currentCapital: 45926,
  contributed: 60000,
  returnedCapital: 14074,
  yieldReceived: 3200,
};

const CONTRIBUTIONS: ProjectContribution[] = [
  {
    id: "c1",
    receivedDate: "2026-03-27",
    amount: 41000,
    capitalType: "equity",
    agreedReturn: "15% anual",
    term: "12 meses",
    status: "recibido",
  },
  {
    id: "c2",
    receivedDate: "2026-01-10",
    amount: 19000,
    capitalType: "préstamo",
    agreedReturn: "Participación 8%",
    term: "6 meses",
    status: "devuelto",
  },
];

const renderPanel = (
  props: Partial<Parameters<typeof ProjectMyInvestment>[0]> = {}
) =>
  render(
    <ProjectMyInvestment
      position={POSITION}
      contributions={CONTRIBUTIONS}
      projectCapitalReceived={200000}
      {...props}
    />
  );

describe("figures", () => {
  it("shows the current capital in this project", () => {
    renderPanel();
    expect(screen.getByText("$45,926")).toBeInTheDocument();
  });

  it("shows yield ACTUALLY received", () => {
    renderPanel();
    expect(screen.getByText("$3,200")).toBeInTheDocument();
    expect(
      screen.getByText(es.projectDetail.myInvestment.yieldHint)
    ).toBeInTheDocument();
  });

  it("shows a zero yield as zero rather than hiding it", () => {
    renderPanel({ position: { ...POSITION, yieldReceived: 0 } });

    expect(screen.getByText("$0")).toBeInTheDocument();
    expect(
      screen.getByText(es.projectDetail.myInvestment.yieldNone)
    ).toBeInTheDocument();
  });
});

describe("share of the project", () => {
  it("is the investor's current capital over the project's received capital", () => {
    // 45.926 / 200.000 = 22,963% -> formatPercent rounds to a whole number.
    renderPanel();
    expect(screen.getByText("23%")).toBeInTheDocument();
  });

  it("guards against a zero denominator with a dash, never 0%", () => {
    renderPanel({ projectCapitalReceived: 0 });

    expect(
      screen.getByText(es.projectDetail.myInvestment.shareUnavailableHint)
    ).toBeInTheDocument();
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
  });

  it("guards against a missing denominator the same way", () => {
    renderPanel({ projectCapitalReceived: null });

    expect(
      screen.getByText(es.projectDetail.myInvestment.shareUnavailableHint)
    ).toBeInTheDocument();
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
  });
});

describe("agreed return is literal", () => {
  it("renders the stored text exactly, whatever its shape", () => {
    renderPanel();

    expect(screen.getByText("15% anual")).toBeInTheDocument();
    expect(screen.getByText("Participación 8%")).toBeInTheDocument();
  });

  it("does not normalise a participation into a percentage figure", () => {
    renderPanel({
      contributions: [{ ...CONTRIBUTIONS[0], agreedReturn: "Participación 8%" }],
    });

    const cell = screen.getByText("Participación 8%");
    // Still the whole string; nothing parsed a number out of it.
    expect(cell.textContent).toBe("Participación 8%");
    expect(screen.queryByText("8%")).not.toBeInTheDocument();
  });

  it("shows a dash when no return was agreed, inventing nothing", () => {
    renderPanel({
      contributions: [{ ...CONTRIBUTIONS[0], agreedReturn: null }],
    });

    expect(screen.getByText("—")).toBeInTheDocument();
  });
});

describe("contribution breakdown", () => {
  it("renders the five columns in order", () => {
    renderPanel();

    expect(
      screen.getAllByRole("columnheader").map((h) => h.textContent)
    ).toEqual(["Fecha", "Monto", "Tipo", "Retorno pactado", "Estado"]);
  });

  it("formats dates and amounts with the project helpers", () => {
    renderPanel();

    expect(screen.getByText("27 mar 2026")).toBeInTheDocument();
    expect(screen.getByText("10 ene 2026")).toBeInTheDocument();
    expect(screen.getByText("$41,000")).toBeInTheDocument();
    expect(screen.getByText("$19,000")).toBeInTheDocument();
  });

  it("maps capital type and status to Spanish", () => {
    renderPanel();

    expect(screen.getByText("Equity")).toBeInTheDocument();
    expect(screen.getByText("Préstamo")).toBeInTheDocument();
    expect(screen.getByText("Recibido")).toBeInTheDocument();
    expect(screen.getByText("Devuelto")).toBeInTheDocument();
  });

  it("reads fine with a single contribution", () => {
    renderPanel({ contributions: [CONTRIBUTIONS[0]] });

    expect(screen.getAllByRole("row").slice(1)).toHaveLength(1);
  });

  it("is read-only: no editing controls", () => {
    renderPanel();

    expect(document.querySelectorAll("input, select, textarea")).toHaveLength(0);
    expect(screen.queryByText("+")).not.toBeInTheDocument();
  });

  it("does not rebuild the global transaction history", () => {
    renderPanel();

    // The columns of /transacciones must not appear here.
    const headers = screen
      .getAllByRole("columnheader")
      .map((h) => h.textContent);
    expect(headers).not.toContain("Proyecto");
  });
});

describe("closed position", () => {
  it("says so plainly instead of rendering an empty panel", () => {
    renderPanel({
      position: {
        currentCapital: 0,
        contributed: 60000,
        returnedCapital: 60000,
        yieldReceived: 5000,
      },
    });

    expect(
      screen.getByText(es.projectDetail.myInvestment.closed)
    ).toBeInTheDocument();
    expect(
      screen.getByText(es.projectDetail.myInvestment.investedClosedHint)
    ).toBeInTheDocument();
    // The history is still there.
    expect(screen.getAllByRole("row").slice(1)).toHaveLength(
      CONTRIBUTIONS.length
    );
  });

  it("does not call a position closed when nothing was ever contributed", () => {
    renderPanel({
      position: {
        currentCapital: 0,
        contributed: 0,
        returnedCapital: 0,
        yieldReceived: 0,
      },
      contributions: [],
    });

    expect(
      screen.queryByText(es.projectDetail.myInvestment.closed)
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(es.projectDetail.myInvestment.noContributions)
    ).toBeInTheDocument();
  });
});

describe("no projections", () => {
  it("shows nothing labelled as projected or guaranteed", () => {
    const { container } = renderPanel();

    expect(container.textContent).not.toMatch(/proyectad|garantiz|estimad/i);
  });
});
