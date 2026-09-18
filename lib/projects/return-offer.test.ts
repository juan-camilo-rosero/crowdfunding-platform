import { describe, expect, it } from "vitest";
import {
  describeReturnOffer,
  draftToOffer,
  estimateReturn,
  offerToDraft,
  parseReturnOffer,
  returnOfferLabel,
  serializeReturnOffer,
  validateReturnOffer,
  type ReturnOffer,
  type ReturnOfferDraft,
} from "./return-offer";

const ANNUAL: ReturnOffer = {
  kind: "annual",
  terms: [
    { months: 6, min: 8, max: 12 },
    { months: 12, min: 10, max: 15 },
  ],
};
const TOTAL: ReturnOffer = { kind: "total", min: 18, max: 22, months: 18 };
const PARTICIPATION: ReturnOffer = { kind: "participation", percent: 8 };

describe("parseReturnOffer — tolerant reading for display", () => {
  it("reads an object as stored in jsonb", () => {
    expect(parseReturnOffer(ANNUAL)).toEqual(ANNUAL);
  });

  it("reads the JSON string the grid holds for an edit", () => {
    expect(parseReturnOffer(JSON.stringify(TOTAL))).toEqual(TOTAL);
  });

  it("is null for nothing, garbage or an unknown kind — never a throw", () => {
    expect(parseReturnOffer(null)).toBeNull();
    expect(parseReturnOffer("")).toBeNull();
    expect(parseReturnOffer("{no es json")).toBeNull();
    expect(parseReturnOffer({ kind: "magia" })).toBeNull();
    expect(parseReturnOffer({ kind: "annual", terms: [] })).toBeNull();
    expect(parseReturnOffer({ kind: "total", min: -5, max: 10, months: null })).toBeNull();
  });
});

describe("describeReturnOffer — the label investors read", () => {
  it("annual range across its terms, with the span of terms", () => {
    expect(describeReturnOffer(ANNUAL)).toBe("8%–15% anual · 6 a 12 meses");
  });

  it("a single fixed annual rate", () => {
    expect(
      describeReturnOffer({ kind: "annual", terms: [{ months: 12, min: 12, max: 12 }] })
    ).toBe("12% anual · 12 meses");
  });

  it("decimals in the local format", () => {
    expect(
      describeReturnOffer({ kind: "annual", terms: [{ months: 1, min: 12.5, max: 12.5 }] })
    ).toBe("12,5% anual · 1 mes");
  });

  it("total at exit, with its estimated term when known", () => {
    expect(describeReturnOffer(TOTAL)).toBe("18%–22% al cierre · 18 meses");
    expect(describeReturnOffer({ kind: "total", min: 20, max: 20, months: null })).toBe(
      "20% al cierre"
    );
  });

  it("participation in profits", () => {
    expect(describeReturnOffer(PARTICIPATION)).toBe("8% de participación en utilidades");
  });

  it("nothing for no offer", () => {
    expect(describeReturnOffer(null)).toBe("");
  });
});

describe("returnOfferLabel — what the catalogue shows", () => {
  it("prefers the structured offer", () => {
    expect(returnOfferLabel(TOTAL, "Hasta 15% anual")).toBe("18%–22% al cierre · 18 meses");
  });

  it("falls back to the legacy free text while no offer is configured", () => {
    expect(returnOfferLabel(null, "  Hasta 15% anual ")).toBe("Hasta 15% anual");
  });

  it("is empty when there is neither", () => {
    expect(returnOfferLabel(null, null)).toBe("");
    expect(returnOfferLabel(undefined, "   ")).toBe("");
  });
});

describe("serializeReturnOffer — one canonical form", () => {
  it("sorts terms and fixes the key order, so equal offers serialize equal", () => {
    const shuffled = {
      kind: "annual",
      terms: [
        { max: 15, months: 12, min: 10 },
        { min: 8, max: 12, months: 6 },
      ],
    } as unknown as ReturnOffer;

    expect(serializeReturnOffer(shuffled)).toBe(serializeReturnOffer(ANNUAL));
  });

  it("is empty for no offer", () => {
    expect(serializeReturnOffer(null)).toBe("");
  });
});

describe("validateReturnOffer — the server's gate", () => {
  it("accepts a valid offer and returns it canonical", () => {
    const result = validateReturnOffer(JSON.stringify(ANNUAL));
    expect(result).toEqual({ ok: true, value: serializeReturnOffer(ANNUAL) });
  });

  it("refuses text that is not JSON", () => {
    expect(validateReturnOffer("15% anual").ok).toBe(false);
  });

  it("refuses an unknown kind", () => {
    expect(validateReturnOffer(JSON.stringify({ kind: "bono" })).ok).toBe(false);
  });

  it.each([
    ["a max below the min", { kind: "total", min: 20, max: 10, months: null }],
    ["a zero rate", { kind: "participation", percent: 0 }],
    ["an annual rate over 100%", { kind: "annual", terms: [{ months: 12, min: 10, max: 120 }] }],
    ["a fractional term", { kind: "annual", terms: [{ months: 6.5, min: 10, max: 12 }] }],
    ["a term over ten years", { kind: "total", min: 10, max: 12, months: 121 }],
    [
      "the same term twice",
      {
        kind: "annual",
        terms: [
          { months: 12, min: 10, max: 12 },
          { months: 12, min: 11, max: 13 },
        ],
      },
    ],
    ["no terms at all", { kind: "annual", terms: [] }],
    ["a non-numeric rate", { kind: "participation", percent: "ocho" }],
  ])("refuses %s", (_label, offer) => {
    const result = validateReturnOffer(JSON.stringify(offer));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.length).toBeGreaterThan(0);
  });

  it("refuses more than six terms", () => {
    const terms = Array.from({ length: 7 }, (_, index) => ({
      months: (index + 1) * 6,
      min: 10,
      max: 12,
    }));
    expect(validateReturnOffer(JSON.stringify({ kind: "annual", terms })).ok).toBe(false);
  });

  it("drops fields it does not know rather than storing them", () => {
    const result = validateReturnOffer(
      JSON.stringify({ ...PARTICIPATION, sneaky: "<script>" })
    );
    expect(result).toEqual({ ok: true, value: serializeReturnOffer(PARTICIPATION) });
  });
});

describe("the editor draft", () => {
  const blankDraft = (): ReturnOfferDraft => offerToDraft(null);

  it("round-trips every kind", () => {
    for (const offer of [ANNUAL, TOTAL, PARTICIPATION]) {
      expect(draftToOffer(offerToDraft(offer))).toEqual({ ok: true, offer });
    }
  });

  it("means 'no offer' when the kind is none", () => {
    expect(draftToOffer(blankDraft())).toEqual({ ok: true, offer: null });
  });

  it("starts an annual draft with one empty term to fill in", () => {
    const draft = offerToDraft(null);
    expect(draft.terms).toHaveLength(1);
  });

  it("reads decimals typed with a comma, and a stray % sign", () => {
    const draft: ReturnOfferDraft = {
      ...blankDraft(),
      kind: "participation",
      participation: "8,5 %",
    };
    expect(draftToOffer(draft)).toEqual({
      ok: true,
      offer: { kind: "participation", percent: 8.5 },
    });
  });

  it("treats an empty maximum as a fixed rate", () => {
    const draft: ReturnOfferDraft = {
      ...blankDraft(),
      kind: "annual",
      terms: [{ months: "12", min: "12", max: "" }],
    };
    expect(draftToOffer(draft)).toEqual({
      ok: true,
      offer: { kind: "annual", terms: [{ months: 12, min: 12, max: 12 }] },
    });
  });

  it("ignores a term row left completely empty", () => {
    const draft: ReturnOfferDraft = {
      ...blankDraft(),
      kind: "annual",
      terms: [
        { months: "12", min: "10", max: "12" },
        { months: "", min: "", max: "" },
      ],
    };
    expect(draftToOffer(draft)).toEqual({
      ok: true,
      offer: { kind: "annual", terms: [{ months: 12, min: 10, max: 12 }] },
    });
  });

  it("says which term is missing its rate", () => {
    const draft: ReturnOfferDraft = {
      ...blankDraft(),
      kind: "annual",
      terms: [{ months: "18", min: "", max: "" }],
    };
    const result = draftToOffer(draft);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("18");
  });

  it("asks for at least one term", () => {
    const draft: ReturnOfferDraft = {
      ...blankDraft(),
      kind: "annual",
      terms: [{ months: "", min: "", max: "" }],
    };
    expect(draftToOffer(draft).ok).toBe(false);
  });

  it("refuses a max below the min, before any round trip", () => {
    const draft: ReturnOfferDraft = {
      ...blankDraft(),
      kind: "total",
      totalMin: "20",
      totalMax: "10",
    };
    expect(draftToOffer(draft).ok).toBe(false);
  });

  it("allows a total offer without an estimated term", () => {
    const draft: ReturnOfferDraft = { ...blankDraft(), kind: "total", totalMin: "20" };
    expect(draftToOffer(draft)).toEqual({
      ok: true,
      offer: { kind: "total", min: 20, max: 20, months: null },
    });
  });

  it("refuses text where a number goes", () => {
    const draft: ReturnOfferDraft = {
      ...blankDraft(),
      kind: "participation",
      participation: "mucho",
    };
    expect(draftToOffer(draft).ok).toBe(false);
  });
});

describe("estimateReturn — the calculator's arithmetic, on real terms", () => {
  it("annual: simple interest over the chosen term", () => {
    expect(estimateReturn(ANNUAL, 10000, 12)).toEqual({
      totalMin: 1000,
      totalMax: 1500,
      monthlyMin: 1000 / 12,
      monthlyMax: 1500 / 12,
      months: 12,
    });
  });

  it("annual: a 6-month term earns half a year", () => {
    const estimate = estimateReturn(ANNUAL, 10000, 6);
    expect(estimate?.totalMin).toBeCloseTo(400);
    expect(estimate?.totalMax).toBeCloseTo(600);
  });

  it("annual: an unknown term falls back to the first one offered", () => {
    expect(estimateReturn(ANNUAL, 10000, 99)?.months).toBe(6);
  });

  it("total: the percentage of the capital, spread over the term when known", () => {
    expect(estimateReturn(TOTAL, 10000)).toEqual({
      totalMin: 1800,
      totalMax: 2200,
      monthlyMin: 100,
      monthlyMax: 2200 / 18,
      months: 18,
    });
  });

  it("total: no monthly figure without a term — it would be invented", () => {
    const estimate = estimateReturn({ kind: "total", min: 20, max: 20, months: null }, 10000);
    expect(estimate).toEqual({
      totalMin: 2000,
      totalMax: 2000,
      monthlyMin: null,
      monthlyMax: null,
      months: null,
    });
  });

  it("participation: no estimate at all — it depends on the profit", () => {
    expect(estimateReturn(PARTICIPATION, 10000)).toBeNull();
  });

  it("nothing for no amount", () => {
    expect(estimateReturn(ANNUAL, 0, 12)).toBeNull();
    expect(estimateReturn(ANNUAL, -5, 12)).toBeNull();
  });
});
