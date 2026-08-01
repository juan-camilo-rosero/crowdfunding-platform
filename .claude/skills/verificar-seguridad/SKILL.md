---
name: verificar-seguridad
description: Batería de verificación de seguridad de acceso y aislamiento de datos entre inversionistas para este proyecto. Úsalo SIEMPRE antes de dar por terminada cualquier funcionalidad que toque autenticación, roles, estados de usuario, vinculación de inversionistas, o cualquier consulta de datos privados — y obligatoriamente antes de cada entrega o despliegue. La regla que nunca puede fallar es que un inversionista jamás vea datos de otro; este procedimiento lo comprueba desde varios ángulos.
---

# Verificar seguridad de usuarios y aislamiento de datos

En una plataforma con datos financieros de inversionistas reales, el peor incidente posible es que una persona vea los datos de otra. Esta verificación existe para que eso nunca ocurra. Córrela antes de cerrar cualquier feature de acceso/datos y antes de cada despliegue.

Referencia completa de roles, estados y matriz de permisos: `.claude/docs/user-management.md`.

## Nivel 1 — Transiciones de estado
Comprueba que cada transición válida funciona y cada prohibida se bloquea:
- invitado → registrado al entrar por primera vez.
- registrado NO puede autoascenderse a activo (solo el admin vincula).
- admin vincula → registrado pasa a activo.
- admin suspende → el usuario no puede iniciar sesión.
- suspendido reactivado → recupera acceso.
- desactivado readmitido → conserva su historial.
Cada transición prohibida debe devolver error, no fallar en silencio.

## Nivel 2 — Matriz de permisos (lo más crítico)

Se prueba por **capacidades**, no por rol único (ver user-management.md). Las cuatro combinaciones a cubrir: sin vínculo/no admin · con vínculo/no admin · admin sin vínculo · admin con vínculo (la dueña).

Las pruebas que no pueden fallar:
- Un inversionista A NO puede ver transacciones, documentos ni datos de un inversionista B. Probar de tres formas:
  1. Desde la navegación normal (no debe existir la opción).
  2. Pegando la URL directa del recurso ajeno (el backend debe negar).
  3. Llamando directo a la consulta/endpoint (RLS debe bloquear).
- Alguien sin vínculo de inversionista no accede a rutas de inversionista (`/inicio`, `/mis-inversiones`, `/transacciones`…) por URL directa, **aunque sea admin**.
- Alguien sin `role = 'admin'` no accede al panel admin por URL directa, **aunque tenga inversiones**.
- La dueña (admin + con vínculo) accede a ambas secciones, y en `/inicio` sigue viendo SOLO sus propias inversiones.
- Un inversionista no aprueba sus propias solicitudes.
- El admin ve los datos de todos únicamente a través de `/admin/*`.

## Nivel 3 — Casos borde
- Mismo email en Google y Outlook = una sola cuenta, no duplicada.
- Suspender a un usuario con sesión abierta le corta el acceso en su siguiente acción.
- No se puede eliminar al último admin.
- Inversionista con varios proyectos ve la suma de todos; desvinculado de uno, deja de ver solo ese.
- Enlace directo a pantalla privada: el backend niega, no confía en que el menú esté oculto.

## Nivel 4 — Flujos completos
- Camino A: admin invita → persona entra → queda activa y ve solo lo suyo.
- Camino B: persona se registra sola → admin la vincula → pasa a activa.
- Baja: activo → desactivado → deja de recibir y ver todo.
- Reactivación con historial intacto.

## La prueba que nunca debe fallar
Si solo hay tiempo para una: **un inversionista jamás ve datos de otro.** Compruébala desde el menú, desde la URL directa y desde la llamada al backend. Si esa pasa siempre, ya evitaste el peor incidente posible.

## Cómo reportar
Al terminar, entrega una lista de qué pasó y qué falló. Si algo del Nivel 2 falla, la funcionalidad NO se considera lista ni se despliega, sin importar que el resto funcione. Los niveles 1 y 2 conviene tenerlos como pruebas automatizadas para que corran en cada cambio; el nivel 4, manual con checklist antes de cada entrega grande.
