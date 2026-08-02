-- =============================================================================
-- Financial aggregation per investor, for the home screen (views.md).
--
-- Everything here is CALCULATED from movements that ALREADY happened
-- (public.transactions). Nothing is captured by hand and no projected yield of
-- an open project is ever included — only real transactions.
--
-- Yield and capital return stay in SEPARATE columns and are never added
-- together (CLAUDE.md, business rules).
--
-- All three views use security_invoker = true, so they run with the caller's
-- privileges and the RLS of the base tables keeps applying: an investor only
-- ever sees their own rows, an admin sees everything.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Base view: one row per (investor, project) position.
--
-- Includes CLOSED and EMPTY positions, which the summary needs to work out the
-- liquidated capital; the distribution view filters them out afterwards.
--
-- REASSIGNMENTS — agreed criterion:
--   `transactions` only has one project_id per row, so it cannot express a
--   movement between two projects on its own. The source/destination pair is
--   taken from public.reassignment_requests with status = 'aprobada':
--     + amount for to_project_id   (capital arrives)
--     - amount for from_project_id (capital leaves)
--   No existing table was modified to support this.
--
--   A reassignment moves capital BETWEEN projects of the same investor, so it
--   nets to zero at investor level: it changes the distribution, never the
--   totals.
-- -----------------------------------------------------------------------------
create view public.investor_project_position
with (security_invoker = true) as
with movements as (
  select
    t.investor_id,
    t.project_id,
    coalesce(sum(t.amount) filter (where t.type = 'aporte'), 0) as contributed,
    coalesce(sum(t.amount) filter (where t.type = 'devolución de capital'), 0) as returned_capital,
    coalesce(sum(t.amount) filter (where t.type = 'rendimiento'), 0) as yield_received
  from public.transactions t
  where t.investor_id is not null
    and t.project_id is not null
  group by t.investor_id, t.project_id
),
reassignments as (
  select
    investor_id,
    project_id,
    sum(delta) as net_reassigned
  from (
    select investor_id, to_project_id as project_id, amount as delta
      from public.reassignment_requests
      where status = 'aprobada' and to_project_id is not null
    union all
    select investor_id, from_project_id as project_id, -amount as delta
      from public.reassignment_requests
      where status = 'aprobada' and from_project_id is not null
  ) moves
  where investor_id is not null
  group by investor_id, project_id
)
select
  coalesce(m.investor_id, r.investor_id) as investor_id,
  coalesce(m.project_id, r.project_id)   as project_id,
  -- Historic totals for this position.
  coalesce(m.contributed, 0)             as contributed,
  coalesce(m.returned_capital, 0)        as returned_capital,
  coalesce(m.yield_received, 0)          as yield_received,
  -- CURRENT capital: what is still working in this project today, as opposed to
  -- the historic `contributed`.
  coalesce(m.contributed, 0)
    - coalesce(m.returned_capital, 0)
    + coalesce(r.net_reassigned, 0)      as current_capital
from movements m
-- FULL OUTER: a project can receive capital purely through a reassignment and
-- therefore have no `aporte` row of its own.
full outer join reassignments r
  on r.investor_id = m.investor_id
 and r.project_id  = m.project_id;

comment on view public.investor_project_position is
  'Base positions per investor and project. current_capital = contributed - returned + net reassignments. Includes closed positions.';


-- -----------------------------------------------------------------------------
-- Capital currently working, per investor and project. Feeds the home donut.
-- Positions with no capital left are excluded (0 or negative).
-- -----------------------------------------------------------------------------
create view public.investor_project_distribution
with (security_invoker = true) as
select
  investor_id,
  project_id,
  current_capital
from public.investor_project_position
where current_capital > 0;

comment on view public.investor_project_distribution is
  'Current capital per investor and project, excluding positions at zero. For the home donut chart.';


-- -----------------------------------------------------------------------------
-- One row per investor with the home screen figures.
--
-- LIQUIDATED CAPITAL — agreed criterion:
--   The denominator of accumulated_return_pct is what the investor contributed
--   to positions ALREADY CLOSED, meaning projects where they got back at least
--   everything they put in (returned_capital >= contributed, contributed > 0).
--   It answers "what did the capital that already completed its cycle yield?".
--
--   Two consequences, on purpose:
--     · A partially returned position does NOT count yet: it is still open.
--     · The numerator is the TOTAL yield received, including yield from open
--       projects, so the percentage can read high while a position that already
--       paid yield has not been closed yet.
--
--   With no closed position the denominator is 0, and NULLIF turns the result
--   into NULL instead of raising a division-by-zero. NULL is deliberate: it
--   means "not measurable yet", which the UI can render as "—" rather than a
--   misleading 0%.
-- -----------------------------------------------------------------------------
create view public.investor_financial_summary
with (security_invoker = true) as
select
  i.id as investor_id,
  -- Historic: everything ever contributed.
  coalesce(sum(p.contributed), 0)      as total_contributed,
  -- Currently working = contributed - returned. Reassignments cancel out here
  -- because they only move capital between this investor's own projects.
  coalesce(sum(p.contributed), 0)
    - coalesce(sum(p.returned_capital), 0) as current_capital,
  -- Kept apart from yield_received, always.
  coalesce(sum(p.returned_capital), 0) as capital_returned,
  coalesce(sum(p.yield_received), 0)   as yield_received,
  count(distinct p.project_id) filter (where p.current_capital > 0) as active_projects_count,
  round(
    coalesce(sum(p.yield_received), 0) * 100
    / nullif(
        sum(p.contributed) filter (
          where p.contributed > 0 and p.returned_capital >= p.contributed
        ),
        0
      ),
    2
  ) as accumulated_return_pct
from public.investors i
-- LEFT JOIN so an investor with no movements shows zeros instead of vanishing.
left join public.investor_project_position p on p.investor_id = i.id
group by i.id;

comment on view public.investor_financial_summary is
  'Home screen figures per investor. accumulated_return_pct = yield / capital contributed to already-closed positions; NULL when nothing has been liquidated yet.';
