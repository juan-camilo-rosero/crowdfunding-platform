/**
 * The small slice of Markdown the assistant is allowed to speak.
 *
 * WHY NOT a Markdown library: the model writes short answers in a 320px panel,
 * and the only syntax it ever needs is bold, bullets and numbered lists. A full
 * parser would ship tens of kilobytes to every investor screen and bring along
 * links, images, tables and raw HTML — surface this panel has no use for and
 * would then have to be sanitised. The system prompt asks the model for exactly
 * this subset (see lib/ai/system-prompt.ts), so parser and producer agree.
 *
 * This module builds a DATA structure, never HTML. The renderer turns it into
 * React elements, so there is no `dangerouslySetInnerHTML` anywhere and model
 * output can never inject markup.
 *
 * Anything it does not recognise is left as plain text — the failure mode is
 * "reads like it was typed", never a crash or a swallowed sentence.
 */

/** A run of text, optionally bold. */
export type InlineToken = { text: string; bold: boolean };

export type RichTextBlock =
  | { kind: "paragraph"; lines: InlineToken[][] }
  | { kind: "list"; ordered: boolean; items: InlineToken[][] };

const BULLET = /^\s*[-*•]\s+(.*)$/;
const ORDERED = /^\s*\d+[.)]\s+(.*)$/;
/** A heading the model was asked not to use; rendered as a bold line. */
const HEADING = /^\s*#{1,6}\s+(.*)$/;

/**
 * Splits a line into bold and plain runs.
 *
 * Only `**bold**`. Single asterisks are left alone: at the start of a line one
 * is a bullet (handled before this runs), and anywhere else it is far more
 * likely to be literal than an italic the model never meant.
 */
export function parseInline(line: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  const pattern = /\*\*(.+?)\*\*/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(line)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ text: line.slice(lastIndex, match.index), bold: false });
    }
    tokens.push({ text: match[1], bold: true });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < line.length) {
    tokens.push({ text: line.slice(lastIndex), bold: false });
  }

  // An empty line still needs one token, so a paragraph keeps its shape.
  return tokens.length > 0 ? tokens : [{ text: "", bold: false }];
}

/** Turns the assistant's reply into blocks the panel can render. */
export function parseRichText(source: string): RichTextBlock[] {
  const blocks: RichTextBlock[] = [];

  let paragraph: InlineToken[][] = [];
  let list: { ordered: boolean; items: InlineToken[][] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push({ kind: "paragraph", lines: paragraph });
    paragraph = [];
  };

  const flushList = () => {
    if (!list) return;
    blocks.push({ kind: "list", ordered: list.ordered, items: list.items });
    list = null;
  };

  for (const rawLine of source.split("\n")) {
    const line = rawLine.trimEnd();

    if (line.trim() === "") {
      flushParagraph();
      flushList();
      continue;
    }

    const bullet = line.match(BULLET);
    const ordered = bullet ? null : line.match(ORDERED);

    if (bullet || ordered) {
      const isOrdered = !!ordered;
      flushParagraph();
      // A change of list type starts a new list rather than mixing markers.
      if (list && list.ordered !== isOrdered) flushList();

      const content = (bullet ?? ordered)![1];
      list ??= { ordered: isOrdered, items: [] };
      list.items.push(parseInline(content));
      continue;
    }

    flushList();

    const heading = line.match(HEADING);
    if (heading) {
      flushParagraph();
      blocks.push({
        kind: "paragraph",
        lines: [[{ text: heading[1], bold: true }]],
      });
      continue;
    }

    paragraph.push(parseInline(line));
  }

  flushParagraph();
  flushList();

  return blocks;
}
