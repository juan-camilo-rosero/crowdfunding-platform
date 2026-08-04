/**
 * Movement types stored in transactions.type.
 *
 * These are the FOUR values the CHECK constraint allows (migration
 * 20260730000940_tablas_movimiento.sql) — not a UI list. Spanish because the
 * database stores them that way; the display labels live in i18n.
 *
 * `rendimiento` and `devolución de capital` are separate on purpose and must
 * never be merged or added together (business rules in CLAUDE.md): one is
 * earnings, the other is the investor's own money coming back.
 */
export const TRANSACTION_TYPES = [
  "aporte",
  "rendimiento",
  "devolución de capital",
  "reasignación",
] as const;

export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export function isTransactionType(value: unknown): value is TransactionType {
  return (
    typeof value === "string" &&
    (TRANSACTION_TYPES as readonly string[]).includes(value)
  );
}

/**
 * Whether the movement puts capital INTO a project or returns value TO the
 * investor. Used only for a discreet colour cue — no signs are invented, and
 * the amounts stay positive exactly as stored.
 */
export function transactionDirection(
  type: string | null
): "in" | "out" | "neutral" {
  switch (type) {
    case "aporte":
      return "in";
    case "rendimiento":
    case "devolución de capital":
      return "out";
    default:
      // A reassignment moves capital between the investor's own projects; it is
      // neither an entry nor an exit at portfolio level.
      return "neutral";
  }
}

/** One row as the screen needs it: the transaction plus its project name. */
export type InvestorTransaction = {
  id: string;
  date: string | null;
  projectId: string | null;
  projectName: string;
  type: string | null;
  amount: number;
};

/** Selectable project, derived from the investor's own transactions. */
export type TransactionProjectOption = { id: string; name: string };

export type TransactionFilters = {
  projectId: string | null;
  type: string | null;
};
