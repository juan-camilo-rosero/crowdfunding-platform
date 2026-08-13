-- Tracking of electronic-signature requests (Documenso).
--
-- WHY THIS TABLE EXISTS: until now "the contract is signed" was derived from
-- the mere existence of a `contrato` document. That cannot tell apart sent,
-- opened, rejected, cancelled or expired — states a real provider genuinely
-- has. This mirrors identity_verifications: one row per attempt, with the
-- provider's own id as the join key.
--
-- SECURITY: the investor may READ their own rows and nothing else. There is
-- deliberately NO insert or update policy for `authenticated`: the state of a
-- signature is decided by the Documenso webhook, never by the person signing.
-- Adding a write policy here would let an investor declare their own contract
-- signed, the same class of escalation as the users.role hole fixed earlier.

create table public.signing_requests (
  id uuid primary key default gen_random_uuid(),
  investor_id uuid not null references public.investors(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  capital_contribution_id uuid references public.capital_contributions(id) on delete set null,

  -- The envelope id in Documenso. UNIQUE because it is what a webhook event is
  -- mapped back by: an event whose id matches no row here is ignored, so a
  -- forged payload cannot attach a signature to an arbitrary investor.
  external_document_id text not null unique,

  status text not null default 'enviado'
    check (status in ('enviado','entregado','completado','rechazado','anulado','expirado')),

  sent_at timestamptz not null default now(),
  completed_at timestamptz,
  declined_reason text,

  -- The filed contract, once the signed PDF has been stored.
  signed_document_id uuid references public.documents(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- The investor's own lookup, and the webhook's mapping by envelope id.
create index signing_requests_investor_idx on public.signing_requests (investor_id);

alter table public.signing_requests enable row level security;

-- READ ONLY, and only your own. Mirrors identity_select_own.
create policy "signing_requests_select_own" on public.signing_requests
  for select to authenticated
  using (
    public.is_admin()
    or investor_id in (
      select id from public.investors where user_id = (select auth.uid())
    )
  );

-- Admins may correct or resend from the panel. Investors may not: there is no
-- policy granting them insert or update, which is the point.
create policy "signing_requests_admin_write" on public.signing_requests
  for all to authenticated
  using ( public.is_admin() )
  with check ( public.is_admin() );

comment on table public.signing_requests is
  'One row per e-signature request. Status is authoritative from the provider webhook; investors have read-only access to their own rows and no write policy at all.';

comment on column public.signing_requests.external_document_id is
  'Envelope id in Documenso. A webhook event is matched to a row by this value; an unmatched event is ignored rather than applied.';
