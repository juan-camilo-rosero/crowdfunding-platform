---
name: nueva-vista-inversionista
description: Procedimiento para construir una pantalla nueva del portal del inversionista en este proyecto Next.js, con el andamiaje correcto y consistente. Úsalo SIEMPRE que haya que crear o modificar una vista, pantalla, página o ruta del inversionista (inicio, catálogo, detalle de proyecto, transacciones, documentos, solicitudes, perfil), aunque el usuario solo diga "hazme la pantalla de X". Seguir este patrón evita reescribir el mismo andamiaje cada vez y garantiza que la seguridad, el formateo y los estados vacíos nunca se olviden.
---

# Construir una vista del inversionista

Toda pantalla del inversionista comparte el mismo andamiaje. Seguir este patrón mantiene el código consistente y evita olvidar piezas críticas como la verificación de capacidad o el estado vacío.

## Antes de empezar
Lee en `.claude/docs/views.md` la descripción de la vista específica (qué bloques lleva, qué datos muestra) y en `.claude/docs/code-patterns.md` las convenciones. No agregues bloques que no estén documentados para esa vista — si crees que falta algo, proponlo, no lo des por incluido (regla de alcance del proyecto).

## Estructura estándar de una vista

### 1. Página (Server Component)
La página vive en `app/(investor)/<ruta-en-espanol>/page.tsx`. Es Server Component por defecto. Su trabajo:
- Obtener el usuario autenticado y su rol con el cliente server de Supabase (`@supabase/ssr`, `createServerClient`).
- Consultar solo los datos que le corresponden a ese inversionista (RLS ya filtra, pero la consulta debe ser explícita).
- Pasar los datos ya listos como props a los componentes de presentación.
- No poner lógica de UI compleja aquí.

### 2. Componentes de presentación (en `components/`)
- Reutiliza lo que ya existe: `ProjectCard`, `KpiCard`, tablas, gráficos de `components/charts/`.
- Si necesitas interactividad (filtros, tabs), ese componente lleva `"use client"`; el resto se queda server.
- Props tipadas con los tipos de `types/`.

### 3. Formateo
Nunca formatees moneda, fecha o porcentaje a mano. Usa `lib/format` (`formatCurrency`, `formatDate`, `formatPercent`). Moneda en USD sin decimales (`$140,926`), fecha es-CO (`27 mar 2025`), avance entero + `%`.

### 4. Estados obligatorios
Toda vista con datos define explícitamente:
- **Estado de carga** mientras se resuelven los datos.
- **Estado vacío** con mensaje claro (ej. "Aún no tienes inversiones activas"), nunca una pantalla en blanco.
- **Dato en cero** se muestra en cero, no se oculta (un KPI de $0 es información válida).

### 5. Seguridad
- La ruta ya está protegida en `proxy.ts` por capacidad (vínculo de inversionista para las vistas del inversionista; `role = 'admin'` para el panel) y por estado, pero la página igual verifica que el usuario tenga derecho a lo que pide.
- Jamás consultar ni mostrar datos de otro inversionista. Si la vista muestra algo de un proyecto ajeno (catálogo), solo los campos públicos, nunca la inversión de otro.

## Textos
Todo texto visible sale de `i18n/` (español). No hardcodear strings en el componente.

## Verificar antes de terminar
- La vista carga con datos reales de un inversionista de prueba.
- Con otro inversionista, no se filtra ningún dato ajeno.
- El estado vacío se ve bien (probar con un usuario sin datos).
- Moneda, fechas y porcentajes usan los helpers de formato.
- En móvil la vista no se rompe (tablas colapsan a tarjetas donde aplique).
