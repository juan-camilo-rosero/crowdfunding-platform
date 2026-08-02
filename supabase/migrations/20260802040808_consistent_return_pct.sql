-- =============================================================================
-- Fix: make accumulated_return_pct internally CONSISTENT.
--
-- Before, the ratio mixed two different sets of projects:
--     numerator   = ALL yield received (open projects included)
--     denominator = capital contributed to CLOSED positions only
-- so an open project that had already paid yield pushed the percentage up
-- without adding anything to the denominator. On an investment dashboard an
-- inflated return is a trust problem, not a rounding detail.
--
-- Now both sides describe exactly the SAME set of projects: the positions that
-- have been fully liquidated.
--
--   accumulated_return_pct = yield received FROM CLOSED positions
--                            / capital contributed TO THOSE SAME positions
--
--   Reads as: "of what has already been fully liquidated, this was your real
--   return." A project still open never moves this number — neither its capital
--   nor its yield take part.
--
--   CLOSED POSITION (unchanged): the investor got back at least everything they
--   put into that project — contributed > 0 and returned_capital >= contributed.
--
--   With no closed position the denominator is 0 and NULLIF yields NULL, which
--   means "not measurable yet" rather than a misleading 0%.
--
-- `yield_received` is deliberately left ALONE: it is the total yield actually
-- received, open projects included, because that is real money the investor
-- got and it has its own card on the home screen. Only the PERCENTAGE changes.
--
-- Only this view is touched; investor_project_position and
-- investor_project_distribution stay as they are.
-- =============================================================================

create or replace view public.investor_financial_summary
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
  -- TOTAL yield received, open projects included. Unchanged on purpose.
  coalesce(sum(p.yield_received), 0)   as yield_received,
  count(distinct p.project_id) filter (where p.current_capital > 0) as active_projects_count,
  -- Both sides filtered by the SAME condition: closed positions only.
  round(
    coalesce(
      sum(p.yield_received) filter (
        where p.contributed > 0 and p.returned_capital >= p.contributed
      ),
      0
    ) * 100
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
  'Home screen figures per investor. accumulated_return_pct = yield from fully liquidated positions / capital contributed to those same positions; NULL when nothing has been liquidated yet. yield_received is the total received, open projects included.';
