import { DollarSignIcon, PieChartIcon, TrendingUpIcon } from "lucide-react";
import { es } from "@/i18n";
import { formatCurrency, formatDate, formatPercent } from "@/lib/format";
import type { TableColumn, TableRow } from "@/lib/table/types";
import { EmptyState } from "@/components/layout/EmptyState";
import { KpiCard } from "@/components/cards/KpiCard";
import { ReadOnlyDataTable } from "@/components/tables/ReadOnlyDataTable";

export type InvestorPositionInProject = {
  /** Capital still working here: contributed − returned (from the SQL view). */
  currentCapital: number;
  contributed: number;
  returnedCapital: number;
  /** Yield ALREADY RECEIVED. Never a projection. */
  yieldReceived: number;
};

export type ProjectContribution = {
  id: string;
  receivedDate: string | null;
  amount: number;
  capitalType: string | null;
  /** Free text, shown verbatim. */
  agreedReturn: string | null;
  term: string | null;
  status: string | null;
};

export type ProjectMyInvestmentProps = {
  position: InvestorPositionInProject;
  contributions: ProjectContribution[];
  /**
   * project_totals.capital_received — the denominator of the share. Null or 0
   * means the share cannot be computed.
   */
  projectCapitalReceived: number | null;
};

const COLUMNS: TableColumn[] = [
  { key: "receivedDate", label: es.projectDetail.myInvestment.columns.date, type: "date" },
  { key: "amount", label: es.projectDetail.myInvestment.columns.amount, type: "currency" },
  { key: "capitalType", label: es.projectDetail.myInvestment.columns.capitalType, type: "select" },
  {
    key: "agreedReturn",
    label: es.projectDetail.myInvestment.columns.agreedReturn,
    type: "text",
    width: 200,
  },
  { key: "status", label: es.projectDetail.myInvestment.columns.status, type: "select" },
];

/**
 * "Mi inversión" — the investor's OWN position in THIS project.
 *
 * Presentational: every figure arrives already computed by the page from
 * investor_project_position and project_totals. Nothing is recalculated here,
 * because those numbers are the product.
 *
 * Two rules from CLAUDE.md are visible in the code:
 *  · `agreedReturn` is rendered EXACTLY as stored. It is free text ("15%
 *    anual", "Participación 8%"), never parsed into a number, never averaged
 *    and never turned into a promise.
 *  · Yield is the yield RECEIVED. No projection of any kind appears here, so
 *    nothing on this panel can be mistaken for money the investor will get.
 *
 * This is the position, not the history: the full movement list lives in
 * /transacciones and is not rebuilt here.
 */
export function ProjectMyInvestment({
  position,
  contributions,
  projectCapitalReceived,
}: ProjectMyInvestmentProps) {
  // Guard against a zero/absent denominator, the same way the accumulated
  // return does elsewhere: "—" means "not measurable", which 0% would misstate.
  const canComputeShare =
    projectCapitalReceived !== null && projectCapitalReceived > 0;
  const sharePct = canComputeShare
    ? (position.currentCapital / projectCapitalReceived) * 100
    : null;

  // Capital was contributed but none of it is working today.
  const isClosed = position.currentCapital <= 0 && position.contributed > 0;

  const rows = contributions as unknown as TableRow[];

  return (
    <div className="flex flex-col gap-6">
      {isClosed ? (
        <p className="rounded-[10px] border border-neutral-200 bg-stone-50 px-4 py-3 text-sm text-zinc-600">
          <span className="font-medium text-stone-900">
            {es.projectDetail.myInvestment.closed}
          </span>{" "}
          {es.projectDetail.myInvestment.closedHint}
        </p>
      ) : null}

      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 sm:col-span-6 xl:col-span-4">
          <KpiCard
            variant="featured"
            title={es.projectDetail.myInvestment.invested}
            value={formatCurrency(position.currentCapital)}
            description={
              isClosed
                ? es.projectDetail.myInvestment.investedClosedHint
                : es.projectDetail.myInvestment.investedHint
            }
            icon={<TrendingUpIcon />}
          />
        </div>

        <div className="col-span-12 sm:col-span-6 xl:col-span-4">
          <KpiCard
            title={es.projectDetail.myInvestment.yield}
            // A zero is shown as zero, not hidden: it is valid information.
            value={formatCurrency(position.yieldReceived)}
            description={
              position.yieldReceived > 0
                ? es.projectDetail.myInvestment.yieldHint
                : es.projectDetail.myInvestment.yieldNone
            }
            icon={<DollarSignIcon />}
          />
        </div>

        <div className="col-span-12 sm:col-span-6 xl:col-span-4">
          <KpiCard
            title={es.projectDetail.myInvestment.share}
            value={
              sharePct === null
                ? es.projectDetail.myInvestment.shareUnavailable
                : formatPercent(sharePct)
            }
            description={
              sharePct === null
                ? es.projectDetail.myInvestment.shareUnavailableHint
                : es.projectDetail.myInvestment.shareHint
            }
            icon={<PieChartIcon />}
          />
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="text-base font-medium text-stone-900">
            {es.projectDetail.myInvestment.contributionsTitle}
          </h3>
          <p className="text-sm text-zinc-500">
            {es.projectDetail.myInvestment.contributionsHint}
          </p>
        </div>

        <ReadOnlyDataTable
          caption={es.projectDetail.myInvestment.tableCaption}
          columns={COLUMNS}
          rows={rows}
          renderCell={(row, column) => {
            if (column.key === "receivedDate") {
              return row.receivedDate ? formatDate(String(row.receivedDate)) : "";
            }
            if (column.key === "capitalType") {
              const value = row.capitalType ? String(row.capitalType) : null;
              return value
                ? (es.projectDetail.myInvestment.capitalType[value] ?? value)
                : "";
            }
            if (column.key === "status") {
              const value = row.status ? String(row.status) : null;
              return value
                ? (es.projectDetail.myInvestment.contributionStatus[value] ?? value)
                : "";
            }
            if (column.key === "agreedReturn") {
              // VERBATIM. Free text that is never normalised (CLAUDE.md).
              return row.agreedReturn ? String(row.agreedReturn) : "—";
            }
            return undefined;
          }}
          emptyState={
            <EmptyState
              icon={<DollarSignIcon />}
              title={es.projectDetail.myInvestment.noContributions}
              hint={es.projectDetail.myInvestment.noContributionsHint}
            />
          }
        />
      </section>
    </div>
  );
}
