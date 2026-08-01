import type { Database } from "@/types/database";
import type { TableColumn } from "@/lib/table/types";

/** Every admin tab must point at a table that actually exists in the schema. */
type SupabaseTableName = keyof Database["public"]["Tables"];

/**
 * The tables the admin panel can browse. Each entry maps a tab to a Supabase
 * table plus its serializable column definitions.
 *
 * Enum options mirror the CHECK constraints in supabase/migrations — keep them
 * in sync with .claude/docs/database-schema.md.
 */
export type AdminTableDefinition = {
  /** Tab id, also the `?tabla=` value. */
  id: string;
  label: string;
  /** Table name in Supabase, checked against the generated schema types. */
  source: SupabaseTableName;
  /** Records can be created from the "+" row. Defaults to true. */
  allowInsert?: boolean;
  /** Column used to sort; defaults to created_at. */
  orderBy?: string;
  columns: TableColumn[];
};

export const ADMIN_TABLES: AdminTableDefinition[] = [
  {
    id: "proyectos",
    label: "Proyectos",
    source: "projects",
    columns: [
      { key: "name", label: "Nombre", type: "text", width: 220, required: true },
      {
        key: "company",
        label: "Compañía",
        type: "select",
        options: ["Investors 180 Group", "F1", "F3", "Otra LLC"],
      },
      { key: "address", label: "Dirección", type: "text", width: 240 },
      {
        key: "city",
        label: "Ciudad",
        type: "select",
        options: ["Punta Gorda", "Rotonda", "North Port", "Otra"],
      },
      {
        key: "type",
        label: "Tipo",
        type: "select",
        options: ["lote", "casa", "triplex", "multifamily"],
      },
      {
        key: "status",
        label: "Estado",
        type: "select",
        options: [
          "en evaluación",
          "en reserva",
          "permisos",
          "construcción",
          "vendido",
          "rentado",
          "pausado",
        ],
      },
      { key: "lot_value", label: "Valor del lote", type: "currency" },
      { key: "capital_required", label: "Capital requerido", type: "currency" },
      { key: "estimated_sale_value", label: "Venta estimada", type: "currency" },
      { key: "estimated_rent", label: "Renta estimada", type: "currency" },
      { key: "progress", label: "Avance", type: "percent" },
      { key: "responsible", label: "Responsable", type: "text" },
      { key: "next_step", label: "Siguiente paso", type: "text", width: 220 },
      { key: "deadline", label: "Fecha límite", type: "date" },
      { key: "in_fundraising", label: "En captación", type: "boolean" },
      { key: "fundraising_goal", label: "Meta de captación", type: "currency" },
      { key: "description", label: "Descripción", type: "longText" },
      { key: "drive_folder_url", label: "Carpeta Drive", type: "url" },
    ],
  },
  {
    id: "inversionistas",
    label: "Inversionistas",
    source: "investors",
    columns: [
      { key: "full_name", label: "Nombre completo", type: "text", width: 220, required: true },
      { key: "document_id", label: "Cédula", type: "text" },
      { key: "phone", label: "Teléfono", type: "phone" },
      { key: "email", label: "Correo", type: "email" },
      { key: "city_country", label: "Ciudad / País", type: "text" },
      { key: "potential_amount", label: "Monto potencial", type: "currency" },
      {
        key: "pipeline_stage",
        label: "Etapa",
        type: "select",
        options: [
          "contacto",
          "calificado",
          "en reunión",
          "en revisión",
          "firmado",
          "desembolsado",
        ],
      },
      {
        key: "investment_type_pref",
        label: "Tipo preferido",
        type: "select",
        options: ["deuda", "equity", "socio", "préstamo", "participación"],
      },
      { key: "first_contact_date", label: "Primer contacto", type: "date" },
      { key: "last_contact_date", label: "Último contacto", type: "date" },
      {
        key: "status",
        label: "Estado",
        type: "select",
        options: [
          "prospecto",
          "interesado",
          "en revisión",
          "comprometido",
          "recibido",
          "pausado",
        ],
      },
      { key: "notes", label: "Notas", type: "longText" },
    ],
  },
  {
    id: "capital",
    label: "Capital y financiamiento",
    source: "capital_contributions",
    columns: [
      { key: "project_id", label: "Proyecto", type: "select", width: 220, required: true },
      { key: "reference", label: "Referencia", type: "text", required: true },
      { key: "amount_required", label: "Monto requerido", type: "currency", required: true },
      { key: "amount_committed", label: "Monto comprometido", type: "currency" },
      { key: "amount_received", label: "Monto recibido", type: "currency" },
      { key: "received_date", label: "Fecha de recepción", type: "date" },
      { key: "bank_account", label: "Cuenta bancaria", type: "text" },
      {
        key: "capital_type",
        label: "Tipo de capital",
        type: "select",
        options: ["equity", "deuda", "préstamo", "socio"],
      },
      { key: "agreed_return", label: "Retorno pactado", type: "text" },
      { key: "term", label: "Plazo", type: "text" },
      {
        key: "status",
        label: "Estado",
        type: "select",
        options: ["pendiente", "recibido", "usado", "devuelto"],
      },
      { key: "comments", label: "Comentarios", type: "longText" },
    ],
  },
  {
    id: "presupuesto",
    label: "Presupuesto",
    source: "budget_items",
    columns: [
      { key: "project_id", label: "Proyecto", type: "select", width: 220, required: true },
      { key: "description", label: "Descripción", type: "text", width: 240, required: true },
      {
        key: "category",
        label: "Categoría",
        type: "select",
        required: true,
        options: [
          "lote",
          "closing costs",
          "survey",
          "arquitectura",
          "ingeniería",
          "permisos",
          "impact fees",
          "site work",
          "utilities",
          "construcción",
          "piscina",
          "landscaping",
          "marketing",
          "realtor",
          "contingencia",
          "administración",
        ],
      },
      { key: "approved_budget", label: "Presupuesto aprobado", type: "currency" },
      { key: "actual_spent", label: "Gasto real", type: "currency" },
      { key: "spent_date", label: "Fecha de gasto", type: "date" },
      { key: "vendor", label: "Proveedor", type: "text" },
      {
        key: "paid_status",
        label: "Pago",
        type: "select",
        options: ["pagado", "pendiente"],
      },
      { key: "comments", label: "Comentarios", type: "longText" },
    ],
  },
  {
    id: "timeline",
    label: "Timeline",
    source: "tasks",
    columns: [
      { key: "project_id", label: "Proyecto", type: "select", width: 220, required: true },
      { key: "task", label: "Tarea", type: "text", width: 240, required: true },
      {
        key: "stage",
        label: "Etapa",
        type: "select",
        options: [
          "evaluación",
          "oferta",
          "due diligence",
          "survey",
          "diseño",
          "planos",
          "permisos",
          "construcción",
          "inspecciones",
          "renta",
          "venta",
          "refinanciación",
        ],
      },
      { key: "responsible", label: "Responsable", type: "text" },
      { key: "estimated_date", label: "Fecha estimada", type: "date" },
      { key: "actual_date", label: "Fecha real", type: "date" },
      {
        key: "priority",
        label: "Prioridad",
        type: "select",
        options: ["alta", "media", "baja"],
      },
      {
        key: "status",
        label: "Estado",
        type: "select",
        options: ["pendiente", "en proceso", "completada", "atrasada"],
      },
      { key: "next_action", label: "Siguiente acción", type: "text", width: 220 },
    ],
  },
  {
    id: "reportes",
    label: "Reportes",
    source: "monthly_reports",
    orderBy: "report_month",
    columns: [
      { key: "project_id", label: "Proyecto", type: "select", width: 220, required: true },
      { key: "report_month", label: "Mes", type: "date", required: true },
      { key: "physical_progress", label: "Avance físico", type: "text", width: 220 },
      { key: "financial_progress", label: "Avance financiero", type: "text", width: 220 },
      { key: "capital_used_month", label: "Capital usado", type: "currency" },
      { key: "decisions", label: "Decisiones", type: "longText" },
      { key: "risks", label: "Riesgos", type: "longText" },
      { key: "next_steps", label: "Siguientes pasos", type: "longText" },
      { key: "next_report_date", label: "Próximo reporte", type: "date" },
      { key: "report_pdf_url", label: "PDF", type: "url" },
    ],
  },
  {
    id: "documentos",
    label: "Documentos",
    source: "documents",
    columns: [
      { key: "project_id", label: "Proyecto", type: "select", width: 220, required: true },
      { key: "name", label: "Nombre", type: "text", width: 240, required: true },
      {
        key: "doc_type",
        label: "Tipo",
        type: "select",
        required: true,
        options: [
          "deed",
          "property record",
          "survey",
          "planos",
          "permisos",
          "presupuesto",
          "contrato",
          "operating agreement",
          "facturas",
          "estados de cuenta",
          "reportes",
          "certificado de aporte",
        ],
      },
      { key: "date", label: "Fecha", type: "date" },
      { key: "responsible", label: "Responsable", type: "text" },
      { key: "file_url", label: "Archivo", type: "url" },
      {
        key: "status",
        label: "Estado",
        type: "select",
        options: ["pendiente", "recibido", "aprobado", "vencido"],
      },
      {
        key: "visibility",
        label: "Visibilidad",
        type: "select",
        options: ["privado", "proyecto", "público"],
      },
    ],
  },
  {
    id: "solicitudes",
    label: "Solicitudes",
    source: "reassignment_requests",
    orderBy: "requested_at",
    columns: [
      { key: "amount", label: "Monto", type: "currency", required: true },
      {
        key: "status",
        label: "Estado",
        type: "select",
        options: ["pendiente", "aprobada", "rechazada"],
        // Approving must go through the approvals screen so the reassignment
        // transaction gets created (database-schema.md).
        readOnly: true,
      },
      { key: "requested_at", label: "Solicitada", type: "date" },
      { key: "resolved_at", label: "Resuelta", type: "date" },
    ],
  },
  {
    id: "interes",
    label: "Interés de inversión",
    source: "investment_interests",
    // Interest forms are submitted by users, never typed in by an admin.
    allowInsert: false,
    columns: [
      { key: "amount", label: "Monto", type: "currency" },
      {
        key: "investment_type_pref",
        label: "Tipo preferido",
        type: "select",
        options: ["equity", "deuda", "préstamo", "socio", "no estoy seguro"],
      },
      { key: "phone", label: "Teléfono", type: "phone" },
      { key: "comments", label: "Comentarios", type: "longText" },
      {
        key: "status",
        label: "Estado",
        type: "select",
        options: ["nuevo", "contactado", "cerrado"],
      },
    ],
  },
];

export function findAdminTable(id: string | undefined): AdminTableDefinition {
  return ADMIN_TABLES.find((table) => table.id === id) ?? ADMIN_TABLES[0];
}

/** Column that links a child record to its project. */
export const PROJECT_COLUMN_KEY = "project_id";

/**
 * Fills the project selector with the real projects. Kept out of the static
 * definition because the choices come from the database at request time.
 */
export function withProjectOptions(
  definition: AdminTableDefinition,
  projects: { id: string; name: string }[]
): AdminTableDefinition {
  if (!definition.columns.some((column) => column.key === PROJECT_COLUMN_KEY)) {
    return definition;
  }

  return {
    ...definition,
    columns: definition.columns.map((column) =>
      column.key === PROJECT_COLUMN_KEY
        ? {
            ...column,
            options: projects.map((project) => ({
              value: project.id,
              label: project.name,
            })),
          }
        : column
    ),
  };
}
