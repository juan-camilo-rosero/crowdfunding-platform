import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { es } from "@/i18n";
import { formatCurrency } from "@/lib/format";
import { INVESTOR_HOME_ROUTE, LOGIN_ROUTE } from "@/lib/auth/routes";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { projectStatusLabel, projectTitle } from "@/lib/projects/labels";
import { PageTitle } from "@/components/layout/PageTitle";

/**
 * Project detail.
 *
 * SCAFFOLDING: the data layer and routing are final, the layout is not — the
 * designed screen (hero gallery, tabs for resumen/avance/reportes/documentos,
 * see views.md) comes later. What is already correct here is what it loads and
 * who is allowed to see it.
 *
 * Access follows the catalogue rule: any onboarded user may open a project
 * (proxy.ts lists /proyecto under the catalogue paths), but the "your
 * investment" block only appears when the caller actually holds a position.
 * That block reads investor_project_position, whose RLS restricts rows to the
 * caller's own investor ids, so another investor's numbers can never surface
 * here even by guessing the URL.
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

  const { data: investorRows } = await supabase
    .from("investors")
    .select("id")
    .eq("user_id", profile.id);

  const investorIds = (investorRows ?? []).map((row) => row.id);

  const { data: positions } = investorIds.length
    ? await supabase
        .from("investor_project_position")
        .select("contributed, returned_capital, yield_received, current_capital")
        .eq("project_id", id)
        .in("investor_id", investorIds)
    : { data: [] };

  // A user may hold several investor rows; their position here is the sum.
  const position = (positions ?? []).reduce(
    (totals, row) => ({
      contributed: totals.contributed + Number(row.contributed ?? 0),
      returned: totals.returned + Number(row.returned_capital ?? 0),
      yield: totals.yield + Number(row.yield_received ?? 0),
      current: totals.current + Number(row.current_capital ?? 0),
    }),
    { contributed: 0, returned: 0, yield: 0, current: 0 }
  );

  const hasPosition = (positions ?? []).length > 0;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <PageTitle>{project.name}</PageTitle>
        <p className="text-sm text-zinc-500">
          {projectTitle(project.type, project.city)}
          {project.status ? ` · ${projectStatusLabel(project.status)}` : ""}
        </p>
      </div>

      <p className="rounded-[10px] border border-neutral-200 bg-stone-50 px-6 py-4 text-sm text-zinc-500">
        {es.projectDetail.notice}
      </p>

      <section className="flex flex-col gap-5 rounded-[10px] border border-neutral-200 bg-stone-50 p-6">
        <h2 className="text-base font-medium text-stone-900">
          {es.projectDetail.yourInvestment}
        </h2>

        {hasPosition ? (
          <dl className="grid grid-cols-12 gap-5">
            {[
              { label: es.projectDetail.currentCapital, value: position.current },
              { label: es.projectDetail.contributed, value: position.contributed },
              { label: es.projectDetail.returned, value: position.returned },
              { label: es.projectDetail.yield, value: position.yield },
            ].map((item) => (
              <div
                key={item.label}
                className="col-span-12 sm:col-span-6 xl:col-span-3"
              >
                <dt className="text-xs text-zinc-500">{item.label}</dt>
                <dd className="text-2xl font-medium text-stone-900">
                  {formatCurrency(item.value)}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-zinc-500">{es.projectDetail.noPosition}</p>
        )}
      </section>

      <Link
        href={INVESTOR_HOME_ROUTE}
        className="w-fit cursor-pointer text-sm font-medium text-zinc-600 underline underline-offset-4"
      >
        {es.projectDetail.backToHome}
      </Link>
    </div>
  );
}
