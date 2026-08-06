"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImageIcon } from "lucide-react";
import { es } from "@/i18n";
import { Button } from "@/components/ui/button";
import type { TableChanges, TableColumn, TableRow } from "@/lib/table/types";
import { BatchEditPanel } from "@/components/data-table/BatchEditPanel";
import {
  TableTabsSelector,
  type TableTab,
} from "@/components/data-table/TableTabsSelector";
import { saveTableChanges } from "./actions";
import { ProjectPhotosDialog } from "./ProjectPhotosDialog";

/** The one tab whose records carry photos. */
const PROJECTS_TAB_ID = "proyectos";

export type AdminTablesPanelProps = {
  tabs: TableTab[];
  activeTabId: string;
  columns: TableColumn[];
  rows: TableRow[];
  allowInsert: boolean;
};

/**
 * Admin panel screen: the shared batch editor with a table picker on top.
 * Switching tabs is a navigation, so the server re-queries and RLS keeps
 * applying.
 */
export function AdminTablesPanel({
  tabs,
  activeTabId,
  columns,
  rows,
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
      datasetKey={activeTabId}
      columns={columns}
      rows={rows}
      allowInsert={allowInsert}
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
      renderFilter={(guard) => (
        <TableTabsSelector
          tabs={tabs}
          activeTabId={activeTabId}
          onTabChange={(tabId) =>
            guard(() => router.push(`/admin?tabla=${tabId}`))
          }
        />
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
