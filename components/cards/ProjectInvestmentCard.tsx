import Image from "next/image";
import Link from "next/link";
import { ImageIcon } from "lucide-react";
import { es } from "@/i18n";
import { formatCurrency, formatPercent } from "@/lib/format";
import {
  RETURN_TEXT_SIZE,
  projectStatusLabel,
  projectTitle,
  resolveAgreedReturn,
} from "@/lib/projects/labels";
import { cn } from "@/lib/utils";

export type ProjectInvestmentCardProps = {
  /** Project id; drives the "Ver más" link. */
  projectId: string;
  /** Short name shown on the image badge, e.g. "197 Cougar Way". */
  name: string;
  /** projects.type — composes the title with `city`. */
  type: string | null;
  /** projects.city — composes the title with `type`. */
  city: string | null;
  /** projects.status — rendered through the status label map. */
  status: string | null;
  /** First entry of projects.main_photos; a placeholder shows when absent. */
  imageUrl?: string | null;
  /** projects.fundraising_goal. Null hides the fundraising block. */
  fundraisingGoal?: number | null;
  /** Capital raised so far, for the progress bar. */
  capitalRaised?: number | null;
  /** The investor's current capital in this project. */
  investedAmount: number;
  /**
   * Every `agreed_return` of this position's contributions. They are resolved
   * into one label; see lib/projects/labels.
   */
  agreedReturns?: (string | null | undefined)[];
  className?: string;
};

/**
 * Project tile showing the investor's position in it.
 *
 * Generic on purpose — it takes plain project fields plus the position, with no
 * queries of its own — so the catalogue can reuse it by passing a zero position
 * or omitting the amount.
 */
export function ProjectInvestmentCard({
  projectId,
  name,
  type,
  city,
  status,
  imageUrl,
  fundraisingGoal,
  capitalRaised,
  investedAmount,
  agreedReturns = [],
  className,
}: ProjectInvestmentCardProps) {
  const agreedReturn = resolveAgreedReturn(agreedReturns);

  // The fundraising block only makes sense with a goal; without one the card
  // shows a neutral line instead of a bar at a made-up percentage, which keeps
  // every card structurally identical inside the grid.
  const hasGoal = !!fundraisingGoal && fundraisingGoal > 0;
  const raisedShare = hasGoal
    ? Math.min(100, ((capitalRaised ?? 0) / fundraisingGoal) * 100)
    : 0;

  return (
    // The whole card is the link, so a click anywhere opens the project. The
    // "Ver más" affordance below is therefore a styled span, not a nested <a>,
    // which would be invalid markup.
    <Link
      href={`/proyecto/${projectId}`}
      className={cn(
        "group flex h-full w-full cursor-pointer flex-col gap-3 rounded-[10px] border border-neutral-200 bg-stone-50 p-4 transition-shadow hover:shadow-md",
        className
      )}
    >
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

      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 truncate text-base font-medium text-stone-900">
          {projectTitle(type, city)}
        </h3>
        <p className="shrink-0 text-base font-medium text-stone-900">
          {formatCurrency(investedAmount)}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        {hasGoal ? (
          <>
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-xs text-zinc-500">
                {es.investmentCard.goal.replace(
                  "{amount}",
                  formatCurrency(fundraisingGoal)
                )}
              </p>
              <p className="shrink-0 text-xs text-zinc-500">
                {formatPercent(raisedShare)}
              </p>
            </div>
            <div className="h-2 w-full rounded-md bg-zinc-100">
              <div
                className="h-2 rounded-md bg-amber-300"
                style={{ width: `${raisedShare}%` }}
              />
            </div>
          </>
        ) : (
          <p className="text-xs text-zinc-500">{es.investmentCard.noGoal}</p>
        )}
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-0.5">
        <p
          className={cn(
            "text-center font-medium text-stone-900",
            RETURN_TEXT_SIZE
          )}
        >
          {agreedReturn.value}
        </p>
        <p className="text-center text-xs font-medium text-zinc-600">
          {agreedReturn.label}
        </p>
      </div>

      {/* mt-auto pins it to the bottom, so every card's button lines up even
          when the content above is shorter. */}
      <span className="mt-auto flex h-10 w-full shrink-0 items-center justify-center rounded-[10px] bg-stone-900 text-base font-medium text-white transition-opacity group-hover:opacity-90">
        {es.investmentCard.seeMore}
      </span>
    </Link>
  );
}
