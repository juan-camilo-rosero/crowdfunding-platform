# Gestión de usuarios

## Principios
- Menor privilegio: cada usuario tiene el mínimo acceso necesario.
- Roles como paquetes de permisos; los permisos no se asignan sueltos a personas.
- Autorización validada en el backend, no en la UI.
- Separar identidad (quién eres, lo prueba OAuth) de autorización (qué puedes ver, lo define rol + vínculos).

## Roles
- **visitante:** autenticado pero no vinculado a proyectos. Ve solo catálogo público y su perfil. No ve datos financieros de nadie.
- **inversionista:** vinculado a uno o más proyectos. Ve su portafolio, transacciones, documentos, solicitudes y el catálogo. Solo lo suyo.
- **admin:** acceso total, panel de administración, pipeline, gestión de usuarios.

No crear roles intermedios sin necesidad real.

## Estados del usuario
| Estado | Significado | Puede iniciar sesión |
|---|---|---|
| invitado | Pre-registrado por admin, aún no entra | No |
| registrado | Autenticado con OAuth, sin vincular | Sí, solo catálogo |
| activo | Vinculado como inversionista | Sí |
| suspendido | Bloqueado temporalmente por admin | No |
| desactivado | Baja; datos conservados, sin acceso | No |

### Transiciones válidas
invitado→registrado (primera entrada) · registrado→activo (admin vincula) · activo→suspendido · suspendido→activo · activo→desactivado · desactivado→activo (readmisión, conserva historial).

### Transiciones prohibidas (verificar explícitamente)
- registrado NO puede autoascenderse a activo (solo el admin vincula).
- suspendido NO puede iniciar sesión aunque su OAuth sea válido.
- desactivado NO ve datos aunque tenga enlace directo.

## Flujo de vinculación
**Camino A (admin invita primero):** admin crea el registro del inversionista → email marcado "invitado" → persona entra con OAuth con ese email → pasa a activo, ya vinculada.

**Camino B (persona se registra sola):** entra con OAuth sin invitación → queda "registrado" (solo catálogo) → admin la ve en "usuarios sin vincular" → al vincularla pasa a activo.

**Regla de oro:** el vínculo persona↔inversionista se hace por email verificado. Si el admin escribió un email distinto al que usa la persona para entrar, no hay match; el admin debe poder corregir el email o vincular manualmente.

## Matriz de permisos (resumen)
| Acción | visitante | inversionista | admin |
|---|---|---|---|
| Ver catálogo | Sí | Sí | Sí |
| Ver su portafolio/transacciones/documentos | No | Sí | Sí |
| Ver datos de OTRO inversionista | No | No | Sí |
| Crear solicitud de reasignación | No | Sí | Sí |
| Aprobar solicitudes | No | No | Sí |
| CRUD proyectos, vincular inversionistas, cambiar estados | No | No | Sí |
| Ver panel admin | No | No | Sí |

IMPORTANTE: la fila "ver datos de otro inversionista" es el requisito de seguridad número uno. Probar desde menú, URL directa y llamada al backend.

## Casos borde a contemplar
- Mismo email en Google y Outlook = una sola cuenta, no duplicar.
- Inversionista en varios proyectos: portafolio y transacciones suman todos.
- Desvinculado de un proyecto pero activo en otro: deja de ver solo ese.
- Suspendido con sesión abierta: pierde acceso en su siguiente acción.
- Nunca se puede eliminar al último admin.
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
