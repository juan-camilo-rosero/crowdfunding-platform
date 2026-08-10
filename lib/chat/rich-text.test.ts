import { describe, expect, it } from "vitest";
import { parseInline, parseRichText, type RichTextBlock } from "./rich-text";

const plain = (text: string) => ({ text, bold: false });
const bold = (text: string) => ({ text, bold: true });

/** Flattens a block back to text, to assert nothing was swallowed. */
const textOf = (block: RichTextBlock): string =>
  (block.kind === "list" ? block.items : block.lines)
    .map((tokens) => tokens.map((token) => token.text).join(""))
    .join("\n");

describe("bold runs", () => {
  it("splits **bold** out of the surrounding text", () => {
    expect(parseInline("hola **mundo** adiós")).toEqual([
      plain("hola "),
      bold("mundo"),
      plain(" adiós"),
    ]);
  });

  it("handles several in one line", () => {
    expect(parseInline("**a** y **b**")).toEqual([
      bold("a"),
      plain(" y "),
      bold("b"),
    ]);
  });

  it("leaves a lone asterisk alone", () => {
    // 3 * 4 is arithmetic, not emphasis.
    expect(parseInline("3 * 4 = 12")).toEqual([plain("3 * 4 = 12")]);
  });

  it("leaves an unclosed ** alone rather than eating the rest", () => {
    expect(parseInline("esto **no cierra")).toEqual([plain("esto **no cierra")]);
  });

  it("always returns at least one token", () => {
    expect(parseInline("")).toEqual([plain("")]);
  });
});

describe("the reply that was rendering literally", () => {
  const REPLY = `Estos son los proyectos:

*   **Gulf Cove Multifamily 8:** estado construcción, avance de obra 72%.
*   **North Port Lote 7:** estado en evaluación, avance de obra 0%.
*   **Punta Gorda Lote 9:** estado permisos, avance de obra 45%.`;

  const blocks = parseRichText(REPLY);

  it("reads as an intro paragraph and one list", () => {
    expect(blocks.map((block) => block.kind)).toEqual(["paragraph", "list"]);
  });

  it("keeps the three items, unordered", () => {
    const list = blocks[1];
    expect(list.kind).toBe("list");
    if (list.kind !== "list") return;

    expect(list.ordered).toBe(false);
    expect(list.items).toHaveLength(3);
  });

  it("strips the bullet marker and the asterisks from the text", () => {
    // The whole point: none of this reaches the screen as characters.
    const rendered = blocks.map(textOf).join("\n");
    expect(rendered).not.toContain("*");
    expect(rendered).toContain("Gulf Cove Multifamily 8:");
  });

  it("marks the project name as bold and leaves the rest plain", () => {
    const list = blocks[1];
    if (list.kind !== "list") return;

    expect(list.items[0]).toEqual([
      bold("Gulf Cove Multifamily 8:"),
      plain(" estado construcción, avance de obra 72%."),
    ]);
  });
});

describe("lists", () => {
  it("accepts -, * and • as bullets", () => {
    for (const marker of ["-", "*", "•"]) {
      const blocks = parseRichText(`${marker} uno\n${marker} dos`);
      expect(blocks[0].kind).toBe("list");
      expect(textOf(blocks[0])).toBe("uno\ndos");
    }
  });

  it("recognises a numbered list", () => {
    const blocks = parseRichText("1. uno\n2. dos");

    expect(blocks[0].kind).toBe("list");
    if (blocks[0].kind !== "list") return;
    expect(blocks[0].ordered).toBe(true);
    expect(blocks[0].items).toHaveLength(2);
  });

  it("does not mix bullets and numbers into one list", () => {
    const blocks = parseRichText("- uno\n1. dos");
    expect(blocks.map((block) => block.kind)).toEqual(["list", "list"]);
  });

  it("closes the list when prose follows", () => {
    const blocks = parseRichText("- uno\nY eso es todo.");
    expect(blocks.map((block) => block.kind)).toEqual(["list", "paragraph"]);
  });

  it("does not read a sentence starting with a number as a list", () => {
    const blocks = parseRichText("2026 fue el año del cierre.");
    expect(blocks[0].kind).toBe("paragraph");
  });
});

describe("paragraphs", () => {
  it("splits on a blank line", () => {
    const blocks = parseRichText("uno\n\ndos");
    expect(blocks).toHaveLength(2);
  });

  it("keeps consecutive lines together, as separate lines", () => {
    const blocks = parseRichText("uno\ndos");

    expect(blocks).toHaveLength(1);
    if (blocks[0].kind !== "paragraph") return;
    expect(blocks[0].lines).toHaveLength(2);
  });

  it("renders a heading as a bold line instead of showing the hashes", () => {
    // The model is asked not to use them; if it does anyway, they must not
    // reach the screen.
    const blocks = parseRichText("## Resumen");

    expect(blocks[0]).toEqual({
      kind: "paragraph",
      lines: [[bold("Resumen")]],
    });
  });
});

describe("plain text is left alone", () => {
  it("returns one paragraph for a normal answer", () => {
    const answer = "Tienes $80,000 invertidos en Villa Rotonda.";
    const blocks = parseRichText(answer);

    expect(blocks).toHaveLength(1);
    expect(textOf(blocks[0])).toBe(answer);
  });

  it("returns nothing for an empty reply, instead of an empty paragraph", () => {
    expect(parseRichText("")).toEqual([]);
    expect(parseRichText("\n\n")).toEqual([]);
  });

  it("never loses a sentence, whatever the syntax", () => {
    const messy = "Texto **con** cosas\n- uno\n\n## Título\n1) dos\n3 * 4";
    const rendered = parseRichText(messy).map(textOf).join(" ");

    for (const fragment of ["Texto", "cosas", "uno", "Título", "dos", "3 * 4"]) {
      expect(rendered).toContain(fragment);
    }
  });
});
