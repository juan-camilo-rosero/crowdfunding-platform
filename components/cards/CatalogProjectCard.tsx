import { CheckIcon } from "lucide-react";
import { es } from "@/i18n";
import { RETURN_TEXT_SIZE, projectTitle } from "@/lib/projects/labels";
import { cn } from "@/lib/utils";
import { ProjectCardBar } from "@/components/cards/ProjectCardBar";
import { ProjectCardMedia } from "@/components/cards/ProjectCardMedia";
import { ProjectCardShell } from "@/components/cards/ProjectCardShell";

export type CatalogProjectCardProps = {
  /** Project id; the whole card links to its detail screen. */
  projectId: string;
  /** projects.name — the short badge over the photo. */
  name: string;
  /** projects.type — composes the title with `city`. */
  type: string | null;
  /** projects.city — composes the title with `type`. */
  city: string | null;
  /** projects.status — rendered through the status label map. */
  status: string | null;
  /** First entry of projects.main_photos; a placeholder shows when absent. */
  imageUrl?: string | null;
  /** projects.fundraising_goal. Null means the project is not raising. */
  fundraisingGoal?: number | null;
  /** Capital the PROJECT has raised, from the project_fundraising view. */
  capitalRaised?: number | null;
  /**
   * projects.offered_return — the return the project advertises publicly, free
   * text, shown verbatim. Null when the project has not published one.
   */
  offeredReturn?: string | null;
  /** True when the signed-in user already holds a position in this project. */
  isInvested?: boolean;
  className?: string;
};

/**
 * Project tile for the catalogue (/portafolio).
 *
 * Everything here is PUBLIC information about the project: any authenticated
 * user sees the same card, whether or not they have ever invested. That is why
 * it shows `offered_return` (marketing, on the project) and never
 * `agreed_return` (contractual, per investor, RLS-protected) — the two are
 * different figures and must not be confused. The private view of a project the
 * user does hold is ProjectInvestmentCard, in "mis inversiones".
 *
 * The one caller-specific bit is `isInvested`, a discreet marker computed from
 * the caller's OWN positions; it reveals nothing about anybody else.
 */
export function CatalogProjectCard({
  projectId,
  name,
  type,
  city,
  status,
  imageUrl,
  fundraisingGoal,
  capitalRaised,
  offeredReturn,
  isInvested = false,
  className,
}: CatalogProjectCardProps) {
  const publishedReturn = offeredReturn?.trim();

  return (
    <ProjectCardShell
      projectId={projectId}
      action={es.investmentCard.seeMore}
      className={className}
    >
      <ProjectCardMedia imageUrl={imageUrl} name={name} status={status} />

      <div className="flex flex-col gap-1.5">
        <h3 className="min-w-0 truncate text-base font-medium text-stone-900">
          {projectTitle(type, city)}
        </h3>

        {/* Context, not a call to action: a quiet chip that tells the investor
            they already hold this project without changing the rest of the
            card. Absent for everyone else. */}
        {isInvested ? (
          <span className="inline-flex w-fit items-center gap-1 rounded-[500px] bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
            <CheckIcon className="size-3" aria-hidden="true" />
            {es.catalog.alreadyInvested}
          </span>
        ) : null}
      </div>

      {/* Fundraising, never work progress: here the reader has not invested
          yet, so the question is how much of the goal is still open. */}
      <ProjectCardBar
        variant="fundraising"
        fundraisingGoal={fundraisingGoal}
        capitalRaised={capitalRaised}
      />

      {/* The return slot always occupies the same space so the cards line up,
          but a project with no published return says so plainly rather than
          rendering a dash where a figure belongs. */}
      <div className="flex flex-1 flex-col items-center justify-center gap-0.5">
        {publishedReturn ? (
          <>
            <p
              className={cn(
                "text-center font-medium text-stone-900",
                RETURN_TEXT_SIZE
              )}
            >
              {publishedReturn}
            </p>
            <p className="text-center text-xs font-medium text-zinc-600">
              {es.catalog.offeredReturn}
            </p>
          </>
        ) : (
          <p className="text-center text-xs font-medium text-zinc-500">
            {es.catalog.returnOnRequest}
          </p>
        )}
      </div>
    </ProjectCardShell>
  );
}
