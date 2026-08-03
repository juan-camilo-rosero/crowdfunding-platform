import { es } from "@/i18n";
import { formatCurrency, formatPercent } from "@/lib/format";
import {
  RETURN_TEXT_SIZE,
  projectTitle,
  resolveAgreedReturn,
} from "@/lib/projects/labels";
import { cn } from "@/lib/utils";
import { ProjectCardMedia } from "@/components/cards/ProjectCardMedia";
import { ProjectCardShell } from "@/components/cards/ProjectCardShell";

export type ProjectInvestmentCardProps = {
  /** Project id; drives the card's link. */
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
  /** Capital the PROJECT has raised, for the progress bar. */
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
 * Project tile for "mis inversiones": the investor's own position in a project
 * they already hold.
 *
 * What it shows is PRIVATE to the caller — their invested amount and the return
 * THEY agreed to (capital_contributions.agreed_return). The catalogue's variant
 * (CatalogProjectCard) deliberately shows neither; it sells the project with its
 * public figures instead. Both are built on ProjectCardShell/ProjectCardMedia,
 * so they stay visually identical.
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
    <ProjectCardShell
      projectId={projectId}
      action={es.investmentCard.seeMore}
      className={className}
    >
      <ProjectCardMedia imageUrl={imageUrl} name={name} status={status} />

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
    </ProjectCardShell>
  );
}
