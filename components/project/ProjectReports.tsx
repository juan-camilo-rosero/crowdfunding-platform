import Image from "next/image";
import { FileTextIcon } from "lucide-react";
import { es } from "@/i18n";
import { formatCurrency, formatDate } from "@/lib/format";
import { EmptyState } from "@/components/layout/EmptyState";

export type ProjectReport = {
  id: string;
  /** monthly_reports.report_month — first day of the month. */
  reportMonth: string | null;
  physicalProgress: string | null;
  financialProgress: string | null;
  capitalUsedMonth: number | null;
  decisions: string | null;
  risks: string | null;
  nextSteps: string | null;
  photos: string[] | null;
  reportPdfUrl: string | null;
};

export type ProjectReportsProps = {
  /** Newest first; the page orders them. */
  reports: ProjectReport[];
};

/**
 * "Reportes" panel: the monthly reports of the project, most recent first.
 *
 * views.md calls this the heart of the screen, so each report is a full card
 * rather than a row: what advanced physically, what advanced financially, what
 * was decided, what is at risk and what comes next — with its photos.
 *
 * Every field is optional in the schema, so each one is rendered only when it
 * has content; a sparse report degrades to a shorter card, never to a list of
 * empty labels.
 */
export function ProjectReports({ reports }: ProjectReportsProps) {
  if (reports.length === 0) {
    return (
      <EmptyState
        icon={<FileTextIcon />}
        title={es.projectDetail.reports.empty}
        hint={es.projectDetail.reports.emptyHint}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {reports.map((report) => {
        const facts = [
          {
            label: es.projectDetail.reports.physical,
            value: report.physicalProgress,
          },
          {
            label: es.projectDetail.reports.financial,
            value: report.financialProgress,
          },
          {
            label: es.projectDetail.reports.capitalUsed,
            value:
              report.capitalUsedMonth !== null &&
              report.capitalUsedMonth !== undefined
                ? formatCurrency(report.capitalUsedMonth)
                : null,
          },
          {
            label: es.projectDetail.reports.decisions,
            value: report.decisions,
          },
          { label: es.projectDetail.reports.risks, value: report.risks },
          {
            label: es.projectDetail.reports.nextSteps,
            value: report.nextSteps,
          },
        ].filter((fact) => !!fact.value);

        const photos = (report.photos ?? []).filter(Boolean);

        return (
          <article
            key={report.id}
            className="flex flex-col gap-4 rounded-[10px] border border-neutral-200 bg-stone-50 p-6"
          >
            <h3 className="text-xl font-medium text-stone-900">
              {report.reportMonth
                ? formatDate(report.reportMonth)
                : es.projectDetail.documents.noDate}
            </h3>

            {facts.length > 0 ? (
              <dl className="grid gap-4 sm:grid-cols-2">
                {facts.map((fact) => (
                  <div key={fact.label} className="flex flex-col gap-0.5">
                    <dt className="text-xs font-medium text-zinc-500">
                      {fact.label}
                    </dt>
                    <dd className="text-base text-zinc-600">{fact.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}

            {photos.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {photos.map((url, index) => (
                  <div
                    key={url}
                    className="relative aspect-4/3 overflow-hidden rounded-[5px] border border-neutral-200"
                  >
                    <Image
                      src={url}
                      alt={`${es.projectDetail.reports.photoAlt} ${index + 1}`}
                      fill
                      sizes="200px"
                      className="object-cover"
                    />
                  </div>
                ))}
              </div>
            ) : null}

            {report.reportPdfUrl ? (
              <a
                href={report.reportPdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-fit cursor-pointer text-sm font-medium text-slate-950 underline underline-offset-4"
              >
                {es.projectDetail.reports.openPdf}
              </a>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
