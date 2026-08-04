# Investors 180 — Plataforma de Inversión Inmobiliaria

Portal web donde inversionistas (mayoría en Colombia) consultan la trazabilidad completa de sus inversiones en proyectos inmobiliarios en Florida: sus proyectos, aportes, condiciones, avance, documentos, transacciones y solicitudes. Incluye catálogo de proyectos que también sirve para captación, chatbot de asistencia, firma electrónica y onboarding con verificación de identidad.

**Onboarding por capas:** al registrarse, cualquier usuario completa solo el onboarding BÁSICO (datos personales). La verificación de identidad (Truora) y la firma del contrato pertenecen al onboarding DE INVERSIÓN, que ocurre después, cuando el usuario va a invertir en un proyecto concreto o el admin lo vincula como inversionista. Detalle en `.claude/docs/views.md` y `.claude/docs/user-management.md`.

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
- **shadcn/ui** (compatible con Tailwind v4; usa `tw-animate-css`, no `tailwindcss-animate`). Instalado sobre **Base UI** (`@base-ui/react`), con `class-variance-authority` para variantes y `lucide-react` para iconos.
- IMPORTANTE: los controles (botones, inputs, etc.) SIEMPRE salen de `components/ui/`, nunca markup suelto. Todo elemento interactivo lleva `cursor-pointer`. Detalle en `.claude/docs/code-patterns.md`.
- Color de marca para acciones primarias: `#060D1F`, expuesto como `--brand` / `bg-brand`.
- **Recharts** para gráficos.
- **Vercel** para despliegue.
- Truora (verificación de identidad), Documenso o equivalente (firma electrónica).
- Chatbot: proveedor conmutable (OpenAI / Claude / DeepSeek) vía `lib/ai/provider.ts`.

IMPORTANTE — cambios de Next.js 16 que afectan el código:
- La protección de rutas va en **`proxy.ts`** (reemplaza a `middleware.ts` de versiones anteriores). No generar `middleware.ts`.
- Las request APIs (`cookies()`, `headers()`, `params`) son **async**: siempre `await`.
- El caché es explícito (Cache Components); no asumir el caché implícito de fetch de versiones viejas.

## Comandos

El proyecto usa **npm** (hay `package-lock.json`, no `pnpm-lock.yaml`).

```
npm run dev         # desarrollo local
npm run build       # build de producción
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm test            # Vitest (una pasada)
npm run test:watch  # Vitest en watch
```

- YOU MUST correr `npm run typecheck` y `npm run lint` después de cualquier serie de cambios.

### Testing (Vitest + React Testing Library)

Config en `vitest.config.mts` (**la extensión `.mts` es obligatoria**: `vite-tsconfig-paths` es ESM-only y el proyecto no tiene `"type": "module"`, así que un `.ts` se carga como CJS y revienta). Setup global en `vitest.setup.ts`.

- Entorno `jsdom`. **Fijado en jsdom 26**: la 30 exige Node 22 y este equipo corre Node 20.
- El alias `@/` sale del `tsconfig.json` vía `vite-tsconfig-paths`; no hay un segundo mapeo que mantener sincronizado.
- Los tests viven junto al código que prueban (`lib/transactions/query.test.ts`), no en una carpeta aparte.
- **Qué se testea: nuestra lógica.** Scoping de datos, filtros, formateo y render. Nada de internals de terceros (Supabase, Recharts, el router de Next) ni snapshots trivales.
- Para probar consultas, mockear el cliente de Supabase con un builder encadenable que registre las llamadas. El test que nunca debe faltar en una vista privada: que la consulta **siempre** aplique el scope del `investor_id`/`auth.uid()` del usuario actual, pase lo que pase por los filtros.
- Los tipos de TypeScript en `types/` mapean 1:1 con las tablas de la base.

### Manejo del dev server (IMPORTANTE — Turbopack corrompe su caché)

Turbopack guarda una caché persistente en `.next/dev/cache/turbopack/` (archivos `.sst`, tipo base de datos). Se corrompe con facilidad, y cuando pasa **el síntoma engaña**: las rutas devuelven 404 o 500 aunque el archivo `page.tsx` exista y `tsc`/`lint` pasen limpios. En el log aparece:

```
TurbopackInternalError: Failed to open SST file .next/dev/cache/turbopack/…/000000XX.sst
→ ENOENT: … /page/build-manifest.json
```

**Reglas para no provocarlo:**

1. **NUNCA matar el dev server con `taskkill /F`** (ni `kill -9`), y menos a mitad de compilación. Detenerlo con Ctrl+C para que cierre la caché ordenadamente.
2. **UN SOLO dev server a la vez.** Dos procesos escribiendo la misma caché la corrompen. Si Next avisa *"Another next dev server is already running"*, detén el otro en vez de abrir uno nuevo en otro puerto.
3. No borrar ni recrear archivos de ruta (`page.tsx`, `layout.tsx`) con el server corriendo; si hay que hacerlo, detenerlo antes.

**Cómo recuperarse** (PowerShell, que es la shell de este equipo — `rm -rf` NO funciona ahí):

```powershell
# 1. detener TODOS los dev servers (el orden importa: si borras la caché
#    con un server vivo, la reescribe corrupta al instante)
Get-NetTCPConnection -LocalPort 3000,3001 -State Listen |
  Select-Object -ExpandProperty OwningProcess -Unique |
  ForEach-Object { Stop-Process -Id $_ -Force }

# 2. borrar la caché (es 100% regenerable, no es código)
Remove-Item -Recurse -Force .next

# 3. levantar uno solo
npm run dev
```

Después, **Ctrl+Shift+R** en el navegador: la pestaña puede seguir con el bundle viejo.

**Cómo diagnosticarlo:** el log real de Next vive en `.next/dev/logs/next-development.log`, no en la salida de la terminal. Ahí se ve el `TurbopackInternalError`. Antes de culpar al código: si una ruta da 404/500 pero su archivo existe y `tsc` pasa, comprobar si otras rutas que **no se tocaron** también fallan — si sí, es la caché, no el código.

## Idioma

**REGLA ABSOLUTA — el código va 100% en inglés.** Sin excepciones:
- Nombres de variables, funciones, tipos, constantes, parámetros, archivos y componentes: **inglés**.
- Comentarios y JSDoc: **inglés**.
- Claves de los objetos de `i18n/`: **inglés** (`signInWithGoogle`, no `continuarConGoogle`).
- Nada de español en el código. Si dudas, va en inglés.

Lo único que permanece en español es lo que **ve el usuario final** o lo que ya es un contrato externo:
- **Valores** de los strings de UI en `i18n/` (el texto que se renderiza): 100% español.
- Rutas y carpetas de `app/` (`/mis-inversiones`, `/portafolio`): español, porque son URLs visibles.
- Valores de enums almacenados en base (`'en construcción'`, `'inversionista'`): español, definidos por las migraciones y la UI.
- Nombres de tablas y columnas: inglés (estándar SQL).

Strings de UI centralizados en `i18n/` para permitir internacionalización futura; hoy solo existe español.

## Roles y seguridad

**Modelo de capacidades, no de roles excluyentes.** "Ser admin" y "ser inversionista" son capacidades independientes que pueden coexistir en la misma cuenta (caso real: la dueña gestiona el negocio y además invirtió en él).

- `users.role` representa SOLO el nivel administrativo: `visitante` (usuario común) o `admin`. Ya no se asigna `inversionista` como valor de `role`.
- **Se es inversionista si existe una fila en `investors` vinculada al `user_id`.** Es una capacidad DERIVADA del vínculo, no del rol — el mismo criterio que ya usan las políticas RLS.
- El sidebar y los permisos se arman sumando capacidades: sección de inversionista si hay vínculo, sección de admin si `role = 'admin'`, ambas para la dueña.
- Rutas de inversionista (`/inicio`, `/mis-inversiones`, `/transacciones`…) exigen vínculo; `/admin/*` exige `role = 'admin'`.

Reglas de seguridad (sin cambios):
- IMPORTANTE: un inversionista JAMÁS ve datos de otro. Se garantiza con Row Level Security en Supabase (filtrado por `auth.uid()`), no solo ocultando en la UI. Ser admin no relaja esto: sus datos propios los ve en `/inicio` y los de todos solo en `/admin/*`.
- Toda consulta de datos privados verifica identidad + capacidades + propiedad del dato en el servidor. La protección de rutas va en `proxy.ts` (Next.js 16).

Detalle completo de las cuatro combinaciones: `.claude/docs/user-management.md`.

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

0. Setup + esquema SQL + RLS → 1. Auth + roles/estados + `proxy.ts` + onboarding básico → 2. Panel admin CRUD → 3. Catálogo y detalle de proyecto → 4. Home (KPIs, dona, feed) → 5. Transacciones y solicitudes → 6. Documentos y notificaciones → 7. Onboarding de inversión + Truora → 8. Firma electrónica → 9. Catálogo como captación + pipeline admin → 10. Chatbot.

El onboarding básico (datos personales) es parte de la etapa 1, junto con el login. Truora y la firma llegan en las etapas 7 y 8, dentro del onboarding de inversión.

Cada etapa debe quedar demostrable antes de pasar a la siguiente.
