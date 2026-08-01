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
