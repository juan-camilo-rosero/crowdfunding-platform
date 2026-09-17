# Auditoría de validación para el cliente móvil

**Fecha:** 18 de agosto de 2026
**Alcance:** `reassignment_requests`, `investment_interests`
**Estado:** diagnóstico. No se modificó la base de datos, no se escribieron migraciones, no se tocó código.
**Actualizado el 18 de agosto** con los resultados de D1, D2 y D5, y con la verificación de `resolved_at`. Ver [Resultados de las verificaciones](#resultados-de-las-verificaciones).

## Contexto del problema

Hoy toda la validación de valores vive en Zod, dentro de Server Actions de Next.js. La app móvil hablará con PostgREST directamente, así que ese código no se ejecutará para ella.

RLS decide **qué filas** puede tocar cada usuario. No dice nada sobre **qué valores** traen los campos. Esa es la brecha.

Hay un matiz que cambia el diagnóstico y conviene tener presente en todo el informe: las políticas de INSERT de ambas tablas comparan campos concretos (`investor_id`, `user_id`, `status`). En SQL, comparar contra `NULL` da `NULL`, y un `WITH CHECK` que no evalúa a verdadero rechaza la fila. **Eso hace que RLS ya imponga, de rebote, un NOT NULL sobre esos tres campos** — pero solo en la ruta directa. La ruta del panel admin (`admin_save_table_changes`) es `SECURITY DEFINER` y no pasa por RLS en absoluto.

---

## 1. Inventario de validación en código

### 1.1 `reassignment_requests`

Ruta única de escritura desde el cliente: `createReassignmentRequest` en `app/(investor)/solicitudes/actions.ts`.
Esquema: `lib/requests/create-schema.ts`. Reglas de negocio: `lib/requests/availability.ts`.

| Campo | Regla en TypeScript | Dónde |
|---|---|---|
| `investor_id` | No viene del payload. Se deriva de `auth.uid()` → `investors.user_id`. Si no hay ficha, se rechaza | actions.ts |
| `from_project_id` | Obligatorio, formato UUID | Zod |
| `to_project_id` | Obligatorio, formato UUID | Zod |
| `from` vs `to` | Deben ser distintos | Zod `.refine()` |
| `amount` | Obligatorio, número, finito, estrictamente positivo | Zod |
| `amount` | ≤ capital disponible en el proyecto de origen, releído de la base en el momento de escribir | actions.ts + availability.ts |
| `status` | No viene del payload. Forzado a `'pendiente'` en código | actions.ts |
| `requested_at` | No se escribe. Lo pone el DEFAULT | — |
| `resolved_at`, `resolved_by` | Nunca se escriben en esta ruta | — |

**Verificaciones cruzadas contra otras tablas** (ninguna expresable como CHECK):

1. El **origen** debe ser un proyecto cerrado a inversión: `status ∈ ('vendido','rentado')` **o** `progress ≥ 100`.
2. El **destino** debe ser un proyecto abierto a inversión (la negación de lo anterior).
3. El inversionista debe tener **capital vigente > 0** en el origen. Se lee de la vista `investor_project_position`.
4. El monto disponible **descuenta lo que ya reclaman otras solicitudes pendientes**, para que nadie comprometa el mismo dinero dos veces.

### 1.2 `investment_interests`

Ruta única: `createInvestmentInterest` en `components/project/actions.ts`.
Esquema: `lib/interests/schema.ts`.

| Campo | Regla en TypeScript | Dónde |
|---|---|---|
| `user_id` | No viene del payload. Se deriva de `auth.uid()` | actions.ts |
| `project_id` | Obligatorio, formato UUID | Zod |
| `amount` | Opcional. Si viene: número, finito, estrictamente positivo | Zod |
| `investment_type_pref` | Obligatorio. Uno de: `equity`, `deuda`, `préstamo`, `socio`, `no estoy seguro` | Zod `enum` |
| `comments` | Opcional. Texto recortado, **máximo 2000 caracteres** | Zod |
| `phone` | No viene del payload. Se copia del perfil del usuario | actions.ts |
| `status` | No viene del payload. Forzado a `'nuevo'` | actions.ts |

No hay verificaciones cruzadas. El único requisito externo es que el `project_id` exista, cubierto por la clave foránea.

---

## 2. Protección actual en la base de datos

### 2.1 Qué pude extraer en vivo y qué no

**Extraído del sistema en producción:**

- Columnas, tipos, obligatoriedad efectiva y claves foráneas, leídos del documento OpenAPI que PostgREST genera desde el catálogo real.
- Las 12 filas existentes (5 + 7), completas.
- Estados y avance de los 12 proyectos, y las posiciones de `investor_project_position`.
- Tamaños de tabla vía `supabase inspect db table-stats`.

**Extraído después, al resolver D1:** el DDL completo de producción está en `docs/schema-produccion.sql`, obtenido con `npx supabase db dump --linked --schema public`. Incluye constraints, políticas, índices y claves foráneas tal como están en el catálogo.

**El catálogo real coincide exactamente con las migraciones. No hay deriva.** Lo que aparece abajo como definición declarada es, además, lo que está aplicado. Ver [Resultados de las verificaciones](#resultados-de-las-verificaciones) para el contraste literal.

### 2.2 Obligatoriedad efectiva (esto sí es del sistema real)

PostgREST marca como `required` únicamente las columnas sin default y con NOT NULL:

```
reassignment_requests   required: ["id", "requested_at"]
investment_interests    required: ["id", "created_at"]
```

**Todo lo demás acepta NULL en la base.** Incluidos `amount`, `investor_id`, `from_project_id`, `to_project_id`, `status`, `user_id`, `project_id` e `investment_type_pref`.

Claves foráneas confirmadas en vivo:

| Tabla | Columna | Referencia |
|---|---|---|
| `reassignment_requests` | `investor_id` | `investors.id` |
| `reassignment_requests` | `from_project_id` | `projects.id` |
| `reassignment_requests` | `to_project_id` | `projects.id` |
| `reassignment_requests` | `resolved_by` | `users.id` |
| `investment_interests` | `user_id` | `users.id` |
| `investment_interests` | `project_id` | `projects.id` |

### 2.3 Definición declarada en migraciones

```sql
-- 20260730000940_tablas_movimiento.sql
create table public.reassignment_requests (
  id uuid primary key default gen_random_uuid(),
  investor_id uuid references public.investors(id) on delete restrict,
  from_project_id uuid references public.projects(id) on delete restrict,
  to_project_id uuid references public.projects(id) on delete restrict,
  amount numeric(14,2),
  status text check (status in ('pendiente','aprobada','rechazada')),
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.users(id) on delete set null
);

create table public.investment_interests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  amount numeric(14,2),
  investment_type_pref text check (investment_type_pref in
    ('equity','deuda','préstamo','socio','no estoy seguro')),
  comments text,
  phone text,
  status text check (status in ('nuevo','contactado','cerrado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
```

Un CHECK sobre una columna que admite NULL **se satisface con NULL**. `status text check (status in (...))` no impide `status = NULL`.

`ON DELETE` conviene mirarlo: `restrict` en las tres referencias de solicitudes (borrar un proyecto con solicitudes falla), pero `cascade` en las dos de intereses (borrar un proyecto borra los intereses asociados, y borrar un usuario borra los suyos).

### 2.4 Políticas RLS declaradas

```sql
-- reassignment_requests
create policy "requests_select_own" for select to authenticated
  using ( public.is_admin() or investor_id in (
    select id from public.investors where user_id = (select auth.uid()) ) );

create policy "requests_insert_own" for insert to authenticated   -- tras 20260806171655
  with check (
    investor_id in (select id from public.investors where user_id = (select auth.uid()))
    and status = 'pendiente'
  );

create policy "requests_admin_update" for update to authenticated
  using ( public.is_admin() ) with check ( public.is_admin() );

-- investment_interests
create policy "interests_select_own" for select to authenticated
  using ( public.is_admin() or user_id = (select auth.uid()) );

create policy "interests_insert_own" for insert to authenticated  -- tras 20260806215537
  with check ( user_id = (select auth.uid()) and status = 'nuevo' );
```

Lo que se deduce:

- Ninguna de las dos tablas tiene política de DELETE para `authenticated`. Nadie borra.
- `investment_interests` **no tiene política de UPDATE**. El panel admin cambia el estado a través de `admin_save_table_changes`, que es `SECURITY DEFINER` y por tanto **no pasa por RLS**. Esa función valida que quien llama sea admin y que la tabla y las columnas existan, pero **no valida valores**.
- Ambas tablas están en la lista blanca de esa función.

**Consecuencia para el diseño:** una política RLS solo protege la ruta directa. Un CHECK o un trigger protegen las dos.

### 2.5 Unicidad e índices

No hay UNIQUE declarado en ninguna de las dos tablas más allá de la clave primaria. No hay índices adicionales declarados en las migraciones. **No pude confirmar la lista real de índices** — ver 2.1.

---

## 3. Matriz de brechas

Severidad: **CRÍTICA** corrompe datos financieros, salta una regla de negocio o deja que alguien afecte información de otro. **MEDIA** admite datos inconsistentes o basura que la UI mostrará mal. **BAJA** cosmética o cubierta de otro modo.

### 3.1 `reassignment_requests`

| Campo | Regla en Zod | Protección en la base | Severidad |
|---|---|---|---|
| `amount` | Obligatorio | Ninguna. Admite NULL | **CRÍTICA** |
| `amount` | Estrictamente positivo | Ninguna. Admite 0 y negativos | **CRÍTICA** |
| `amount` | ≤ disponible en el origen | Ninguna | **CRÍTICA** |
| `from_project_id` | Origen debe ser proyecto cerrado | Ninguna | **CRÍTICA** |
| `from_project_id` | El inversionista debe tener capital ahí | Ninguna | **CRÍTICA** |
| `to_project_id` | Destino debe ser proyecto abierto | Ninguna | **CRÍTICA** |
| `from_project_id` | Obligatorio | Ninguna. Admite NULL | MEDIA |
| `to_project_id` | Obligatorio | Ninguna. Admite NULL | MEDIA |
| `from` ≠ `to` | Deben diferir | Ninguna | MEDIA |
| `investor_id` | Derivado de la sesión | RLS lo cubre en la ruta directa; NULL se rechaza de rebote | BAJA |
| `status` | Forzado a `'pendiente'` | RLS lo exige; el CHECK acota el dominio | BAJA |
| `resolved_at` / `resolved_by` | Nunca escritos | Ninguna. Un cliente puede nacer con ellos rellenos | MEDIA |

Por qué `amount` NULL o negativo es crítico y no cosmético: la vista `investor_project_position` calcula el capital vigente restando las reasignaciones aprobadas. Un monto negativo aprobado **suma** capital donde no lo hay. Un NULL entra como cero en unos cálculos y como "sin dato" en otros, y llega a la cola de aprobación como una solicitud que un admin puede aprobar sin ver el problema.

Sobre `resolved_at` / `resolved_by`: RLS solo exige `status = 'pendiente'` al insertar. Nada impide crear una solicitud pendiente que ya venga con fecha y responsable de resolución, lo que ensucia la trazabilidad de quién aprobó qué.

### 3.2 `investment_interests`

| Campo | Regla en Zod | Protección en la base | Severidad |
|---|---|---|---|
| `comments` | Máximo 2000 caracteres | Ninguna. `text` sin límite | MEDIA |
| `amount` | Positivo si viene | Ninguna. Admite 0 y negativos | MEDIA |
| `project_id` | Obligatorio | Ninguna. Admite NULL | MEDIA |
| `investment_type_pref` | Obligatorio, uno de cinco | El CHECK acota el dominio pero **admite NULL** | MEDIA |
| `phone` | Del perfil, formato E.164 | Ninguna. Texto libre | MEDIA |
| `comments` | Recortado, no vacío | Ninguna | BAJA |
| `user_id` | Derivado de la sesión | RLS lo cubre; NULL se rechaza de rebote | BAJA |
| `status` | Forzado a `'nuevo'` | RLS lo exige; el CHECK acota el dominio | BAJA |

Ninguna es crítica: un interés es un lead, no un dato financiero. `comments` sin límite es la que más molesta — nada impide insertar megabytes de texto en una tabla que el panel admin renderiza completa.

---

## 4. Verificación contra los datos existentes

**Coste:** ambas tablas son diminutas —`reassignment_requests` 32 kB / 5 filas, `investment_interests` 32 kB / 7 filas—, así que las consultas fueron instantáneas y sin impacto. Se leyeron las 12 filas completas y se evaluó cada regla propuesta una por una.

### 4.1 Reglas expresables como CHECK: cero violaciones

| Tabla | Regla propuesta | Filas que la violan |
|---|---|---|
| `reassignment_requests` | `investor_id` NOT NULL | **0** |
| `reassignment_requests` | `from_project_id` NOT NULL | **0** |
| `reassignment_requests` | `to_project_id` NOT NULL | **0** |
| `reassignment_requests` | `amount` NOT NULL | **0** |
| `reassignment_requests` | `amount > 0` | **0** |
| `reassignment_requests` | `status` NOT NULL | **0** |
| `reassignment_requests` | `from_project_id <> to_project_id` | **0** |
| `reassignment_requests` | `'pendiente'` ⇒ sin `resolved_at` ni `resolved_by` | **0** |
| `reassignment_requests` | resuelta ⇒ con `resolved_at` | **0** |
| `reassignment_requests` | resuelta ⇒ con `resolved_by` | **0** |
| `investment_interests` | `user_id` NOT NULL | **0** |
| `investment_interests` | `project_id` NOT NULL | **0** |
| `investment_interests` | `investment_type_pref` NOT NULL | **0** |
| `investment_interests` | `status` NOT NULL | **0** |
| `investment_interests` | `amount > 0` cuando no es NULL | **0** |
| `investment_interests` | `length(comments) <= 2000` | **0** |
| `investment_interests` | `comments` no vacío tras recortar | **0** |
| `investment_interests` | `phone` E.164 cuando no es NULL | **0** |

**Todos los CHECK propuestos se pueden agregar y validar sin limpieza previa.** El `VALIDATE CONSTRAINT` pasará en los 18 casos.

### 4.2 Reglas cruzadas: aquí sí hay datos que no cumplen

| Regla propuesta | Filas que la violan |
|---|---|
| El origen es un proyecto cerrado a inversión | **5 de 5** |
| El destino es un proyecto abierto a inversión | 0 de 5 |
| El inversionista tiene posición en el proyecto de origen | **2 de 5** |

Detalle de las cinco solicitudes:

| Solicitud | Estado | Monto | Proyecto origen | Estado / avance | ¿Cerrado? | ¿Tiene posición? |
|---|---|---|---|---|---|---|
| `5f2c1620` | pendiente | 25.000 | Villa Rotonda 118 | construcción / 62 | No | **No** |
| `215699d8` | aprobada | 15.000 | Punta Gorda Duplex 24 | permisos / 15 | No | Sí (capital **−15.000**) |
| `db7dea35` | rechazada | 8.000 | Villa Rotonda 118 | construcción / 62 | No | **No** |
| `5b79e114` | pendiente | 5.000 | North Port Lote 7 | en evaluación / 0 | No | Sí (8.000) |
| `d2793dfb` | pendiente | 30.000 | Villa Rotonda 118 | construcción / 62 | No | Sí (45.926) |

Esto **no bloquea** la migración: un trigger `BEFORE INSERT` no toca filas existentes. Pero dice dos cosas que importan:

**Primera:** los datos de siembra son anteriores a la regla de negocio y no la cumplen. Cualquier intento futuro de validar el histórico fallará. Hay que decidir si se corrigen o se dejan como están.

**Segunda, y más seria:** la solicitud `215699d8` está **aprobada** y dejó una posición con **capital vigente de −15.000**:

```json
{ "investor_id": "f1d44c2b…", "project_id": "8699d776…",
  "contributed": 0, "returned_capital": 0, "current_capital": -15000 }
```

**La causa raíz resultó ser otra, y la corrijo aquí.** No es "se aprobó una reasignación sin capital detrás". La vista `investor_project_position` calcula `contributed` sumando **transacciones** de tipo `aporte`. Este inversionista tiene un aporte de 85.000 en `capital_contributions` con estado `recibido`, pero **ninguna transacción que lo respalde**. La base de cálculo es 0, y la reasignación aprobada de 15.000 la deja en −15.000.

**No es sistémico:** de los 18 aportes de la base, exactamente **1** presenta ese desfase, y es el del inversionista de siembra. Los demás cuadran.

**Corrección a una afirmación de la versión anterior de este informe:** dije que el capital negativo era visible para ese inversionista en su pantalla de Inicio. Es falso. Su ficha tiene `user_id = null`, así que no hay cuenta con la que iniciar sesión. Solo lo ve un admin desde el panel.

---

## 5. Lógica que no puede expresarse como CHECK

Un CHECK solo ve la fila que se está insertando. Estas cuatro reglas necesitan leer otras tablas.

| # | Regla | Tablas que consulta |
|---|---|---|
| 1 | `amount` ≤ capital disponible en el origen | `investor_project_position`, `reassignment_requests` |
| 2 | El origen es un proyecto cerrado a inversión | `projects` |
| 3 | El destino es un proyecto abierto a inversión | `projects` |
| 4 | El inversionista tiene capital vigente en el origen | `investor_project_position` |

Las tres opciones, con su criterio:

**Clave foránea compuesta.** Se descarta. Exigiría una tabla real con la pareja `(investor_id, project_id)` y su capital, y eso hoy es una **vista** (`investor_project_position`). No se puede referenciar una vista con una FK. Materializarla introduce un problema de sincronización peor que el que resuelve.

**Función invocada desde el `WITH CHECK` de la política.** Encaja con lo que ya hace el proyecto (`is_admin()`, `has_project_stake()`) y mantiene la regla junto a la autorización. Su límite: **solo se aplica donde se aplica RLS**. El panel admin escribe por `admin_save_table_changes`, que es `SECURITY DEFINER` y se salta las políticas. La regla no protegería esa ruta.

**Trigger `BEFORE INSERT`.** Se ejecuta en **todas** las escrituras: PostgREST directo, service role, y la función del panel. Es la única opción que cubre las dos rutas. Su coste es que también aplica a scripts de siembra y a correcciones administrativas, que hoy insertan filas que no cumplen la regla 2.

**Criterio recomendado:** trigger para las cuatro. La razón decide sola: si un admin puede crear por el panel una solicitud que el sistema considera inválida, la regla no es una regla. Pero eso cambia el comportamiento actual del panel, así que va a la sección de decisiones.

Detalle sobre la regla 1: debe calcularse **dentro** del trigger releyendo la posición y restando las solicitudes pendientes, replicando `getAvailableForProject`. Es la única forma de que sea atómica; comprobarlo fuera deja una carrera entre dos solicitudes simultáneas.

---

## 6. Plan de migración propuesto

No ejecutado. Cinco migraciones, en orden. Ninguna altera, borra ni rellena datos.

**Convenciones que aplican a todas:**

- Primera línea `set lock_timeout = '3s';` — si algo tiene la tabla tomada, la migración aborta en vez de encolar y colgar la base.
- Los CHECK entran con `NOT VALID` y se validan en una migración posterior. `ADD CONSTRAINT ... NOT VALID` solo toma un `ACCESS EXCLUSIVE` brevísimo, sin escanear la tabla; `VALIDATE CONSTRAINT` escanea con un lock que **no bloquea lecturas ni escrituras**.
- Las políticas se modifican con `ALTER POLICY`, nunca `DROP` + `CREATE`, para que la tabla no quede sin protección ni un instante. (Nota: `CREATE OR REPLACE POLICY` no existe en PostgreSQL; `ALTER POLICY` es la forma correcta y es la que el proyecto ya usa en `20260806171655`.)
- Cada una trae su rollback.

### M1 — `reassignment_requests`: obligatoriedad y dominios (NOT VALID)

```sql
set lock_timeout = '3s';

alter table public.reassignment_requests
  add constraint rr_investor_id_not_null     check (investor_id is not null) not valid,
  add constraint rr_from_project_not_null    check (from_project_id is not null) not valid,
  add constraint rr_to_project_not_null      check (to_project_id is not null) not valid,
  add constraint rr_status_not_null          check (status is not null) not valid,
  add constraint rr_amount_not_null          check (amount is not null) not valid,
  add constraint rr_amount_positive          check (amount > 0) not valid,
  add constraint rr_from_differs_from_to     check (from_project_id <> to_project_id) not valid,
  add constraint rr_resolution_coherent      check (
    (status = 'pendiente' and resolved_at is null and resolved_by is null)
    or (status <> 'pendiente' and resolved_at is not null and resolved_by is not null)
  ) not valid;
```

*Rollback:* `alter table public.reassignment_requests drop constraint rr_investor_id_not_null, drop constraint …;`

### M2 — `reassignment_requests`: validar

```sql
set lock_timeout = '3s';
alter table public.reassignment_requests validate constraint rr_investor_id_not_null;
-- … una sentencia por constraint
```

*Rollback:* no aplica; validar no cambia datos. Para revertir se ejecuta el rollback de M1.

Una vez validados los tres `is not null`, se puede convertir a `SET NOT NULL` real sin escaneo: desde PostgreSQL 12 el planificador usa el CHECK ya validado como prueba. Va en migración aparte por si se prefiere no darlo.

### M3 — `investment_interests`: obligatoriedad, dominios y saneamiento (NOT VALID)

```sql
set lock_timeout = '3s';

alter table public.investment_interests
  add constraint ii_user_id_not_null      check (user_id is not null) not valid,
  add constraint ii_project_id_not_null   check (project_id is not null) not valid,
  add constraint ii_type_pref_not_null    check (investment_type_pref is not null) not valid,
  add constraint ii_status_not_null       check (status is not null) not valid,
  add constraint ii_amount_positive       check (amount is null or amount > 0) not valid,
  add constraint ii_comments_length       check (comments is null or length(comments) <= 2000) not valid,
  add constraint ii_comments_not_blank    check (comments is null or btrim(comments) <> '') not valid,
  add constraint ii_phone_e164            check (phone is null or phone ~ '^\+[1-9]\d{6,14}$') not valid;
```

*Rollback:* simétrico a M1.

### M4 — `investment_interests`: validar

Igual que M2.

### M5 — Reglas cruzadas de solicitudes (trigger)

Pendiente de decisión. Esbozo:

```sql
set lock_timeout = '3s';

create or replace function public.validate_reassignment_request()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_available numeric;
begin
  -- origen cerrado / destino abierto / capital suficiente,
  -- replicando lib/requests/availability.ts
  ...
  return new;
end $$;

create trigger reassignment_requests_validate
  before insert on public.reassignment_requests
  for each row execute function public.validate_reassignment_request();
```

*Rollback:* `drop trigger reassignment_requests_validate on public.reassignment_requests; drop function public.validate_reassignment_request();`

**Orden de despliegue:** M1 → M2 → M3 → M4, verificando entre cada una. M5 solo tras aprobar la decisión D3.

---

## 7. Estrategia de pruebas

### 7.1 Dónde se prueba

En una **rama de Supabase** con copia del esquema y de los datos. Es lo más cercano a producción: mismo motor, mismos datos, mismas políticas. La alternativa local (`supabase start`) exige Docker, que hoy no corre en esta máquina — habría que levantarlo o usar la rama.

Secuencia: aplicar M1–M4 en la rama, correr los casos de abajo, aplicar M5, repetir, y solo entonces tocar producción.

### 7.2 Casos por constraint

Para cada uno: el valor válido que debe pasar, el inválido que debe ser rechazado, y el límite.

| Constraint | Pasa | Rechaza | Límite |
|---|---|---|---|
| `rr_amount_positive` | `1000` | `-500`, `0` | `0.01` pasa |
| `rr_amount_not_null` | `1000` | `null` | — |
| `rr_from_differs_from_to` | dos UUID distintos | el mismo UUID en ambos | — |
| `rr_resolution_coherent` | `pendiente` + ambos null | `pendiente` + `resolved_at` puesto | `aprobada` + ambos puestos pasa |
| `ii_amount_positive` | `50000`, `null` | `-1`, `0` | `0.01` pasa |
| `ii_comments_length` | 2000 caracteres | 2001 caracteres | 2000 exactos pasa |
| `ii_comments_not_blank` | `"hola"`, `null` | `"   "`, `""` | — |
| `ii_phone_e164` | `+573001112233`, `null` | `3001112233`, `+0300`, `abc` | `+1234567` (7 dígitos) pasa; `+123456` rechaza |
| `ii_type_pref_not_null` | `equity` | `null` | valor fuera del dominio ya lo rechaza el CHECK existente |
| Trigger M5 | monto ≤ disponible, origen cerrado | monto = disponible + 0.01; origen en construcción | monto = disponible exacto pasa |

### 7.3 Que la web siga funcionando igual

Los constraints son más estrictos que Zod en ningún caso, así que ninguna acción legítima debería romperse. Aun así hay que ejercitar, con sesión de inversionista real:

1. **Crear una solicitud de reasignación** desde `/solicitudes` → debe guardar igual que hoy.
2. Intentar **monto mayor al disponible** → debe seguir dando el mensaje en español de Zod, **no** un error de base de datos. Si aparece un error crudo de Postgres, la validación de código dejó de correr antes que la de base y hay que revisar el orden.
3. **Enviar un formulario de interés** desde el detalle de un proyecto, con y sin monto, con y sin comentarios.
4. Enviar un interés con **comentario largo** (cerca de 2000) → Zod lo corta antes; el constraint no debe verse nunca.
5. Con sesión de admin: **editar y guardar** las tablas Solicitudes e Interés de inversión en el panel. Es la ruta `SECURITY DEFINER`, la que RLS no protege y los constraints sí — si algo se rompe, aparece aquí.
6. Comprobar que `/inicio` y `/mis-inversiones` siguen mostrando las mismas cifras.

La suite automatizada (622 tests) debe seguir en verde, en particular `supabase/policies/requests-insert.rls.test.ts` e `interests-insert.rls.test.ts`, que ya ejercitan estas dos tablas con JWT reales.

### 7.4 Simular el cliente móvil

Es la prueba que de verdad cierra la auditoría: confirmar que el constraint bloquea lo que Zod bloqueaba, atacando PostgREST directamente.

```bash
# 1. Obtener un access token de un inversionista de prueba
TOKEN=$(curl -s -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" -H "content-type: application/json" \
  -d '{"email":"inversionista.prueba@ejemplo.com","password":"..."}' \
  | jq -r .access_token)

# 2. Insertar saltándose por completo Next.js y Zod
curl -i -X POST "$SUPABASE_URL/rest/v1/reassignment_requests" \
  -H "apikey: $ANON_KEY" \
  -H "authorization: Bearer $TOKEN" \
  -H "content-type: application/json" \
  -d '{"investor_id":"<ficha-del-token>","from_project_id":"<uuid>",
       "to_project_id":"<otro-uuid>","amount":-999999,"status":"pendiente"}'
```

**Antes** de las migraciones esto devuelve `201 Created`. **Después** debe devolver `400` con violación de `rr_amount_positive`.

La batería mínima, toda con el mismo token de inversionista:

| Intento | Antes | Después |
|---|---|---|
| `amount: -999999` | 201 | 400 |
| `amount: 0` | 201 | 400 |
| `amount: null` | 201 | 400 |
| `from_project_id` = `to_project_id` | 201 | 400 |
| `resolved_by` relleno con status `pendiente` | 201 | 400 |
| `investor_id` de **otro** inversionista | 401/403 (RLS ya lo bloquea) | igual |
| interés con `comments` de 5000 caracteres | 201 | 400 |
| interés con `phone: "no-es-un-telefono"` | 201 | 400 |
| solicitud legítima dentro del disponible | 201 | 201 |

La última fila es la importante: hay que confirmar que **no** rompimos el caso bueno.

Estas pruebas **se ejecutan contra la rama, nunca contra producción**, porque las que pasan escriben filas de verdad.

---

## Resultados de las verificaciones

Tres comprobaciones pedidas tras la primera versión del informe. Todas de solo lectura.

### V1 — El catálogo real (cierra D1)

`npx supabase db dump --linked --schema public -f docs/schema-produccion.sql`, con Docker levantado.

**El catálogo coincide con las migraciones, línea por línea. No hay deriva.** Nadie tocó estas tablas a mano desde el panel de Supabase. Lo literal:

```sql
CREATE TABLE IF NOT EXISTS "public"."reassignment_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "investor_id" "uuid",
    "from_project_id" "uuid",
    "to_project_id" "uuid",
    "amount" numeric(14,2),
    "status" "text",
    "requested_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_at" timestamp with time zone,
    "resolved_by" "uuid",
    CONSTRAINT "reassignment_requests_status_check"
      CHECK (("status" = ANY (ARRAY['pendiente'::"text", 'aprobada'::"text", 'rechazada'::"text"])))
);
```

Confirmado también, ahora desde el catálogo y no por deducción:

- **Índices:** ninguno más allá de las dos claves primarias. Sin UNIQUE.
- **Políticas:** las cinco, con el texto exacto que reproduce la sección 2.4.
- **Claves foráneas y `ON DELETE`:** `RESTRICT` en las tres de solicitudes, `CASCADE` en las dos de intereses.

El DDL queda archivado en `docs/schema-produccion.sql` para el manual técnico.

### V2 — `users.phone` contra E.164 (cierra D5)

El riesgo estaba bien visto: `investment_interests.phone` se copia de `users.phone`, así que medirlo contra las 7 filas de intereses no dice nada. Lo que importa es el origen.

| Tabla | Filas | Violan E.164 | NULL o vacío |
|---|---|---|---|
| `users.phone` | 6 | **0** | 3 |
| `investors.phone` | 10 | **0** | 1 |

Los tres teléfonos con valor son `+573165831231`, `+573504411438` y `+573001111111`. Todos pasan. Los NULL no son problema: el constraint propuesto es `phone is null or phone ~ '...'`.

**El constraint `ii_phone_e164` es seguro de aplicar hoy.**

Con un matiz que conviene registrar: **`users.phone` no tiene ningún constraint propio**. Hoy está limpio porque el onboarding compone el E.164, pero nada en la base lo obliga. Si algún día entra ahí un teléfono mal formado, el fallo no aparecerá en el perfil — aparecerá cuando esa persona envíe un formulario de interés, como un error de base en producción. Constreñir `users.phone` está fuera del alcance de esta auditoría, pero es la corrección de raíz.

### V3 — Quién rellena `resolved_at` y `resolved_by`

**Nadie. No hay una sola línea de código que los escriba.** El rastreo completo del repositorio devuelve tres apariciones, y ninguna es una escritura:

- `table-definitions.ts`: expone `resolved_at` como columna editable en el panel.
- `solicitudes/actions.ts`: dos comentarios que dicen justamente que no se escriben.

Los valores de las tres filas resueltas vienen de los datos de siembra.

Esto cambia el diagnóstico de `rr_resolution_coherent`, y no en la dirección que suponíamos:

**La aprobación no se rompe, porque no existe.** En el panel, la columna `status` de Solicitudes está marcada `readOnly` —con el comentario de que aprobar debe pasar por una pantalla de aprobaciones que no se construyó—. Un admin no puede cambiar el estado desde ahí. Tu corrección sobre BEFORE INSERT frente a UPDATE es válida, y además el UPDATE ni siquiera está disponible.

**Pero hay un caso real de rotura, distinto:** `resolved_at` **sí** es editable en el panel (`type: "date"`, sin `readOnly`). Si un admin le pone fecha a una solicitud que sigue en `pendiente`, el constraint la rechaza y el guardado por lotes falla con un error crudo de Postgres — `admin_save_table_changes` no traduce violaciones de constraint a los mensajes en español de `lib/table/validation.ts`.

**Recomendación: sacar `rr_resolution_coherent` de M1 y dejarlo para cuando se construya la pantalla de aprobaciones.** Las razones, en orden:

1. Protege un flujo que hoy no existe. No hay ruta, ni desde la web ni desde la móvil, que ponga una solicitud en `aprobada`.
2. Su único efecto observable hoy sería hacer fallar una columna del panel que sí funciona.
3. Cuando se construya la aprobación, el constraint y el código que rellena esos dos campos deben diseñarse juntos. Ponerlo antes obliga a adivinar el contrato.

Si prefieres dejarlo dentro, la condición previa es marcar `resolved_at` como `readOnly` en `table-definitions.ts` — que es un cambio de código, no de base, y sale del alcance de esta sesión.

### V4 — Origen del capital negativo (cierra D2 a medias)

`f1d44c2b` es **dato de siembra**, no un inversionista real:

```
full_name  Andrés Felipe Ruiz
email      af.ruiz@ejemplo.com
notes      [MOCK] Firmó en mayo.
user_id    null        <-- sin cuenta; nadie puede iniciar sesión como él
status     comprometido
```

De las 10 fichas de `investors`, **5 están marcadas `[MOCK]`** en sus notas. La cifra que manejabas —8 inversionistas reales con 17 aportes— no cuadra con lo que hay en la base: 10 fichas, 5 de ellas de prueba, y 18 aportes. Conviene aclararlo antes de borrar nada.

**Y las cinco solicitudes no son todas de siembra.** Tres lo son (mayo, junio y julio, con marcas de tiempo redondas y `resolved_at` puesto). Las otras dos se crearon con la aplicación durante las pruebas de agosto, y pertenecen a `f5e9f1c5` — **una ficha real y vinculada a una cuenta**:

| Solicitud | Fecha | Inversionista | Origen |
|---|---|---|---|
| `db7dea35` | 2026-05-11 11:00:00 | Andrés Felipe Ruiz (MOCK) | siembra |
| `215699d8` | 2026-06-02 09:10:00 | Andrés Felipe Ruiz (MOCK) | siembra |
| `5f2c1620` | 2026-07-18 14:20:00 | María Fernanda Gómez (MOCK) | siembra |
| `5b79e114` | 2026-08-06 17:26:50.539 | Juan Camilo (real, vinculado) | app |
| `d2793dfb` | 2026-08-07 13:56:45.780 | Juan Camilo (real, vinculado) | app |

Dijiste "si es de siembra, borrá las cinco". **No lo hice**, por dos motivos: dos de las cinco no son de siembra, y borrar filas es una modificación de datos que esta sesión tenía prohibida. Queda listo para ejecutar en cuanto confirmes el alcance.

### V5 — Fuera de alcance, pero anotado: la aprobación es el momento sin cubrir

Tu observación es correcta y la dejo registrada aquí para que no se pierda. Un trigger `BEFORE INSERT` protege la creación, que es el objetivo de esta auditoría. No cubre el instante en que el dinero se mueve de verdad: entre que se crea la solicitud y se aprueba, la disponibilidad puede haber cambiado.

Es el mismo trabajo aplicado a `BEFORE UPDATE` cuando `status` pasa a `aprobada`, y pertenece al sprint de la pantalla de aprobaciones, junto con `rr_resolution_coherent` y con el código que rellene `resolved_at` y `resolved_by`. Los tres son la misma pieza.

---

## Decisiones que necesitan tu aprobación

### D1 — Confirmar el catálogo real antes de escribir migraciones — **RESUELTA**

> Aprobada la opción (a). Ejecutada: ver V1. Sin deriva; `docs/schema-produccion.sql` archivado.

**El problema:** las definiciones y políticas de la sección 2.3 y 2.4 están reconstruidas desde las migraciones, no leídas del catálogo. No detectarían un cambio hecho a mano desde el panel de Supabase.

**Opciones:**
- **(a)** Levantar Docker y correr `npx supabase db dump --linked --schema public`. Da el DDL completo y real.
- **(b)** Pasarme la contraseña de la base (Settings → Database) para consultar `pg_constraint`, `pg_policies` y `pg_indexes` directamente.
- **(c)** Asumir que las migraciones son fieles y seguir.

**Recomiendo (a).** No requiere compartir credenciales, es un comando, y deja el DDL real archivado para el manual técnico. (c) es probablemente correcta —el proyecto ha sido disciplinado con migraciones— pero "probablemente" es poco para tocar una base en producción.

### D2 — Qué hacer con las 5 solicitudes que no cumplen la regla de negocio — **PENDIENTE, con dato nuevo**

> `f1d44c2b` es de siembra (V4), pero **dos de las cinco solicitudes no lo son**: pertenecen a una ficha real y vinculada. Falta decidir el alcance del borrado.

**El problema:** las cinco tienen un origen que no es un proyecto cerrado. Dos no tienen posición en el origen. Una está aprobada y dejó una posición en **−15.000**.

**Opciones:**
- **(a)** Dejarlas. El trigger solo aplica a inserciones nuevas, así que no estorban.
- **(b)** Corregir la fila `215699d8`, que es la que produce el capital negativo.
- **(c)** Borrar las cinco si son datos de siembra.

**Recomiendo (b), y confirmar antes si son datos reales o de prueba.** El capital negativo es visible hoy para ese inversionista en su pantalla de Inicio. Si es una cuenta de prueba, (c) es más limpio. Si hay un inversionista real detrás, hay que entender cómo se aprobó esa reasignación antes de tocar nada. **Necesito que me digas cuál es el caso.**

### D3 — Trigger o función de política para las reglas cruzadas — **RESUELTA (a)**

> Trigger `BEFORE INSERT`. **Corrección al análisis original:** sobrestimé el impacto en el panel. La aprobación es un UPDATE y el trigger es BEFORE INSERT, así que no la toca — y de hecho la aprobación desde el panel ni siquiera existe (ver V3).

**El problema:** una función en el `WITH CHECK` no protege la ruta del panel admin (`SECURITY DEFINER`); un trigger protege las dos, pero también impide que un admin cree por el panel una solicitud que hoy sí puede crear.

**Opciones:**
- **(a)** Trigger `BEFORE INSERT`. Cubre todo.
- **(b)** Función en la política. Solo cubre la ruta directa; el panel sigue como está.
- **(c)** Trigger, pero que se salte la validación cuando quien escribe es admin.

**Recomiendo (a).** Si un admin puede crear por el panel una solicitud que el sistema considera inválida, la regla no es una regla. (c) suena conciliador pero reintroduce el agujero por la puerta de al lado. Ahora bien, **(a) cambia el comportamiento del panel**, y eso hay que decidirlo con conocimiento: hoy los cinco registros existentes se crearon de un modo que el trigger rechazaría.

### D4 — Convertir los CHECK de nulidad en `SET NOT NULL` — **RESUELTA (b)**

> Entra como migración propia después de validar.

**El problema:** `check (col is not null)` y `NOT NULL` son equivalentes en la práctica, pero solo el segundo aparece en el esquema, en los tipos generados y en el OpenAPI que consumirá la app móvil.

**Opciones:**
- **(a)** Dejar los CHECK. Menos pasos.
- **(b)** Añadir una migración que convierta a `SET NOT NULL` tras validar. Sin escaneo, gracias al CHECK ya validado.

**Recomiendo (b).** El equipo móvil leerá el contrato desde el OpenAPI de PostgREST, y ahí `required` solo refleja `NOT NULL` real. Con la opción (a), su cliente generado seguiría creyendo que `amount` es opcional.

### D5 — Alcance de `phone` en intereses — **RESUELTA (a)**

> Verificado contra `users.phone`: 0 violaciones (ver V2). El CHECK entra en M3. El GRANT de columna queda para cuando se defina el contrato con el equipo móvil.

**El problema:** hoy `phone` no viene del formulario, se copia del perfil. Un cliente móvil sí podría mandarlo, porque la columna existe y RLS no la menciona.

**Opciones:**
- **(a)** CHECK de formato E.164, como propongo en M3.
- **(b)** Además, revocar el `INSERT` sobre esa columna a `authenticated` con un GRANT de columnas, como ya se hizo con `users` en `20260806172657`.

**Recomiendo (a) ahora y (b) cuando se defina el contrato con el equipo móvil.** (b) es más estricto pero cierra la puerta a que la app móvil recoja el teléfono en el propio formulario, que puede ser justo lo que quieran hacer. **Conviene preguntarles antes.**

---

## Ambigüedades encontradas

**No asumí nada en estos cuatro puntos:**

1. **`current_capital = −15.000`.** No sé si `f1d44c2b…` es un inversionista real o de prueba. Cambia por completo qué hacer (D2).

2. **Un proyecto tiene `status = null`** ("Proyecto de testing 2"). Está fuera del alcance de esta auditoría, pero `projects.status` tiene el mismo patrón de CHECK-que-admite-NULL. Si la app móvil va a leer proyectos, conviene una auditoría equivalente de esa tabla.

3. **`ON DELETE cascade` en `investment_interests`.** Borrar un usuario borra sus intereses. Puede ser deliberado o un descuido heredado; no lo toqué porque no está en el alcance.

4. **El límite de 2000 caracteres en `comments` no está en ningún documento de negocio.** Sale del Zod. Lo propuse como constraint porque es la regla que rige hoy, pero si el número es arbitrario, este es el momento de fijarlo con criterio.

---

## Verificación de esta sesión

No se modificó la base de datos, no se crearon migraciones y no se cambió código de aplicación. Solo se leyó.

```
npx tsc --noEmit   → sin errores
npm run lint       → sin errores
```

Los archivos temporales de auditoría se eliminaron. El único archivo nuevo es este informe.
