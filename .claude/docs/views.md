# Vistas y pantallas

## Estructura de carpetas (App Router)

```
app/
├── (auth)/login, callback
├── (onboarding)/onboarding
├── (investor)/            # layout con sidebar de inversionista
│   ├── inicio
│   ├── portafolio         # catálogo "Portafolio Investors 180"
│   ├── mis-inversiones
│   ├── proyecto/[id]      # detalle con tabs
│   ├── transacciones
│   ├── documentos
│   ├── solicitudes
│   └── perfil
├── (admin)/admin/         # layout admin, solo rol admin
│   ├── proyectos, inversionistas, capital, presupuesto, tareas,
│   ├── reportes, documentos, usuarios, pipeline, aprobaciones
└── api/
    ├── chat               # endpoint del chatbot (sin persistencia)
    ├── truora/start, truora/webhook
    └── esign/webhook
```

Carpetas y rutas en español (coinciden con la UI). La protección de rutas va en `proxy.ts` en la raíz (Next.js 16 renombró `middleware.ts` a `proxy.ts`).

## Autenticación (/login)
Sign in/up unificado: botones "Continuar con Google" y "Continuar con Outlook" (OAuth vía Supabase). Carrusel lateral de 4 slides con features, SIN cifras ni promesas de retorno. Tras login, `proxy.ts` decide el destino:

| `onboarding_completed` | Rol | Destino |
|---|---|---|
| false | cualquiera | `/onboarding` (onboarding básico) |
| true | visitante | `/portafolio` (catálogo público) |
| true | inversionista | `/inicio` |
| true | admin | `/inicio` |

## Onboarding (/onboarding) — BÁSICO

IMPORTANTE: el onboarding es por capas. Esta pantalla es solo el **onboarding básico**, que hace TODO usuario recién registrado, sin importar su rol.

Solo la primera vez. Pide únicamente **datos personales**: nombre completo, teléfono (E.164) y ciudad/país. NO incluye verificación de identidad ni firma de contrato. Checklist de estado visible. Al completar, `onboarding_completed = true` y el usuario queda como `visitante` con acceso al catálogo público (`/portafolio`) y su perfil.

El paso a `inversionista` NO ocurre aquí: lo hace el admin al vincular a la persona con un proyecto (Camino B en user-management.md).

## Onboarding de inversión (sprint de integraciones, aún no construido)

La **verificación de identidad con Truora** y la **firma del contrato de inversión** (e-sign) NO ocurren al registrarse. Pertenecen al onboarding de inversión, que se dispara cuando:
- el usuario va a invertir en un proyecto concreto, o
- el admin lo vincula como inversionista.

Ver integrations.md para el detalle técnico de ambas integraciones. La verificación Truora se puede saltar por configuración si el equipo no la activa. Este flujo se construye en su sprint correspondiente, no en el registro inicial.

## Inicio (/inicio) — Home
- KPIs (4 tarjetas): Invertido actualmente, Capital devuelto/vigente, Rendimiento recibido, Proyectos activos. Cada tarjeta con etiqueta, cifra grande y línea de contexto.
- Gráfico de dona: distribución del capital vigente por proyecto. Etiqueta del total: "Invertido actualmente".
- Tarjetas de "mis proyectos".
- Feed de actividad reciente (reportes nuevos, hitos, solicitudes resueltas).
- NO incluye la tabla completa de transacciones.

Estados vacíos obligatorios: sin inversiones (cifra $0, "Aún no tienes inversiones activas"); sin pendientes ("Estás al día", en verde).

## Portafolio Investors 180 (/portafolio) — Catálogo
Grilla de tarjetas de todos los proyectos del grupo (activos, en captación, vendidos). Los del inversionista van marcados.
- Tarjeta: foto, badge de estado (define el color), nombre, ciudad, tipo, "Tu inversión" si aplica, retorno pactado tal cual, barra de avance heredando el color del badge.
- Proyectos vendidos: sin barra de avance; muestran valor de venta o badge "Proyecto cerrado".
- Proyectos `in_fundraising`: barra de progreso (recaudado/meta) y botón "Me interesa este proyecto".
- Filtros: estado y "en captación" en primer nivel; ciudad y tipo detrás de "más filtros". Contador de resultados. Orden por defecto: activos primero, vendidos al final. Estado vacío con botón "limpiar filtros".

## Mis inversiones (/mis-inversiones)
Solo los proyectos donde el inversionista tiene capital, con detalle financiero por proyecto (monto, tipo, retorno pactado, avance).

## Detalle de proyecto (/proyecto/[id])
Hero FIJO: galería de fotos + nombre, estado, ciudad (siempre visibles al cambiar de pestaña). Nav de pestañas:
- **Resumen:** descripción (2 párrafos: uno vende el inmueble, otro informa el estado), argumentos de venta ("Por qué este proyecto"), "Sobre Investors 180" (equipo con experiencia, sin afirmar "líder" salvo dato verificable), ficha técnica ("Detalles del proyecto"), cifras, mapa con línea de contexto de ubicación.
- **Avance:** cronograma por etapas con estado, barra de obra, ejecución presupuestal. No repetir el % de avance de otras pestañas.
- **Reportes:** reportes mensuales con fotos, más reciente arriba. Es el corazón de la pantalla, mayor peso visual.
- **Documentos:** los que apliquen al inversionista.
- **Mi inversión** (condicional): solo si invirtió ahí (monto, fecha, tipo, retorno, participación). Si no, botón "Me interesa" en el hero.

El margen del proyecto se presenta siempre como "proyectado", nunca como retorno garantizado al inversionista.

## Transacciones (/transacciones)
Tabla: Fecha · Proyecto · Tipo · Monto. Sin columna de estado (todo lo listado ya ocurrió). Tipo con color/ícono según sea entrada (aporte, reasignación) o salida hacia el inversionista (rendimiento, devolución). Filtro por tipo de movimiento (y por proyecto cuando crezca). Botón exportar (PDF/Excel) y fila de total. En móvil colapsa a tarjetas.

## Documentos (/documentos)
Lista agrupada por proyecto: ícono, nombre, fecha, botón descarga. Cada inversionista ve solo lo suyo (RLS por investor_id). Estado vacío: "Aún no tienes documentos disponibles".

## Solicitudes (/solicitudes)
Tabla: Fecha · Origen · Destino · Monto · Estado (pendiente/aprobada/rechazada). Aquí el estado SÍ es necesario (es la información principal). Botón "nueva solicitud" abre formulario de reasignación (origen, destino, monto). Solo la reasignación aprobada aparece en transacciones.

## Perfil (/perfil)
Datos del usuario (de Google/Outlook), preferencias de notificación, cerrar sesión.

## Formulario "Me interesa este proyecto"
Título: "Me interesa este proyecto". Campos: monto (opcional), tipo de inversión preferido (incluye "No estoy seguro, quiero asesoría"), comentarios (opcional), teléfono (solo si no está en el perfil). Contexto no editable: proyecto y correo. Botón "Enviar interés" (nunca "Invertir ahora"). Nota al pie: "Enviar este formulario no constituye un compromiso de inversión." Confirmación con tiempo de respuesta.

## Chatbot
Burbuja/panel en el layout de inversionista. Ver integrations.md para su funcionamiento. No tiene historial persistente.

## Panel admin (/admin/*)
CRUD de las tablas base. Además:
- **usuarios:** vincular inversionista a proyectos, cambiar estado/rol, corregir email de vínculo.
- **pipeline:** tabla del embudo de captación — nombre del inversionista, teléfono, monto potencial, etapa, acción "cambiar estado". Las etapas alimentan la métrica de capital potencial por etapa (embudo: contacto, calificado, en reunión, en revisión, firmado, desembolsado).
- **aprobaciones:** cola de reassignment_requests e investment_interests pendientes.

Las pestañas de admin se OCULTAN por completo para no-admin (no se muestran deshabilitadas).
