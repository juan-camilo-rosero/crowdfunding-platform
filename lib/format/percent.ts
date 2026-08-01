/** Entero + "%": 13 -> "13%". */
export function formatPercent(value: number | null | undefined): string {
  return `${Math.round(value ?? 0)}%`;
}
