import { redirect } from "next/navigation";
// Feather icons (lucide-react is the maintained fork): folder, search.
import { FolderIcon, SearchIcon } from "lucide-react";
import { es } from "@/i18n";
import { formatDate } from "@/lib/format";
import { DOCUMENTS_ROUTE, LOGIN_ROUTE } from "@/lib/auth/routes";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { parseDocumentFilters } from "@/lib/documents/params";
import {
  fetchDocumentFilterOptions,
  fetchInvestorDocuments,
  type DocumentsClient,
} from "@/lib/documents/query";
import type { TableColumn, TableRow } from "@/lib/table/types";
import { EmptyState } from "@/components/layout/EmptyState";
import { PageTitle } from "@/components/layout/PageTitle";
import { ReadOnlyDataTable } from "@/components/tables/ReadOnlyDataTable";
import { DocumentFilters } from "./DocumentFilters";
import { DownloadButton } from "./DownloadButton";

/**
 * Columns in the order the spec sets: Tipo · Proyecto · Fecha · Descargar.
 * No status column.
 *
 * The last one is `type: "action"` — it holds a control, not a value, and its
 * content always comes from renderCell.
 */
const COLUMNS: TableColumn[] = [
  { key: "docType", label: es.documents.columns.docType, type: "select", width: 220 },
  { key: "projectName", label: es.documents.columns.project, type: "project", width: 240 },
  { key: "date", label: es.documents.columns.date, type: "date" },
  { key: "download", label: es.documents.columns.download, type: "action", width: 170 },
];

/**
 * Documents — what this investor is entitled to read.
 *
 * ACCESS: investor link OR admin (proxy.ts). An admin with no contributions
 * sees whatever the policy gives them, which is valid information.
 *
 * SCOPING: done entirely by RLS on `documents`, under the caller's own session.
 * Nothing here re-implements the policy, so there is no second definition to
 * drift. The project filter can only narrow what RLS already returned, and the
 * filter's own options are built from those same rows — it can never name a
 * project this caller has no document in.
 */
export default async function DocumentsPage({
  searchParams,
}: {
  // Next.js 16: searchParams is async.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    redirect(LOGIN_ROUTE);
  }

  const filters = parseDocumentFilters(await searchParams);
  const supabase = await createClient();
  const client = supabase as unknown as DocumentsClient;

  const [result, options] = await Promise.all([
    fetchInvestorDocuments(client, filters),
    fetchDocumentFilterOptions(client),
  ]);

  const failed = result.failed || options.failed;
  const rows = result.documents as unknown as TableRow[];
  const isFiltered = !!filters.projectId;
  // "No documents at all" is a different fact from "none match this filter",
  // and only the second one has a way out.
  const hasNoDocuments = !failed && options.total === 0;

  const countLabel =
    result.documents.length === 1
      ? es.documents.resultsCountOne
      : es.documents.resultsCount.replace(
          "{n}",
          String(result.documents.length)
        );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <PageTitle>{es.documents.title}</PageTitle>
        <p className="max-w-2xl text-base text-ink-500">
          {es.documents.subtitle}
        </p>
      </div>

      {failed ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-line bg-elevated px-6 py-4"
        >
          <p className="text-base text-destructive">{es.documents.loadError}</p>
          {/* A plain link to the same route: re-running the server component IS
              the retry, and it needs no client state to do it. */}
          <a
            href={DOCUMENTS_ROUTE}
            className="cursor-pointer text-sm font-medium text-ink-900 underline underline-offset-4"
          >
            {es.documents.retry}
          </a>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {/* With nothing to show there is nothing to filter by. */}
          {hasNoDocuments ? null : (
            <DocumentFilters
              filters={filters}
              projectOptions={options.projectOptions}
              hasUnassigned={options.hasUnassigned}
              countLabel={countLabel}
            />
          )}

          <ReadOnlyDataTable
            caption={es.documents.tableCaption}
            columns={COLUMNS}
            rows={rows}
            renderCell={(row, column) => {
              if (column.key === "docType") {
                const type = row.docType ? String(row.docType) : null;
                return type ? (es.documents.type[type] ?? type) : "";
              }
              if (column.key === "date") {
                return row.date ? formatDate(String(row.date)) : "";
              }
              if (column.key === "download") {
                return (
                  <DownloadButton
                    documentId={String(row.id)}
                    documentName={String(row.name ?? "")}
                  />
                );
              }
              return undefined;
            }}
            emptyState={
              hasNoDocuments ? (
                <EmptyState
                  icon={<FolderIcon />}
                  title={es.documents.empty}
                  hint={es.documents.emptyHint}
                />
              ) : (
                <EmptyState
                  icon={<SearchIcon />}
                  title={es.documents.emptyFiltered}
                  hint={es.documents.emptyFilteredHint}
                  action={
                    isFiltered
                      ? {
                          href: DOCUMENTS_ROUTE,
                          label: es.documents.filters.clear,
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
