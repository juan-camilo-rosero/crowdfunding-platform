create view public.project_totals
with (security_invoker = true) as
select
  p.id as project_id,
  coalesce(sum(cc.amount_received), 0) as capital_received,
  p.capital_required - coalesce(sum(cc.amount_received), 0) as capital_pending,
  (select coalesce(sum(b.actual_spent),0) from public.budget_items b where b.project_id = p.id) as executed_budget
from public.projects p
left join public.capital_contributions cc on cc.project_id = p.id
group by p.id, p.capital_required;

create view public.investor_totals
with (security_invoker = true) as
select
  i.id as investor_id,
  coalesce(sum(cc.amount_committed), 0) as total_committed,
  coalesce(sum(cc.amount_received), 0) as total_received
from public.investors i
left join public.capital_contributions cc on cc.investor_id = i.id
group by i.id;
