// timeZone: "UTC" evita el corrimiento de un día que produce new Date("YYYY-MM-DD")
// al formatear en una zona horaria distinta a UTC (columnas `date` no llevan hora).
const dateFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** Formato es-CO: "2025-03-27" -> "27 mar 2025". Vacío si no hay valor o es inválido. */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "";

  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";

  // formatToParts en vez de format(): el patrón es-CO de Intl agrega conectores
  // ("27 de mar. de 2025"); se arma el string a mano para el formato pedido.
  const parts = dateFormatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  const day = get("day");
  const month = get("month").replace(/\.$/, "");
  const year = get("year");

  return `${day} ${month} ${year}`;
}
