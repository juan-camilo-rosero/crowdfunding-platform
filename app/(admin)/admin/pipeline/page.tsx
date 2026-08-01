import { es } from "@/i18n";
import { PageTitle } from "@/components/layout/PageTitle";
import { createClient } from "@/lib/supabase/server";
import { optionValue, type TableColumn, type TableRow } from "@/lib/table/types";
import { findAdminTable } from "../table-definitions";
import { PipelinePanel } from "./PipelinePanel";
import { ALL_STAGES, PIPELINE_COLUMN_KEYS, PIPELINE_STAGE_KEY } from "./stages";

/**
 * Sales funnel. Reads `investors` — the same table the admin panel edits — so
 * there is no duplicated model; it only narrows the columns to the funnel view
 * and filters by pipeline stage.
 *
 * `proxy.ts` already restricts /admin/* to role = 'admin'.
 */
export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ etapa?: string }>;
}) {
  const { etapa } = await searchParams;
  const definition = findAdminTable("inversionistas");

  const stageColumn = definition.columns.find(
    (column) => column.key === PIPELINE_STAGE_KEY
  );
  const stageOptions = stageColumn?.options ?? [];

  // An unknown ?etapa= falls back to "all" instead of silently showing nothing.
  const allowedStages = stageOptions.map(optionValue);
  const activeStage =
    etapa && allowedStages.includes(etapa) ? etapa : ALL_STAGES;

  const supabase = await createClient();
  let query = supabase
    .from("investors")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(100);

  if (activeStage !== ALL_STAGES) {
    query = query.eq(PIPELINE_STAGE_KEY, activeStage);
  }

  const { data, error } = await query;

  const columns = PIPELINE_COLUMN_KEYS.map((key) =>
    definition.columns.find((column) => column.key === key)
  ).filter((column): column is TableColumn => column !== undefined);

  return (
    <div className="flex flex-col gap-8">
      <PageTitle>{es.nav.salesFunnel}</PageTitle>

      {error ? (
        <p role="alert" className="text-base text-destructive">
          {es.admin.loadError}
        </p>
      ) : null}

      <PipelinePanel
        activeStage={activeStage}
        stageOptions={stageOptions}
        columns={columns}
        rows={(data ?? []) as TableRow[]}
        allowInsert={definition.allowInsert !== false}
      />
    </div>
  );
}
