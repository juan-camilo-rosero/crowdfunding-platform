-- Close a hole in the reassignment-request INSERT policy.
--
-- THE BUG: "requests_insert_own" checked WHO owns the row but not WHAT STATE it
-- is created in. An investor holding their own access token could POST straight
-- to PostgREST with status = 'aprobada' and it was accepted (verified: 201).
--
-- WHY IT MATTERED: investor_project_position sums reassignment_requests with
-- status = 'aprobada' when computing current_capital per project. A
-- self-approved request therefore moved capital between an investor's own
-- projects in their own figures, with no admin involved. Approval is the
-- admin's call, and the numbers are the whole point of the product.
--
-- THE FIX: a request may only be BORN pending. Moving it to 'aprobada' or
-- 'rechazada' is an UPDATE, which "requests_admin_update" already restricts to
-- admins — that policy is deliberately left untouched.
--
-- ALTER POLICY rather than drop-and-recreate: "for insert" and "to
-- authenticated" stay exactly as they were, so the change is only the check.
-- The Server Action also forces status = 'pendiente'; that stays as
-- defence in depth. This policy is the barrier that holds when the action is
-- bypassed entirely.

alter policy "requests_insert_own" on public.reassignment_requests
  with check (
    investor_id in (select id from public.investors where user_id = (select auth.uid()))
    and status = 'pendiente'
  );

comment on policy "requests_insert_own" on public.reassignment_requests is
  'An investor may create a reassignment request only for themselves and only in state pendiente. Approving or rejecting is an UPDATE, restricted to admins by requests_admin_update.';
