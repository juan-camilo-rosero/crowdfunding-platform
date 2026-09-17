-- M3 — investment_interests: obligatoriedad, dominios y saneamiento de texto.
--
-- Mismo motivo y misma técnica que M1: estas reglas viven hoy solo en Zod
-- (lib/interests/schema.ts) y el cliente móvil no las ejecutará.
--
-- Un interés es un lead, no un dato financiero, así que ninguna de estas es
-- crítica. La que más pesa es la longitud de `comments`: la columna es `text`
-- sin límite, y el panel admin renderiza la tabla completa.
--
-- ii_phone_e164 se verificó contra su ORIGEN, no contra esta tabla: el teléfono
-- no lo manda el formulario, lo copia la Server Action desde users.phone. Se
-- contaron las violaciones sobre users.phone (0 de 6, con 3 nulos) e
-- investors.phone (0 de 10, con 1 nulo). Los nulos no estorban: la regla es
-- "nulo o con formato".
--
-- NOTA PARA MÁS ADELANTE: users.phone no tiene constraint propio. Hoy está
-- limpio porque el onboarding compone el E.164, pero nada en la base lo obliga.
-- Si algún día entra un teléfono mal formado ahí, el fallo no saldrá en el
-- perfil: saldrá al enviar un interés. Constreñir users.phone es la corrección
-- de raíz y queda fuera de esta tanda.
--
-- NO se toca ninguna política RLS. NO se inserta, actualiza ni borra nada.

set lock_timeout = '3s';

alter table public.investment_interests
  add constraint ii_user_id_not_null
    check (user_id is not null) not valid,
  add constraint ii_project_id_not_null
    check (project_id is not null) not valid,
  add constraint ii_type_pref_not_null
    check (investment_type_pref is not null) not valid,
  add constraint ii_status_not_null
    check (status is not null) not valid,
  add constraint ii_amount_positive
    check (amount is null or amount > 0) not valid,
  -- El límite replica el de Zod. Sin él, nada impide insertar megabytes.
  add constraint ii_comments_length
    check (comments is null or length(comments) <= 2000) not valid,
  add constraint ii_comments_not_blank
    check (comments is null or btrim(comments) <> '') not valid,
  add constraint ii_phone_e164
    check (phone is null or phone ~ '^\+[1-9]\d{6,14}$') not valid;

comment on constraint ii_phone_e164 on public.investment_interests is
  'E.164, la misma regla que CLAUDE.md fija para teléfonos. El valor se copia de users.phone, que hoy no tiene constraint propio.';

-- ---------------------------------------------------------------------------
-- ROLLBACK
-- ---------------------------------------------------------------------------
-- set lock_timeout = '3s';
--
-- alter table public.investment_interests
--   drop constraint if exists ii_user_id_not_null,
--   drop constraint if exists ii_project_id_not_null,
--   drop constraint if exists ii_type_pref_not_null,
--   drop constraint if exists ii_status_not_null,
--   drop constraint if exists ii_amount_positive,
--   drop constraint if exists ii_comments_length,
--   drop constraint if exists ii_comments_not_blank,
--   drop constraint if exists ii_phone_e164;
