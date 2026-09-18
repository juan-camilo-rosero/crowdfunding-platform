import { useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { es } from "@/i18n";
import {
  offerToDraft,
  type ReturnOffer,
  type ReturnOfferDraft,
} from "@/lib/projects/return-offer";
import { ReturnOfferEditor } from "./ReturnOfferEditor";

const t = es.returnOffer;

/** The editor is controlled; this holds its draft the way a caller would. */
function Harness({ initial }: { initial: ReturnOffer | null }) {
  const [draft, setDraft] = useState<ReturnOfferDraft>(offerToDraft(initial));
  return <ReturnOfferEditor draft={draft} onDraftChange={setDraft} />;
}

const preview = () => screen.getByTestId("return-offer-preview");
const kindButton = (label: string) => screen.getByRole("button", { name: label });

describe("choosing how the return is offered", () => {
  it("marks the current kind as pressed", () => {
    render(<Harness initial={{ kind: "participation", percent: 8 }} />);

    expect(kindButton(t.kinds.participation)).toHaveAttribute("aria-pressed", "true");
    expect(kindButton(t.kinds.annual)).toHaveAttribute("aria-pressed", "false");
  });

  it("starts on 'Sin publicar' for a project with no offer", () => {
    render(<Harness initial={null} />);

    expect(kindButton(t.kinds.none)).toHaveAttribute("aria-pressed", "true");
    expect(preview()).toHaveTextContent(t.previewEmpty);
  });

  it("explains each kind in a line under the choice", async () => {
    const user = userEvent.setup();
    render(<Harness initial={null} />);

    await user.click(kindButton(t.kinds.total));

    expect(screen.getByText(t.kindHints.total)).toBeInTheDocument();
  });

  it("keeps what was typed when switching kind and back", async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ kind: "participation", percent: 8 }} />);

    await user.click(kindButton(t.kinds.total));
    await user.click(kindButton(t.kinds.participation));

    expect(screen.getByLabelText(t.participationLabel)).toHaveValue("8");
  });
});

describe("annual rate by term", () => {
  it("previews the catalogue label as the admin types", async () => {
    const user = userEvent.setup();
    render(<Harness initial={null} />);

    await user.click(kindButton(t.kinds.annual));
    await user.type(screen.getByLabelText(`${t.termMonths}, fila 1`), "12");
    await user.type(screen.getByLabelText(`${t.rateMin}, fila 1`), "10");
    await user.type(screen.getByLabelText(`${t.rateMax}, fila 1`), "15");

    expect(preview()).toHaveTextContent("10%–15% anual · 12 meses");
  });

  it("adds and removes terms", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initial={{ kind: "annual", terms: [{ months: 12, min: 10, max: 12 }] }}
      />
    );

    await user.click(screen.getByRole("button", { name: t.addTerm }));
    expect(screen.getByLabelText(`${t.termMonths}, fila 2`)).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: t.removeTerm.replace("{n}", "2") })
    );
    expect(screen.queryByLabelText(`${t.termMonths}, fila 2`)).not.toBeInTheDocument();
  });

  it("never removes the last term row, so there is always one to fill", () => {
    render(
      <Harness
        initial={{ kind: "annual", terms: [{ months: 12, min: 10, max: 12 }] }}
      />
    );

    expect(
      screen.queryByRole("button", { name: t.removeTerm.replace("{n}", "1") })
    ).not.toBeInTheDocument();
  });

  it("stops offering new terms at the limit", async () => {
    const user = userEvent.setup();
    render(<Harness initial={null} />);
    await user.click(kindButton(t.kinds.annual));

    for (let i = 0; i < 5; i += 1) {
      await user.click(screen.getByRole("button", { name: t.addTerm }));
    }

    expect(screen.getByRole("button", { name: t.addTerm })).toBeDisabled();
  });

  it("says what is wrong instead of a label when a value does not add up", async () => {
    const user = userEvent.setup();
    render(<Harness initial={null} />);

    await user.click(kindButton(t.kinds.annual));
    await user.type(screen.getByLabelText(`${t.termMonths}, fila 1`), "12");
    await user.type(screen.getByLabelText(`${t.rateMin}, fila 1`), "15");
    await user.type(screen.getByLabelText(`${t.rateMax}, fila 1`), "10");

    expect(within(preview()).getByText(t.errors.maxBelowMin)).toBeInTheDocument();
  });
});

describe("total at exit and participation", () => {
  it("previews a total with its optional term", async () => {
    const user = userEvent.setup();
    render(<Harness initial={null} />);

    await user.click(kindButton(t.kinds.total));
    await user.type(screen.getByLabelText(t.totalMin), "20");
    expect(preview()).toHaveTextContent("20% al cierre");

    await user.type(screen.getByLabelText(`${t.totalMonths} (${t.optional})`), "18");
    expect(preview()).toHaveTextContent("20% al cierre · 18 meses");
  });

  it("previews a participation", async () => {
    const user = userEvent.setup();
    render(<Harness initial={null} />);

    await user.click(kindButton(t.kinds.participation));
    await user.type(screen.getByLabelText(t.participationLabel), "8,5");

    expect(preview()).toHaveTextContent("8,5% de participación en utilidades");
  });
});
