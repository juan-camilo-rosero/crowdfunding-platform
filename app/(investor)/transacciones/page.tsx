import { redirect } from "next/navigation";
// Feather icons (lucide-react is the maintained fork): file-text, search.
import { FileTextIcon, SearchIcon } from "lucide-react";
import { es } from "@/i18n";
import { formatDate } from "@/lib/format";
import { LOGIN_ROUTE, TRANSACTIONS_ROUTE } from "@/lib/auth/routes";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { parseTransactionFilters } from "@/lib/transactions/params";
import {
  fetchInvestorTransactions,
  fetchTransactionFilterOptions,
  type TransactionsClient,
} from "@/lib/transactions/query";
import { transactionDirection } from "@/lib/transactions/types";
import type { TableColumn, TableRow } from "@/lib/table/types";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/layout/EmptyState";
import { PageTitle } from "@/components/layout/PageTitle";
import { ReadOnlyDataTable } from "@/components/tables/ReadOnlyDataTable";
import { TransactionFilters } from "./TransactionFilters";

/**
 * Columns in the order views.md specifies: Fecha · Proyecto · Tipo · Monto.
 * No status column — everything listed already happened.
 *
 * The same TableColumn shape the admin panel uses, so widths, header type icons
 * and cell formatting come out identical to the rest of the app.
 */
const COLUMNS: TableColumn[] = [
  { key: "date", label: es.transactions.columns.date, type: "date" },
  {
    key: "projectName",
    label: es.transactions.columns.project,
    type: "text",
    width: 240,
  },
  { key: "type", label: es.transactions.columns.type, type: "select" },
  { key: "amount", label: es.transactions.columns.amount, type: "currency" },
];

/**
 * Transactions — the investor's record of real movements.
 *
 * ACCESS: investor capability. proxy.ts gates the route, and the page scopes
 * again before querying: the whole screen is built from the caller's own
 * investor ids, derived here from auth.uid() and never from anything the client
 * sent. A tampered ?proyecto= can only narrow that set.
 *
 * Yield and capital return appear as the separate movements they are and are
 * never added together (CLAUDE.md). Amounts stay positive exactly as stored;
 * the only distinction drawn is a discreet colour on the type label.
 */
export default async function TransactionsPage({
  searchParams,
}: {
  // Next.js 16: searchParams is async.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    redirect(LOGIN_ROUTE);
  }

  const filters = parseTransactionFilters(await searchParams);
  const supabase = await createClient();

  // The investor rows linked to THIS user. RLS restricts the read to their own;
  // the explicit user_id filter is the second barrier.
  const { data: investorRows } = await supabase
    .from("investors")
    .select("id")
    .eq("user_id", profile.id);

  const investorIds = (investorRows ?? []).map((row) => row.id);

  const client = supabase as unknown as TransactionsClient;
  const [result, options] = await Promise.all([
    fetchInvestorTransactions(client, investorIds, filters),
    fetchTransactionFilterOptions(client, investorIds),
  ]);

  const failed = result.failed || options.failed;
  const rows = result.transactions as unknown as TableRow[];
  const isFiltered = !!filters.projectId || !!filters.type;
  // "No movements at all" is a different fact from "none match this filter",
  // and only the second one has a way out.
  const hasNoHistory = !failed && options.projectOptions.length === 0;

  const countLabel =
    result.transactions.length === 1
      ? es.transactions.resultsCountOne
      : es.transactions.resultsCount.replace(
          "{n}",
          String(result.transactions.length)
        );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <PageTitle>{es.transactions.title}</PageTitle>
        <p className="max-w-2xl text-base text-zinc-500">
          {es.transactions.subtitle}
        </p>
      </div>

      {failed ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-neutral-200 bg-stone-50 px-6 py-4"
        >
          <p className="text-base text-destructive">
            {es.transactions.loadError}
          </p>
          {/* A plain link to the same route: re-running the server component IS
              the retry, and it needs no client state to do it. */}
          <a
            href={TRANSACTIONS_ROUTE}
            className="cursor-pointer text-sm font-medium text-ink-900 underline underline-offset-4"
          >
            {es.transactions.retry}
          </a>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {/* With nothing in the history there is nothing to filter by. */}
          {hasNoHistory ? null : (
            <TransactionFilters
              filters={filters}
              projectOptions={options.projectOptions}
              typeOptions={options.typeOptions}
              countLabel={countLabel}
            />
          )}

          <ReadOnlyDataTable
            caption={es.transactions.tableCaption}
            columns={COLUMNS}
            rows={rows}
            renderCell={(row, column) => {
              if (column.key === "date") {
                return row.date ? formatDate(String(row.date)) : "";
              }
              if (column.key === "type") {
                const type = row.type ? String(row.type) : null;
                if (!type) return "";
                const direction = transactionDirection(type);
                return (
                  <span
                    className={cn(
                      "font-medium",
                      direction === "in" && "text-stone-900",
                      direction === "out" && "text-emerald-700",
                      direction === "neutral" && "text-zinc-500"
                    )}
                  >
                    {es.transactions.type[type] ?? type}
                  </span>
                );
              }
              return undefined;
            }}
            emptyState={
              hasNoHistory ? (
                <EmptyState
                  icon={<FileTextIcon />}
                  title={es.transactions.empty}
                  hint={es.transactions.emptyHint}
                />
              ) : (
                <EmptyState
                  icon={<SearchIcon />}
                  title={es.transactions.emptyFiltered}
                  hint={es.transactions.emptyFilteredHint}
                  action={
                    isFiltered
                      ? {
                          href: TRANSACTIONS_ROUTE,
                          label: es.transactions.filters.clear,
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
