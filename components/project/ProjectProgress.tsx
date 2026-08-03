import { MilestoneIcon } from "lucide-react";
import { es } from "@/i18n";
import { formatDate, formatPercent } from "@/lib/format";
import { EmptyState } from "@/components/layout/EmptyState";
import {
  ContributionTimeline,
  type TimelineEntry,
} from "@/components/cards/ContributionTimeline";

export type ProjectMilestone = {
  id: string;
  task: string;
  stage: string | null;
  status: string | null;
  /** actual_date when the task is done, estimated_date otherwise. */
  date: string | null;
};

export type ProjectProgressProps = {
  /** projects.progress, 0–100. Null when nothing has been reported. */
  progress: number | null;
  milestones: ProjectMilestone[];
};

/**
 * "Avance" panel: how far the work has come, and the milestones behind it.
 *
 * The milestones are the project's real `tasks` rows — the schema already
 * models the construction stages (evaluación, permisos, construcción…), so
 * nothing here is invented. Any authenticated user may read them
 * (tasks_select), which is right: this is project information, not anybody's
 * position.
 */
export function ProjectProgress({ progress, milestones }: ProjectProgressProps) {
  const hasProgress = progress !== null && progress !== undefined;
  const share = Math.min(100, Math.max(0, Number(progress ?? 0)));

  const entries: TimelineEntry[] = milestones.map((milestone) => ({
    id: milestone.id,
    heading: milestone.task,
    // Stage, state and date on one line: the timeline is generic and carries a
    // heading plus a body, so the qualifiers travel in the body.
    detail: [
      milestone.stage,
      milestone.status,
      milestone.date ? formatDate(milestone.date) : null,
    ]
      .filter(Boolean)
      .join(" · "),
  }));

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-xl font-medium text-stone-900">
            {es.projectDetail.progress.title}
          </h3>
          {hasProgress ? (
            <p className="text-xl font-medium text-slate-950">
              {formatPercent(share)}
            </p>
          ) : null}
        </div>

        {hasProgress ? (
          <>
            <div className="h-3 w-full rounded-md bg-zinc-100">
              <div
                className="h-3 rounded-md bg-slate-950"
                style={{ width: `${share}%` }}
              />
            </div>
            <p className="text-sm text-zinc-600">
              {es.projectDetail.progress.current.replace(
                "{n}",
                String(Math.round(share))
              )}
            </p>
          </>
        ) : (
          <p className="text-sm text-neutral-400">
            {es.projectDetail.progress.notReported}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="text-xl font-medium text-stone-900">
          {es.projectDetail.progress.milestonesTitle}
        </h3>

        {entries.length > 0 ? (
          // Same rail the home uses for contributions: it only knows heading +
          // detail, so a milestone feed reuses it unchanged.
          <ContributionTimeline entries={entries} className="max-h-none" />
        ) : (
          <EmptyState
            icon={<MilestoneIcon />}
            title={es.projectDetail.progress.milestonesEmpty}
            hint={es.projectDetail.progress.milestonesEmptyHint}
          />
        )}
      </section>
    </div>
  );
}
