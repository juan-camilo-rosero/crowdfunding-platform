-- Stop a user from editing the columns that decide what they are allowed to do.
--
-- THE BUG: "users_update_own" checks WHICH ROW may be written (auth.uid() = id)
-- but not WHICH COLUMNS. A plain visitante could PATCH their own row with
-- role = 'admin' and it was accepted (verified: 200, and the value stuck).
--
-- WHY IT MATTERED: from that moment they satisfy public.is_admin(), which is
-- the gate on every *_admin_write policy, on documents_select, and — worst of
-- all — on capital_select_own and transactions_select_own. One PATCH turned any
-- account into a reader of EVERY investor's financial data. It also broke a
-- transition user-management.md lists as forbidden: "nadie se autoasciende a
-- role = 'admin'". The same hole let a suspended user set their own status back
-- to 'activo', undoing their own suspension.
--
-- THE FIX: column-level privileges. RLS cannot restrict columns — a policy sees
-- the whole row — so the restriction goes where Postgres does support it, in
-- the GRANT. Checked BEFORE the policy, so it cannot be argued around.
--
-- What stays writable is exactly what the basic onboarding and the profile
-- screen write. What leaves is the authorization surface:
--   role               → only an admin flow may change this
--   status             → account lifecycle, the admin's call
--   identity_verified  → set by the Truora webhook, never by the user
--   email              → comes verified from OAuth; it is the linking key
--   id, created_at     → immutable
--
-- service_role keeps full access, so seeds, webhooks and admin tooling are
-- unaffected. When the admin user-management screen is built it should write
-- through a SECURITY DEFINER function that checks is_admin(), the way
-- admin_save_table_changes already does — that pattern is unaffected by this.
--
-- "users_update_own" itself is deliberately NOT modified: row ownership is
-- still its job, and it does that correctly.

revoke update on public.users from authenticated;

grant update (
  full_name,
  phone,
  avatar_url,
  document_id,
  phone_country_code,
  city,
  country,
  city_place_id,
  onboarding_completed,
  updated_at
) on public.users to authenticated;

comment on policy "users_update_own" on public.users is
  'Restricts an update to the caller''s own row. WHICH COLUMNS they may write is enforced separately by column-level GRANTs (see migration 20260806172657): role, status, identity_verified and email are not writable by authenticated.';
