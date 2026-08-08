import type { ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { es } from "@/i18n";
import { CATALOG_ROUTE, LOGIN_ROUTE } from "@/lib/auth/routes";
import {
  getCurrentUserProfile,
  getInvestorIds,
} from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isClosedToInvestment } from "@/lib/projects/enums";
import { projectStatusLabel, projectTitle } from "@/lib/projects/labels";
import { ProjectGallery } from "@/components/project/ProjectGallery";
import { ProjectSummary } from "@/components/project/ProjectSummary";
import { ProjectProgress } from "@/components/project/ProjectProgress";
import { ProjectReports } from "@/components/project/ProjectReports";
import { ProjectDocuments } from "@/components/project/ProjectDocuments";
import { InterestForm } from "@/components/project/InterestForm";
import { ProjectMyInvestment } from "@/components/project/ProjectMyInvestment";
import {
  ProjectTabs,
  type ProjectTabId,
} from "@/components/project/ProjectTabs";
import type { ReturnTerm } from "@/components/project/ReturnCalculator";

/**
 * MOCK terms for the return calculator.
 *
 * TODO(modelo de datos): terms and rate ranges are NOT in the schema. Adding
 * them means new columns or a `project_return_terms` table, which is a data
 * model decision rather than a UI one, so nothing was migrated. Once they
 * exist, load them here alongside the project and pass them through unchanged —
 * the calculator is already parameterised by props and knows nothing else.
 *
 * Ranges, never single rates: the screen must not imply a figure the investor
 * will receive.
 */
const MOCK_RETURN_TERMS: ReturnTerm[] = [
  { months: 6, annualMin: 0.08, annualMax: 0.12 },
  { months: 12, annualMin: 0.1, annualMax: 0.15 },
  { months: 18, annualMin: 0.11, annualMax: 0.16 },
];

/** Milestones pulled for the "Avance" timeline. */
const MILESTONES_LIMIT = 30;

/**
 * Project detail.
 *
 * Open to any onboarded user (proxy.ts lists /proyecto among the catalogue
 * routes), so everything on it is public project information — except the
 * "Mi inversión" tab.
 *
 * THAT TAB IS DECIDED HERE, ON THE SERVER, from the authenticated user's own
 * position: the panel is only added to the array when they actually hold
 * capital in THIS project. The client component receives a list of panels and
 * cannot invent one, so there is no client-side condition to tamper with. The
 * position comes from investor_project_distribution, whose RLS restricts rows
 * to the caller's own investor ids, and the query is additionally scoped to
 * those ids.
 */
export default async function ProjectDetailPage({
  params,
}: {
  // Next.js 16: params is async.
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const profile = await getCurrentUserProfile();
  if (!profile) {
    redirect(LOGIN_ROUTE);
  }

  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  // Unknown id, or one RLS will not disclose: same answer either way, so the
  // URL cannot be used to probe which projects exist.
  if (!project) {
    notFound();
  }
  // One cached read per request, shared with the layout's sidebar check.
  const investorIds = await getInvestorIds();

  const [positionsResult, milestonesResult, reportsResult, documentsResult] =
    await Promise.all([
      // The FULL position, not merely whether one exists: the same read both
      // decides the tab and feeds it, so the panel can never be shown with
      // figures that were fetched under a different condition.
      investorIds.length
        ? supabase
            .from("investor_project_position")
            .select("contributed, returned_capital, yield_received, current_capital")
            .eq("project_id", id)
            .in("investor_id", investorIds)
        : Promise.resolve({ data: [] }),
      supabase
        .from("tasks")
        .select("id, task, stage, status, estimated_date, actual_date")
        .eq("project_id", id)
        .order("estimated_date", { ascending: true })
        .limit(MILESTONES_LIMIT),
      supabase
        .from("monthly_reports")
        .select("*")
        .eq("project_id", id)
        .order("report_month", { ascending: false }),
      // RLS decides what comes back here; nothing is re-filtered client side.
      supabase
        .from("documents")
        .select("id, name, doc_type, date, file_url")
        .eq("project_id", id)
        .order("date", { ascending: false }),
    ]);

  // A user may hold several investor rows; their position here is the sum.
  const positionRows = (positionsResult.data ?? []) as {
    contributed: number | string | null;
    returned_capital: number | string | null;
    yield_received: number | string | null;
    current_capital: number | string | null;
  }[];

  const position = positionRows.reduce(
    (totals, row) => ({
      contributed: totals.contributed + Number(row.contributed ?? 0),
      returnedCapital: totals.returnedCapital + Number(row.returned_capital ?? 0),
      yieldReceived: totals.yieldReceived + Number(row.yield_received ?? 0),
      currentCapital: totals.currentCapital + Number(row.current_capital ?? 0),
    }),
    { contributed: 0, returnedCapital: 0, yieldReceived: 0, currentCapital: 0 }
  );

  const hasPosition = positionRows.length > 0;

  // Only fetched when there is a position to describe, and scoped to the same
  // investor ids: the contribution breakdown and the project's total received
  // capital, which is the denominator of the share.
  const [contributionsResult, totalsResult] = await Promise.all([
    hasPosition
      ? supabase
          .from("capital_contributions")
          // amount_received, not amount_committed: this table is the breakdown
          // of money actually in, which is what the position is built from.
          .select("id, received_date, amount_received, capital_type, agreed_return, term, status")
          .eq("project_id", id)
          .in("investor_id", investorIds)
          .order("received_date", { ascending: false })
      : Promise.resolve({ data: [] }),
    hasPosition
      ? supabase
          .from("project_totals")
          .select("capital_received")
          .eq("project_id", id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const contributions = ((contributionsResult.data ?? []) as {
    id: string;
    received_date: string | null;
    amount_received: number | string | null;
    capital_type: string | null;
    agreed_return: string | null;
    term: string | null;
    status: string | null;
  }[]).map((row) => ({
    id: row.id,
    receivedDate: row.received_date,
    amount: Number(row.amount_received ?? 0),
    capitalType: row.capital_type,
    // Verbatim; never parsed or normalised.
    agreedReturn: row.agreed_return,
    term: row.term,
    status: row.status,
  }));

  const projectCapitalReceived =
    (totalsResult.data as { capital_received: number | string | null } | null)
      ?.capital_received != null
      ? Number(
          (totalsResult.data as { capital_received: number | string }).capital_received
        )
      : null;

  const milestones = (milestonesResult.data ?? []).map((row) => ({
    id: row.id,
    task: row.task ?? "",
    stage: row.stage,
    status: row.status,
    // A finished task is dated by when it actually happened; a pending one by
    // when it is expected.
    date: row.actual_date ?? row.estimated_date,
  }));

  const reports = (reportsResult.data ?? []).map((row) => ({
    id: row.id,
    reportMonth: row.report_month,
    physicalProgress: row.physical_progress,
    financialProgress: row.financial_progress,
    capitalUsedMonth: row.capital_used_month,
    decisions: row.decisions,
    risks: row.risks,
    nextSteps: row.next_steps,
    photos: row.photos,
    reportPdfUrl: row.report_pdf_url,
  }));

  const documents = (documentsResult.data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    docType: row.doc_type,
    date: row.date,
    fileUrl: row.file_url,
  }));

  // Finished or already producing: the screen keeps informing but stops
  // inviting. Everything factual stays — gallery, progress, reports, documents
  // and the investor's own position — and only what solicits capital goes: the
  // return calculator and the interest form.
  const closedToInvestment = isClosedToInvestment(project);

  const statusLabel = projectStatusLabel(project.status);
  const subtitle =
    project.progress !== null && project.progress !== undefined
      ? es.projectDetail.statusWithProgress
          .replace("{status}", statusLabel)
          .replace("{progress}", String(Math.round(project.progress)))
      : statusLabel;

  const panels: { id: ProjectTabId; content: ReactNode }[] = [
    {
      id: "resumen",
      content: (
        <ProjectSummary
          description={project.description}
          sellingPoints={project.selling_points}
          terms={MOCK_RETURN_TERMS}
          closedToInvestment={closedToInvestment}
        />
      ),
    },
    {
      id: "avance",
      content: (
        <ProjectProgress progress={project.progress} milestones={milestones} />
      ),
    },
    { id: "reportes", content: <ProjectReports reports={reports} /> },
    { id: "documentos", content: <ProjectDocuments documents={documents} /> },
  ];

  // Conditional, and conditional on the SERVER: no position, no tab.
  if (hasPosition) {
    panels.push({
      id: "mi-inversion",
      content: (
        <ProjectMyInvestment
          position={position}
          contributions={contributions}
          projectCapitalReceived={projectCapitalReceived}
        />
      ),
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={CATALOG_ROUTE}
        className="flex w-fit cursor-pointer items-center gap-2 text-sm text-neutral-400 transition-colors hover:text-zinc-600"
      >
        <ArrowLeftIcon className="size-4" aria-hidden="true" />
        {es.projectDetail.back}
      </Link>

      <ProjectGallery photos={project.main_photos} />

      {/* 2/3 + 1/3. The columns stack under lg, where a sidebar beside the
          content would leave both too narrow to read. */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 flex flex-col gap-6 lg:col-span-8">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-medium text-stone-900">
              {projectTitle(project.type, project.city)}
            </h1>
            <p className="text-2xl text-zinc-500">{subtitle}</p>
          </div>

          <hr className="border-zinc-300" />

          <ProjectTabs panels={panels} />
        </div>

        <aside className="col-span-12 lg:col-span-4">
          {/* Sticky only where there is a column to be sticky in. */}
          <div className="lg:sticky lg:top-6">
            {closedToInvestment ? (
              <div className="flex flex-col gap-3 rounded-[10px] border border-neutral-200 bg-stone-50 p-6">
                <h2 className="text-xl font-medium text-stone-900">
                  {es.projectDetail.closedTitle}
                </h2>
                <p className="text-sm text-zinc-600">
                  {es.projectDetail.closedHint}
                </p>
                <Link
                  href={CATALOG_ROUTE}
                  className="mt-1 flex h-10 w-fit cursor-pointer items-center justify-center rounded-[10px] bg-stone-900 px-5 text-base font-medium text-white transition-opacity hover:opacity-90"
                >
                  {es.projectDetail.closedAction}
                </Link>
              </div>
            ) : (
              <InterestForm projectId={project.id} />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
