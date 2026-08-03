-- Public catalogue fields.
--
-- The catalogue (/portafolio) is a showcase: it is browsed by users who hold no
-- position at all, so everything it renders must be readable without any
-- investor link. Two pieces were missing for that.

-- 1. The return the PROJECT offers publicly, to attract capital.
--
-- This is NOT capital_contributions.agreed_return. That column is the return an
-- individual investor actually agreed to, it lives per contribution, and RLS
-- restricts it to its own investor — a visitor browsing the catalogue would see
-- nothing. The two must not be conflated:
--   · projects.offered_return              → marketing, public, shown in /portafolio
--   · capital_contributions.agreed_return  → contractual, private, shown in /mis-inversiones
--
-- Free text on purpose, like agreed_return: "Hasta 12% anual", "12–15% anual",
-- "Participación desde 8%". It is never parsed, averaged or recalculated.
-- No RLS change is needed: projects_select_all already lets any authenticated
-- user read every column of the table.
alter table public.projects
  add column if not exists offered_return text;

comment on column public.projects.offered_return is
  'Public marketing return offered by the project (free text). Distinct from capital_contributions.agreed_return, which is the private per-investor agreed return.';

-- 2. Capital raised per project, readable by anyone authenticated.
--
-- project_totals cannot serve the catalogue: it is security_invoker, so it
-- aggregates only the capital_contributions rows the CALLER may read. A visitor
-- gets 0 for every project and an investor gets their own contribution counted
-- as the whole project's progress — a wrong number on a sales screen.
--
-- This view deliberately runs with the owner's rights (no security_invoker), so
-- the sum spans every contribution. What it exposes is only the project-level
-- total, which is precisely the public "raised / goal" figure the progress bar
-- is meant to show. There is no investor dimension in the output: no identity,
-- no per-investor amount and no way to attribute the total to anyone.
create or replace view public.project_fundraising as
select
  p.id as project_id,
  coalesce(sum(cc.amount_received), 0)::numeric(14, 2) as capital_raised
from public.projects p
left join public.capital_contributions cc on cc.project_id = p.id
group by p.id;

comment on view public.project_fundraising is
  'Project-level capital raised, owner-rights on purpose so the catalogue shows the real total to any authenticated user. Aggregate only: exposes no investor identity or per-investor amount.';

revoke all on public.project_fundraising from anon, authenticated;
grant select on public.project_fundraising to authenticated;
