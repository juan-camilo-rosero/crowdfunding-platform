# Gestión de usuarios

## Principios
- Menor privilegio: cada usuario tiene el mínimo acceso necesario.
- Autorización validada en el backend, no en la UI.
- Separar identidad (quién eres, lo prueba OAuth) de autorización (qué puedes ver, lo definen tus capacidades).

## Modelo de capacidades (NO son roles excluyentes)

IMPORTANTE: "ser admin" y "ser inversionista" son capacidades **independientes que pueden coexistir en la misma cuenta**. El caso real que obliga a esto: la dueña gestiona el negocio Y además invirtió en él.

Hay **tres ejes independientes**:

| Eje | Dónde vive | Valores |
|---|---|---|
| **Nivel administrativo** | `users.role` | `visitante` (usuario común) · `admin` (gestión del negocio) |
| **Capacidad de inversionista** | DERIVADA: existe fila en `investors` con `user_id` = su id | sí / no |
| **Estado de la cuenta** | `users.status` | invitado · registrado · activo · suspendido · desactivado |

- **`users.role` representa SOLO el nivel administrativo.** Ya NO se asigna el valor `inversionista` a `role`; la condición de inversionista no vive ahí.
- **Se es inversionista si y solo si existe una fila en `investors` vinculada al `user_id`.** No depende de `role` en absoluto. Es exactamente el criterio que ya usan las políticas RLS (`investor_id in (select id from investors where user_id = auth.uid())`).
- El valor `inversionista` sigue permitido por el CHECK de `role` por compatibilidad histórica, pero **no se asigna ni se consulta para autorizar**. Una fila heredada con `role='inversionista'` se comporta como usuario común (no admin); su capacidad de inversionista sale del vínculo, como todos.

No crear roles intermedios sin necesidad real.

## Estados del usuario

El estado es el **ciclo de vida de la cuenta** (si puede entrar o no). NO indica si la persona es inversionista: eso lo determina el vínculo en `investors`.

| Estado | Significado | Puede iniciar sesión |
|---|---|---|
| invitado | Pre-registrado por admin, aún no entra | No |
| registrado | Autenticado con OAuth | Sí |
| activo | Cuenta habilitada por el admin | Sí |
| suspendido | Bloqueado temporalmente por admin | No |
| desactivado | Baja; datos conservados, sin acceso | No |

## Matriz de acceso por combinación de capacidades

El onboarding es **por capas** (ver views.md). `onboarding_completed` se refiere SOLO al onboarding básico (datos personales: nombre, teléfono, ciudad/país). NO implica verificación de identidad ni contrato firmado; esos pertenecen al onboarding de inversión, que ocurre después.

Con `onboarding_completed = false`, **cualquier** combinación va a `/onboarding` y nada más. Las cuatro combinaciones reales, ya con el onboarding básico completo:

| Combinación | `role` | ¿Vínculo en `investors`? | Destino tras login | Pestañas que ve | A qué accede |
|---|---|---|---|---|---|
| **Visitante sin inversión** | `visitante` | No | `/portafolio` | Solo catálogo y perfil | `/portafolio`, `/proyecto/[id]`, `/perfil`. NADA más. |
| **Visitante con inversión** | `visitante` | Sí | `/inicio` | Sección inversionista | Todo lo suyo: inicio, portafolio, mis-inversiones, transacciones, documentos, solicitudes, perfil. Nunca `/admin/*`. |
| **Admin sin inversión** | `admin` | No | `/admin` | Ambas secciones | **El admin ve TODO**: panel admin, sección de inversionista, catálogo y perfil. Sus pantallas de inversionista salen vacías si no tiene aportes, y eso es correcto. |
| **Admin con inversión** (la dueña) | `admin` | Sí | `/inicio` | Ambas secciones | Todo: sus propias inversiones + panel admin completo. |

Reglas que se derivan de la tabla y que NO deben romperse:

Las tres reglas de visibilidad, en una línea:

1. **El admin ve todo** (sección de inversionista + sección de admin).
2. **El inversionista ve todo menos la sección de admin.**
3. **El visitante ve únicamente el catálogo** (y su perfil).

De ahí se derivan:

- **El sidebar se arma por capacidades, no por un rol único.** La sección de inversionista aparece si hay vínculo **o si es admin**; la de admin, solo si `role = 'admin'`. La dueña ve las dos.
- **Las rutas de inversionista (`/inicio`, `/mis-inversiones`, `/transacciones`, `/documentos`, `/solicitudes`) exigen vínculo de inversionista O `role = 'admin'`.** Un admin sin aportes las ve vacías, que es información válida.
- **Las rutas `/admin/*` exigen `role = 'admin'`.** Tener inversiones NO da acceso al panel: esa es la barrera que nunca se relaja.
- **Un visitante SÍ hace el onboarding básico.** `/onboarding` está abierto a cualquier usuario autenticado con `onboarding_completed = false`. Todos nacen `visitante` sin vínculo.
- **Vincular como inversionista lo hace SOLO el admin** (crea/conecta la fila en `investors`). Nadie se autoasciende completando el onboarding.
- Un usuario con `onboarding_completed = false` que pida cualquier ruta privada se devuelve a `/onboarding`, no a `/login` (ya tiene sesión válida).

### Transiciones válidas
invitado→registrado (primera entrada) · registrado→activo (admin habilita la cuenta, normalmente al vincularla) · activo→suspendido · suspendido→activo · activo→desactivado · desactivado→activo (readmisión, conserva historial).

### Transiciones prohibidas (verificar explícitamente)
- Nadie se autovincula como inversionista: crear la fila en `investors` es potestad del admin.
- Nadie se autoasciende a `role = 'admin'`.
- suspendido NO puede iniciar sesión aunque su OAuth sea válido.
- desactivado NO ve datos aunque tenga enlace directo.

## Flujo de vinculación

Vincular a alguien como inversionista = **crear o conectar su fila en `investors` con su `user_id`**. NO cambia su `role`. Ascender a admin es una acción distinta y explícita (`role = 'admin'`), independiente del vínculo.

**Camino A (admin invita primero):** admin crea el registro en `investors` con el email de la persona → queda "invitado" → la persona entra con OAuth con ese email → hace el onboarding básico → el admin conecta esa fila de `investors` a su `user_id` → ya es inversionista.

**Camino B (persona se registra sola):** entra con OAuth sin invitación → queda "registrado" con `role = 'visitante'` y sin vínculo → hace el onboarding básico (`onboarding_completed = true`) → navega el catálogo público → admin la ve en "usuarios sin vincular" → al crear/conectar su fila en `investors` pasa a ser inversionista. **Su `role` sigue siendo `visitante`**: eso es correcto, porque `role` solo mide el nivel administrativo.

En ambos caminos el onboarding básico es solo datos personales. La verificación de identidad y la firma del contrato llegan después, en el onboarding de inversión.

**Regla de oro:** el vínculo persona↔inversionista se hace por email verificado. Si el admin escribió un email distinto al que usa la persona para entrar, no hay match; el admin debe poder corregir el email o vincular manualmente.

## Matriz de permisos (resumen)

Las columnas son **capacidades**, no roles excluyentes: una misma persona puede cumplir "con vínculo de inversionista" y "admin" a la vez (la dueña), y entonces suma ambas filas de permisos.

| Acción | Sin vínculo, no admin | Con vínculo de inversionista | admin (`role`) |
|---|---|---|---|
| Ver catálogo | Sí | Sí | Sí |
| Ver SUS inversiones/transacciones/documentos | No | Sí | Solo si además tiene vínculo |
| Ver datos de OTRO inversionista | No | No | Sí (vía `/admin/*`) |
| Crear solicitud de reasignación | No | Sí | Solo si además tiene vínculo |
| Aprobar solicitudes | No | No | Sí |
| CRUD proyectos, vincular inversionistas, cambiar estados | No | No | Sí |
| Ver panel admin | No | No | Sí |

IMPORTANTE: la fila "ver datos de otro inversionista" es el requisito de seguridad número uno. Probar desde menú, URL directa y llamada al backend. Que alguien sea admin NO relaja el aislamiento de sus propios datos de inversionista: sigue viendo lo suyo en `/inicio` y lo de todos solo en `/admin/*`.

## Casos borde a contemplar
- Mismo email en Google y Outlook = una sola cuenta, no duplicar.
- Inversionista en varios proyectos: portafolio y transacciones suman todos.
- Desvinculado de un proyecto pero activo en otro: deja de ver solo ese.
- **Perder el vínculo de inversionista** (se borra su fila en `investors`): deja de ver las pestañas de inversionista de inmediato, pero conserva su `role`. Si era admin, sigue siendo admin.
- **Admin que además invierte** (la dueña): ve ambas secciones. Quitarle el vínculo no le quita el admin, y quitarle el admin no le quita sus inversiones.
- Suspendido con sesión abierta: pierde acceso en su siguiente acción.
- Nunca se puede eliminar al último admin. La regla aplica sobre `role = 'admin'`, y es independiente de si esa persona tiene o no vínculo de inversionista.
- Email invitado que nunca entra: no cuenta como activo ni recibe reportes.
- Cambio de email: admin actualiza el vínculo sin perder historial.
- Reactivación: recupera historial anterior.
- Enlace directo a pantalla privada: el backend niega, no confía en el menú oculto.

## Seguridad mínima
- Autorización en cada consulta del backend (identidad + rol + propiedad).
- Row Level Security en Supabase como segunda barrera.
- Sesiones con expiración.
- Registro de acciones sensibles (quién vinculó/suspendió/cambió qué y cuándo).

## Testing (4 niveles)
1. Transiciones de estado: cada válida funciona, cada prohibida se bloquea.
2. Permisos (la matriz): una prueba por celda; críticas las de "ver datos de otro" vía URL directa.
3. Casos borde: uno por cada punto de arriba.
4. Flujos end-to-end: Camino A completo, Camino B completo, baja, reactivación con historial.

Automatizar niveles 1 y 2 (sobre todo "ver datos de otro"). Nivel 4 manual con checklist antes de cada entrega grande. La prueba que nunca debe fallar: un inversionista jamás ve datos de otro.
