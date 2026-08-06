/**
 * Values stored in reassignment_requests.status.
 *
 * The three the CHECK constraint allows (migration
 * 20260730000940_tablas_movimiento.sql). Already Spanish in the database, but
 * still routed through i18n for the visible text so the UI has one source.
 */
export const REQUEST_STATUSES = ["pendiente", "aprobada", "rechazada"] as const;

export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export function isRequestStatus(value: unknown): value is RequestStatus {
  return (
    typeof value === "string" &&
    (REQUEST_STATUSES as readonly string[]).includes(value)
  );
}

/** Badge variant for each state. Meaning, not decoration. */
export type RequestStatusVariant = "success" | "warning" | "danger" | "neutral";

/**
 * Maps a stored status to its chip colour.
 *
 * An unknown value falls back to neutral rather than to one of the meaningful
 * colours: showing an unrecognised state in green would be a lie.
 */
export function requestStatusVariant(
  status: string | null | undefined
): RequestStatusVariant {
  switch (status) {
    case "aprobada":
      return "success";
    case "pendiente":
      return "warning";
    case "rechazada":
      return "danger";
    default:
      return "neutral";
  }
}

/** One row as the screen needs it, with both project names resolved. */
export type InvestorRequest = {
  id: string;
  requestedAt: string | null;
  fromProjectId: string | null;
  fromProjectName: string;
  toProjectId: string | null;
  toProjectName: string;
  amount: number;
  status: string | null;
};

/** Selectable destination project, derived from the caller's own requests. */
export type RequestProjectOption = { id: string; name: string };

export type RequestFilters = {
  /** Filters on to_project_id. */
  toProjectId: string | null;
  status: string | null;
};
