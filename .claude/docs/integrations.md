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
Eventos: nuevo reporte publicado, solicitud de reasignación resuelta, nuevo proyecto en captación. Solo email (no hay notificaciones in-app en el alcance actual).
