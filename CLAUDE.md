# Investors 180 — Plataforma de Inversión Inmobiliaria

Portal web donde inversionistas (mayoría en Colombia) consultan la trazabilidad completa de sus inversiones en proyectos inmobiliarios en Florida: sus proyectos, aportes, condiciones, avance, documentos, transacciones y solicitudes. Incluye catálogo de proyectos que también sirve para captación, chatbot de asistencia, firma electrónica y onboarding con verificación de identidad.

**IMPORTANTE — Regla de alcance:** no se añade ninguna función que no esté documentada en este archivo ni en los de `.claude/docs/`. Features nuevas se proponen, no se dan por incluidas.

## Stack

Versiones verificadas (jul 2026). Fijar estas versiones mayores; no bajar de ellas.

- **Next.js 16** (App Router). Turbopack es el bundler por defecto. Requiere Node.js 20.9+.
- **Node.js 20 LTS o superior** (obligatorio para Next.js 16; 18 ya no es compatible).
- **React 19.2** (viene con Next.js 16).
- **TypeScript 5.1+**.
- **Supabase** (PostgreSQL + Row Level Security + Storage + Auth).
- Cliente Supabase: **`@supabase/ssr`** para todo lo server-side y de auth. NUNCA usar `@supabase/auth-helpers-*` (deprecado; rompe la app).
- Autenticación: Supabase Auth con OAuth de Google y Microsoft (Outlook).
- **Tailwind CSS v4** (configuración CSS-first con `@theme`, sin `tailwind.config.js`).
- **shadcn/ui** (compatible con Tailwind v4; usa `tw-animate-css`, no `tailwindcss-animate`).
- **Recharts** para gráficos.
- **Vercel** para despliegue.
- Truora (verificación de identidad), Documenso o equivalente (firma electrónica).
- Chatbot: proveedor conmutable (OpenAI / Claude / DeepSeek) vía `lib/ai/provider.ts`.

IMPORTANTE — cambios de Next.js 16 que afectan el código:
- La protección de rutas va en **`proxy.ts`** (reemplaza a `middleware.ts` de versiones anteriores). No generar `middleware.ts`.
- Las request APIs (`cookies()`, `headers()`, `params`) son **async**: siempre `await`.
- El caché es explícito (Cache Components); no asumir el caché implícito de fetch de versiones viejas.

## Comandos

```
pnpm dev            # desarrollo local
pnpm build          # build de producción
pnpm lint           # ESLint
pnpm typecheck      # tsc --noEmit
```

- YOU MUST correr `pnpm typecheck` y `pnpm lint` después de cualquier serie de cambios.
- Los tipos de TypeScript en `types/` mapean 1:1 con las tablas de la base.

## Idioma

- UI, textos y mensajes: 100% español.
- Nombres de tablas y columnas: inglés (estándar SQL).
- Enums se almacenan en español (coinciden con la UI).
- Strings de UI centralizados en `i18n/` para permitir internacionalización futura; hoy solo existe español.

## Roles y seguridad

Tres roles: `visitante` (solo catálogo), `inversionista` (ve solo lo suyo), `admin` (acceso total).

- IMPORTANTE: un inversionista JAMÁS ve datos de otro. Se garantiza con Row Level Security en Supabase (filtrado por `auth.uid()`), no solo ocultando en la UI.
- Toda consulta de datos privados verifica identidad + rol + propiedad del dato en el servidor. La protección de rutas por rol/estado va en `proxy.ts` (Next.js 16).

## Reglas de negocio críticas

- Capital recibido, pendiente, diferencias y acumulados se CALCULAN (consultas agregadas), nunca se capturan a mano.
- El retorno pactado se guarda como texto libre ("15% anual", "Participación 8%"): no se normaliza ni se promedia.
- Rendimiento y devolución de capital son transacciones separadas; nunca se muestran como un solo monto.
- No se muestran rendimientos proyectados de proyectos no cerrados como si fueran reales.
- La plataforma registra y organiza solicitudes de movimiento de dinero; NO mueve, custodia ni transfiere dinero real.

## Formato de datos

- Moneda: `numeric` en base; en UI USD con separador de miles, sin decimales (`$140,926`). Formateo en `lib/format`.
- Fechas: `date`/`timestamptz` en base (ISO); en UI formato es-CO (`27 mar 2025`).
- Avance de obra: entero 0–100, sin decimales.
- Teléfonos: E.164 (`+57...`).

## Documentación de detalle

- Esquema completo de base de datos: @.claude/docs/database-schema.md
- Funcionamiento de cada vista y pantalla: @.claude/docs/views.md
- Roles, estados de usuario y su ciclo de vida: @.claude/docs/user-management.md
- Integraciones (Truora, firma electrónica, chatbot): @.claude/docs/integrations.md
- Patrones y convenciones de código: @.claude/docs/code-patterns.md

## Orden de construcción

0. Setup + esquema SQL + RLS → 1. Auth + roles/estados + middleware → 2. Panel admin CRUD → 3. Catálogo y detalle de proyecto → 4. Home (KPIs, dona, feed) → 5. Transacciones y solicitudes → 6. Documentos y notificaciones → 7. Onboarding + Truora → 8. Firma electrónica → 9. Catálogo como captación + pipeline admin → 10. Chatbot.

Cada etapa debe quedar demostrable antes de pasar a la siguiente.
