import { es } from "@/i18n";

/** Spanish label for a stored doc_type; the raw value is never shown. */
export function documentTypeLabel(docType: string | null | undefined): string {
  if (!docType) return "";
  return es.documents.type[docType] ?? docType;
}

export type DocumentHeading = {
  /** First line: what the investor would call the file. */
  primary: string;
  /** Second line: what kind of document it is, when that adds anything. */
  secondary: string;
};

/**
 * The two lines that identify a document in the list.
 *
 * The NAME leads — "Escritura lote 118" says which file this is; "Escritura"
 * alone says only which drawer it came from, and a project usually has several
 * of each. The type moves beneath it as the qualifier.
 *
 * The cases that would otherwise render badly:
 *   · no name (older rows, a blank typed in the panel) → the type takes the
 *     first line alone, so the row is never headed by an empty line;
 *   · a name that just repeats the type → one line, not the same word twice;
 *   · neither → both empty, and the table shows its dash.
 */
export function describeDocument(document: {
  name: string | null | undefined;
  docType: string | null | undefined;
}): DocumentHeading {
  const name = (document.name ?? "").trim();
  const type = documentTypeLabel(document.docType).trim();

  if (!name) return { primary: type, secondary: "" };
  if (type && name.localeCompare(type, "es", { sensitivity: "base" }) === 0) {
    return { primary: name, secondary: "" };
  }
  return { primary: name, secondary: type };
}
