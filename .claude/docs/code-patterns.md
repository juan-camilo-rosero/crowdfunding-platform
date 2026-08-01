# Patrones y convenciones de código

## Estructura de carpetas
```
app/          # rutas (App Router), agrupadas por (auth) (onboarding) (investor) (admin)
components/   # ui (shadcn), charts, cards, tables, layout
lib/          # supabase, ai, truora, esign, auth, format
types/        # tipos TS que mapean 1:1 con las tablas
hooks/
i18n/         # strings de UI (es)
proxy.ts      # protección de rutas por rol/estado (Next.js 16; antes middleware.ts)
```

## Nomenclatura

**REGLA ABSOLUTA: el código va 100% en inglés** — variables, funciones, tipos, constantes, parámetros, nombres de archivo, componentes, comentarios y claves de `i18n/`. Nada de español en el código.

Excepciones (solo lo que ve el usuario o ya es contrato externo):
- **Valores** de los strings de UI en `i18n/`: español.
- Rutas y carpetas de `app/`: español (`/mis-inversiones`), porque son URLs visibles.
- Valores de enums almacenados en base: español.

Resto de reglas que el linter/formatter no impone por sí mismo:
- Tablas y columnas de base: snake_case en inglés.
- Componentes en PascalCase, el archivo coincide con el nombre del componente.

## Componentes
- Preferir Server Components por defecto (App Router). Usar `"use client"` solo cuando haga falta interactividad o hooks de cliente.
- Un componente por archivo; el nombre del archivo coincide con el componente.
- Props tipadas con interfaces en el mismo archivo o importadas de `types/`.
- Componentes de presentación separados de la lógica de datos: la página (server) obtiene datos y los pasa como props a componentes de UI.

## Datos y Supabase
- Usar SIEMPRE el paquete `@supabase/ssr`. NUNCA `@supabase/auth-helpers-*` (deprecado, rompe la app).
- Cliente server (`lib/supabase/server.ts`) con `createServerClient` para Server Components y route handlers; cliente browser (`lib/supabase/browser.ts`) con `createBrowserClient` solo en Client Components.
- `cookies()` y `headers()` son async en Next.js 16: siempre `await`.
- El refresco de sesión va en `proxy.ts` (no `middleware.ts`).
- NUNCA exponer `SUPABASE_SERVICE_ROLE_KEY` al cliente; solo en el servidor.
- Toda consulta de datos privados pasa por RLS. No confiar en filtros de la UI.
- Los cálculos (capital recibido, pendiente, diferencias) se hacen en vistas SQL o queries agregadas, no en el cliente.
- Tipar los resultados con los tipos de `types/`.

## Formateo (lib/format)
- `formatCurrency(value)` → `$140,926` (USD, sin decimales, separador de miles).
- `formatDate(value)` → `27 mar 2025` (es-CO).
- `formatPercent(value)` → entero + `%`.
- Ningún componente formatea moneda/fecha a mano; siempre vía estos helpers.

## Estado y manejo de errores
- No usar `localStorage`/`sessionStorage` para datos sensibles.
- Server Actions o route handlers para mutaciones; validar entrada con una librería de esquemas (p. ej. Zod) antes de escribir.
- Cada route handler devuelve errores con estado HTTP claro y mensaje en español para la UI.
- Estados de carga y vacío SIEMPRE definidos en vistas con datos (tablas, grillas, KPIs). Un dato en cero se muestra en cero, no se oculta.

## Seguridad (recordatorio, ver user-management.md)
- Autorización verificada en el servidor en cada acción sensible: identidad + rol + propiedad del dato.
- Rutas protegidas en `proxy.ts` por rol y estado del usuario (incluido `onboarding_completed`).
- El chatbot solo recibe contexto del usuario autenticado; jamás datos de otros.

## Gráficos (Recharts)
- Componentes en `components/charts/`. Reutilizables y tipados.
- La dona del home y las barras del proyecto heredan la paleta de estados; no colores aleatorios.

## i18n
- Todo string visible sale de `i18n/` (hoy solo `es`). No hardcodear texto en componentes, para permitir traducción futura sin refactor.

## Git
- Commits pequeños por paso de tarea, en español, con prefijo tipo `feat:`, `fix:`, `chore:`.
- Correr `pnpm typecheck` y `pnpm lint` antes de commit.
