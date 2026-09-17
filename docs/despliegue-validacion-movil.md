# Despliegue de validación para el cliente móvil — M1 a M4

**Fecha:** 18 de agosto de 2026
**Base:** [docs/auditoria-validacion-movil.md](auditoria-validacion-movil.md)
**Estado: PROBADO, NO DESPLEGADO.** Nada se aplicó a producción. Las cuatro migraciones existen como archivos versionados y están pendientes en remoto.

---

## 1. Migraciones creadas

| Archivo | Qué hace |
|---|---|
| `20260818200855_validacion_solicitudes_constraints.sql` | M1 — 7 constraints en `reassignment_requests`, `NOT VALID` |
| `20260818200913_validacion_solicitudes_validate.sql` | M2 — valida los 7; 5 columnas a `SET NOT NULL`; borra los checks de nulidad redundantes |
| `20260818200928_validacion_intereses_constraints.sql` | M3 — 8 constraints en `investment_interests`, `NOT VALID` |
| `20260818200943_validacion_intereses_validate.sql` | M4 — valida los 8; 4 columnas a `SET NOT NULL`; borra los redundantes |

Las cuatro empiezan con `set lock_timeout = '3s';`, ninguna contiene `INSERT`, `UPDATE`, `DELETE` ni `TRUNCATE`, ninguna toca políticas RLS, y cada una lleva su rollback en un comentario al final del archivo.

Fuera de esta tanda, como se acordó: `rr_resolution_coherent` y el trigger de reglas cruzadas (M5).

---

## 2. Dónde se probó, y por qué no en una rama

**El plan pedía una rama de Supabase. No fue posible:**

```
$ npx supabase branches create validacion-movil --persistent
402 "Branching is supported only on the Pro plan or above"
```

**Segundo intento, stack local completo (`supabase start`). También falló**, por un problema ajeno a este trabajo:

```
Applying migration 20260804182713_documents_storage_read_policy.sql...
ERROR: comment on policy "documents_objects_select_entitled" on storage.objects
```

En Supabase alojado esa migración corre con un rol que puede comentar una política de `storage.objects`; en local, no. Afecta también a `20260806230453_project_photos_storage_policies.sql`. **Significa que `supabase start` y `supabase db reset` están rotos en este proyecto desde el 4 de agosto.** Arreglarlo queda fuera del alcance de esta sesión; ver [Pendientes](#7-lo-que-no-se-pudo-probar-y-qué-hace-falta).

**Lo que se montó en su lugar**, que para el objetivo de esta tanda es equivalente y en un punto es mejor:

- Contenedor `public.ecr.aws/supabase/postgres:17.6.1.147`, **la misma versión que produce producción**.
- Dos bases: `precopy` (sin migrar) y `prodcopy` (migrada), ambas cargadas con **el DDL real de producción** (`docs/schema-produccion.sql`, obtenido con `db dump`) y **los datos reales** (`db dump --data-only`).
- Dos instancias de PostgREST v14.5, una contra cada base, con JWT HS256, para atacar por HTTP igual que hará la app móvil.

Es mejor que una réplica de migraciones en un punto: el esquema no se reconstruye replayando, se carga tal como está hoy en producción.

Lo que esta réplica **no** cubre: GoTrue, Storage y la aplicación Next.js. De ahí la sección 7.

---

## 3. Aplicación de las migraciones

Aplicadas en orden sobre la copia con datos reales. Ninguna falló.

| Migración | Resultado | Estado tras aplicarla |
|---|---|---|
| M1 | OK | 7 constraints creados, los 7 con `convalidated = f` |
| M2 | OK | 7 validados; `investor_id`, `from_project_id`, `to_project_id`, `status`, `amount` con `NOT NULL` real; los 5 checks de nulidad eliminados |
| M3 | OK | 8 constraints creados, `NOT VALID` |
| M4 | OK | 8 validados; `user_id`, `project_id`, `investment_type_pref`, `status` con `NOT NULL`; los 4 checks eliminados |

**Ningún `VALIDATE CONSTRAINT` falló**, tal como anticipaba la auditoría al contar cero violaciones sobre los datos reales.

Estado final verificado en el catálogo:

```
reassignment_requests   NOT NULL: id, investor_id, from_project_id, to_project_id,
                                  amount, status, requested_at
                        checks vivos: rr_amount_positive (validado),
                                      rr_from_differs_from_to (validado)

investment_interests    NOT NULL: id, user_id, project_id, investment_type_pref,
                                  status, created_at
                        checks vivos: ii_amount_positive, ii_comments_length,
                                      ii_comments_not_blank, ii_phone_e164
                                      (los cuatro validados)
```

Confirmación adicional, no planeada pero útil: las 12 filas reales se cargaron **después** de aplicar las migraciones, con los constraints ya activos, y entraron sin una sola violación.

### 3.1 ¿`SET NOT NULL` disparó un escaneo de tabla?

**No.** Con 12 filas la pregunta no se puede medir, así que se reprodujo el patrón sobre **3 millones de filas** en el mismo contenedor:

| Operación | Duración |
|---|---|
| **A)** `SET NOT NULL` **sin** check previo | **3.740 ms** |
| **B)** `ADD CONSTRAINT ... NOT VALID` | 15 ms |
| **B)** `VALIDATE CONSTRAINT` | 619 ms |
| **B)** `SET NOT NULL` con el check ya validado | **3,96 ms** |
| **B)** `DROP CONSTRAINT` del redundante | 33 ms |

El `SET NOT NULL` de M2 y M4 es **945 veces más rápido** que el mismo comando sin la prueba previa. No escanea.

Y el reparto de bloqueos es el que interesa en producción: el único escaneo ocurre en `VALIDATE CONSTRAINT`, que toma un `SHARE UPDATE EXCLUSIVE` — **no bloquea lecturas ni escrituras**. Los pasos que sí toman `ACCESS EXCLUSIVE` duran milisegundos.

Por eso el `DROP` del check va **después** del `SET NOT NULL` y no antes: al revés se pierde la prueba y Postgres vuelve a escanear.

---

## 4. Pruebas

### 4.1 Matriz de constraints (sección 7.2 del informe de auditoría)

29 casos: el valor válido que debe pasar, el inválido que debe ser rechazado, y el límite.

**29 OK. Cero discrepancias.** Cada caso corrió en su propia transacción abortada; las tablas terminaron con las mismas 5 y 7 filas.

Los límites, que son los que suelen fallar:

| Caso | Esperado | Obtenido |
|---|---|---|
| `rr_amount_positive`: `0.01` | pasa | pasa |
| `rr_amount_positive`: `0` | rechaza | rechaza |
| `ii_comments_length`: 2000 caracteres | pasa | pasa |
| `ii_comments_length`: 2001 caracteres | rechaza | rechaza |
| `ii_phone_e164`: `+1234567` (7 dígitos) | pasa | pasa |
| `ii_phone_e164`: `+123456` (6 dígitos) | rechaza | rechaza |
| `ii_phone_e164`: `+0300` (empieza en 0) | rechaza | rechaza |
| `ii_amount_positive`: `null` | pasa (es opcional) | pasa |

### 4.2 Batería HTTP simulando el cliente móvil (sección 7.4)

Inserts directos a PostgREST con un JWT de inversionista, **saltándose Next.js y Zod por completo**. Cada intento se mandó a las dos copias: la sin migrar da el "antes", la migrada el "después".

| Tabla | Intento | Antes | Después | Veredicto |
|---|---|---|---|---|
| solicitudes | `amount: -999999` | 201 | **400** | OK |
| solicitudes | `amount: 0` | 201 | **400** | OK |
| solicitudes | `amount: null` | 201 | **400** | OK |
| solicitudes | `from_project_id` = `to_project_id` | 201 | **400** | OK |
| solicitudes | `from_project_id: null` | 201 | **400** | OK |
| solicitudes | `resolved_by` con status `pendiente` | 201 | 201 | OK (esperado: fuera de esta tanda) |
| solicitudes | `investor_id` de **otro** inversionista | 403 | 403 | OK (RLS ya lo bloqueaba) |
| solicitudes | **legítima** | 201 | **201** | OK |
| intereses | `comments` de 5000 caracteres | 201 | **400** | OK |
| intereses | `phone: "no-es-un-telefono"` | 201 | **400** | OK |
| intereses | `amount: -1` | 201 | **400** | OK |
| intereses | `investment_type_pref: null` | 201 | **400** | OK |
| intereses | `comments` solo espacios | 201 | **400** | OK |
| intereses | **legítimo** | 201 | **201** | OK |

**14 de 14 según lo esperado.** Los dos casos legítimos siguen devolviendo 201: no se rompió el camino bueno.

La fila de `resolved_by` merece una nota: sigue en 201 **a propósito**. Es lo que cubriría `rr_resolution_coherent`, que se dejó fuera de esta tanda por decisión tomada.

### 4.3 Suite automatizada

```
Test Files  44 passed (44)
Tests      622 passed (622)
```

Incluye `supabase/policies/requests-insert.rls.test.ts` e `interests-insert.rls.test.ts`, que ejercitan estas dos tablas con JWT reales.

**Matiz honesto:** esos dos corren contra producción, que **todavía no está migrada**. Confirman que las políticas RLS siguen intactas, no el comportamiento posterior a la migración. Hay que volver a correrlos después del despliegue.

---

## 5. Cambio de tipos y archivos tocados

Nueve columnas pasan de admitir null a no admitirlo, lo que cambia el contrato de TypeScript.

**Archivo tocado: `types/database.ts`. Uno solo.**

27 líneas: 9 columnas × 3 secciones (`Row`, `Insert`, `Update`).

```
reassignment_requests   amount, from_project_id, investor_id, status, to_project_id
investment_interests    investment_type_pref, project_id, status, user_id
```

- `Row`: `tipo | null` → `tipo`
- `Insert`: `col?: tipo | null` → `col: tipo` (sin default, pasa a obligatoria)
- `Update`: `col?: tipo | null` → `col?: tipo` (sigue opcional)

### Por qué la edición es quirúrgica y no una regeneración completa

Se intentó `supabase gen types typescript --db-url` contra la copia migrada. **Funcionó, pero el archivo salió incompleto:** perdió el bloque `graphql_public` y `__InternalSupabase.PostgrestVersion: "14.5"`, porque la copia no tiene la extensión pg_graphql ni un PostgREST vivo del que leer la versión.

Enviar ese archivo habría metido una regresión silenciosa en el tipado del cliente. En su lugar se partió del archivo canónico —el que generó producción— y se aplicaron solo los 27 cambios de nulabilidad, verificando que el diff no contiene nada más.

**Cuando producción esté migrada, lo correcto es regenerar de verdad** con `npx supabase gen types typescript --linked` y confirmar que el resultado coincide.

### Código de aplicación: cero cambios necesarios

```
npx tsc --noEmit   → sin errores
npm run lint       → sin errores
```

No hubo comprobaciones de null muertas ni accesos que dejaran de compilar. La razón: las rutas que escriben estas tablas construyen el objeto completo en la Server Action, y las que leen ya trataban los valores como presentes o pasaban por los helpers de formato.

---

## 6. Procedimiento de despliegue a producción

**No ejecutado. Requiere aprobación.**

### Antes de empezar

1. `git status` limpio.
2. `npx tsc --noEmit` y `npm run lint` sin errores.
3. Suite en verde.
4. `npx supabase migration list` debe mostrar las cuatro en local y no en remoto.
5. **Comprobar en el panel de Supabase que existe un backup reciente y anotar su marca de tiempo.** El plan gratuito no genera backups automáticos diarios; si no hay uno, detenerse.

### Aplicación

```bash
npx supabase db push        # aplica las cuatro en orden
```

`db push` las aplica todas de una vez. Para verificar entre cada una hay que empujarlas de a una, marcando las siguientes como pendientes, o verificar al final contra la lista de comprobación de abajo. **Recomiendo lo segundo**: las cuatro son rápidas y el estado final es inequívoco.

Verificación tras M1 y M3 (constraints creados, sin validar):

```sql
select conname, convalidated from pg_constraint
where conrelid = 'public.reassignment_requests'::regclass and contype = 'c'
order by conname;
-- los 7 nuevos deben aparecer con convalidated = false
```

Verificación tras M2 y M4 (validados, NOT NULL real, redundantes fuera):

```sql
select column_name, is_nullable from information_schema.columns
where table_name = 'reassignment_requests' order by ordinal_position;
-- investor_id, from_project_id, to_project_id, amount, status -> NO

select conname, convalidated from pg_constraint
where conrelid = 'public.reassignment_requests'::regclass and contype = 'c';
-- deben quedar solo: reassignment_requests_status_check, rr_amount_positive,
-- rr_from_differs_from_to, los tres con convalidated = true
```

### Después de las migraciones, antes del deploy de código

1. **El OpenAPI debe listar las columnas como `required`.** Es el contrato que consumirá la app móvil y la comprobación que cierra el objetivo:

```bash
curl -s "$SUPABASE_URL/rest/v1/" -H "apikey: $ANON_KEY" \
  | jq '.definitions.reassignment_requests.required'
# esperado: ["id","investor_id","from_project_id","to_project_id","amount","status","requested_at"]
```

2. **El conteo de filas debe ser idéntico:** 5 en `reassignment_requests`, 7 en `investment_interests`.

3. **Tres inserts inválidos por curl**, con token de un inversionista de prueba: `amount` negativo, `amount` nulo, y `from_project_id` igual a `to_project_id`. Los tres deben dar **400**. No escriben nada, por eso son seguros en producción.

**No ejecutar en producción el caso legítimo de la batería:** escribiría una solicitud real, y estas tablas no tienen política de DELETE.

### Deploy del código

**Solo después** de que las cuatro migraciones estén aplicadas y verificadas, desplegar a Vercel el cambio de `types/database.ts`.

El orden no es negociable: si el código sale primero, asume que las columnas no son nulas mientras la base todavía lo permite.

### Rollback

En orden inverso al despliegue, por la misma razón:

1. Revertir el deploy de Vercel a la versión anterior.
2. Aplicar los rollbacks de M4 → M3 → M2 → M1, cada uno en el comentario al final de su archivo.

`DROP NOT NULL` no escanea la tabla: el rollback de M2 y M4 es inmediato.

### Cuándo hacer rollback

- Un usuario real no puede completar una acción que antes completaba.
- Aparece un error crudo de Postgres en la interfaz.
- Las cifras de `/inicio` cambian.
- Los logs muestran violaciones de constraint en operaciones legítimas.

---

## 7. Lo que NO se pudo probar, y qué hace falta

Cuatro bloques del plan de pruebas quedaron sin ejecutar. Todos por la misma causa: **necesitan la aplicación Next.js corriendo contra una base migrada**, y el stack local está roto por las dos migraciones de `storage.objects`.

| Bloque del plan | Estado |
|---|---|
| 7.2 — matriz de constraints | **Hecho.** 29/29 |
| 7.4 — batería HTTP del cliente móvil | **Hecho.** 14/14 |
| Suite automatizada | **Hecha.** 622/622 |
| 7.3 — app web: crear solicitud, monto excedido, formulario de interés | **Parcial** (ver §10) |
| 7.5 — panel admin: editar y guardar Solicitudes e Interés | **Hecho** (ver §10) |
| 7.6 — cifras de `/inicio` y `/mis-inversiones` | **Hecho, pasa** (ver §10) |

De los tres pendientes, **el más importante es el 7.5**: el panel escribe por `admin_save_table_changes`, que es `SECURITY DEFINER` y no pasa por RLS. Es la única ruta donde los constraints son la primera y única barrera, y donde un error de constraint saldría crudo, sin traducirse a los mensajes en español de `lib/table/validation.ts`.

**Para desbloquearlos hay dos caminos:**

- **(a)** Arreglar la portabilidad de las dos migraciones de storage envolviendo el `comment on policy` en un bloque que ignore el fallo de permisos. Es un cambio de una línea por archivo, no altera producción (el comentario ya existe allí) y devuelve `supabase start` y `supabase db reset` al equipo. **Es lo que recomiendo**, y además arregla el entorno local que lleva roto desde el 4 de agosto.
- **(b)** Contratar el plan Pro y usar una rama de Supabase, que era el plan original.

**Ninguno de los dos entra en el alcance de esta sesión.** Los dejo señalados para que decidas.

> **Actualización (18 ago).** Se tomó el camino (a). Las secciones 9 a 11 de este
> mismo documento recogen el arreglo y el resultado de los tres bloques.

---

## 8. Estado final

| | |
|---|---|
| Migraciones creadas | 4 |
| Aplicadas a producción | **Ninguna** |
| `VALIDATE CONSTRAINT` fallidos | 0 |
| Casos de constraint | 29/29 |
| Casos HTTP | 14/14 |
| Suite | 622/622 |
| `tsc` / `lint` | limpios |
| Archivos de código tocados | 1 (`types/database.ts`) |
| Datos modificados | **Ninguno** |

Las cuatro migraciones están listas para `db push`. Esperando aprobación.

---

## 9. Portabilidad del entorno local (sesión del 18 ago, tarde)

### Qué se envolvió

**Dos migraciones**, las mismas que señalaba la auditoría. Lo verifiqué buscando en todo el directorio, no solo esas dos:

```
$ grep -rln "storage\." supabase/migrations/
supabase/migrations/20260804182713_documents_storage_read_policy.sql
supabase/migrations/20260806230453_project_photos_storage_policies.sql
```

En cada una se envolvió **únicamente la sentencia `COMMENT ON POLICY`**. Los `CREATE POLICY` quedaron intactos a propósito: un comentario es documentación y su ausencia no cambia comportamiento; una política sí, y si esa fallara la migración debe detenerse.

### El error que se captura, verificado y no supuesto

Antes de escribir el manejador reproduje el fallo en un contenedor aparte, comentando una política de una tabla ajena:

```
COMMENT capturado por insufficient_privilege | SQLSTATE=42501 | must be owner of relation objetos
CREATE POLICY capturado por insufficient_privilege | SQLSTATE=42501
```

Así que el manejador captura **exclusivamente `insufficient_privilege`**. Cualquier otro error sigue abortando la migración:

```sql
do $do$
begin
  comment on policy "documents_objects_select_entitled" on storage.objects is '...';
exception when insufficient_privilege then
  raise notice 'Sin permiso para comentar ... (esperado en local). La política se creó igual.';
end
$do$;
```

Cada archivo lleva un comentario que empieza con **"NO QUITAR ESTA ENVOLTURA. No es defensa de más."** y explica el motivo, para que nadie la revierta por creerla excesiva.

### Por qué es un no-op en producción

Dos razones independientes, y la primera es concluyente:

**1. Los comentarios ya existen allí.** `docs/schema-produccion.sql` es un volcado de `public` únicamente, así que no contenía nada de storage. Extraje el esquema `storage` de producción para poder afirmarlo con evidencia (`docs/schema-produccion-storage.sql`):

```sql
COMMENT ON POLICY "documents_objects_select_entitled" ON "storage"."objects" IS 'Lets a user read an object of the documents bucket only when a public.documents row they are allowed to see points at it. ...';
COMMENT ON POLICY "project_photos_admin_insert" ON "storage"."objects" IS 'Only an admin may add project photos, matching projects_admin_write on the rows they belong to.';
```

Idénticos, palabra por palabra, a los que las migraciones escriben.

**2. Estas dos migraciones ya están aplicadas en producción.** Una migración aplicada no se vuelve a ejecutar, así que el archivo modificado no correrá allí nunca.

En producción el rol sí es dueño de `storage.objects`, de modo que si algún día se replicara desde cero, el `COMMENT` se ejecutaría con normalidad y la envoltura sería transparente.

### Verificación: `supabase start`

Las **21 migraciones** aplican sin error, incluidas las dos de storage y M1–M4:

```
Applying migration 20260804182713_documents_storage_read_policy.sql...
Applying migration 20260806171655_fix_requests_insert_status_guard.sql...
...
Applying migration 20260818200943_validacion_intereses_validate.sql...
```

**Un matiz honesto:** el primer `start` completo llegó al final de las migraciones y luego falló por *health-check* de cuatro contenedores auxiliares (Studio, storage-api, edge-runtime y realtime), no por SQL. La máquina tenía otros ocho contenedores de otros proyectos corriendo. El stack levanta bien excluyendo los servicios que estas pruebas no necesitan:

```
npx supabase start -x studio,imgproxy,edge-runtime,realtime,vector,supavisor,mailpit,logflare
→ API_URL http://127.0.0.1:54321   DB_URL postgresql://…@127.0.0.1:54322/postgres
```

Es una limitación de la máquina, no del arreglo. En un equipo menos cargado o con más margen de *timeout*, el `start` completo debería terminar.

### Verificación: `supabase db reset`

Limpio, salida 0, con las 21 migraciones y los dos NOTICE que demuestran que el manejador se disparó exactamente donde debía:

```
Applying migration 20260804182713_documents_storage_read_policy.sql...
NOTICE (00000): Sin permiso para comentar documents_objects_select_entitled (esperado en local). La política se creó igual.
...
Applying migration 20260806230453_project_photos_storage_policies.sql...
NOTICE (00000): Sin permiso para comentar project_photos_admin_insert (esperado en local). La política se creó igual.
...
Applying migration 20260818200943_validacion_intereses_validate.sql...
Finished supabase db reset on branch main.
{"target":"local","version":"","message":"Reset local database."}
EXIT:0
```

**El efecto queda intacto.** Las cinco políticas existen en local pese a que el comentario se saltó:

```
documents_objects_select_entitled
project_photos_admin_delete
project_photos_admin_insert
project_photos_admin_update
project_photos_read
```

**El entorno local del proyecto vuelve a funcionar, después de dos semanas roto.**

### Un ajuste de fidelidad que hubo que hacer

Tras `db reset`, los roles `authenticated` y `service_role` quedaban con `TRUNCATE, REFERENCES, TRIGGER` sobre las tablas de `public` — sin `SELECT`, `INSERT` ni `UPDATE`. Producción sí los tiene:

```sql
GRANT ALL ON TABLE "public"."reassignment_requests" TO "anon";
GRANT ALL ON TABLE "public"."reassignment_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."reassignment_requests" TO "service_role";
```

Es un artefacto del `db reset` local, que no reproduce los privilegios por defecto de la plataforma alojada. **No es un problema del producto ni de las migraciones**, y la evidencia es que producción funciona.

Para que el local fuera fiel se aplicaron las 111 sentencias `GRANT` **tal como están en el volcado de producción**. No se inventó ningún permiso: se copió el estado real.

---

## 10. Las tres verificaciones que quedaban pendientes

Base local con las 21 migraciones y **los datos reales de producción cargados**: 6 usuarios, 10 inversionistas, 12 proyectos, 5 solicitudes, 7 intereses, 15 transacciones. Cargaron **sin un solo error con los constraints M1–M4 ya activos**, que es una confirmación más de que los datos reales los cumplen.

### Bloque 7.6 — Las cifras: **PASA**

Comparación valor por valor entre producción (sin migrar) y local (migrada), sobre las vistas de las que salen `/inicio` y `/mis-inversiones`:

| Vista | Filas prod/local | ¿Idénticas? |
|---|---|---|
| `investor_financial_summary` | 10 / 10 | **Sí** |
| `investor_project_position` | 15 / 15 | **Sí** |
| `investor_totals` | 10 / 10 | **Sí** |
| `project_totals` | 12 / 12 | **Sí** |
| `project_fundraising` | 12 / 12 | **Sí** |

**59 filas, todas idénticas.** No a ojo: serializando cada fila con las claves ordenadas y comparando como texto.

### Bloque 7.5 — Panel de administrador: **DOS HALLAZGOS**

Se reprodujo exactamente lo que hace `saveTableChanges`: llamar al RPC `admin_save_table_changes` con un JWT de administrador real.

#### Hallazgo 1 — La tabla Solicitudes del panel NO se puede editar, y nunca se pudo

**Todos** los intentos sobre `reassignment_requests` fallan, incluidos los válidos:

```
── Solicitudes: monto VÁLIDO (2500)
   HTTP 400  RECHAZADO
   message : column "updated_at" of relation "reassignment_requests" does not exist
   code    : 42703
```

La causa **no tiene relación con M1–M4**:

- El RPC construye siempre `update public.%I set %s, updated_at = now() where id = %L` (línea 82 de `20260801170000_admin_batch_save.sql`).
- **`reassignment_requests` no tiene columna `updated_at`.** Confirmado en el volcado real de producción: 0 apariciones. `investment_interests` sí la tiene, por eso esa tabla sí funciona.

Es un fallo **preexistente en producción** desde que se construyó el panel. Cualquier edición de Solicitudes desde el panel ha fallado siempre con un error crudo de Postgres.

**Consecuencia para tu lista de pruebas:** el caso "editar `resolved_at` de una solicitud pendiente" **no se pudo comprobar**, porque esa tabla no admite ninguna edición. No es que M1–M4 lo rompan; no funcionaba antes.

Lo reporto y no lo arreglo, como pediste.

#### Hallazgo 2 — Ante una violación de constraint, el admin ve un error crudo en inglés

Los casos sobre `investment_interests`, que sí es editable:

| Caso | HTTP | Lo que ve el administrador |
|---|---|---|
| monto válido (75000) | 200 | guardado, sin mensaje |
| comentario válido | 200 | guardado, sin mensaje |
| monto 0 | 400 | `new row for relation "investment_interests" violates check constraint "ii_amount_positive"` |
| comentario de 2500 caracteres | 400 | `new row for relation "investment_interests" violates check constraint "ii_comments_length"` |
| comentario de solo espacios | 400 | `new row for relation "investment_interests" violates check constraint "ii_comments_not_blank"` |

Ese texto llega tal cual a la pantalla: `app/(admin)/admin/actions.ts` hace `return { ok: false, error: error.message }`, con el comentario *"The database message is already in Spanish for the cases we raise"* — cierto para las excepciones que la función lanza, **falso para una violación de constraint**, que trae el mensaje propio de Postgres, en inglés y con el nombre técnico del constraint.

El `details` incluye además **la fila completa**, con el correo y el teléfono del interesado.

**Qué filtra la validación TS antes de llegar ahí.** No todo llega a la base. `lib/table/validation.ts` sí atrapa algunos casos y devuelve español:

| Caso | Quién lo atrapa | Qué ve el admin |
|---|---|---|
| monto **negativo** | TS (`currency` rechaza `< 0`) | *"El monto en 'Monto' no puede ser un número negativo."* |
| monto **cero** | **la base** | mensaje crudo en inglés |
| comentario largo | **la base** (`longText` no valida longitud) | mensaje crudo en inglés |
| teléfono mal formado | TS (`phone`) | *"El teléfono en 'Teléfono' debe incluir el indicativo del país…"* |

Es decir: los constraints nuevos **abren tres huecos donde antes no había nada que fallara**, porque antes la base aceptaba esos valores. La brecha no la crea el constraint —el dato malo entraba igual—, pero sí cambia dónde se manifiesta.

**No lo arreglé.** El arreglo natural sería traducir los códigos `23514` (check) y `23502` (not null) a los mensajes de `es.validation` en `saveTableChanges`, mapeando el nombre del constraint. Es trabajo de otra sesión.

### Bloque 7.3 — Aplicación web: **PARCIAL**

La aplicación se levantó contra la base local migrada y responde correctamente:

| Ruta | Resultado |
|---|---|
| `/login` | 200 |
| `/portafolio`, `/inicio`, `/mis-inversiones`, `/solicitudes`, `/documentos`, `/admin` | 307 → `/login` |

Eso confirma lo que más importaba de este bloque: **la aplicación compila y arranca contra el esquema migrado, y el cambio de `types/database.ts` no rompe nada en ejecución.**

**Lo que no pude hacer, y hasta dónde llegué intentándolo.** Los tres casos
interactivos requieren clics en un navegador, y no hay automatización de
navegador en este entorno. Intenté rodearlo invocando las Server Actions por
HTTP como hace el cliente de Next —`POST` a la ruta con la cabecera
`Next-Action` y los argumentos en el cuerpo, leyendo los identificadores de
`server-reference-manifest.json`—.

Llegué a obtener sesión **por la propia acción de login de la app**, con un
inversionista real y una fuente de reasignación válida (60.000 vigentes en un
proyecto rentado). Ahí se atascó: `/solicitudes` sigue respondiendo 307 aunque
se mande la cookie que devolvió el login, así que `proxy.ts` no la da por buena
y la página nunca llega a compilar ni a exponer sus acciones.

Seguir depurando la construcción de esa cookie era exactamente el arreglo sobre
la marcha que el criterio de parada desaconseja, así que me detuve. Falsear el
resultado habría sido peor que dejarlo pendiente.

Lo que sí está cubierto por otras vías, y conviene tenerlo presente al valorar el riesgo:

- **El orden Zod → base** está en el código (`app/(investor)/solicitudes/actions.ts` valida y relee la disponibilidad antes del insert) y lo fija la suite: `actions.test.ts` comprueba que un monto por encima del disponible devuelve el mensaje en español, sin llegar a la base.
- **El rechazo en la base** de todos esos valores está probado en la batería HTTP de la sesión anterior, 14/14.
- **El caso legítimo sigue devolviendo 201**, también en esa batería.

Queda pendiente el clic humano. Son tres minutos de alguien con sesión de inversionista.

---

## 11. Estado final tras la segunda sesión

| | |
|---|---|
| Migraciones de storage envueltas | 2 |
| `supabase start` | **Arranca** (excluyendo servicios auxiliares) |
| `supabase db reset` | **Limpio**, 21 migraciones, salida 0 |
| Bloque 7.6 — cifras | **PASA**, 59 filas idénticas |
| Bloque 7.5 — panel admin | **2 hallazgos**, ninguno causado por M1–M4 |
| Bloque 7.3 — app web | **Parcial**: arranca y sirve; falta el clic |
| Producción | **Sin tocar** |
| M1–M4 | Pendientes en remoto |

### Los dos hallazgos, en una línea cada uno

1. **La tabla Solicitudes del panel admin nunca ha sido editable**: el RPC escribe `updated_at` y esa tabla no tiene esa columna. Preexistente, en producción, ajeno a este sprint.
2. **Una violación de constraint le muestra al admin el mensaje crudo de Postgres en inglés**, con la fila completa en `details`. Afecta a tres casos que la validación TS no cubre: monto cero, comentario largo y comentario en blanco.

Ninguno de los dos bloquea el despliegue de M1–M4 — el primero es anterior y el segundo solo cambia el texto de un error ante datos que ya eran inválidos. Pero los dos merecen decisión antes de dar el sprint por cerrado.
