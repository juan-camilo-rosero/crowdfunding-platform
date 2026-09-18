-- Structured public return offer for projects.
--
-- projects.offered_return was free text ("Hasta 15% anual") while the project
-- page ran its return calculator on hard-coded terms, so the numbers an
-- investor played with had nothing to do with what the project offered. The
-- offer is now data, in three shapes (see lib/projects/return-offer.ts):
--
--   {"kind":"annual","terms":[{"months":12,"min":10,"max":15}, ...]}
--   {"kind":"total","min":18,"max":22,"months":18}          -- months may be null
--   {"kind":"participation","percent":8}
--
-- Rates are percentages (12 = 12%). The application validates the full shape
-- before writing (lib/table/validation.ts → validateReturnOffer); the CHECK
-- below is the database's own floor, so a hand-written UPDATE cannot store
-- something that is not even an offer.
--
-- SECURITY: no new policy. The column inherits the two that already govern
-- the table — projects_select_all (any authenticated user reads the catalogue)
-- and projects_admin_write (only public.is_admin() writes) — which is exactly
-- the rule for public catalogue data. Nothing here is private to an investor.
--
-- offered_return is KEPT: projects published before this keep their text as a
-- read-only fallback in the catalogue until an admin configures the offer. The
-- admin save clears it when return_offer is written, so the two never disagree.

alter table public.projects
  add column if not exists return_offer jsonb;

alter table public.projects
  drop constraint if exists projects_return_offer_shape;

alter table public.projects
  add constraint projects_return_offer_shape check (
    return_offer is null
    or (
      jsonb_typeof(return_offer) = 'object'
      and return_offer ->> 'kind' in ('annual', 'total', 'participation')
    )
  );

comment on column public.projects.return_offer is
  'Structured public return offer: annual (rate per term), total (at exit) or participation (share of profit). Percentages. Feeds the catalogue label and the return calculator. See lib/projects/return-offer.ts.';

comment on column public.projects.offered_return is
  'LEGACY free-text public return. Read-only fallback shown while return_offer is null; cleared by the admin save when return_offer is written.';
