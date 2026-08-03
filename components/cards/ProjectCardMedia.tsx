import Image from "next/image";
import { ImageIcon } from "lucide-react";
import { es } from "@/i18n";
import { projectStatusLabel } from "@/lib/projects/labels";

export type ProjectCardMediaProps = {
  /** First entry of projects.main_photos; a placeholder shows when absent. */
  imageUrl?: string | null;
  /** projects.name — the short badge over the photo. */
  name: string;
  /** projects.status — rendered through the status label map. */
  status: string | null;
};

/**
 * Photo of a project card with its two badges: the short name over the top-left
 * corner and the status over the bottom-right one.
 *
 * Shared by every project card variant so a project is recognised the same way
 * in the catalogue and in "mis inversiones".
 */
export function ProjectCardMedia({
  imageUrl,
  name,
  status,
}: ProjectCardMediaProps) {
  return (
    <div className="relative h-40 w-full shrink-0 overflow-hidden rounded-[10px] border border-neutral-200 bg-zinc-100">
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={es.projects.imageAlt}
          fill
          sizes="320px"
          className="object-cover"
        />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-1 text-zinc-400">
          <ImageIcon className="size-6" aria-hidden="true" />
          <span className="text-xs">{es.projects.noImage}</span>
        </div>
      )}

      <span className="absolute top-2 left-2 max-w-[60%] truncate rounded-[500px] bg-stone-50 px-2.5 py-1 text-xs font-medium text-stone-900">
        {name}
      </span>

      {status ? (
        <span className="absolute right-2 bottom-2 rounded-[500px] bg-stone-900 px-3 py-1 text-sm font-medium text-stone-50">
          {projectStatusLabel(status)}
        </span>
      ) : null}
    </div>
  );
}
