-- Push notifications: device tokens and the notification feed.
--
-- SHARED CONTRACT WITH THE MOBILE APP. `investors_180_mobile` lives in another
-- repository and points at THIS Supabase project. The table and column names
-- below are the interface between the two codebases: the app registers its Expo
-- token in `push_tokens` and reads its feed from `notifications`. Renaming
-- anything here silently breaks a client this repo cannot see or deploy.
--
-- ONE DELIVERY PIPELINE, no exceptions:
--
--   insert into public.notifications
--     -> Database Webhook (INSERT on notifications)
--          -> Edge Function `push-send`  (supabase/functions/push-send)
--               -> Expo Push API
--
-- Both senders -- the admin panel (/admin/notificaciones) and the trigger at the
-- bottom of this file -- do nothing but INSERT a row. No code in this repo talks
-- to Expo, so there is exactly ONE place where delivery can break, and every
-- notification is persisted before it is ever pushed. Setup of the webhook and
-- the function is in .claude/docs/integrations.md.

-- === push_tokens ===========================================================

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  -- public.users, not auth.users: every table in this schema hangs off the
  -- profile table, whose id IS auth.users.id (tablas_base.sql) and which itself
  -- cascades from auth.users. The value stored is therefore the auth user id
  -- the mobile app writes, deleting the account still removes these rows, and
  -- the FK stays inside a schema PostgREST can see.
  user_id uuid not null references public.users(id) on delete cascade,
  -- The Expo push token ("ExponentPushToken[...]"). Unique because a device
  -- handed to another person must not keep pushing to the old owner: the app
  -- upserts on this column, which moves the row instead of duplicating it.
  token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  device_name text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

comment on table public.push_tokens is
  'Expo push tokens, one row per device. Written by the mobile app (investors_180_mobile), read by the push-send Edge Function. Shared contract: do not rename.';

-- The Edge Function looks tokens up by user_id on every notification.
create index if not exists push_tokens_user_id_idx
  on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

-- A device token identifies a person's phone: theirs to register, refresh and
-- remove, and nobody else's to read.
create policy "users manage own push tokens" on public.push_tokens
  for all
  to authenticated
  using ( (select auth.uid()) = user_id )
  with check ( (select auth.uid()) = user_id );

-- === notifications =========================================================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  body text not null,
  -- Routing payload for the app: {"type": "...", ...}. Defaults to an empty
  -- object so the client never has to handle null.
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

comment on table public.notifications is
  'Notification feed, one row per recipient. Inserting a row IS sending it: a Database Webhook forwards every INSERT to the push-send Edge Function. Shared contract with investors_180_mobile: do not rename.';

-- The feed is always read as "mine, newest first".
create index if not exists notifications_user_created_at_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

-- An investor reads their own feed and nobody else's. The same rule as every
-- other private table in this schema (see rls_policies.sql).
create policy "users read own notifications" on public.notifications
  for select
  to authenticated
  using ( (select auth.uid()) = user_id );

-- Marking as read. WHICH ROW is enforced here; WHICH COLUMNS by the grant
-- further down, the same split used for public.users in migration
-- 20260806172657 -- RLS sees whole rows, so only a column GRANT can stop the
-- owner of a notification from rewriting its title and body.
create policy "users mark own notifications read" on public.notifications
  for update
  to authenticated
  using ( (select auth.uid()) = user_id )
  with check ( (select auth.uid()) = user_id );

-- Sending from the admin panel: the only INSERT path open to a session-bound
-- client, and it reuses the repo's single definition of "is an admin" instead
-- of re-deriving it. The trigger below does NOT rely on this policy -- it is
-- SECURITY DEFINER and runs with RLS bypassed.
create policy "admins send notifications" on public.notifications
  for insert
  to authenticated
  with check ( public.is_admin() );

comment on policy "users mark own notifications read" on public.notifications is
  'Restricts an update to the recipient''s own rows. WHICH COLUMNS they may write is enforced separately by a column GRANT: only read_at.';

-- === Grants ================================================================
-- New tables in `public` are NOT reachable through the Data API roles without
-- an explicit GRANT (see auto_expose_new_tables in supabase/config.toml), so
-- these are required, not decorative. RLS still decides which rows.

grant select, insert, update, delete on public.push_tokens to authenticated;

grant select, insert on public.notifications to authenticated;
-- Read receipts only. Everything else about a notification was written by the
-- sender and must stay as it was delivered.
grant update (read_at) on public.notifications to authenticated;

-- The push-send Edge Function reads tokens and prunes the dead ones.
grant all on public.push_tokens to service_role;
grant all on public.notifications to service_role;

-- === Fan-out: a new project notifies every investor ========================

create or replace function public.notify_investors_of_new_project()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- WHO COUNTS AS AN INVESTOR: someone with a LINKED row in public.investors.
  -- Being an investor is a capability derived from that link, never from
  -- users.role -- the same rule the RLS policies and the sidebar use (CLAUDE.md,
  -- "Roles y seguridad"). An admin who has also invested is linked, so they are
  -- notified too, which is correct: they are being told as an investor.
  --
  -- DISTINCT because nothing stops two investor records from pointing at one
  -- account; that person still gets a single notification.
  insert into public.notifications (user_id, title, body, data)
  select distinct
    i.user_id,
    'Nuevo proyecto disponible',
    new.name || ' ya está disponible para invertir.',
    jsonb_build_object('type', 'project_created', 'project_id', new.id)
  from public.investors i
  where i.user_id is not null;

  -- AFTER trigger: the return value is ignored.
  return null;
end;
$$;

comment on function public.notify_investors_of_new_project() is
  'Fans a new project out to every linked investor as a notifications row. SECURITY DEFINER: the admin inserting the project has no INSERT policy for other people''s notifications, and the insert also arrives through admin_save_table_changes.';

create trigger projects_notify_investors
  after insert on public.projects
  for each row execute function public.notify_investors_of_new_project();
