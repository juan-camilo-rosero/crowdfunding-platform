import { es } from "@/i18n";
import {
  NO_PROJECT,
  type DocumentFilters,
  type DocumentProjectOption,
  type InvestorDocument,
} from "./types";

/**
 * Data access for /documentos.
 *
 * The scope here is enforced ENTIRELY by RLS on `documents`, deliberately: the
 * policy already decides what this caller may see (their own private documents,
 * plus the project and public ones), and duplicating that rule in a WHERE
 * clause would create a second definition to keep in sync. Every query runs
 * under the user's session — never the service role — so the rows that come
 * back are by construction the rows they are entitled to.
 *
 * The project filter can therefore only ever NARROW that set. Tampering with
 * ?proyecto= cannot reach a document RLS did not already hand over.
 */

type QueryBuilder = {
  select: (columns: string) => QueryBuilder;
  eq: (column: string, value: unknown) => QueryBuilder;
  is: (column: string, value: unknown) => QueryBuilder;
  order: (column: string, options: { ascending: boolean }) => QueryBuilder;
  then: Promise<{ data: unknown[] | null; error: unknown }>["then"];
};

export type DocumentsClient = {
  from: (table: string) => QueryBuilder;
};

type RawRow = {
  id: string;
  name: string | null;
  doc_type: string | null;
  date: string | null;
  project_id: string | null;
  projects?: { id: string; name: string } | { id: string; name: string }[] | null;
};

/** PostgREST returns an embedded row as an object or a single-element array. */
function embeddedProject(row: RawRow): { id: string; name: string } | null {
  const project = row.projects;
  if (!project) return null;
  return Array.isArray(project) ? (project[0] ?? null) : project;
}

export type DocumentsResult = {
  documents: InvestorDocument[];
  failed: boolean;
};

/**
 * The documents this caller may see, newest first.
 *
 * `filters.projectId` accepts the NO_PROJECT sentinel, which selects the rows
 * with no project at all — the investor's own private documents.
 */
export async function fetchInvestorDocuments(
  client: DocumentsClient,
  filters: DocumentFilters = { projectId: null }
): Promise<DocumentsResult> {
  let query = client
    .from("documents")
    .select("id, name, doc_type, date, project_id, projects(id, name)");

  if (filters.projectId === NO_PROJECT) {
    query = query.is("project_id", null);
  } else if (filters.projectId) {
    query = query.eq("project_id", filters.projectId);
  }

  const { data, error } = await query.order("date", { ascending: false });

  if (error) return { documents: [], failed: true };

  const documents = ((data ?? []) as RawRow[]).map((row) => {
    const project = embeddedProject(row);
    return {
      id: row.id,
      docType: row.doc_type,
      projectId: row.project_id,
      // Never an id, never blank: a document with no project is "General".
      projectName: project?.name ?? es.documents.noProject,
      date: row.date,
      name: row.name ?? "",
    };
  });

  return { documents, failed: false };
}

/**
 * Options for the project filter, built from the caller's UNFILTERED documents.
 *
 * A separate read on purpose: taking them from the filtered rows would leave
 * the chosen project as the only option, with no way back. It is also what
 * guarantees the list can never name a project this caller has no document in.
 */
export async function fetchDocumentFilterOptions(
  client: DocumentsClient
): Promise<{
  projectOptions: DocumentProjectOption[];
  /** True when at least one document has no project, so "General" is offered. */
  hasUnassigned: boolean;
  total: number;
  failed: boolean;
}> {
  const { data, error } = await client
    .from("documents")
    .select("project_id, projects(id, name)");

  if (error) {
    return { projectOptions: [], hasUnassigned: false, total: 0, failed: true };
  }

  const rows = (data ?? []) as RawRow[];
  const projectsById = new Map<string, string>();
  let hasUnassigned = false;

  for (const row of rows) {
    const project = embeddedProject(row);
    if (project?.id) projectsById.set(project.id, project.name);
    else hasUnassigned = true;
  }

  return {
    projectOptions: [...projectsById.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "es")),
    hasUnassigned,
    total: rows.length,
    failed: false,
  };
}
