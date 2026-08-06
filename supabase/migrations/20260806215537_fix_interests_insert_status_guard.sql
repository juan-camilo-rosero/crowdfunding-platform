-- Pin the state a new investment interest may be created in.
--
-- Same class of hole as the one fixed in reassignment_requests
-- (20260806171655): "interests_insert_own" checked WHO owns the row but not
-- WHAT STATE it starts in, so a user posting straight to PostgREST could create
-- their own interest already marked 'contactado' or 'cerrado'.
--
-- Impact was low — no view and no authorization reads investment_interests.status,
-- so the worst outcome was hiding one's own interest from the admin's queue. It
-- is closed now because this table stops being dormant with this sprint: the
-- form starts writing to it, and the admin's follow-up queue starts depending
-- on 'nuevo' meaning "nobody has looked at this yet".
--
-- Moving an interest to 'contactado' or 'cerrado' is an UPDATE, which no policy
-- grants to a normal user, so it stays with the admin tooling.
--
-- ALTER POLICY rather than drop-and-recreate: "for insert" and "to
-- authenticated" are unchanged; only the check grows.

alter policy "interests_insert_own" on public.investment_interests
  with check (
    user_id = (select auth.uid())
    and status = 'nuevo'
  );

comment on policy "interests_insert_own" on public.investment_interests is
  'A user may register an interest only for themselves and only in state nuevo. Advancing it to contactado or cerrado is the admin''s job.';
