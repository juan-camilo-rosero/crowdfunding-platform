import type { Json } from "@/types/database";

export type SellingPoint = {
  /** Bold lead of the block. */
  title: string;
  /** Body text under it. May be empty when the entry is a bare sentence. */
  body: string;
};

/**
 * Reads `projects.selling_points`.
 *
 * The column is `jsonb` with no shape enforced by the schema, and it is written
 * by hand from the admin panel, so this parser accepts what it realistically
 * finds and drops anything else instead of throwing on a malformed row — a
 * badly typed selling point must never take the project page down.
 *
 * Accepted:
 *   ["Cerca del waterfront", …]                       → title only
 *   [{ "title": "…", "body": "…" }, …]                → title + body
 *   [{ "titulo": "…", "descripcion": "…" }, …]        → same, Spanish keys
 */
export function parseSellingPoints(value: Json | null | undefined): SellingPoint[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry): SellingPoint[] => {
    if (typeof entry === "string") {
      const title = entry.trim();
      return title ? [{ title, body: "" }] : [];
    }

    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      const record = entry as Record<string, unknown>;
      const title = pick(record, ["title", "titulo", "título", "name"]);
      const body = pick(record, [
        "body",
        "descripcion",
        "descripción",
        "text",
        "detail",
      ]);
      if (!title && !body) return [];
      // A body with no title still says something; it becomes the lead.
      return [{ title: title || body, body: title ? body : "" }];
    }

    return [];
  });
}

function pick(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

/**
 * Splits a project description into paragraphs.
 *
 * views.md asks for two: one that sells the property, one that reports its
 * state. Authors separate them with a blank line; a single-paragraph
 * description is returned as one rather than being cut arbitrarily.
 */
export function toParagraphs(description: string | null | undefined): string[] {
  if (!description?.trim()) return [];
  return description
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}
