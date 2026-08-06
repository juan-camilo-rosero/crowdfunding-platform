/**
 * Values stored in documents.doc_type.
 *
 * These are the twelve the CHECK constraint allows (migration
 * 20260730000559_tablas_base.sql). They are MIXED English and Spanish in the
 * database — "deed" and "planos" sit side by side — which is exactly why the
 * screen never renders them raw: every one is mapped to a Spanish label in
 * i18n. The stored values are an external contract and are not renamed.
 */
export const DOCUMENT_TYPES = [
  "deed",
  "property record",
  "survey",
  "planos",
  "permisos",
  "presupuesto",
  "contrato",
  "operating agreement",
  "facturas",
  "estados de cuenta",
  "reportes",
  "certificado de aporte",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

/** Sentinel for the "no project" option of the project filter. */
export const NO_PROJECT = "general";

/** One row as the screen needs it: the document plus its project name. */
export type InvestorDocument = {
  id: string;
  docType: string | null;
  projectId: string | null;
  /** Project name, or the "General" label when the document has no project. */
  projectName: string;
  date: string | null;
  name: string;
};

/** Selectable project, derived from the documents the caller can see. */
export type DocumentProjectOption = { id: string; name: string };

export type DocumentFilters = {
  /** A project id, the NO_PROJECT sentinel, or null for "all". */
  projectId: string | null;
};
