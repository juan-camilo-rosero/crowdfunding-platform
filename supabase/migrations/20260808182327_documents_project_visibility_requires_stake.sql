-- A "proyecto" document is for the investors OF that project, not for everyone.
--
-- THE HOLE: documents_select admitted `visibility in ('proyecto','público')`
-- for any authenticated user. So every deed, survey, budget and operating
-- agreement of EVERY project was readable by anyone with an account —
-- including someone with no capital anywhere. views.md is explicit that an
-- investor sees only what is theirs; the policy did not implement that.
--
-- THE RULE NOW:
--   público   → any authenticated user. That is what the value is for, and it
--               is the escape hatch for anything meant to attract investors.
--   proyecto  → only someone who holds a stake in THAT project.
--   privado   → only the investor it belongs to (unchanged).
--   admin     → everything (unchanged).
--
-- "Holds a stake" is deliberately generous: a registered contribution OR a
-- movement. Someone whose capital is contracted but not yet moved is already
-- an investor in that project and should read its papers.

create or replace function public.has_project_stake(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.capital_contributions cc
    join public.investors i on i.id = cc.investor_id
    where cc.project_id = p_project_id
      and i.user_id = (select auth.uid())
  ) or exists (
    select 1
    from public.transactions t
    join public.investors i on i.id = t.investor_id
    where t.project_id = p_project_id
      and i.user_id = (select auth.uid())
  );
$$;

comment on function public.has_project_stake(uuid) is
  'True when the CURRENT user holds a stake in the given project, through a capital contribution or a transaction. SECURITY DEFINER so the check does not depend on the caller''s own RLS over those tables; it always resolves auth.uid() itself and cannot be pointed at somebody else.';

-- SECURITY DEFINER: only ever callable about oneself, so it is safe to expose.
revoke all on function public.has_project_stake(uuid) from public, anon;
grant execute on function public.has_project_stake(uuid) to authenticated;

alter policy "documents_select" on public.documents
  using (
    public.is_admin()
    or visibility = 'público'
    or (
      visibility = 'proyecto'
      and project_id is not null
      and public.has_project_stake(project_id)
    )
    or investor_id in (
      select id from public.investors where user_id = (select auth.uid())
    )
  );

comment on policy "documents_select" on public.documents is
  'público: any authenticated user. proyecto: only someone holding a stake in that project. privado: only the investor it belongs to. Admins see everything. The storage policy on the documents bucket defers to this, so tightening here tightens downloads too.';
