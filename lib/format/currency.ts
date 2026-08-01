const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

/** USD sin decimales, separador de miles: 140926 -> "$140,926". */
export function formatCurrency(value: number | null | undefined): string {
  return currencyFormatter.format(value ?? 0);
}
