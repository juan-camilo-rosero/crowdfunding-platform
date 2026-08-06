import type {
  ReassignmentDestination,
  ReassignmentSource,
} from "./create-types";

/**
 * How much capital an investor may actually commit, and where it may go.
 *
 * This module is the single definition of both rules. The form reads it to draw
 * the options, and the Server Action reads it AGAIN before writing — the second
 * read is the authoritative one, because anything the browser sent is a
 * suggestion.
 */

type QueryBuilder = {
  select: (columns: string) => QueryBuilder;
  eq: (column: string, value: unknown) => QueryBuilder;
  in: (column: string, values: unknown[]) => QueryBuilder;
  not: (column: string, operator: string, value: unknown) => QueryBuilder;
  gt: (column: string, value: unknown) => QueryBuilder;
  then: Promise<{ data: unknown[] | null; error: unknown }>["then"];
};

export type AvailabilityClient = {
  from: (table: string) => QueryBuilder;
};

/**
 * Statuses that disqualify a project as a DESTINATION.
 *
 * A sold project is finished and a rented one is already producing: neither is
 * taking capital. Scope decision — isolated here so changing it is one edit.
 */
export const INELIGIBLE_DESTINATION_STATUSES = ["vendido", "rentado"] as const;

/** Request states that still hold capital hostage. */
const BLOCKING_REQUEST_STATUS = "pendiente";

/**
 * ────────────────────────────────────────────────────────────────────────────
 * PENDING-REQUEST DEDUCTION — scope decision, deliberately isolated.
 *
 * Current capital alone would let an investor commit the same money twice:
 * request 10.000 out of a project holding 10.000, then request another 10.000
 * before the first is resolved. Subtracting what pending requests already claim
 * from each source closes that.
 *
 * If the business decides an investor MAY queue overlapping requests, delete
 * this function and the single call to it in `getReassignablePositions`.
 * Nothing else depends on it.
 * ────────────────────────────────────────────────────────────────────────────
 */
export function subtractPendingClaims(
  currentCapitalByProject: Map<string, number>,
  pendingByProject: Map<string, number>
): Map<string, number> {
  const available = new Map<string, number>();
  for (const [projectId, capital] of currentCapitalByProject) {
    available.set(projectId, capital - (pendingByProject.get(projectId) ?? 0));
  }
  return available;
}

/**
 * Projects this investor can move capital OUT of, with the amount available.
 *
 * `investorIds` MUST come from the session. An empty array short-circuits to an
 * empty list rather than querying without a scope.
 */
export async function getReassignablePositions(
  client: AvailabilityClient,
  investorIds: string[]
): Promise<{ sources: ReassignmentSource[]; failed: boolean }> {
  if (investorIds.length === 0) return { sources: [], failed: false };

  // Current capital per project: contributed − returned, straight from the SQL
  // view. Never recomputed here — that number is too important to duplicate.
  const positions = await client
    .from("investor_project_position")
    .select("project_id, current_capital")
    .in("investor_id", investorIds)
    .gt("current_capital", 0);

  if (positions.error) return { sources: [], failed: true };

  const currentByProject = new Map<string, number>();
  for (const row of (positions.data ?? []) as {
    project_id: string | null;
    current_capital: number | string | null;
  }[]) {
    if (!row.project_id) continue;
    currentByProject.set(
      row.project_id,
      (currentByProject.get(row.project_id) ?? 0) +
        Number(row.current_capital ?? 0)
    );
  }

  if (currentByProject.size === 0) return { sources: [], failed: false };

  // What pending requests already claim from those same sources.
  const pending = await client
    .from("reassignment_requests")
    .select("from_project_id, amount")
    .in("investor_id", investorIds)
    .eq("status", BLOCKING_REQUEST_STATUS);

  if (pending.error) return { sources: [], failed: true };

  const pendingByProject = new Map<string, number>();
  for (const row of (pending.data ?? []) as {
    from_project_id: string | null;
    amount: number | string | null;
  }[]) {
    if (!row.from_project_id) continue;
    pendingByProject.set(
      row.from_project_id,
      (pendingByProject.get(row.from_project_id) ?? 0) + Number(row.amount ?? 0)
    );
  }

  const availableByProject = subtractPendingClaims(
    currentByProject,
    pendingByProject
  );

  const projectIds = [...availableByProject.keys()];
  const projects = await client
    .from("projects")
    .select("id, name")
    .in("id", projectIds);

  if (projects.error) return { sources: [], failed: true };

  const nameById = new Map(
    ((projects.data ?? []) as { id: string; name: string }[]).map((p) => [
      p.id,
      p.name,
    ])
  );

  const sources = [...availableByProject.entries()]
    // A source fully claimed by pending requests has nothing left to offer.
    .filter(([, amount]) => amount > 0)
    .map(([projectId, amount]) => ({
      projectId,
      name: nameById.get(projectId) ?? "",
      availableAmount: amount,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  return { sources, failed: false };
}

/** Projects that can RECEIVE capital. Public information, no investor scope. */
export async function getReassignmentDestinations(
  client: AvailabilityClient
): Promise<{ destinations: ReassignmentDestination[]; failed: boolean }> {
  const { data, error } = await client
    .from("projects")
    .select("id, name")
    .not("status", "in", `(${INELIGIBLE_DESTINATION_STATUSES.join(",")})`);

  if (error) return { destinations: [], failed: true };

  const destinations = ((data ?? []) as { id: string; name: string }[])
    .map((project) => ({ projectId: project.id, name: project.name }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  return { destinations, failed: false };
}

/** Available amount for ONE source, for the server's re-check before writing. */
export async function getAvailableForProject(
  client: AvailabilityClient,
  investorIds: string[],
  projectId: string
): Promise<number | null> {
  const { sources, failed } = await getReassignablePositions(
    client,
    investorIds
  );
  if (failed) return null;
  return sources.find((source) => source.projectId === projectId)
    ?.availableAmount ?? 0;
}
