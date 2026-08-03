-- Personal data captured by the BASIC onboarding (see views.md).
--
-- public.users already had full_name and phone; these are the fields the
-- onboarding form collects that had nowhere to go. All nullable text: the rows
-- of everyone who signed up before this migration stay valid, and the form is
-- the only thing that fills them.
--
-- No RLS change is needed. users_select_own and users_update_own already scope
-- every read and write to auth.uid() = id, so these columns inherit exactly the
-- same rule: a user can only ever write their OWN personal data.

alter table public.users
  add column if not exists document_id        text,
  add column if not exists phone_country_code text,
  add column if not exists city               text,
  add column if not exists country            text,
  add column if not exists city_place_id      text;

comment on column public.users.document_id is
  'National ID / cédula. Digits only, validated by the onboarding schema.';

-- PHONE STORAGE — decided here so both halves agree:
--   users.phone              full E.164, e.g. "+573001112233" (CLAUDE.md rule)
--   users.phone_country_code the dial code alone, e.g. "+57"
-- The dial code is stored redundantly on purpose: it lets the form re-select
-- the right country without having to guess where the prefix ends, which is
-- ambiguous between overlapping codes (+1, +1809…).
comment on column public.users.phone_country_code is
  'Dial code of users.phone, e.g. "+57". Redundant with the E.164 value in users.phone, kept so the UI can restore the country selector without parsing.';

comment on column public.users.city is
  'City name as shown by Google Places autocomplete.';
comment on column public.users.country is
  'Country of the selected city, when Places returns it.';
comment on column public.users.city_place_id is
  'Google Places place_id of users.city. Lets the city be resolved again later without relying on the stored text.';
