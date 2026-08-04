import type {
  InvestorTransaction,
  TransactionFilters,
  TransactionProjectOption,
} from "./types";
import { isTransactionType } from "./types";

/**
 * Data access for /transacciones.
 *
 * Everything here is scoped to ONE investor and that scope is not negotiable:
 * `investorIds` is derived on the server from auth.uid(), and every query
 * applies it before any user-supplied filter. A filter can only ever narrow
 * that set, never widen it — tampering with ?proyecto= in the URL cannot reach
 * another investor's rows, and RLS on `transactions` would refuse them anyway.
 */

/** Minimal shape of the Supabase client this module needs. Keeps it mockable. */
type QueryBuilder = {
  select: (columns: string) => QueryBuilder;
  eq: (column: string, value: unknown) => QueryBuilder;
  in: (column: string, values: unknown[]) => QueryBuilder;
  order: (column: string, options: { ascending: boolean }) => QueryBuilder;
  then: Promise<{ data: unknown[] | null; error: unknown }>["then"];
};

export type TransactionsClient = {
  from: (table: string) => QueryBuilder;
};

export type TransactionsResult = {
  transactions: InvestorTransaction[];
  /** Projects this investor actually has movements in — the filter's options. */
  projectOptions: TransactionProjectOption[];
  /** Movement types present in this investor's history. */
  typeOptions: string[];
  /** True when the query itself failed, so the screen can offer a retry. */
  failed: boolean;
};

type RawRow = {
  id: string;
  date: string | null;
  type: string | null;
  amount: number | string | null;
  project_id: string | null;
  projects?: { id: string; name: string } | { id: string; name: string }[] | null;
};

/** PostgREST returns an embedded row as an object or a single-element array. */
function embeddedProject(row: RawRow): { id: string; name: string } | null {
  const project = row.projects;
  if (!project) return null;
  return Array.isArray(project) ? (project[0] ?? null) : project;
}

/**
 * Every transaction of the given investor rows, newest first, with the project
 * name joined in.
 *
 * `investorIds` MUST come from the session. An empty array means the caller has
 * no investor link, and the function short-circuits to an empty result rather
 * than querying without a scope — which is what would leak everything.
 */
export async function fetchInvestorTransactions(
  client: TransactionsClient,
  investorIds: string[],
  filters: TransactionFilters = { projectId: null, type: null }
): Promise<TransactionsResult> {
  const empty: TransactionsResult = {
    transactions: [],
    projectOptions: [],
    typeOptions: [],
    failed: false,
  };

  if (investorIds.length === 0) return empty;

  let query = client
    .from("transactions")
    .select("id, date, type, amount, project_id, projects(id, name)")
    // The scope goes on FIRST and is never conditional.
    .in("investor_id", investorIds);

  if (filters.projectId) query = query.eq("project_id", filters.projectId);
  // Only a real stored type is accepted; anything else is ignored rather than
  // matched, so a hand-edited URL shows the full list instead of nothing.
  if (filters.type && isTransactionType(filters.type)) {
    query = query.eq("type", filters.type);
  }

  const { data, error } = await query.order("date", { ascending: false });

  if (error) return { ...empty, failed: true };

  const rows = (data ?? []) as RawRow[];

  const transactions: InvestorTransaction[] = rows.map((row) => {
    const project = embeddedProject(row);
    return {
      id: row.id,
      date: row.date,
      projectId: row.project_id,
      projectName: project?.name ?? "",
      type: row.type,
      amount: Number(row.amount ?? 0),
    };
  });

  return {
    transactions,
    projectOptions: [],
    typeOptions: [],
    failed: false,
  };
}

/**
 * The filter options, built from the investor's UNFILTERED history.
 *
 * Deliberately a separate read: if the options came from the filtered rows,
 * picking a project would leave that project as the only option and the user
 * could not get back. It is also why the project list can never contain a
 * project this investor has no movements in.
 */
export async function fetchTransactionFilterOptions(
  client: TransactionsClient,
  investorIds: string[]
): Promise<{
  projectOptions: TransactionProjectOption[];
  typeOptions: string[];
  failed: boolean;
}> {
  if (investorIds.length === 0) {
    return { projectOptions: [], typeOptions: [], failed: false };
  }

  const { data, error } = await client
    .from("transactions")
    .select("type, project_id, projects(id, name)")
    .in("investor_id", investorIds);

  if (error) return { projectOptions: [], typeOptions: [], failed: true };

  const rows = (data ?? []) as RawRow[];

  const projectsById = new Map<string, string>();
  const types = new Set<string>();

  for (const row of rows) {
    const project = embeddedProject(row);
    if (project?.id) projectsById.set(project.id, project.name);
    if (row.type) types.add(row.type);
  }

  return {
    projectOptions: [...projectsById.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "es")),
    // Kept in the schema's own order, so the list reads the same every time.
    typeOptions: [...types],
    failed: false,
  };
}
