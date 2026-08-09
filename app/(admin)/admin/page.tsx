import { es } from "@/i18n";
import { PageTitle } from "@/components/layout/PageTitle";
import { createClient } from "@/lib/supabase/server";
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

  // Only the tables that actually reference them pay for the extra reads.
  const wantsProjects = needsReference(baseDefinition, PROJECT_COLUMN_KEY);
  const wantsInvestors = needsReference(baseDefinition, INVESTOR_COLUMN_KEY);

  const [{ data, error }, projectsResult, investorsResult] = await Promise.all([
    supabase
      .from(baseDefinition.source)
      .select("*")
      .order(baseDefinition.orderBy ?? "created_at", { ascending: true })
      .limit(100),
    wantsProjects
      ? supabase.from("projects").select("id, name").order("name")
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    wantsInvestors
      ? supabase.from("investors").select("id, full_name, email").order("full_name")
      : Promise.resolve({
          data: [] as { id: string; full_name: string; email: string | null }[],
        }),
  ]);

  const definition = withReferenceOptions(baseDefinition, {
    projects: projectsResult.data ?? [],
    investors: investorsResult.data ?? [],
  });

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
