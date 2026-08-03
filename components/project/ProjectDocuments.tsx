import { FolderIcon, FileIcon } from "lucide-react";
import { es } from "@/i18n";
import { formatDate } from "@/lib/format";
import { EmptyState } from "@/components/layout/EmptyState";

export type ProjectDocument = {
  id: string;
  /** documents.name is nullable in the schema; the row still lists. */
  name: string | null;
  docType: string | null;
  date: string | null;
  fileUrl: string | null;
};

export type ProjectDocumentsProps = {
  documents: ProjectDocument[];
};

/**
 * "Documentos" panel.
 *
 * The list is whatever the SERVER was allowed to read. documents_select lets a
 * caller see a row only when it is public, scoped to the project, or theirs —
 * so another investor's private document (a certificado de aporte, say) never
 * reaches this component, and there is no filtering to redo here. The `documents`
 * bucket is private, so the links are the stored file_url; signed URLs come with
 * the storage sprint.
 */
export function ProjectDocuments({ documents }: ProjectDocumentsProps) {
  if (documents.length === 0) {
    return (
      <EmptyState
        icon={<FolderIcon />}
        title={es.projectDetail.documents.empty}
        hint={es.projectDetail.documents.emptyHint}
      />
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {documents.map((document) => (
        <li
          key={document.id}
          className="flex items-center gap-4 rounded-[10px] border border-neutral-200 bg-stone-50 p-4"
        >
          <span
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center rounded-[5px] bg-zinc-100 text-zinc-500"
          >
            <FileIcon className="size-5" />
          </span>

          <div className="flex min-w-0 flex-1 flex-col">
            <p className="truncate text-base font-medium text-stone-900">
              {document.name ?? es.projectDetail.documents.untitled}
            </p>
            <p className="truncate text-sm text-zinc-500">
              {[
                document.docType,
                document.date
                  ? formatDate(document.date)
                  : es.projectDetail.documents.noDate,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>

          {document.fileUrl ? (
            <a
              href={document.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 cursor-pointer rounded-[10px] bg-stone-900 px-4 py-2 text-sm font-medium text-stone-50 transition-opacity hover:opacity-90"
            >
              {es.projectDetail.documents.open}
            </a>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
