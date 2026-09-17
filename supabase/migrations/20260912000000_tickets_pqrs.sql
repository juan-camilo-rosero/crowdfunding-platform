-- Módulo PQRS: tabla tickets
--
-- Los tickets son el canal de comunicación formal del inversor con el equipo de
-- Investors 180 (Petición, Queja, Reclamo, Sugerencia). Se crean SIEMPRE en
-- estado 'abierto' y solo el equipo admin puede cambiar su estado o responderlos.
--
-- SEGURIDAD:
--   investor_id se deriva de auth.uid() en la Server Action, nunca del payload.
--   El CHECK de la política INSERT fuerza status = 'abierto': un ticket no puede
--   nacer resuelto o cerrado.

create table if not exists public.tickets (
  id           uuid primary key default gen_random_uuid(),
  investor_id  uuid not null references public.investors(id) on delete cascade,
  type         text not null,
  subject      text not null,
  description  text not null,
  status       text not null default 'abierto',
  admin_reply  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- Enforce the allowed ticket types at the DB level.
  constraint tickets_type_check check (
    type in ('petición', 'queja', 'reclamo', 'sugerencia')
  ),
  -- Enforce the allowed statuses at the DB level.
  constraint tickets_status_check check (
    status in ('abierto', 'en revisión', 'resuelto', 'cerrado')
  ),
  -- Subject must have visible content.
  constraint tickets_subject_length check (
    char_length(trim(subject)) >= 3
  ),
  -- Description must have visible content.
  constraint tickets_description_length check (
    char_length(trim(description)) >= 10
  )
);

comment on table public.tickets is
  'PQRS tickets submitted by investors. Created and read by the investor; updated by admins.';

-- Keep updated_at current on every write.
create or replace function public.set_tickets_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tickets_set_updated_at
  before update on public.tickets
  for each row execute procedure public.set_tickets_updated_at();

-- ─── RLS ────────────────────────────────────────────────────────────────────

alter table public.tickets enable row level security;

-- Investors can only see their own tickets.
create policy "tickets_select_own" on public.tickets
  for select
  to authenticated
  using (
    investor_id in (
      select id from public.investors where user_id = (select auth.uid())
    )
  );

-- Investors can only create tickets for themselves, and only in state 'abierto'.
-- This mirrors the reassignment_requests approach: the action also forces the
-- status, but the DB check is the barrier that holds when the action is bypassed.
create policy "tickets_insert_own" on public.tickets
  for insert
  to authenticated
  with check (
    investor_id in (
      select id from public.investors where user_id = (select auth.uid())
    )
    and status = 'abierto'
  );

-- Admins can see and update all tickets (to reply, change status).
create policy "tickets_admin_select" on public.tickets
  for select
  to authenticated
  using (
    exists (
      select 1 from public.users
      where id = (select auth.uid())
        and role = 'admin'
    )
  );

create policy "tickets_admin_update" on public.tickets
  for update
  to authenticated
  using (
    exists (
      select 1 from public.users
      where id = (select auth.uid())
        and role = 'admin'
    )
  );

comment on policy "tickets_select_own" on public.tickets is
  'An investor may read only their own tickets.';
comment on policy "tickets_insert_own" on public.tickets is
  'An investor may only create tickets for themselves, always in state abierto.';
comment on policy "tickets_admin_select" on public.tickets is
  'Admins can read all tickets.';
comment on policy "tickets_admin_update" on public.tickets is
  'Admins can update tickets (reply, change status).';
