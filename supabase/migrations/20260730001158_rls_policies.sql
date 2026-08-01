create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.users
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

alter table public.users enable row level security;
alter table public.projects enable row level security;
alter table public.investors enable row level security;
alter table public.capital_contributions enable row level security;
alter table public.transactions enable row level security;
alter table public.budget_items enable row level security;
alter table public.tasks enable row level security;
alter table public.monthly_reports enable row level security;
alter table public.documents enable row level security;
alter table public.reassignment_requests enable row level security;
alter table public.investment_interests enable row level security;
alter table public.identity_verifications enable row level security;

create policy "users_select_own" on public.users
  for select to authenticated
  using ( (select auth.uid()) = id or public.is_admin() );
create policy "users_update_own" on public.users
  for update to authenticated
  using ( (select auth.uid()) = id )
  with check ( (select auth.uid()) = id );

create policy "projects_select_all" on public.projects
  for select to authenticated
  using ( true );
create policy "projects_admin_write" on public.projects
  for all to authenticated
  using ( public.is_admin() )
  with check ( public.is_admin() );

create policy "investors_select_own" on public.investors
  for select to authenticated
  using ( user_id = (select auth.uid()) or public.is_admin() );
create policy "investors_admin_write" on public.investors
  for all to authenticated
  using ( public.is_admin() )
  with check ( public.is_admin() );

create policy "capital_select_own" on public.capital_contributions
  for select to authenticated
  using (
    public.is_admin() or investor_id in (
      select id from public.investors where user_id = (select auth.uid())
    )
  );
create policy "capital_admin_write" on public.capital_contributions
  for all to authenticated
  using ( public.is_admin() ) with check ( public.is_admin() );

create policy "transactions_select_own" on public.transactions
  for select to authenticated
  using (
    public.is_admin() or investor_id in (
      select id from public.investors where user_id = (select auth.uid())
    )
  );
create policy "transactions_admin_write" on public.transactions
  for all to authenticated
  using ( public.is_admin() ) with check ( public.is_admin() );

create policy "documents_select" on public.documents
  for select to authenticated
  using (
    public.is_admin()
    or visibility in ('proyecto','público')
    or investor_id in ( select id from public.investors where user_id = (select auth.uid()) )
  );
create policy "documents_admin_write" on public.documents
  for all to authenticated
  using ( public.is_admin() ) with check ( public.is_admin() );

create policy "requests_select_own" on public.reassignment_requests
  for select to authenticated
  using (
    public.is_admin() or investor_id in (
      select id from public.investors where user_id = (select auth.uid())
    )
  );
create policy "requests_insert_own" on public.reassignment_requests
  for insert to authenticated
  with check (
    investor_id in ( select id from public.investors where user_id = (select auth.uid()) )
  );
create policy "requests_admin_update" on public.reassignment_requests
  for update to authenticated
  using ( public.is_admin() ) with check ( public.is_admin() );

create policy "interests_select_own" on public.investment_interests
  for select to authenticated
  using ( public.is_admin() or user_id = (select auth.uid()) );
create policy "interests_insert_own" on public.investment_interests
  for insert to authenticated
  with check ( user_id = (select auth.uid()) );

create policy "identity_select_own" on public.identity_verifications
  for select to authenticated
  using ( public.is_admin() or user_id = (select auth.uid()) );

create policy "budget_select" on public.budget_items
  for select to authenticated using ( true );
create policy "budget_admin_write" on public.budget_items
  for all to authenticated using ( public.is_admin() ) with check ( public.is_admin() );

create policy "tasks_select" on public.tasks
  for select to authenticated using ( true );
create policy "tasks_admin_write" on public.tasks
  for all to authenticated using ( public.is_admin() ) with check ( public.is_admin() );

create policy "reports_select" on public.monthly_reports
  for select to authenticated using ( true );
create policy "reports_admin_write" on public.monthly_reports
  for all to authenticated using ( public.is_admin() ) with check ( public.is_admin() );
