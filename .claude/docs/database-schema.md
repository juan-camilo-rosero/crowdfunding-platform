# Esquema de base de datos (Supabase / PostgreSQL)

Todas las tablas llevan: `id uuid primary key default gen_random_uuid()`, `created_at timestamptz default now()`, `updated_at timestamptz`. Tipos en formato PostgreSQL. Los enums se almacenan en español.

## users (perfil, extiende auth.users de Supabase)
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | = auth.users.id |
| email | text | verificado por OAuth |
| full_name | text | |
| phone | text | E.164 |
| avatar_url | text | de Google/Outlook |
| role | text enum | Nivel administrativo: `visitante` · `admin`. El CHECK acepta además `inversionista` por compatibilidad histórica, pero **ya no se asigna**: ser inversionista se deriva de tener fila en `investors` con este `user_id` (ver user-management.md). |
| status | text enum | invitado · registrado · activo · suspendido · desactivado |
| onboarding_completed | boolean | default false |
| identity_verified | boolean | default false (lo marca Truora) |

## projects
| Campo | Tipo | Notas |
|---|---|---|
| name | text | |
| company | text enum | Investors 180 Group · F1 · F3 · Otra LLC |
| address | text | |
| city | text enum | Punta Gorda · Rotonda · North Port · Otra |
| type | text enum | lote · casa · triplex · multifamily |
| status | text enum | en evaluación · en reserva · permisos · construcción · vendido · rentado · pausado |
| lot_value | numeric(14,2) | USD |
| capital_required | numeric(14,2) | USD |
| estimated_sale_value | numeric(14,2) | USD |
| estimated_rent | numeric(14,2) | USD |
| progress | integer | 0–100 avance de obra |
| description | text | descripción larga (pestaña Resumen) |
| selling_points | jsonb | lista de argumentos de venta |
| responsible | text | |
| next_step | text | |
| deadline | date | |
| drive_folder_url | text | |
| main_photos | text[] | URLs en Storage |
| in_fundraising | boolean | catálogo como captación |
| fundraising_goal | numeric(14,2) | meta si in_fundraising |
| return_offer | jsonb | Retorno público ofrecido, estructurado. Tres formas: `{"kind":"annual","terms":[{"months","min","max"}]}` (tasa anual por plazo), `{"kind":"total","min","max","months"}` (total al cierre; `months` puede ser null), `{"kind":"participation","percent"}` (participación en utilidades). Porcentajes (12 = 12%), siempre rango min–max. Alimenta la etiqueta del catálogo y la calculadora. Validado en `lib/projects/return-offer.ts`; CHECK mínimo en la base. NO es el `agreed_return` por inversionista, que sigue siendo texto libre. |
| offered_return | text | LEGADO: texto libre anterior. Solo se muestra como respaldo mientras `return_offer` es null; el guardado del admin lo limpia al escribir `return_offer`. |
| lat | numeric(9,6) | mapa |
| lng | numeric(9,6) | mapa |

Campos calculados (vía vista SQL, NO columnas): `capital_received`, `capital_pending`, `executed_budget`.

## investors
| Campo | Tipo | Notas |
|---|---|---|
| user_id | uuid | FK users (nullable hasta vincular) |
| full_name | text | |
| document_id | text | cédula |
| phone | text | E.164 |
| email | text | |
| city_country | text | |
| potential_amount | numeric(14,2) | USD, para el pipeline |
| pipeline_stage | text enum | contacto · calificado · en reunión · en revisión · firmado · desembolsado |
| investment_type_pref | text enum | deuda · equity · socio · préstamo · participación |
| first_contact_date | date | |
| last_contact_date | date | |
| status | text enum | prospecto · interesado · en revisión · comprometido · recibido · pausado |
| notes | text | |

## capital_contributions
| Campo | Tipo | Notas |
|---|---|---|
| reference | text | identificador legible |
| project_id | uuid | FK projects |
| investor_id | uuid | FK investors |
| amount_required | numeric(14,2) | USD |
| amount_committed | numeric(14,2) | USD |
| amount_received | numeric(14,2) | USD |
| received_date | date | |
| bank_account | text | |
| capital_type | text enum | equity · deuda · préstamo · socio |
| agreed_return | text | libre: "15% anual", "Participación 8%" |
| term | text | |
| status | text enum | pendiente · recibido · usado · devuelto |
| comments | text | |

## transactions
Movimientos que ve el inversionista. Los aportes pueden derivarse de capital_contributions vía vista SQL; rendimientos y devoluciones son registros propios.
| Campo | Tipo | Notas |
|---|---|---|
| investor_id | uuid | FK |
| project_id | uuid | FK |
| type | text enum | aporte · rendimiento · devolución de capital · reasignación |
| amount | numeric(14,2) | USD, positivo |
| date | date | |
| capital_type | text | solo si type = aporte |

## budget_items
| Campo | Tipo | Notas |
|---|---|---|
| project_id | uuid | FK |
| description | text | |
| category | text enum | lote · closing costs · survey · arquitectura · ingeniería · permisos · impact fees · site work · utilities · construcción · piscina · landscaping · marketing · realtor · contingencia · administración |
| approved_budget | numeric(14,2) | USD |
| actual_spent | numeric(14,2) | USD |
| spent_date | date | |
| vendor | text | |
| paid_status | text enum | pagado · pendiente |
| comments | text | |

`difference` (approved_budget − actual_spent) se calcula en consulta, no se almacena.

## tasks
| Campo | Tipo | Notas |
|---|---|---|
| project_id | uuid | FK |
| task | text | |
| stage | text enum | evaluación · oferta · due diligence · survey · diseño · planos · permisos · construcción · inspecciones · renta · venta · refinanciación |
| responsible | text | |
| estimated_date | date | |
| actual_date | date | |
| priority | text enum | alta · media · baja |
| status | text enum | pendiente · en proceso · completada · atrasada |
| next_action | text | |

## monthly_reports
| Campo | Tipo | Notas |
|---|---|---|
| project_id | uuid | FK |
| report_month | date | primer día del mes |
| physical_progress | text | |
| financial_progress | text | |
| capital_used_month | numeric(14,2) | USD |
| photos | text[] | URLs Storage |
| decisions | text | |
| risks | text | |
| next_steps | text | |
| next_report_date | date | |
| report_pdf_url | text | |

## documents
| Campo | Tipo | Notas |
|---|---|---|
| project_id | uuid | FK (nullable) |
| investor_id | uuid | FK (nullable): si es privado del inversionista |
| name | text | |
| doc_type | text enum | deed · property record · survey · planos · permisos · presupuesto · contrato · operating agreement · facturas · estados de cuenta · reportes · certificado de aporte |
| date | date | |
| responsible | text | |
| file_url | text | Storage o Drive |
| status | text enum | pendiente · recibido · aprobado · vencido |
| visibility | text enum | privado (solo su investor_id) · proyecto · público |

## reassignment_requests
| Campo | Tipo | Notas |
|---|---|---|
| investor_id | uuid | FK |
| from_project_id | uuid | FK |
| to_project_id | uuid | FK |
| amount | numeric(14,2) | USD |
| status | text enum | pendiente · aprobada · rechazada |
| requested_at | timestamptz | |
| resolved_at | timestamptz | |
| resolved_by | uuid | FK users (admin) |

Una solicitud aprobada genera su transacción de tipo `reasignación`.

## investment_interests
Formulario "Me interesa este proyecto".
| Campo | Tipo | Notas |
|---|---|---|
| user_id | uuid | FK |
| project_id | uuid | FK |
| amount | numeric(14,2) | nullable (opcional) |
| investment_type_pref | text enum | equity · deuda · préstamo · socio · no estoy seguro |
| comments | text | |
| phone | text | si no estaba en el perfil |
| status | text enum | nuevo · contactado · cerrado |

## identity_verifications
Rastreo del proceso Truora.
| Campo | Tipo | Notas |
|---|---|---|
| user_id | uuid | FK |
| truora_process_id | text | del token generado |
| status | text enum | iniciado · aprobado · rechazado · expirado |
| decline_reason | text | si rechazado |
| completed_at | timestamptz | lo fija el webhook |

## push_tokens
Tokens de Expo de la app móvil (`investors_180_mobile`, repo aparte, mismo proyecto de Supabase). **Contrato compartido: no renombrar tabla ni columnas.** No lleva `updated_at`; su equivalente es `last_seen_at`.
| Campo | Tipo | Notas |
|---|---|---|
| user_id | uuid | FK users, on delete cascade |
| token | text | único: un celular que cambia de dueño mueve la fila, no la duplica |
| platform | text enum | `ios` · `android` (en inglés: valor de la plataforma, no texto de UI) |
| device_name | text | nullable |
| last_seen_at | timestamptz | lo refresca la app al abrir |

## notifications
Feed de notificaciones, una fila por destinatario. **Contrato compartido con la app móvil: no renombrar.** Insertar la fila ES enviar la notificación: un Database Webhook la entrega a la Edge Function `push-send` (ver integrations.md). No lleva `updated_at`.
| Campo | Tipo | Notas |
|---|---|---|
| user_id | uuid | FK users, on delete cascade |
| title | text | |
| body | text | |
| data | jsonb | ruteo del tap: `{"type": "project_created", "project_id": ...}` o `{"type": "admin_message"}` |
| read_at | timestamptz | nullable; lo marca el inversionista |

RLS: el inversionista lee solo las suyas y de escritura solo puede tocar `read_at` (GRANT de columna, porque RLS ve filas completas). El INSERT queda para `public.is_admin()` desde el panel y para el trigger `projects_notify_investors` (SECURITY DEFINER), que al crear un proyecto escribe una fila por inversionista **vinculado** (fila en `investors` con `user_id`), nunca por `users.role`.

<!-- Nota: no existe tabla de historial de chat. El chatbot no persiste conversaciones (ver integrations.md). -->
