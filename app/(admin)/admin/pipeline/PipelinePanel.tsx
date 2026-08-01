"use client";

import { useRouter } from "next/navigation";
import { ChevronDownIcon, FilterIcon } from "lucide-react";
import { es } from "@/i18n";
import {
  optionLabel,
  optionValue,
  type SelectOption,
  type TableChanges,
  type TableColumn,
  type TableRow,
} from "@/lib/table/types";
import { BatchEditPanel } from "@/components/data-table/BatchEditPanel";
import { ValuePill } from "@/components/data-table/SelectCell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { saveTableChanges } from "../actions";
import { ALL_STAGES, PIPELINE_STAGE_KEY } from "./stages";

export type PipelinePanelProps = {
  activeStage: string;
  stageOptions: readonly SelectOption[];
  columns: TableColumn[];
  rows: TableRow[];
  allowInsert: boolean;
};

/**
 * Sales funnel screen: the shared batch editor filtered by pipeline stage.
 *
 * Writes go to `investors` through the same save action as the admin panel, so
 * validation, the all-or-nothing transaction and the admin check are shared.
 */
export function PipelinePanel({
  activeStage,
  stageOptions,
  columns,
  rows,
  allowInsert,
}: PipelinePanelProps) {
  const router = useRouter();

  const activeLabel =
    activeStage === ALL_STAGES
      ? es.pipeline.allStages
      : optionLabel(
          stageOptions.find((option) => optionValue(option) === activeStage) ??
            activeStage
        );

  /**
   * Records created while a single stage is filtered inherit that stage, so the
   * new row does not vanish from the view the admin is looking at.
   */
  function prepare(changes: TableChanges): TableChanges {
    if (activeStage === ALL_STAGES) return changes;

    return {
      updates: changes.updates,
      inserts: changes.inserts.map((insert) =>
        insert[PIPELINE_STAGE_KEY]
          ? insert
          : { ...insert, [PIPELINE_STAGE_KEY]: activeStage }
      ),
    };
  }

  return (
    <BatchEditPanel
      tableId="inversionistas"
      datasetKey={activeStage}
      columns={columns}
      rows={rows}
      allowInsert={allowInsert}
      onSave={(changes) => saveTableChanges("inversionistas", prepare(changes))}
      renderFilter={(guard) => (
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={es.pipeline.filterLabel}
            className="flex h-11.5 w-max min-w-48 cursor-pointer items-center justify-between gap-3 rounded-[10px] border border-line bg-elevated px-4 py-2 text-base font-normal text-ink-700 outline-none hover:bg-surface"
          >
            <span className="flex items-center gap-2">
              <FilterIcon className="size-4 text-ink-500" aria-hidden="true" />
              {/* Same colored chip the table uses, so a stage looks identical
                  wherever it appears. "All" stays plain: it clears the filter
                  rather than naming a value. */}
              {activeStage === ALL_STAGES ? (
                activeLabel
              ) : (
                <ValuePill value={activeLabel} />
              )}
            </span>
            <ChevronDownIcon
              className="size-4 shrink-0 text-ink-500"
              aria-hidden="true"
            />
          </DropdownMenuTrigger>

          {/* Roomier on desktop: larger text and more padding per option. */}
          <DropdownMenuContent
            align="start"
            className="bg-elevated md:min-w-64 md:p-1.5"
          >
            <DropdownMenuItem
              className="md:px-3 md:py-2 md:text-base"
              onClick={() =>
                guard(() => router.push(`/admin/pipeline?etapa=${ALL_STAGES}`))
              }
            >
              {es.pipeline.allStages}
            </DropdownMenuItem>

            {stageOptions.map((option) => (
              <DropdownMenuItem
                key={optionValue(option)}
                className="md:px-3 md:py-2 md:text-base"
                onClick={() =>
                  guard(() =>
                    router.push(
                      `/admin/pipeline?etapa=${encodeURIComponent(optionValue(option))}`
                    )
                  )
                }
              >
                <ValuePill value={optionLabel(option)} />
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    />
  );
}
