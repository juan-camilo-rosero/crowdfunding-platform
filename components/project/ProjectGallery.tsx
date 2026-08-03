import Image from "next/image";
import { ImageIcon } from "lucide-react";
import { es } from "@/i18n";
import { cn } from "@/lib/utils";

export type ProjectGalleryProps = {
  /** projects.main_photos. Public URLs from the project-photos bucket. */
  photos: string[] | null | undefined;
  className?: string;
};

/** Photos the side grid can hold; the first photo always takes the hero. */
const SIDE_SLOTS = 4;

/**
 * Shape of the side grid per photo count. Written out rather than built from a
 * template string because Tailwind only ships the classes it can see.
 *
 * Only four photos tile a rectangle without gaps, so that is the one case that
 * becomes a 2×2; one, two or three stack in a single column instead.
 */
const SIDE_LAYOUT: Record<number, string> = {
  1: "grid-cols-1 grid-rows-1",
  2: "grid-cols-1 grid-rows-2",
  3: "grid-cols-1 grid-rows-3",
  4: "grid-cols-2 grid-rows-2",
};

/**
 * Airbnb-style gallery: one large photo on the left, a 2×2 grid on the right.
 *
 * It never breaks on a short set, which matters because most projects are
 * published before their photos are:
 *   · 5 or more  → hero + full 2×2 grid, extra photos ignored;
 *   · 2 to 4     → hero + the ones there are, the grid collapsing to fewer
 *                  columns so no empty cells are left hanging;
 *   · exactly 1  → the hero spans the full width;
 *   · none       → a single placeholder panel of the same height, so the page
 *                  below does not jump once photos are uploaded.
 */
export function ProjectGallery({ photos, className }: ProjectGalleryProps) {
  const available = (photos ?? []).filter((url) => !!url);

  if (available.length === 0) {
    return (
      <div
        className={cn(
          "flex h-[420px] w-full flex-col items-center justify-center gap-2 rounded-[10px] border border-neutral-200 bg-zinc-100 text-neutral-400",
          className
        )}
      >
        <ImageIcon className="size-8" aria-hidden="true" />
        <p className="text-sm">{es.projectDetail.noPhotos}</p>
      </div>
    );
  }

  const [hero, ...rest] = available;
  const side = rest.slice(0, SIDE_SLOTS);
  // In the 2×2 the second cell sits top-right; in a single column it is the
  // first. The bottom-right is always the last cell either way.
  const topRightIndex = side.length === SIDE_SLOTS ? 1 : 0;

  if (side.length === 0) {
    return (
      <div
        className={cn(
          "relative h-[420px] w-full overflow-hidden rounded-[10px]",
          className
        )}
      >
        <Image
          src={hero}
          alt={es.projectDetail.photoAlt}
          fill
          sizes="100vw"
          priority
          className="object-cover"
        />
      </div>
    );
  }

  return (
    <div className={cn("flex h-[420px] w-full gap-2", className)}>
      {/* Hero: rounded on the outer edge only, so the block reads as one unit. */}
      <div className="relative h-full min-w-0 flex-1 overflow-hidden rounded-l-[10px] max-md:rounded-r-[10px]">
        <Image
          src={hero}
          alt={es.projectDetail.photoAlt}
          fill
          sizes="(min-width: 768px) 50vw, 100vw"
          priority
          className="object-cover"
        />
      </div>

      {/*
        The side grid is shaped by how many photos actually arrived, so it is
        always completely filled — a 2×2 only when there are exactly four, a
        single column otherwise. Any other shape would leave a hole where the
        block's corner should be.
      */}
      <div
        className={cn(
          "hidden h-full min-w-0 flex-1 gap-2 md:grid",
          SIDE_LAYOUT[side.length]
        )}
      >
        {side.map((url, index) => (
          <div
            key={url}
            className={cn(
              "relative h-full w-full overflow-hidden",
              // Only the cells touching the block's outer edge get a corner.
              index === topRightIndex && "rounded-tr-[10px]",
              index === side.length - 1 && "rounded-br-[10px]"
            )}
          >
            <Image
              src={url}
              alt={es.projectDetail.photoAltNumbered.replace(
                "{n}",
                String(index + 2)
              )}
              fill
              sizes="25vw"
              className="object-cover"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
