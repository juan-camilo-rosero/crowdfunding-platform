import { es } from "@/i18n";
import { formatCurrency } from "@/lib/format";
import {
  RETURN_TEXT_SIZE,
  projectTitle,
  resolveAgreedReturn,
} from "@/lib/projects/labels";
import { cn } from "@/lib/utils";
import { ProjectCardBar } from "@/components/cards/ProjectCardBar";
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
  /** projects.progress, 0–100. Drives the work-progress bar. */
  progress?: number | null;
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
  progress,
  investedAmount,
  agreedReturns = [],
  className,
}: ProjectInvestmentCardProps) {
  const agreedReturn = resolveAgreedReturn(agreedReturns);

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

      {/* Work progress, never fundraising: on the investor's own screens the
          question is how their project is coming along, not how much capital it
          still needs. The catalogue's variant asks the other question. */}
      <ProjectCardBar variant="progress" progress={progress} />

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
