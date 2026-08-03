import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRightIcon,
  BuildingIcon,
  DollarSignIcon,
  FolderOpenIcon,
  PercentIcon,
  PieChartIcon,
  TrendingUpIcon,
} from "lucide-react";
import { es } from "@/i18n";
import { formatCurrency, formatDate, formatPercent } from "@/lib/format";
import {
  CATALOG_ROUTE,
  LOGIN_ROUTE,
  MY_INVESTMENTS_ROUTE,
} from "@/lib/auth/routes";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/layout/EmptyState";
import { PageTitle } from "@/components/layout/PageTitle";
import { KpiCard } from "@/components/cards/KpiCard";
import { ProjectInvestmentCard } from "@/components/cards/ProjectInvestmentCard";
import {
  ContributionTimeline,
  type TimelineEntry,
} from "@/components/cards/ContributionTimeline";
import {
  CapitalDonutChart,
  type DonutSegment,
} from "@/components/charts/CapitalDonutChart";

/** How many contributions to pull; the list scrolls past the first few. */
const CONTRIBUTIONS_LIMIT = 20;

/**
 * Positions shown in the home's preview. Three fills exactly one row of the
 * grid (three per row on desktop), which is why the threshold is three rather
 * than an arbitrary number: a fourth card would open a second, nearly empty row
 * and turn the preview back into the full list it is meant not to be.
 */
const HOME_INVESTMENTS_PREVIEW = 3;

function fill(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, value),
    template
  );
}

/**
 * Investor home.
 *
 * Every figure comes from the SQL views (investor_financial_summary,
 * investor_project_distribution) — nothing is aggregated in the client. RLS on
 * those views already limits the rows to the authenticated investor, and the
 * queries filter by their investor ids as a second barrier.
 */
export default async function HomePage() {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    redirect(LOGIN_ROUTE);
  }

  const supabase = await createClient();

  // The investor rows linked to this user. RLS already restricts this to their
  // own; the ids are then used to scope every other query explicitly.
  const { data: investorRows } = await supabase
    .from("investors")
    .select("id")
    .eq("user_id", profile.id);

  const investorIds = (investorRows ?? []).map((row) => row.id);
  const hasInvestorLink = investorIds.length > 0;

  const [summaryResult, distributionResult, contributionsResult] =
    await Promise.all([
      hasInvestorLink
        ? supabase
            .from("investor_financial_summary")
            .select("*")
            .in("investor_id", investorIds)
        : Promise.resolve({ data: [] }),
      hasInvestorLink
        ? supabase
            .from("investor_project_distribution")
            .select("project_id, current_capital")
            .in("investor_id", investorIds)
        : Promise.resolve({ data: [] }),
      hasInvestorLink
        ? supabase
            .from("transactions")
            .select("id, amount, date, project_id")
            .in("investor_id", investorIds)
            .eq("type", "aporte")
            .order("date", { ascending: false })
            .limit(CONTRIBUTIONS_LIMIT)
        : Promise.resolve({ data: [] }),
    ]);

  // A user can hold more than one investor row; the home screen shows them as
  // a single portfolio, so the summaries are added up.
  const summaries = summaryResult.data ?? [];
  const currentCapital = summaries.reduce(
    (sum, row) => sum + Number(row.current_capital ?? 0),
    0
  );
  const yieldReceived = summaries.reduce(
    (sum, row) => sum + Number(row.yield_received ?? 0),
    0
  );
  const activeProjects = summaries.reduce(
    (sum, row) => sum + Number(row.active_projects_count ?? 0),
    0
  );
  // NULL means "nothing liquidated yet", which must not read as 0%.
  const returnValues = summaries
    .map((row) => row.accumulated_return_pct)
    .filter((value): value is number => value !== null && value !== undefined);
  const accumulatedReturn =
    returnValues.length > 0
      ? returnValues.reduce((sum, value) => sum + Number(value), 0) /
        returnValues.length
      : null;

  // Project names for the donut legend and the contributions timeline.
  const distributionRows = distributionResult.data ?? [];
  const contributionRows = contributionsResult.data ?? [];
  const projectIds = [
    ...new Set(
      [...distributionRows, ...contributionRows]
        .map((row) => row.project_id)
        .filter((id): id is string => !!id)
    ),
  ];

  const { data: projectRows } = projectIds.length
    ? await supabase
        .from("projects")
        .select("id, name, type, city, status, main_photos, progress")
        .in("id", projectIds)
    : { data: [] };

  // The agreed returns of THIS investor's contributions, for the position
  // cards. No fundraising figure is needed: the personal-position card reports
  // work progress, which travels on the project row itself.
  const investedProjectIds = distributionRows
    .map((row) => row.project_id)
    .filter((id): id is string => !!id);

  const contractsResult =
    hasInvestorLink && investedProjectIds.length
      ? await supabase
          .from("capital_contributions")
          .select("project_id, agreed_return")
          .in("investor_id", investorIds)
          .in("project_id", investedProjectIds)
      : { data: [] };

  const returnsByProject = new Map<string, (string | null)[]>();
  for (const row of contractsResult.data ?? []) {
    if (!row.project_id) continue;
    const current = returnsByProject.get(row.project_id) ?? [];
    current.push(row.agreed_return);
    returnsByProject.set(row.project_id, current);
  }

  const projectsById = new Map(
    (projectRows ?? []).map((project) => [project.id, project])
  );

  const segments: DonutSegment[] = distributionRows
    .filter((row) => row.project_id)
    .map((row) => ({
      id: row.project_id as string,
      label: projectsById.get(row.project_id as string)?.name ?? "—",
      value: Number(row.current_capital ?? 0),
    }));

  /**
   * The home shows a PREVIEW of the positions, not the whole list — that is
   * what /mis-inversiones is for, and repeating it here would make the two
   * screens the same screen.
   *
   * Which ones: the largest by current capital. On a screen whose job is the
   * general picture, the positions that move the portfolio are the ones worth
   * the space; "most recent" would surface a $500 contribution over a $50.000
   * one. The donut right above is ordered by the same figure, so the preview
   * reads as its top slices rather than an unrelated pick.
   *
   * Sorted on a copy: `segments` feeds the donut and must keep its own order.
   */
  const previewSegments = [...segments]
    .sort((a, b) => b.value - a.value)
    .slice(0, HOME_INVESTMENTS_PREVIEW);

  // Below the threshold the preview IS the full list, so the link to the full
  // screen would promise nothing new.
  const hasMoreInvestments = segments.length > HOME_INVESTMENTS_PREVIEW;

  const timelineEntries: TimelineEntry[] = contributionRows.map((row) => ({
    id: row.id,
    heading: formatDate(row.date),
    detail: fill(es.home.contributions.item, {
      amount: formatCurrency(Number(row.amount ?? 0)),
      project: projectsById.get(row.project_id ?? "")?.name ?? "—",
    }),
  }));

  const investedDescription =
    activeProjects === 0
      ? es.home.kpi.investedNone
      : activeProjects === 1
        ? es.home.kpi.investedInOne
        : fill(es.home.kpi.investedIn, { n: String(activeProjects) });

  const projectsValue =
    activeProjects === 0
      ? es.home.kpi.projectsNone
      : activeProjects === 1
        ? es.home.kpi.projectsActiveOne
        : fill(es.home.kpi.projectsActive, { n: String(activeProjects) });

  return (
    // gap-8 separates the title from the content.
    <div className="flex flex-col gap-8">
      <PageTitle>{es.home.title}</PageTitle>

      {/*
        12-column grid: 12 divides evenly by 4, 3 and 2, so any block can take
        an exact quarter (col-span-3), third (col-span-4) or half (col-span-6)
        of the content width. Cards never carry their own width.

        Spacing is gap-5 rather than the dashboard's usual gap-6: these tiles
        are small and read better tighter together.
      */}
      <div className="flex flex-col gap-5">
        {/* Row 1 — four quarters. */}
        <div className="grid grid-cols-12 gap-5">
          <div className="col-span-12 sm:col-span-6 xl:col-span-3">
            <KpiCard
              variant="featured"
              title={es.home.kpi.invested}
              value={formatCurrency(currentCapital)}
              description={investedDescription}
              icon={<TrendingUpIcon />}
            />
          </div>
          <div className="col-span-12 sm:col-span-6 xl:col-span-3">
            <KpiCard
              title={es.home.kpi.yield}
              value={formatCurrency(yieldReceived)}
              description={
                yieldReceived > 0 ? es.home.kpi.yieldFrom : es.home.kpi.yieldNone
              }
              icon={<DollarSignIcon />}
            />
          </div>
          <div className="col-span-12 sm:col-span-6 xl:col-span-3">
            <KpiCard
              title={es.home.kpi.returnPct}
              value={
                accumulatedReturn === null
                  ? es.home.kpi.returnEmpty
                  : `+${formatPercent(accumulatedReturn)}`
              }
              description={es.home.kpi.returnFrom}
              icon={<PercentIcon />}
            />
          </div>
          <div className="col-span-12 sm:col-span-6 xl:col-span-3">
            <KpiCard
              title={es.home.kpi.projects}
              value={projectsValue}
              description={activeProjects === 0 ? es.home.kpi.projectsEmptyHint : es.home.kpi.projectsHint}
              icon={<BuildingIcon />}
            />
          </div>
        </div>

        {/*
          Row 2 — two halves. Both cards share one fixed height on desktop: the
          chart sets the reference and the contributions list scrolls inside
          whatever is left, instead of stretching the row.
        */}
        <div className="grid grid-cols-12 gap-5 lg:h-56">
          <section className="col-span-12 flex flex-col rounded-[10px] border border-neutral-200 bg-stone-50 p-6 lg:col-span-6">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-sm font-medium text-zinc-500">
                {es.home.distribution.title}
              </h2>
              <span
                aria-hidden="true"
                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 [&_svg]:size-4"
              >
                <PieChartIcon />
              </span>
            </div>

            <CapitalDonutChart
              className="mt-6"
              segments={segments}
              centerValue={formatCurrency(currentCapital)}
              centerLabel={es.home.distribution.centerLabel}
              emptyState={
                <div className="py-10 text-center">
                  <p className="text-sm font-medium text-zinc-600">
                    {es.home.distribution.empty}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {es.home.distribution.emptyHint}
                  </p>
                </div>
              }
            />
          </section>

          {/* Small bottom padding on purpose: with a full p-6 the list stopped
              well short of the card edge and looked finished rather than
              scrollable. Now the next entry is clipped at the boundary, which
              is what signals there is more. */}
          <section className="col-span-12 flex min-h-0 flex-col rounded-[10px] border border-neutral-200 bg-stone-50 px-6 pt-6 pb-2 lg:col-span-6">
            <h2 className="shrink-0 text-sm font-medium text-zinc-500">
              {es.home.contributions.title}
            </h2>

            {/* min-h-0 lets the list shrink below its content so it scrolls
                instead of pushing the card taller. */}
            <ContributionTimeline
              className="mt-6 min-h-0 flex-1 overflow-y-auto pr-1 max-lg:max-h-64"
              entries={timelineEntries}
              emptyState={
                <div className="py-10 text-center">
                  <p className="text-sm font-medium text-zinc-600">
                    {es.home.contributions.empty}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {es.home.contributions.emptyHint}
                  </p>
                </div>
              }
            />
          </section>
        </div>

        {/* Row 3 — "Mis inversiones": a PREVIEW of the positions, three per row
            (col-span-4 of 12). The full list lives in /mis-inversiones. */}
        <section className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-2xl font-medium text-zinc-600">
              {es.myInvestments.title}
            </h2>

            {/* In the header rather than under the cards: it stays reachable
                without scrolling past the preview, and it never appears when
                the preview already shows everything. */}
            {hasMoreInvestments ? (
              <Link
                href={MY_INVESTMENTS_ROUTE}
                className="flex cursor-pointer items-center gap-1 text-sm font-medium text-zinc-600 hover:text-stone-900"
              >
                {es.myInvestments.seeAll}
                <ArrowRightIcon className="size-4" aria-hidden="true" />
              </Link>
            ) : null}
          </div>

          {segments.length === 0 ? (
            <EmptyState
              icon={<FolderOpenIcon />}
              title={es.myInvestments.empty}
              hint={es.myInvestments.emptyHint}
              action={{
                href: CATALOG_ROUTE,
                label: es.myInvestments.emptyAction,
              }}
            />
          ) : (
            <div className="grid auto-rows-fr grid-cols-12 gap-5">
              {previewSegments.map((segment) => {
                const project = projectsById.get(segment.id);
                return (
                  <div
                    key={segment.id}
                    className="col-span-12 sm:col-span-6 xl:col-span-4"
                  >
                    <ProjectInvestmentCard
                      projectId={segment.id}
                      name={project?.name ?? es.projects.untitled}
                      type={project?.type ?? null}
                      city={project?.city ?? null}
                      status={project?.status ?? null}
                      imageUrl={project?.main_photos?.[0] ?? null}
                      progress={project?.progress ?? null}
                      investedAmount={segment.value}
                      agreedReturns={returnsByProject.get(segment.id) ?? []}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
