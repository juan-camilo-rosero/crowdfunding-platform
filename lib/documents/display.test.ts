import { describe, expect, it } from "vitest";
import { describeDocument, documentTypeLabel } from "./display";

describe("documentTypeLabel", () => {
  it("maps a stored value to its Spanish label", () => {
    expect(documentTypeLabel("deed")).toBe("Escritura");
  });

  it("returns the stored value for one it does not know, rather than nothing", () => {
    expect(documentTypeLabel("otro tipo")).toBe("otro tipo");
  });

  it("is empty for a missing type", () => {
    expect(documentTypeLabel(null)).toBe("");
    expect(documentTypeLabel(undefined)).toBe("");
  });
});

describe("describeDocument", () => {
  it("leads with the name and qualifies it with the type", () => {
    expect(describeDocument({ name: "Escritura lote 118", docType: "deed" })).toEqual({
      primary: "Escritura lote 118",
      secondary: "Escritura",
    });
  });

  it("puts the type on the first line when there is no name", () => {
    expect(describeDocument({ name: "", docType: "deed" })).toEqual({
      primary: "Escritura",
      secondary: "",
    });
    expect(describeDocument({ name: "   ", docType: "deed" })).toEqual({
      primary: "Escritura",
      secondary: "",
    });
    expect(describeDocument({ name: null, docType: "deed" })).toEqual({
      primary: "Escritura",
      secondary: "",
    });
  });

  it("does not say the same word twice when the name is the type", () => {
    expect(describeDocument({ name: "escritura", docType: "deed" })).toEqual({
      primary: "escritura",
      secondary: "",
    });
  });

  it("ignores accents and case when comparing, as a reader would", () => {
    // "Planos" is the label of "planos"; a name typed without the capital is
    // still the same word.
    expect(describeDocument({ name: "PLANOS", docType: "planos" }).secondary).toBe("");
  });

  it("keeps the name alone when the type is missing", () => {
    expect(describeDocument({ name: "Acta", docType: null })).toEqual({
      primary: "Acta",
      secondary: "",
    });
  });

  it("is empty on both lines when there is nothing to say", () => {
    expect(describeDocument({ name: null, docType: null })).toEqual({
      primary: "",
      secondary: "",
    });
  });

  it("trims the name it shows", () => {
    expect(describeDocument({ name: "  Acta  ", docType: null }).primary).toBe("Acta");
  });
});
