-- M4 — investment_interests: validar y convertir a NOT NULL real.
--
-- Espejo de M2. Ver esa migración para el razonamiento completo sobre por qué
-- SET NOT NULL va antes del DROP del check y por qué no dispara un segundo
-- escaneo de la tabla.
--
-- NO se toca ninguna política RLS. NO se inserta, actualiza ni borra nada.

set lock_timeout = '3s';

-- 1. Validación de los ocho.
alter table public.investment_interests validate constraint ii_user_id_not_null;
alter table public.investment_interests validate constraint ii_project_id_not_null;
alter table public.investment_interests validate constraint ii_type_pref_not_null;
alter table public.investment_interests validate constraint ii_status_not_null;
alter table public.investment_interests validate constraint ii_amount_positive;
alter table public.investment_interests validate constraint ii_comments_length;
alter table public.investment_interests validate constraint ii_comments_not_blank;
alter table public.investment_interests validate constraint ii_phone_e164;

-- 2. Conversión a NOT NULL de las cuatro reglas de nulidad, y retirada del
--    check redundante. El orden importa: primero SET NOT NULL, luego DROP.
alter table public.investment_interests alter column user_id set not null;
alter table public.investment_interests drop constraint ii_user_id_not_null;

alter table public.investment_interests alter column project_id set not null;
alter table public.investment_interests drop constraint ii_project_id_not_null;

alter table public.investment_interests alter column investment_type_pref set not null;
alter table public.investment_interests drop constraint ii_type_pref_not_null;

alter table public.investment_interests alter column status set not null;
alter table public.investment_interests drop constraint ii_status_not_null;

-- Sobreviven, ya validados: ii_amount_positive, ii_comments_length,
-- ii_comments_not_blank e ii_phone_e164.

-- ---------------------------------------------------------------------------
-- ROLLBACK
-- ---------------------------------------------------------------------------
-- Devuelve la tabla al estado posterior a M3.
--
-- set lock_timeout = '3s';
--
-- alter table public.investment_interests alter column user_id drop not null;
-- alter table public.investment_interests alter column project_id drop not null;
-- alter table public.investment_interests alter column investment_type_pref drop not null;
-- alter table public.investment_interests alter column status drop not null;
--
-- alter table public.investment_interests
--   add constraint ii_user_id_not_null    check (user_id is not null) not valid,
--   add constraint ii_project_id_not_null check (project_id is not null) not valid,
--   add constraint ii_type_pref_not_null  check (investment_type_pref is not null) not valid,
--   add constraint ii_status_not_null     check (status is not null) not valid;
