-- M2 — reassignment_requests: validar y convertir a NOT NULL real.
--
-- Dos pasos, en este orden y no en otro:
--
-- 1. VALIDATE CONSTRAINT sobre los siete de M1. Escanea la tabla con un
--    SHARE UPDATE EXCLUSIVE, que NO bloquea lecturas ni escrituras.
--
-- 2. SET NOT NULL sobre las cinco columnas cuyo check de nulidad acaba de
--    quedar validado, y DROP de ese check, que pasa a ser redundante.
--
-- POR QUÉ SET NOT NULL Y NO DEJARLO EN CHECK: son equivalentes para la base,
-- pero solo NOT NULL aparece en el catálogo, en los tipos generados y en el
-- OpenAPI que PostgREST publica. El equipo móvil generará su cliente desde ese
-- documento; con el check a secas, su código seguiría creyendo que `amount` es
-- opcional.
--
-- POR QUÉ NO ESCANEA DOS VECES: desde PostgreSQL 12, SET NOT NULL omite el
-- escaneo si existe un CHECK ya VALIDADO que pruebe que la columna no es nula.
-- Por eso el DROP del check va DESPUÉS del SET NOT NULL: al revés, se perdería
-- la prueba y Postgres volvería a escanear la tabla. Esta base corre 17.6.
--
-- NO se toca ninguna política RLS. NO se inserta, actualiza ni borra nada.

set lock_timeout = '3s';

-- 1. Validación.
alter table public.reassignment_requests validate constraint rr_investor_id_not_null;
alter table public.reassignment_requests validate constraint rr_from_project_not_null;
alter table public.reassignment_requests validate constraint rr_to_project_not_null;
alter table public.reassignment_requests validate constraint rr_status_not_null;
alter table public.reassignment_requests validate constraint rr_amount_not_null;
alter table public.reassignment_requests validate constraint rr_amount_positive;
alter table public.reassignment_requests validate constraint rr_from_differs_from_to;

-- 2. Conversión a NOT NULL real, apoyada en el check ya validado, y retirada
--    del check que se vuelve redundante. El orden importa (ver cabecera).
alter table public.reassignment_requests alter column investor_id set not null;
alter table public.reassignment_requests drop constraint rr_investor_id_not_null;

alter table public.reassignment_requests alter column from_project_id set not null;
alter table public.reassignment_requests drop constraint rr_from_project_not_null;

alter table public.reassignment_requests alter column to_project_id set not null;
alter table public.reassignment_requests drop constraint rr_to_project_not_null;

alter table public.reassignment_requests alter column status set not null;
alter table public.reassignment_requests drop constraint rr_status_not_null;

alter table public.reassignment_requests alter column amount set not null;
alter table public.reassignment_requests drop constraint rr_amount_not_null;

-- Sobreviven a esta migración, ya validados: rr_amount_positive y
-- rr_from_differs_from_to. No son reglas de nulidad, así que no se convierten.

-- ---------------------------------------------------------------------------
-- ROLLBACK
-- ---------------------------------------------------------------------------
-- Devuelve la tabla al estado posterior a M1. Para deshacer también M1, correr
-- después su propio rollback.
--
-- set lock_timeout = '3s';
--
-- alter table public.reassignment_requests alter column investor_id drop not null;
-- alter table public.reassignment_requests alter column from_project_id drop not null;
-- alter table public.reassignment_requests alter column to_project_id drop not null;
-- alter table public.reassignment_requests alter column status drop not null;
-- alter table public.reassignment_requests alter column amount drop not null;
--
-- alter table public.reassignment_requests
--   add constraint rr_investor_id_not_null  check (investor_id is not null) not valid,
--   add constraint rr_from_project_not_null check (from_project_id is not null) not valid,
--   add constraint rr_to_project_not_null   check (to_project_id is not null) not valid,
--   add constraint rr_status_not_null       check (status is not null) not valid,
--   add constraint rr_amount_not_null       check (amount is not null) not valid;
--
-- DROP NOT NULL no escanea la tabla, así que el rollback es inmediato.
