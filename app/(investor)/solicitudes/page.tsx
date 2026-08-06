import { redirect } from "next/navigation";
// Feather icons (lucide-react is the maintained fork): inbox, search.
import { InboxIcon, SearchIcon } from "lucide-react";
import { es } from "@/i18n";
import { formatDate } from "@/lib/format";
import { LOGIN_ROUTE, REQUESTS_ROUTE } from "@/lib/auth/routes";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { parseRequestFilters } from "@/lib/requests/params";
import {
  fetchInvestorRequests,
  fetchRequestFilterOptions,
  type RequestsClient,
} from "@/lib/requests/query";
import { requestStatusVariant } from "@/lib/requests/types";
import type { TableColumn, TableRow } from "@/lib/table/types";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/layout/EmptyState";
import { PageTitle } from "@/components/layout/PageTitle";
import { ReadOnlyDataTable } from "@/components/tables/ReadOnlyDataTable";
import { RequestFilters } from "./RequestFilters";

/**
 * Columns in the order views.md sets: Fecha · Origen · Destino · Monto ·
 * Estado. Here the status column IS needed — it is the main information, unlike
 * in transactions where everything listed already happened.
 */
const COLUMNS: TableColumn[] = [
  { key: "requestedAt", label: es.requests.columns.date, type: "date" },
  { key: "fromProjectName", label: es.requests.columns.from, type: "text", width: 220 },
  { key: "toProjectName", label: es.requests.columns.to, type: "text", width: 220 },
  { key: "amount", label: es.requests.columns.amount, type: "currency" },
  { key: "status", label: es.requests.columns.status, type: "select", width: 160 },
];

/**
 * Requests — the investor's reassignment requests and their state.
 *
 * READ ONLY, deliberately. Creating a request (the "nueva solicitud" form) and
 * resolving one are separate flows: approval lives in the admin panel, because
 * an approved request has to generate its `reasignación` transaction.
 *
 * ACCESS: investor link OR admin (proxy.ts). SCOPING: the caller's own investor
 * ids, derived here from auth.uid() and never from anything the client sent, so
 * a tampered ?destino= or ?estado= can only narrow the set.
 */
export default async function RequestsPage({
  searchParams,
}: {
  // Next.js 16: searchParams is async.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    redirect(LOGIN_ROUTE);
  }

  const filters = parseRequestFilters(await searchParams);
  const supabase = await createClient();

  // The investor rows linked to THIS user. RLS restricts the read to their own;
  // the explicit user_id filter is the second barrier.
  const { data: investorRows } = await supabase
    .from("investors")
    .select("id")
    .eq("user_id", profile.id);

  const investorIds = (investorRows ?? []).map((row) => row.id);

  const client = supabase as unknown as RequestsClient;
  const [result, options] = await Promise.all([
    fetchInvestorRequests(client, investorIds, filters),
    fetchRequestFilterOptions(client, investorIds),
  ]);

  const failed = result.failed || options.failed;
  const rows = result.requests as unknown as TableRow[];
  const isFiltered = !!filters.toProjectId || !!filters.status;
  // "No requests at all" is a different fact from "none match this filter",
  // and only the second one has a way out.
  const hasNoRequests = !failed && options.total === 0;

  const countLabel =
    result.requests.length === 1
      ? es.requests.resultsCountOne
      : es.requests.resultsCount.replace("{n}", String(result.requests.length));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <PageTitle>{es.requests.title}</PageTitle>
        <p className="max-w-2xl text-base text-ink-500">
          {es.requests.subtitle}
        </p>
      </div>

      {failed ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-line bg-elevated px-6 py-4"
        >
          <p className="text-base text-destructive">{es.requests.loadError}</p>
          {/* A plain link to the same route: re-running the server component IS
              the retry, and it needs no client state to do it. */}
          <a
            href={REQUESTS_ROUTE}
            className="cursor-pointer text-sm font-medium text-ink-900 underline underline-offset-4"
          >
            {es.requests.retry}
          </a>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {/* With nothing in the list there is nothing to filter by. */}
          {hasNoRequests ? null : (
            <RequestFilters
              filters={filters}
              toProjectOptions={options.toProjectOptions}
              countLabel={countLabel}
            />
          )}

          <ReadOnlyDataTable
            caption={es.requests.tableCaption}
            columns={COLUMNS}
            rows={rows}
            renderCell={(row, column) => {
              if (column.key === "requestedAt") {
                return row.requestedAt
                  ? formatDate(String(row.requestedAt))
                  : "";
              }
              if (column.key === "status") {
                const status = row.status ? String(row.status) : null;
                if (!status) return "";
                return (
                  <Badge variant={requestStatusVariant(status)}>
                    {es.requests.status[status] ?? status}
                  </Badge>
                );
              }
              return undefined;
            }}
            emptyState={
              hasNoRequests ? (
                <EmptyState
                  icon={<InboxIcon />}
                  title={es.requests.empty}
                  hint={es.requests.emptyHint}
                />
              ) : (
                <EmptyState
                  icon={<SearchIcon />}
                  title={es.requests.emptyFiltered}
                  hint={es.requests.emptyFilteredHint}
                  action={
                    isFiltered
                      ? {
                          href: REQUESTS_ROUTE,
                          label: es.requests.filters.clear,
                        }
                      : undefined
                  }
                />
              )
            }
          />
        </div>
      )}
    </div>
  );
}
