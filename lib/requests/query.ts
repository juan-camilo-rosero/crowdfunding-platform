import { es } from "@/i18n";
import {
  isRequestStatus,
  type InvestorRequest,
  type RequestFilters,
  type RequestProjectOption,
} from "./types";

/**
 * Data access for /solicitudes.
 *
 * Scoped to ONE investor, and that scope is not negotiable: `investorIds` is
 * derived on the server from auth.uid(), and it is applied before any
 * user-supplied filter. A filter can only narrow that set — tampering with
 * ?destino= or ?estado= cannot reach another investor's requests, and RLS on
 * reassignment_requests would refuse them anyway.
 */

type QueryBuilder = {
  select: (columns: string) => QueryBuilder;
  eq: (column: string, value: unknown) => QueryBuilder;
  in: (column: string, values: unknown[]) => QueryBuilder;
  order: (column: string, options: { ascending: boolean }) => QueryBuilder;
  then: Promise<{ data: unknown[] | null; error: unknown }>["then"];
};

export type RequestsClient = {
  from: (table: string) => QueryBuilder;
};

type NamedProject = { id: string; name: string };

type RawRow = {
  id: string;
  requested_at: string | null;
  amount: number | string | null;
  status: string | null;
  from_project_id: string | null;
  to_project_id: string | null;
  from_project?: NamedProject | NamedProject[] | null;
  to_project?: NamedProject | NamedProject[] | null;
};

/** PostgREST returns an embedded row as an object or a single-element array. */
function embedded(value: NamedProject | NamedProject[] | null | undefined) {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/**
 * Two joins to the SAME table, so each needs its own alias. PostgREST spells
 * that `alias:table!fk(columns)`, with the foreign key naming which of the two
 * relationships is meant — without it the embed is ambiguous.
 */
const SELECT =
  "id, requested_at, amount, status, from_project_id, to_project_id," +
  "from_project:projects!reassignment_requests_from_project_id_fkey(id, name)," +
  "to_project:projects!reassignment_requests_to_project_id_fkey(id, name)";

export type RequestsResult = {
  requests: InvestorRequest[];
  failed: boolean;
};

export async function fetchInvestorRequests(
  client: RequestsClient,
  investorIds: string[],
  filters: RequestFilters = { toProjectId: null, status: null }
): Promise<RequestsResult> {
  // No investor link: return empty rather than query without a scope, which is
  // what would leak everything.
  if (investorIds.length === 0) return { requests: [], failed: false };

  let query = client
    .from("reassignment_requests")
    .select(SELECT)
    // The scope goes on FIRST and is never conditional.
    .in("investor_id", investorIds);

  if (filters.toProjectId) query = query.eq("to_project_id", filters.toProjectId);
  // Only a real stored status is accepted; anything else is ignored rather than
  // matched, so a hand-edited URL shows the full list instead of nothing.
  if (filters.status && isRequestStatus(filters.status)) {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query.order("requested_at", {
    ascending: false,
  });

  if (error) return { requests: [], failed: true };

  const requests = ((data ?? []) as RawRow[]).map((row) => {
    const from = embedded(row.from_project);
    const to = embedded(row.to_project);
    return {
      id: row.id,
      requestedAt: row.requested_at,
      fromProjectId: row.from_project_id,
      // Never an id, never blank.
      fromProjectName: from?.name ?? es.requests.unknownProject,
      toProjectId: row.to_project_id,
      toProjectName: to?.name ?? es.requests.unknownProject,
      amount: Number(row.amount ?? 0),
      status: row.status,
    };
  });

  return { requests, failed: false };
}

/**
 * Options for the destination filter, built from the caller's UNFILTERED
 * requests.
 *
 * A separate read on purpose: taking them from the filtered rows would leave
 * the chosen project as the only option, with no way back. It also guarantees
 * the list can never name a project this investor has never requested into.
 */
export async function fetchRequestFilterOptions(
  client: RequestsClient,
  investorIds: string[]
): Promise<{
  toProjectOptions: RequestProjectOption[];
  total: number;
  failed: boolean;
}> {
  if (investorIds.length === 0) {
    return { toProjectOptions: [], total: 0, failed: false };
  }

  const { data, error } = await client
    .from("reassignment_requests")
    .select(
      "to_project_id, to_project:projects!reassignment_requests_to_project_id_fkey(id, name)"
    )
    .in("investor_id", investorIds);

  if (error) return { toProjectOptions: [], total: 0, failed: true };

  const rows = (data ?? []) as RawRow[];
  const projectsById = new Map<string, string>();

  for (const row of rows) {
    const to = embedded(row.to_project);
    if (to?.id) projectsById.set(to.id, to.name);
  }

  return {
    toProjectOptions: [...projectsById.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "es")),
    total: rows.length,
    failed: false,
  };
}
