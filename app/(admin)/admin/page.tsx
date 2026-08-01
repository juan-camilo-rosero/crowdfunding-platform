import { es } from "@/i18n";
import { PageTitle } from "@/components/layout/PageTitle";
import { createClient } from "@/lib/supabase/server";
import type { TableRow } from "@/lib/table/types";
import { AdminTablesPanel } from "./AdminTablesPanel";
import { ADMIN_TABLES, findAdminTable } from "./table-definitions";

/**
 * Admin panel landing. `proxy.ts` already guarantees role = 'admin' here; the
 * data itself is read with the caller's own session, so RLS stays the second
 * barrier (the admin policies are what allow reading every row).
 */
export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: Promise<{ tabla?: string }>;
}) {
  const { tabla } = await searchParams;
  const definition = findAdminTable(tabla);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from(definition.source)
    .select("*")
    .order(definition.orderBy ?? "created_at", { ascending: false })
    .limit(100);

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
      />
    </div>
  );
}
