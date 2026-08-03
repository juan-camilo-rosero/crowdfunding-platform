import { es } from "@/i18n";
import { formatPercent } from "@/lib/format";

/**
 * Which figure the bar reports.
 *
 * The rule behind it: where an investor looks at THEIR OWN projects (the home
 * and /mis-inversiones) the bar reports how the work is progressing; where they
 * discover projects to invest in (the catalogue) it reports how much of the
 * goal has been raised. Same bar, different question.
 */
export type ProjectCardBarVariant = "progress" | "fundraising";

export type ProjectCardBarProps = {
  variant: ProjectCardBarVariant;
  /** projects.progress, 0–100. Read on the "progress" variant. */
  progress?: number | null;
  /** projects.fundraising_goal. Read on the "fundraising" variant. */
  fundraisingGoal?: number | null;
  /** Capital the PROJECT has raised. Read on the "fundraising" variant. */
  capitalRaised?: number | null;
};

/**
 * The metered line on a project card: a caption, a percentage and the bar.
 *
 * One implementation for both card variants, told apart by `variant`, so the
 * geometry can never drift between the catalogue and the investor's own
 * screens — only the figure does.
 *
 * Both variants degrade the same way: when the underlying figure does not
 * exist (no progress recorded, no fundraising goal) the bar is replaced by a
 * neutral line rather than drawn at a made-up value, which keeps every card in
 * the grid structurally identical.
 */
export function ProjectCardBar({
  variant,
  progress,
  fundraisingGoal,
  capitalRaised,
}: ProjectCardBarProps) {
  const meter =
    variant === "progress"
      ? resolveProgress(progress)
      : resolveFundraising(fundraisingGoal, capitalRaised);

  if (!meter) {
    const emptyLabel =
      variant === "progress"
        ? es.investmentCard.noProgress
        : es.catalog.notFundraising;

    return (
      <div className="flex flex-col gap-1.5">
        <p className="text-xs text-zinc-500">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="truncate text-xs text-zinc-500">{meter.label}</p>
        <p className="shrink-0 text-xs text-zinc-500">
          {formatPercent(meter.share)}
        </p>
      </div>
      <div className="h-2 w-full rounded-md bg-zinc-100">
        <div
          className="h-2 rounded-md bg-amber-300"
          style={{ width: `${meter.share}%` }}
        />
      </div>
    </div>
  );
}

/** Work progress is already a percentage; it only needs bounding. */
function resolveProgress(progress: number | null | undefined) {
  if (progress === null || progress === undefined) return null;
  return {
    label: es.investmentCard.workProgress,
    share: Math.min(100, Math.max(0, Number(progress))),
  };
}

/** Raised over goal. Without a goal there is no honest percentage to draw. */
function resolveFundraising(
  fundraisingGoal: number | null | undefined,
  capitalRaised: number | null | undefined
) {
  if (!fundraisingGoal || fundraisingGoal <= 0) return null;
  return {
    label: es.catalog.raised,
    share: Math.min(100, ((capitalRaised ?? 0) / fundraisingGoal) * 100),
  };
}
