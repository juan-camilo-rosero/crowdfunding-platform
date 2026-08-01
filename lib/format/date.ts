// timeZone "UTC" prevents the off-by-one-day shift that new Date("YYYY-MM-DD")
// produces when formatted in a non-UTC zone (`date` columns carry no time).
const dateFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** es-CO format: "2025-03-27" -> "27 mar 2025". Empty when missing or invalid. */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "";

  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";

  // formatToParts instead of format(): the es-CO pattern inserts connectors
  // ("27 de mar. de 2025"), so the string is assembled manually.
  const parts = dateFormatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  const day = get("day");
  const month = get("month").replace(/\.$/, "");
  const year = get("year");

  return `${day} ${month} ${year}`;
}
