import { es } from "@/i18n";
import { PageTitle } from "@/components/layout/PageTitle";
import { createClient } from "@/lib/supabase/server";
import type { TableRow } from "@/lib/table/types";
import { findAdminTable } from "../table-definitions";
import { PipelinePanel } from "./PipelinePanel";

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const { estado = "todos" } = await searchParams;
  const baseDefinition = findAdminTable("inversionistas");
  const supabase = await createClient();

  let query = supabase
    .from("investors")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(100);

  if (estado !== "todos") {
    query = query.eq("status", estado);
  }

  const { data, error } = await query;

  const wantedKeys = ["full_name", "status", "phone", "potential_amount", "notes"];
  
  const pipelineColumns = wantedKeys
    .map(key => baseDefinition.columns.find(col => col.key === key))
    .filter(col => col !== undefined);

  const statusOptions = baseDefinition.columns.find(col => col.key === "status")?.options ?? [];

  return (
    <div className="flex flex-col gap-8">
      <PageTitle>{es.nav.salesFunnel}</PageTitle>
      
      {error ? (
        <p role="alert" className="text-base text-destructive">
          {es.admin.loadError}
        </p>
      ) : null}

      <PipelinePanel
        activeStatus={estado}
        statusOptions={statusOptions}
        columns={pipelineColumns}
        rows={(data ?? []) as TableRow[]}
        allowInsert={baseDefinition.allowInsert !== false}
      />
    </div>
  );
}
