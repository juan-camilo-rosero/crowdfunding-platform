import { redirect } from "next/navigation";
// Feather icons (lucide-react is the maintained fork): folder, search.
import { FolderIcon, SearchIcon } from "lucide-react";
import { es } from "@/i18n";
import {
  CATALOG_ROUTE,
  LOGIN_ROUTE,
  MY_INVESTMENTS_ROUTE,
} from "@/lib/auth/routes";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  findProgressRange,
  hasActiveFilters,
  parseCatalogFilters,
} from "@/lib/projects/catalog";
import { EmptyState } from "@/components/layout/EmptyState";
import { PageTitle } from "@/components/layout/PageTitle";
import { ProjectInvestmentCard } from "@/components/cards/ProjectInvestmentCard";
import { ProjectFilterBar } from "@/components/filters/ProjectFilterBar";

/**
 * Positions from which the filter bar starts being shown.
 *
 * The grid is three per row, so six positions are two full rows — everything a
 * typical investor holds, visible at once. Filtering a set you can already take
 * in is friction, not help, so the bar only appears from the seventh position,
 * when a third row starts and scanning stops being instant.
 */
const FILTERS_MIN_POSITIONS = 7;

/**
 * "Mis inversiones" — the dedicated screen.
 *
 * The home shows a preview of the three largest positions; this is the whole
 * set, with filters. It is the private counterpart of the catalogue: same card
 * frame, opposite content. /portafolio sells every project of the group with
 * public figures; here only the projects where the CALLER holds capital appear,
 * each with THEIR position — their capital, the return THEY agreed to — and no
 * fundraising figure, because this screen is about what they already have.
 *
 * Every private figure comes from views restricted by RLS to the caller's own
 * investor rows, and each query is additionally scoped to those ids.
 */
export default async function MyInvestmentsPage({
  searchParams,
}: {
  // Next.js 16: searchParams is async.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    redirect(LOGIN_ROUTE);
  }

  const filters = parseCatalogFilters(await searchParams);
  const isFiltered = hasActiveFilters(filters);

  const supabase = await createClient();

  // The investor rows linked to this user. RLS already restricts this to their
  // own; the ids then scope every other query explicitly.
  const { data: investorRows } = await supabase
    .from("investors")
    .select("id")
    .eq("user_id", profile.id);

  const investorIds = (investorRows ?? []).map((row) => row.id);
  const hasInvestorLink = investorIds.length > 0;

  // Positions with capital still working. A fully returned position is history,
  // not an investment the person currently holds.
  const { data: positionRows } = hasInvestorLink
    ? await supabase
        .from("investor_project_distribution")
        .select("project_id, current_capital")
        .in("investor_id", investorIds)
    : { data: [] };

  // A user may hold several investor rows; their position in a project is the
  // sum across all of them, so the project appears once.
  const capitalByProject = new Map<string, number>();
  for (const row of positionRows ?? []) {
    if (!row.project_id) continue;
    capitalByProject.set(
      row.project_id,
      (capitalByProject.get(row.project_id) ?? 0) +
        Number(row.current_capital ?? 0)
    );
  }

  const heldProjectIds = [...capitalByProject.keys()];

  // Filters narrow the projects, never the positions: the set is already
  // limited to what this investor holds, so an empty result means "none of
  // YOUR projects match", not "no such project exists".
  let projectQuery = supabase
    .from("projects")
    .select("id, name, type, city, status, progress, main_photos")
    .in("id", heldProjectIds);

  if (filters.status) projectQuery = projectQuery.eq("status", filters.status);
  if (filters.city) projectQuery = projectQuery.eq("city", filters.city);
  if (filters.type) projectQuery = projectQuery.eq("type", filters.type);

  const range = findProgressRange(filters.progress);
  if (range) {
    projectQuery = projectQuery
      .gte("progress", range.min)
      .lte("progress", range.max);
  }

  const { data: projectRows } = heldProjectIds.length
    ? await projectQuery
    : { data: [] };

  // The return THIS investor agreed to, per project. Free text, resolved by the
  // card and never recalculated. Scoped to their own contributions, which RLS
  // enforces independently.
  const { data: contractRows } = hasInvestorLink && heldProjectIds.length
    ? await supabase
        .from("capital_contributions")
        .select("project_id, agreed_return")
        .in("investor_id", investorIds)
        .in("project_id", heldProjectIds)
    : { data: [] };

  const returnsByProject = new Map<string, (string | null)[]>();
  for (const row of contractRows ?? []) {
    if (!row.project_id) continue;
    const current = returnsByProject.get(row.project_id) ?? [];
    current.push(row.agreed_return);
    returnsByProject.set(row.project_id, current);
  }

  // Largest position first: the same ordering the home preview uses, so moving
  // between the two screens does not reshuffle the cards.
  const projects = [...(projectRows ?? [])].sort(
    (a, b) =>
      (capitalByProject.get(b.id) ?? 0) - (capitalByProject.get(a.id) ?? 0)
  );

  // The threshold counts everything held, not what survived the filters —
  // otherwise narrowing down to two results would remove the very bar used to
  // get there.
  const showFilters = heldProjectIds.length >= FILTERS_MIN_POSITIONS;
  const hasNoInvestments = heldProjectIds.length === 0;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <PageTitle>{es.myInvestments.title}</PageTitle>
        <p className="max-w-2xl text-base text-zinc-500">
          {es.myInvestments.subtitle}
        </p>
      </div>

      <div className="flex flex-col gap-5">
        {showFilters ? (
          <ProjectFilterBar
            filters={filters}
            countLabel={
              projects.length === 1
                ? es.myInvestments.resultsCountOne
                : es.myInvestments.resultsCount.replace(
                    "{n}",
                    String(projects.length)
                  )
            }
          />
        ) : null}

        {projects.length === 0 ? (
          // Two different silences: nothing invested yet (the catalogue is the
          // way forward) versus a filter combination that matches none of their
          // projects (clearing it is).
          hasNoInvestments ? (
            <EmptyState
              icon={<FolderIcon />}
              title={es.myInvestments.empty}
              hint={es.myInvestments.emptyHint}
              action={{
                href: CATALOG_ROUTE,
                label: es.myInvestments.emptyAction,
              }}
            />
          ) : (
            <EmptyState
              icon={<SearchIcon />}
              title={es.myInvestments.emptyFiltered}
              hint={es.myInvestments.emptyFilteredHint}
              action={
                isFiltered
                  ? {
                      href: MY_INVESTMENTS_ROUTE,
                      label: es.catalog.filters.clear,
                    }
                  : undefined
              }
            />
          )
        ) : (
          // Three per row (col-span-4 of 12). auto-rows-fr makes every card in a
          // row as tall as the tallest, so the "Ver más" buttons line up.
          <div className="grid auto-rows-fr grid-cols-12 gap-5">
            {projects.map((project) => (
              <div
                key={project.id}
                className="col-span-12 sm:col-span-6 xl:col-span-4"
              >
                <ProjectInvestmentCard
                  projectId={project.id}
                  name={project.name}
                  type={project.type}
                  city={project.city}
                  status={project.status}
                  imageUrl={project.main_photos?.[0] ?? null}
                  progress={project.progress}
                  investedAmount={capitalByProject.get(project.id) ?? 0}
                  agreedReturns={returnsByProject.get(project.id) ?? []}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
