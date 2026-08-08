import type { Json } from "@/types/database";
import { es } from "@/i18n";
import {
  parseSellingPoints,
  toParagraphs,
} from "@/lib/projects/selling-points";
import {
  ReturnCalculator,
  type ReturnTerm,
} from "@/components/project/ReturnCalculator";

export type ProjectSummaryProps = {
  /** projects.description. Paragraphs are separated by a blank line. */
  description: string | null;
  /** projects.selling_points, parsed defensively. */
  sellingPoints: Json | null;
  /** Terms offered by the calculator. See the TODO on the page. */
  terms: ReturnTerm[];
  /**
   * Hides the return calculator. A project that no longer takes capital must
   * not offer a tool for estimating what investing in it would yield.
   */
  closedToInvestment?: boolean;
};

/**
 * "Resumen" panel: what the project is, what it could yield, why it is worth it.
 *
 * Server component — it only formats what the page already loaded. The only
 * interactive part is the calculator, which brings its own client boundary.
 */
export function ProjectSummary({
  description,
  sellingPoints,
  terms,
  closedToInvestment = false,
}: ProjectSummaryProps) {
  const paragraphs = toParagraphs(description);
  const points = parseSellingPoints(sellingPoints);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        {paragraphs.length > 0 ? (
          paragraphs.map((paragraph) => (
            <p key={paragraph} className="text-base text-zinc-600">
              {paragraph}
            </p>
          ))
        ) : (
          <p className="text-base text-neutral-400">
            {es.projectDetail.summary.descriptionEmpty}
          </p>
        )}
      </div>

      {closedToInvestment ? null : <ReturnCalculator terms={terms} />}

      <section className="flex flex-col gap-4">
        <h3 className="text-2xl font-medium text-slate-950">
          {es.projectDetail.summary.sellingPoints}
        </h3>

        {points.length > 0 ? (
          <div className="flex flex-col gap-4">
            {points.map((point) => (
              <div key={point.title} className="flex flex-col gap-1">
                <p className="text-base font-semibold text-stone-900">
                  {point.title}
                </p>
                {point.body ? (
                  <p className="text-base text-zinc-600">{point.body}</p>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-base text-neutral-400">
            {es.projectDetail.summary.sellingPointsEmpty}
          </p>
        )}
      </section>
    </div>
  );
}
