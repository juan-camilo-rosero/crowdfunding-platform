---
name: nueva-tabla-supabase
description: Procedimiento para agregar una tabla nueva a la base de datos de Supabase de este proyecto, completo y sin saltarse pasos. Úsalo SIEMPRE que haya que crear o modificar una tabla, agregar un campo, o definir su seguridad — aunque el usuario solo diga "agrega una tabla X" o "necesito guardar Y". Crear una tabla sin su política de Row Level Security es un error grave de seguridad en este proyecto, así que este procedimiento es obligatorio cada vez.
---

# Crear una tabla nueva en Supabase (con RLS)

En este proyecto, agregar una tabla NO es solo el `CREATE TABLE`. Una tabla sin Row Level Security deja datos de inversionistas expuestos, que es el peor incidente posible aquí. Por eso cada tabla nueva sigue estos cinco pasos sin excepción.

## Antes de empezar
Lee el esquema de referencia en `.claude/docs/database-schema.md` para respetar convenciones (nombres en inglés snake_case, enums en español, columnas base `id`/`created_at`/`updated_at`). No inventes tipos ni nombres que se salgan de ese patrón.

## Paso 1 — Definir la tabla
Escribe el `CREATE TABLE` con:
- `id uuid primary key default gen_random_uuid()`
- `created_at timestamptz default now()`
- `updated_at timestamptz`
- Los campos del dominio, con tipos correctos (`numeric(14,2)` para dinero en USD, `date`/`timestamptz` para fechas, `text` con CHECK o enum para catálogos en español).
- Foreign keys explícitas hacia las tablas que referencia, con `on delete` pensado (normalmente `restrict` para no borrar en cascada datos financieros).

## Paso 2 — Tipo TypeScript
Agrega el tipo correspondiente en `types/` que mapee 1:1 con la tabla. Los nombres de campo en el tipo coinciden con las columnas (snake_case). Sin esto, el front no tiene tipado y se rompe la consistencia.

## Paso 3 — Activar RLS y escribir políticas
Este es el paso que nunca se omite:
```sql
alter table <tabla> enable row level security;
```
Luego las políticas según a quién pertenece el dato:
- Si la tabla tiene datos privados de un inversionista (tiene `investor_id` o `user_id`): el inversionista solo lee/escribe sus propias filas (`auth.uid()` coincide con su usuario), y el admin lee todo.
- Si es catálogo público (ej. `projects` visibles): lectura para cualquier autenticado, escritura solo admin.
- El rol de servicio (server, con service_role key) omite RLS para operaciones de backend legítimas.

Guíate por las políticas ya descritas en `.claude/docs/user-management.md` (matriz de permisos). La regla que nunca se rompe: un inversionista jamás lee filas de otro.

## Paso 4 — Vistas calculadas (si aplica)
Si la tabla alimenta un total (capital recibido, gasto ejecutado, etc.), NO agregues una columna para guardarlo. Crea o actualiza una vista SQL que lo calcule con agregación. Los cálculos nunca se capturan a mano en este proyecto.

## Paso 5 — Verificar
Antes de dar la tarea por terminada:
- Inserta 2 registros de prueba de dos usuarios distintos.
- Confirma, autenticado como el usuario A, que NO puedes leer la fila del usuario B.
- Confirma que el admin sí ve ambas.
- Si hay vista calculada, confirma que el total cuadra a mano.
- Borra los registros de prueba.

Si el paso 5 no pasa, la tabla no está lista, sin importar que el `CREATE TABLE` haya funcionado.

## Recordatorio
No actives RLS sobre tablas a medio construir durante la carga inicial de datos de desarrollo; primero estructura completa, luego seguridad. Pero ninguna tabla llega a producción sin RLS.
