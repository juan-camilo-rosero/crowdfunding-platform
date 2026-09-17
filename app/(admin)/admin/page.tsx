import { es } from "@/i18n";
import { PageTitle } from "@/components/layout/PageTitle";
import { createClient } from "@/lib/supabase/server";
import { parseTableFilters } from "@/lib/table/filters";
import { applyAdminTableQuery } from "@/lib/table/query";
import type { TableRow } from "@/lib/table/types";
import { AdminTablesPanel } from "./AdminTablesPanel";
import {
  ADMIN_TABLES,
  INVESTOR_COLUMN_KEY,
  PROJECT_COLUMN_KEY,
  findAdminTable,
  needsReference,
  withReferenceOptions,
} from "./table-definitions";

/** How many records one screen loads. The counter says when it is not all. */
const ROW_LIMIT = 100;

/**
 * Admin panel landing. `proxy.ts` already guarantees role = 'admin' here; the
 * data is read with the caller's own session, so RLS stays the second barrier
 * (the admin policies are what allow reading every row).
 */
export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const tabla = typeof params.tabla === "string" ? params.tabla : undefined;
  const baseDefinition = findAdminTable(tabla);

  const supabase = await createClient();

  // Only the tables that actually reference them pay for the extra reads.
  const wantsProjects = needsReference(baseDefinition, PROJECT_COLUMN_KEY);
  const wantsInvestors = needsReference(baseDefinition, INVESTOR_COLUMN_KEY);

  const [projectsResult, investorsResult] = await Promise.all([
    wantsProjects
      ? supabase.from("projects").select("id, name").order("name")
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    wantsInvestors
      ? supabase.from("investors").select("id, full_name, email").order("full_name")
      : Promise.resolve({
          data: [] as { id: string; full_name: string; email: string | null }[],
        }),
  ]);

  // The reference options have to exist before the filters are parsed: a
  // filter value is only accepted when it is one of the column's own options,
  // and for `project_id` those come from the database.
  const definition = withReferenceOptions(baseDefinition, {
    projects: projectsResult.data ?? [],
    investors: investorsResult.data ?? [],
  });

  const filters = parseTableFilters(definition.columns, params);

  // Ordering (total, so the list never reshuffles), filters and row cap live
  // in applyAdminTableQuery, where they are covered by tests.
  const { data, error, count } = await applyAdminTableQuery(
    supabase.from(definition.source).select("*", { count: "exact" }),
    { orderBy: definition.orderBy, filters, limit: ROW_LIMIT }
  );

  const rows = (data ?? []) as TableRow[];
  const total = count ?? rows.length;

  const countLabel =
    total > rows.length
      ? es.admin.filters.countLimited
          .replace("{n}", String(rows.length))
          .replace("{total}", String(total))
      : rows.length === 1
        ? es.admin.filters.countOne
        : es.admin.filters.count.replace("{n}", String(rows.length));

  return (
    <div className="flex flex-col gap-8">
      <PageTitle>{es.admin.title}</PageTitle>

      {error ? (
        <p role="alert" className="text-base text-destructive">
          {es.admin.loadError}
        </p>
      ) : null}

      <AdminTablesPanel
        tabs={ADMIN_TABLES.map(({ id, label }) => ({ id, label }))}
        activeTabId={definition.id}
        tableLabel={definition.label}
        columns={definition.columns}
        rows={rows}
        filters={filters}
        countLabel={countLabel}
        allowInsert={definition.allowInsert !== false}
      />
    </div>
  );
}
