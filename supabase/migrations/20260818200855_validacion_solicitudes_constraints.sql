-- M1 — reassignment_requests: obligatoriedad y dominios, sin validar todavía.
--
-- POR QUÉ: hoy estas reglas viven solo en Zod, dentro de Server Actions de
-- Next.js. El cliente móvil hablará con PostgREST directamente y ese código no
-- se ejecutará para él. RLS decide qué FILAS puede tocar cada usuario; no dice
-- nada sobre qué VALORES traen los campos. Ver docs/auditoria-validacion-movil.md.
--
-- NOT VALID a propósito: ADD CONSTRAINT ... NOT VALID toma un ACCESS EXCLUSIVE
-- brevísimo y NO escanea la tabla. La validación va en la migración siguiente,
-- donde el lock ya no bloquea lecturas ni escrituras. En una base en producción
-- esa separación es la diferencia entre un parpadeo y una caída.
--
-- La auditoría contó las violaciones sobre los datos reales antes de proponer
-- cada regla: cero en las siete. El VALIDATE de M2 pasará sin limpieza previa.
--
-- NO se toca ninguna política RLS. NO se inserta, actualiza ni borra nada.
--
-- FUERA DE ESTA TANDA, deliberadamente:
--   · rr_resolution_coherent — protege un flujo de aprobación que todavía no
--     existe y rompería la edición de resolved_at en el panel admin.
--   · El trigger de reglas cruzadas (origen cerrado, destino abierto, monto
--     dentro del disponible). Necesita leer otras tablas; un CHECK no puede.

set lock_timeout = '3s';

alter table public.reassignment_requests
  add constraint rr_investor_id_not_null
    check (investor_id is not null) not valid,
  add constraint rr_from_project_not_null
    check (from_project_id is not null) not valid,
  add constraint rr_to_project_not_null
    check (to_project_id is not null) not valid,
  add constraint rr_status_not_null
    check (status is not null) not valid,
  add constraint rr_amount_not_null
    check (amount is not null) not valid,
  -- El monto es lo único de esta tabla que RLS no cubre de rebote, y es el que
  -- corrompe cifras: un monto negativo aprobado SUMA capital donde no lo hay.
  add constraint rr_amount_positive
    check (amount > 0) not valid,
  add constraint rr_from_differs_from_to
    check (from_project_id <> to_project_id) not valid;

comment on constraint rr_amount_positive on public.reassignment_requests is
  'Un monto cero o negativo corrompe el capital vigente calculado por investor_project_position. Regla equivalente a la de lib/requests/create-schema.ts.';

-- ---------------------------------------------------------------------------
-- ROLLBACK
-- ---------------------------------------------------------------------------
-- set lock_timeout = '3s';
--
-- alter table public.reassignment_requests
--   drop constraint if exists rr_investor_id_not_null,
--   drop constraint if exists rr_from_project_not_null,
--   drop constraint if exists rr_to_project_not_null,
--   drop constraint if exists rr_status_not_null,
--   drop constraint if exists rr_amount_not_null,
--   drop constraint if exists rr_amount_positive,
--   drop constraint if exists rr_from_differs_from_to;
