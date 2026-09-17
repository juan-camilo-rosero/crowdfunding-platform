"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImageIcon } from "lucide-react";
import { es } from "@/i18n";
import { Button } from "@/components/ui/button";
import type { TableFilters } from "@/lib/table/filters";
import { hasActiveTableFilters } from "@/lib/table/filters";
import type { TableChanges, TableColumn, TableRow } from "@/lib/table/types";
import { BatchEditPanel } from "@/components/data-table/BatchEditPanel";
import { TableFilterBar } from "@/components/data-table/TableFilterBar";
import {
  TableTabsSelector,
  type TableTab,
} from "@/components/data-table/TableTabsSelector";
import { ProjectPhotosDialog } from "@/components/project/ProjectPhotosDialog";
import { saveTableChanges } from "./actions";

/** The one tab whose records carry photos. */
const PROJECTS_TAB_ID = "proyectos";

export type AdminTablesPanelProps = {
  tabs: TableTab[];
  activeTabId: string;
  /** Human name of the active table, used in the creation dialog. */
  tableLabel: string;
  columns: TableColumn[];
  rows: TableRow[];
  /** Active filters, already validated on the server. */
  filters: TableFilters;
  countLabel: string;
  allowInsert: boolean;
};

/**
 * Admin panel screen: the shared autosaving editor with a table picker and the
 * filter bar on top.
 *
 * Switching tabs or filters is a NAVIGATION, so the server re-queries and RLS
 * keeps applying — the client never narrows rows it has already been given.
 */
export function AdminTablesPanel({
  tabs,
  activeTabId,
  tableLabel,
  columns,
  rows,
  filters,
  countLabel,
  allowInsert,
}: AdminTablesPanelProps) {
  const router = useRouter();

  // Which project's photo manager is open, if any. Kept here rather than per
  // row so only one dialog exists at a time.
  const [photoTarget, setPhotoTarget] = useState<{
    id: string;
    name: string;
    photos: string[];
  } | null>(null);

  return (
    <>
      <BatchEditPanel
        tableId={activeTabId}
        // The filters are part of the dataset: a different selection is a
        // different set of rows, and the grid must not carry cell state across.
        datasetKey={`${activeTabId}|${JSON.stringify(filters)}`}
        columns={columns}
        rows={rows}
        allowInsert={allowInsert}
        createTitle={es.admin.newRecordIn.replace("{tabla}", tableLabel)}
        emptyMessage={
          hasActiveTableFilters(filters)
            ? es.admin.emptyFiltered
            : es.admin.emptyTable
        }
        onSave={(changes: TableChanges) => saveTableChanges(activeTabId, changes)}
        // Photos are a text[] of files, which the scalar batch save cannot carry;
        // this column opens a manager that commits on its own.
        rowAction={
          activeTabId === PROJECTS_TAB_ID
            ? {
                label: es.admin.photos.column,
                width: 150,
                render: (row) => {
                  const photos = (row.main_photos as string[] | null) ?? [];
                  return (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        setPhotoTarget({
                          id: String(row.id),
                          name: String(row.name ?? ""),
                          photos,
                        })
                      }
                    >
                      <ImageIcon data-icon="inline-start" aria-hidden="true" />
                      {photos.length > 0
                        ? es.admin.photos.count.replace(
                            "{n}",
                            String(photos.length)
                          )
                        : es.admin.photos.none}
                    </Button>
                  );
                },
              }
            : undefined
        }
        renderFilter={({ guard, createButton }) => (
          <div className="flex flex-col gap-4">
            <TableTabsSelector
              tabs={tabs}
              activeTabId={activeTabId}
              // Changing table drops the filters: they name columns that the
              // next table does not have.
              onTabChange={(tabId) =>
                guard(() => router.push(`/admin?tabla=${tabId}`))
              }
            />

            <TableFilterBar
              columns={columns}
              filters={filters}
              preservedParams={{ tabla: activeTabId }}
              countLabel={countLabel}
              // The guard saves what is pending and then continues. If a save
              // failed and the admin chooses to stay, it never continues — so
              // this promise never settles and the filter simply does not
              // change, which is exactly what "stay here" means.
              beforeNavigate={() =>
                new Promise<void>((resolve) => guard(resolve))
              }
              actions={createButton}
            />
          </div>
        )}
      />

      {photoTarget ? (
        <ProjectPhotosDialog
          // Remounting per project keeps the list from leaking between them.
          key={photoTarget.id}
          projectId={photoTarget.id}
          projectName={photoTarget.name}
          initialPhotos={photoTarget.photos}
          open
          onOpenChange={(open) => {
            if (!open) setPhotoTarget(null);
          }}
          onPhotosChange={(photos) =>
            setPhotoTarget((current) =>
              current ? { ...current, photos } : current
            )
          }
        />
      ) : null}
    </>
  );
}
