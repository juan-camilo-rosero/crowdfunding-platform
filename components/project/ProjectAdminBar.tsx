"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImageIcon, PencilIcon, ShieldCheckIcon } from "lucide-react";
import { es } from "@/i18n";
import type { TableColumn, TableRow } from "@/lib/table/types";
import { Button } from "@/components/ui/button";
import { RecordFormDialog } from "@/components/data-table/RecordFormDialog";
import { ProjectPhotosDialog } from "@/components/project/ProjectPhotosDialog";
import { updateProjectFromDetail } from "@/app/(investor)/proyecto/[id]/actions";

export type ProjectAdminBarProps = {
  projectId: string;
  projectName: string;
  /** Current values of the record, used to prefill the edit form. */
  project: TableRow;
  /** The projects table definition, handed down from the server. */
  columns: TableColumn[];
  photos: string[];
};

/**
 * Admin controls on the PUBLIC project page.
 *
 * The page has always been the place where the project is actually looked at,
 * and it was the one place it could not be corrected: spotting a wrong city or
 * a missing photo meant leaving for the panel, finding the row among a hundred
 * others and scrolling sideways to the column. The same edit now happens where
 * the mistake is visible.
 *
 * It is ONLY the entry point. Both dialogs are the ones the panel uses, and
 * both write through actions that check `role = 'admin'` on the server — this
 * component rendering at all already depends on that same check, made on the
 * server in page.tsx. Nothing here is a second source of permission.
 */
export function ProjectAdminBar({
  projectId,
  projectName,
  project,
  columns,
  photos,
}: ProjectAdminBarProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [managingPhotos, setManagingPhotos] = useState(false);

  return (
    <>
      {/* Over the gallery, where the content it edits is. Solid backgrounds
          because it sits on a photograph whose colours we do not control.

          Bounded on both sides so the controls WRAP inside the gallery on a
          phone instead of running off its left edge; transparent to clicks
          except on the controls themselves, since the strip spans the width. */}
      <div className="pointer-events-none absolute top-4 right-4 left-4 z-10 flex flex-wrap items-center justify-end gap-2 [&>*]:pointer-events-auto">
        <span className="hidden items-center gap-1.5 rounded-[500px] bg-elevated/95 px-3 py-1.5 text-xs font-medium text-ink-700 shadow-sm sm:inline-flex">
          <ShieldCheckIcon className="size-3.5" aria-hidden="true" />
          {es.projectDetail.admin.badge}
        </span>

        <Button
          type="button"
          variant="secondary"
          size="lg"
          className="bg-elevated/95 shadow-sm"
          onClick={() => setManagingPhotos(true)}
        >
          <ImageIcon data-icon="inline-start" aria-hidden="true" />
          {es.projectDetail.admin.editPhotos}
        </Button>

        <Button
          type="button"
          variant="brand"
          size="lg"
          className="shadow-sm"
          onClick={() => setEditing(true)}
        >
          <PencilIcon data-icon="inline-start" aria-hidden="true" />
          {es.projectDetail.admin.editInfo}
        </Button>
      </div>

      {editing ? (
        <RecordFormDialog
          open
          onOpenChange={setEditing}
          title={es.projectDetail.admin.editTitle}
          description={es.projectDetail.admin.editDescription}
          columns={columns}
          initialValues={project}
          mode="edit"
          submitLabel={es.projectDetail.admin.save}
          submittingLabel={es.admin.saving}
          onSubmit={async (values) => {
            const result = await updateProjectFromDetail(projectId, values);
            // The page is a Server Component: only a refresh shows the new
            // values, and it must happen before the dialog claims success.
            if (result.ok) router.refresh();
            return result;
          }}
        />
      ) : null}

      {managingPhotos ? (
        <ProjectPhotosDialog
          projectId={projectId}
          projectName={projectName}
          initialPhotos={photos}
          open
          onOpenChange={(open) => {
            setManagingPhotos(open);
            // The gallery above is server-rendered from main_photos.
            if (!open) router.refresh();
          }}
        />
      ) : null}
    </>
  );
}
