"use client";

import { useRouter } from "next/navigation";
import { FilterIcon } from "lucide-react";
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
import { FilterDropdown } from "@/components/filters/FilterDropdown";
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

  const filterOptions = stageOptions.map((option) => ({
    value: optionValue(option),
    label: optionLabel(option),
  }));

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
        <FilterDropdown
          icon={<FilterIcon />}
          ariaLabel={es.pipeline.filterLabel}
          // "All stages" is both the resting label and the clear entry: this
          // filter is never off, it just widens to everything.
          placeholder={es.pipeline.allStages}
          clearLabel={es.pipeline.allStages}
          options={filterOptions}
          value={activeStage === ALL_STAGES ? null : activeStage}
          // Same coloured chip the table uses, so a stage looks identical
          // wherever it appears.
          renderOption={(option) => <ValuePill value={option.label} />}
          // guard() is what protects unsaved edits before navigating away.
          onSelect={(stage) =>
            guard(() =>
              router.push(
                `/admin/pipeline?etapa=${encodeURIComponent(stage ?? ALL_STAGES)}`
              )
            )
          }
        />
      )}
    />
  );
}
