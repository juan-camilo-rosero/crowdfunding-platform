import { redirect } from "next/navigation";
// Feather icons (lucide-react is the maintained fork): folder, search.
import { FolderIcon, SearchIcon } from "lucide-react";
import { es } from "@/i18n";
import { CATALOG_ROUTE, LOGIN_ROUTE } from "@/lib/auth/routes";
import {
  getCurrentUserProfile,
  getInvestorIds,
} from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  findProgressRange,
  hasActiveFilters,
  parseCatalogFilters,
  sortCatalogProjects,
} from "@/lib/projects/catalog";
import { CLOSED_PROJECT_STATUSES } from "@/lib/projects/enums";
import { EmptyState } from "@/components/layout/EmptyState";
import { PageTitle } from "@/components/layout/PageTitle";
import { CatalogProjectCard } from "@/components/cards/CatalogProjectCard";
import { ProjectFilterBar } from "@/components/filters/ProjectFilterBar";

/** Upper bound for one page of the catalogue; the group is far from this. */
const CATALOG_LIMIT = 200;

/**
 * Catalogue — "Portafolio Investors 180 Group".
 *
 * The group's showcase: every project, whoever is looking. It is the one
 * investor screen open to a user with no investor link at all (proxy.ts lists
 * it among the catalogue routes), so everything it renders must be PUBLIC:
 * `projects` columns, which projects_select_all exposes to any authenticated
 * user, plus project_fundraising, an aggregate with no investor dimension.
 *
 * The single caller-specific query is the set of projects the CALLER holds, used
 * only to mark their own cards. It is scoped to their own investor ids and runs
 * against a security_invoker view, so it can never surface anybody else's
 * position — and it is skipped entirely for a user with no link.
 */
export default async function CatalogPage({
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

  let query = supabase
    .from("projects")
    .select(
      "id, name, type, city, status, progress, in_fundraising, fundraising_goal, offered_return, main_photos"
    )
    .limit(CATALOG_LIMIT);

  if (filters.status) {
    query = query.eq("status", filters.status);
  } else {
    // Default view: what an investor can still act on. Closed projects are not
    // hidden for good — asking for them by status brings them back, and they
    // are worth showing as track record.
    // A project with no status yet is not closed, so it stays listed.
    query = query.or(
      `status.is.null,status.not.in.(${CLOSED_PROJECT_STATUSES.join(",")})`
    );
  }

  if (filters.city) query = query.eq("city", filters.city);
  if (filters.type) query = query.eq("type", filters.type);

  const range = findProgressRange(filters.progress);
  if (range) {
    // A project with no progress recorded belongs to no bucket: gte/lte already
    // drop NULLs, which is the honest reading of "unknown".
    query = query.gte("progress", range.min).lte("progress", range.max);
  }

  const { data: projectRows, error } = await query;
  const projects = sortCatalogProjects(projectRows ?? []);

  // Raised capital per project. project_totals cannot be used here: it is
  // security_invoker, so it would only count the contributions THIS user may
  // read — zero for a visitor. project_fundraising is the public aggregate.
  const projectIds = projects.map((project) => project.id);
  const { data: fundraisingRows } = projectIds.length
    ? await supabase
        .from("project_fundraising")
        .select("project_id, capital_raised")
        .in("project_id", projectIds)
    : { data: [] };

  const raisedByProject = new Map(
    (fundraisingRows ?? []).map((row) => [
      row.project_id,
      Number(row.capital_raised ?? 0),
    ])
  );
  // One cached read per request, shared with the layout's sidebar check.
  const investorIds = await getInvestorIds();

  const { data: ownPositions } = investorIds.length && projectIds.length
    ? await supabase
        .from("investor_project_distribution")
        .select("project_id")
        .in("investor_id", investorIds)
        .in("project_id", projectIds)
    : { data: [] };

  const investedProjectIds = new Set(
    (ownPositions ?? [])
      .map((row) => row.project_id)
      .filter((id): id is string => !!id)
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <PageTitle>{es.catalog.title}</PageTitle>
        <p className="max-w-2xl text-base text-zinc-500">
          {es.catalog.subtitle}
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-base text-destructive">
          {es.admin.loadError}
        </p>
      ) : null}

      <div className="flex flex-col gap-5">
        <ProjectFilterBar
          filters={filters}
          countLabel={
            projects.length === 1
              ? es.catalog.resultsCountOne
              : es.catalog.resultsCount.replace("{n}", String(projects.length))
          }
        />

        {projects.length === 0 ? (
          <EmptyCatalog isFiltered={isFiltered} />
        ) : (
          // Three per row (col-span-4 of 12). auto-rows-fr makes every card in a
          // row as tall as the tallest, so the "Ver más" buttons line up.
          <div className="grid auto-rows-fr grid-cols-12 gap-5">
            {projects.map((project) => (
              <div
                key={project.id}
                className="col-span-12 sm:col-span-6 xl:col-span-4"
              >
                <CatalogProjectCard
                  projectId={project.id}
                  name={project.name}
                  type={project.type}
                  city={project.city}
                  status={project.status}
                  imageUrl={project.main_photos?.[0] ?? null}
                  fundraisingGoal={project.fundraising_goal}
                  capitalRaised={raisedByProject.get(project.id) ?? 0}
                  offeredReturn={project.offered_return}
                  isInvested={investedProjectIds.has(project.id)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Two different silences: a filter combination that matches nothing (the user
 * can fix it) and a portfolio with no projects at all (they cannot).
 */
function EmptyCatalog({ isFiltered }: { isFiltered: boolean }) {
  return (
    <EmptyState
      icon={isFiltered ? <SearchIcon /> : <FolderIcon />}
      title={isFiltered ? es.catalog.emptyFiltered : es.catalog.empty}
      hint={isFiltered ? es.catalog.emptyFilteredHint : es.catalog.emptyHint}
      // The way out is offered here too, not only up in the filter bar: this is
      // where the user is looking when nothing came back. With no filters on
      // there is nothing to clear, so no action is offered.
      action={
        isFiltered
          ? { href: CATALOG_ROUTE, label: es.catalog.filters.clear }
          : undefined
      }
    />
  );
}
