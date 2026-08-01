import { es } from "@/i18n";
import { PageTitle } from "@/components/layout/PageTitle";
import { createClient } from "@/lib/supabase/server";
import type { TableRow } from "@/lib/table/types";
import { AdminTablesPanel } from "./AdminTablesPanel";
import {
  ADMIN_TABLES,
  PROJECT_COLUMN_KEY,
  findAdminTable,
  withProjectOptions,
} from "./table-definitions";

/**
 * Admin panel landing. `proxy.ts` already guarantees role = 'admin' here; the
 * data is read with the caller's own session, so RLS stays the second barrier
 * (the admin policies are what allow reading every row).
 */
export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: Promise<{ tabla?: string }>;
}) {
  const { tabla } = await searchParams;
  const baseDefinition = findAdminTable(tabla);

  const supabase = await createClient();

  const needsProjects = baseDefinition.columns.some(
    (column) => column.key === PROJECT_COLUMN_KEY
  );

  const [{ data, error }, projectsResult] = await Promise.all([
    supabase
      .from(baseDefinition.source)
      .select("*")
      .order(baseDefinition.orderBy ?? "created_at", { ascending: true })
      .limit(100),
    needsProjects
      ? supabase.from("projects").select("id, name").order("name")
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const definition = withProjectOptions(
    baseDefinition,
    projectsResult.data ?? []
  );

  const rows = (data ?? []) as TableRow[];

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
        columns={definition.columns}
        rows={rows}
        allowInsert={definition.allowInsert !== false}
      />
    </div>
  );
}
