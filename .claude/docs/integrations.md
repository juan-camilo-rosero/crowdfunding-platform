# Integraciones externas

## Truora — verificación de identidad

Se usa en el **onboarding de inversión**, NO en el registro inicial. El onboarding básico (datos personales, al registrarse) no incluye verificación de identidad; Truora entra cuando el usuario va a invertir en un proyecto concreto o cuando el admin lo vincula como inversionista (ver views.md y user-management.md).

Truora recomienda EXPLÍCITAMENTE usar su Web Integration y evitar los endpoints directos de la API salvo que sea absolutamente necesario. Por eso el flujo es por token web, no llamadas directas a validadores. Modelo:

1. El backend (`/api/truora/start`) genera un token de integración web por usuario contra la API de Truora, usando `TRUORA_API_KEY` y `TRUORA_ACCOUNT_ID`. Cada usuario y cada proceso requieren un token distinto. El `account_id` debe seguir el patrón `[a-zA-Z0-9_.-]+`.
2. Se redirige al usuario al flujo web de Truora (URL con el token). El flujo hace Document ID (validación del documento) + Face Match (comparación facial).
3. Para Colombia, `country = CO` y `document_type = national-id` (cédula). Se requiere `user_authorized = true` por ley de protección de datos.
4. Truora devuelve el resultado por webhook: `/api/truora/webhook` recibe el resultado y actualiza `identity_verifications` (status: aprobado/rechazado/expirado, decline_reason) y marca `users.identity_verified`.

Notas:
- Documentación oficial: dev.truora.com. Hay colección de Postman para probar antes de integrar.
- Truora es un módulo con costo por verificación. El flujo queda construido; si el equipo no lo activa aún, se salta por configuración (flag/variable de entorno).
- Verificar contra dev.truora.com los nombres exactos de endpoints y campos antes de implementar; las APIs cambian.

## Firma electrónica

Contrato de inversión firmado dentro del **onboarding de inversión**, NO en el registro inicial (el onboarding básico solo pide datos personales). Proveedor base: Documenso (open source, autohospedable); conmutable a proveedor comercial vía `ESIGN_PROVIDER_URL` / `ESIGN_API_KEY`. El estado de firma se recibe por `/api/esign/webhook`. Validez legal en Colombia (Ley 527 de 1999) y EE.UU. (ESIGN Act).

## Chatbot IA

- Endpoint: `/api/chat`.
- Proveedor conmutable (OpenAI / Claude / DeepSeek) detrás de `lib/ai/provider.ts`, seleccionado por `AI_PROVIDER`. El resto del código no conoce el proveedor concreto.
- IMPORTANTE: el chatbot NO tiene historial persistente. No se guardan conversaciones en base de datos. Cada petición arma su contexto desde cero con los datos del inversionista autenticado (portafolio, transacciones, proyectos, documentos) y responde. Si se necesita contexto conversacional dentro de una misma sesión, se mantiene solo en el estado del cliente durante esa sesión, sin persistir.
- Contexto: solo datos del inversionista autenticado y datos públicos del portal. NUNCA datos de otros inversionistas.
- Límites de comportamiento: responde sobre el portal y los datos propios del usuario; no da asesoría de inversión, no promete retornos, no toma decisiones. Ante preguntas de ese tipo ("¿me conviene invertir?", "¿cuánto voy a ganar?"), redirige al equipo de Investors 180.

## Notificaciones por email
Eventos: nuevo reporte publicado, solicitud de reasignación resuelta, nuevo proyecto en captación. Canal independiente de las notificaciones push (ver la sección siguiente): el email no dispara push ni al revés.

## Notificaciones push (app móvil)

La app móvil del inversionista (`investors_180_mobile`, repo aparte) apunta a **este mismo proyecto de Supabase**. Los nombres de tabla y columna de abajo son el contrato entre los dos repos: renombrar algo rompe un cliente que este repo no compila ni despliega.

### Tablas

- **`push_tokens`** (`id`, `user_id`, `token`, `platform`, `device_name`, `created_at`, `last_seen_at`). Una fila por dispositivo. La escribe la app móvil; `token` es único, así que un celular que cambia de dueño mueve la fila en vez de duplicarla. RLS: cada quien gestiona solo los suyos.
- **`notifications`** (`id`, `user_id`, `title`, `body`, `data`, `created_at`, `read_at`). Una fila por destinatario. RLS: el inversionista lee solo las suyas y solo puede escribir `read_at` (restricción por GRANT de columna, no por policy: RLS ve filas completas). El INSERT desde el panel está limitado a `public.is_admin()`.

### Un solo pipeline de entrega

```
insert into public.notifications
  → Database Webhook (INSERT sobre notifications)
      → Edge Function push-send
          → Expo Push API
```

**Insertar la fila ES enviar.** Nada del código web habla con Expo. Los dos emisores solo insertan:

1. **Automático:** trigger `projects_notify_investors` (AFTER INSERT sobre `projects`) → una fila por inversionista vinculado, con `data = {"type": "project_created", "project_id": ...}`. Es SECURITY DEFINER, así que también funciona cuando el proyecto entra por `admin_save_table_changes`.
2. **Manual:** panel `/admin/notificaciones` → Server Action `sendNotification`, con `data = {"type": "admin_message"}`.

**Quién es inversionista** en el fan-out: quien tiene fila **vinculada** en `investors` (`user_id is not null`). Es la capacidad derivada del vínculo, nunca `users.role` — la misma regla que usan las policies y el sidebar.

### Edge Function `push-send`

Código en `supabase/functions/push-send/index.ts`. Envía en lotes de máximo 100 destinatarios y borra de `push_tokens` los tokens que Expo reporte como `DeviceNotRegistered`.

```
supabase functions deploy push-send
supabase secrets set EXPO_ACCESS_TOKEN=...
```

- `EXPO_ACCESS_TOKEN` se genera en **expo.dev → Access Tokens**. Sin él la función responde 500 y no entrega nada (falla ruidosa a propósito: la notificación ya está en la base, perderla en silencio sería peor).
- `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` los inyecta la plataforma.
- Se despliega con `verify_jwt = false` (ver `supabase/config.toml`) **y eso no la deja abierta**: ese flag acepta el JWT de cualquier usuario logueado, y este endpoint decide a quién le suena el celular. La función compara ella misma el header `Authorization` contra `SUPABASE_SERVICE_ROLE_KEY`, que ningún cliente tiene.

### Database Webhook (se configura en el dashboard)

Database → Webhooks → Create a new hook:

| Campo | Valor |
|---|---|
| Table | `public.notifications` |
| Events | `Insert` |
| Type | Supabase Edge Functions → `push-send` |
| Method | `POST` |
| Timeout | `1000` ms |
| HTTP Headers | `Authorization: Bearer <SERVICE_ROLE_KEY>` |

El timeout de 1000 ms es el del webhook, no el de la entrega: la función responde rápido y Expo hace el resto.
