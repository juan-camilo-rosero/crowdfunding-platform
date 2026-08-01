# Instrucciones: crear las migraciones de Supabase

Este archivo contiene el trabajo exacto a realizar. El proyecto usa el CLI de Supabase por npm (llamar siempre con `npx supabase ...`). El proyecto ya está inicializado y enlazado (existe la carpeta `supabase/`). NO hace falta correr `init` ni `link` de nuevo.

## Reglas
- Trabajar 100% con migraciones versionadas. Para cada bloque: `npx supabase migration new <nombre>`, pegar el SQL en el archivo generado dentro de `supabase/migrations/`, y aplicar con `npx supabase db push`.
- Un bloque por migración, en el orden dado (hay dependencias de foreign keys).
- NO activar RLS antes del bloque 4.
- Después de cada `db push`, confirmar que no hubo error antes de seguir.
- No inventar campos ni cambiar nombres: usar exactamente el SQL de abajo.

---

## Migración 1 — `tablas_base`

```sql
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  phone text,
  avatar_url text,
  role text not null default 'visitante' check (role in ('visitante','inversionista','admin')),
  status text not null default 'registrado' check (status in ('invitado','registrado','activo','suspendido','desactivado')),
  onboarding_completed boolean not null default false,
  identity_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company text check (company in ('Investors 180 Group','F1','F3','Otra LLC')),
  address text,
  city text check (city in ('Punta Gorda','Rotonda','North Port','Otra')),
  type text check (type in ('lote','casa','triplex','multifamily')),
  status text check (status in ('en evaluación','en reserva','permisos','construcción','vendido','rentado','pausado')),
  lot_value numeric(14,2),
  capital_required numeric(14,2),
  estimated_sale_value numeric(14,2),
  estimated_rent numeric(14,2),
  progress integer default 0 check (progress between 0 and 100),
  description text,
  selling_points jsonb,
  responsible text,
  next_step text,
  deadline date,
  drive_folder_url text,
  main_photos text[],
  in_fundraising boolean not null default false,
  fundraising_goal numeric(14,2),
  lat numeric(9,6),
  lng numeric(9,6),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table public.investors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  full_name text not null,
  document_id text,
  phone text,
  email text,
  city_country text,
  potential_amount numeric(14,2),
  pipeline_stage text check (pipeline_stage in ('contacto','calificado','en reunión','en revisión','firmado','desembolsado')),
  investment_type_pref text check (investment_type_pref in ('deuda','equity','socio','préstamo','participación')),
  first_contact_date date,
  last_contact_date date,
  status text check (status in ('prospecto','interesado','en revisión','comprometido','recibido','pausado')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
```

---

## Migración 2 — `tablas_movimiento`

```sql
create table public.capital_contributions (
  id uuid primary key default gen_random_uuid(),
  reference text,
  project_id uuid references public.projects(id) on delete restrict,
  investor_id uuid references public.investors(id) on delete restrict,
  amount_required numeric(14,2),
  amount_committed numeric(14,2),
  amount_received numeric(14,2),
  received_date date,
  bank_account text,
  capital_type text check (capital_type in ('equity','deuda','préstamo','socio')),
  agreed_return text,
  term text,
  status text check (status in ('pendiente','recibido','usado','devuelto')),
  comments text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  investor_id uuid references public.investors(id) on delete restrict,
  project_id uuid references public.projects(id) on delete restrict,
  type text check (type in ('aporte','rendimiento','devolución de capital','reasignación')),
  amount numeric(14,2),
  date date,
  capital_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table public.budget_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  description text,
  category text check (category in ('lote','closing costs','survey','arquitectura','ingeniería','permisos','impact fees','site work','utilities','construcción','piscina','landscaping','marketing','realtor','contingencia','administración')),
  approved_budget numeric(14,2),
  actual_spent numeric(14,2),
  spent_date date,
  vendor text,
  paid_status text check (paid_status in ('pagado','pendiente')),
  comments text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  task text,
  stage text check (stage in ('evaluación','oferta','due diligence','survey','diseño','planos','permisos','construcción','inspecciones','renta','venta','refinanciación')),
  responsible text,
  estimated_date date,
  actual_date date,
  priority text check (priority in ('alta','media','baja')),
  status text check (status in ('pendiente','en proceso','completada','atrasada')),
  next_action text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table public.monthly_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  report_month date,
  physical_progress text,
  financial_progress text,
  capital_used_month numeric(14,2),
  photos text[],
  decisions text,
  risks text,
  next_steps text,
  next_report_date date,
  report_pdf_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete set null,
  investor_id uuid references public.investors(id) on delete set null,
  name text,
  doc_type text check (doc_type in ('deed','property record','survey','planos','permisos','presupuesto','contrato','operating agreement','facturas','estados de cuenta','reportes','certificado de aporte')),
  date date,
  responsible text,
  file_url text,
  status text check (status in ('pendiente','recibido','aprobado','vencido')),
  visibility text check (visibility in ('privado','proyecto','público')),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table public.reassignment_requests (
  id uuid primary key default gen_random_uuid(),
  investor_id uuid references public.investors(id) on delete restrict,
  from_project_id uuid references public.projects(id) on delete restrict,
  to_project_id uuid references public.projects(id) on delete restrict,
  amount numeric(14,2),
  status text check (status in ('pendiente','aprobada','rechazada')),
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.users(id) on delete set null
);

create table public.investment_interests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  amount numeric(14,2),
  investment_type_pref text check (investment_type_pref in ('equity','deuda','préstamo','socio','no estoy seguro')),
  comments text,
  phone text,
  status text check (status in ('nuevo','contactado','cerrado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table public.identity_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  truora_process_id text,
  status text check (status in ('iniciado','aprobado','rechazado','expirado')),
  decline_reason text,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
```

---

## Migración 3 — `vistas_calculadas`

```sql
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
```

---

## Migración 4 — `rls_policies`

Notas de implementación (ya aplicadas en el SQL, no cambiar):
- `(select auth.uid())` siempre envuelto en subconsulta (rendimiento).
- Todas las políticas con `to authenticated`.
- Funciones helper con `security definer` y `set search_path = ''`.
- El `service_role` del backend omite RLS automáticamente; no necesita políticas.

```sql
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
```

---

## Migración 5 — `trigger_perfil_usuario`

```sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

---

## Al terminar las 5 migraciones
Reportar:
- Que las 5 migraciones se crearon y cada `db push` corrió sin error.
- El estado de `npx supabase migration list`.
- Recordar al usuario que OAuth (Google/Outlook), las Redirect URLs y los buckets de Storage se configuran en el dashboard web, no por migración, y que el RLS solo se puede probar de verdad con un usuario autenticado vía el SDK (el SQL Editor omite RLS).
