/**
 * Display-only phone formatting. Storage stays E.164 (+573014567890); this only
 * groups the digits so they are readable.
 */

/**
 * Country codes are variable length, so guessing by digit count gets it wrong
 * (a greedy 3-digit prefix turns +57 301… into +573 014…). Only the codes the
 * platform actually uses are listed; anything else falls back to plain grouping.
 */
const DIAL_CODES = ["57", "1", "34", "52", "51", "56", "593", "507"];

function splitCountryCode(digits: string): [string, string] | null {
  for (const code of DIAL_CODES) {
    if (digits.startsWith(code)) return [code, digits.slice(code.length)];
  }
  return null;
}

/** Groups a national number as 3-3-4 (or 3s + remainder for other lengths). */
function groupNational(national: string): string {
  if (national.length === 10) {
    return `${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`;
  }
  return national.replace(/(\d{3})(?=\d)/g, "$1 ");
}

export function formatPhone(value: string | null | undefined): string {
  if (!value) return "";

  const raw = String(value).trim();
  const compact = raw.replace(/[^\d+]/g, "");

  // Anything that is not E.164 is shown as stored rather than mangled.
  if (!compact.startsWith("+")) return raw;

  const split = splitCountryCode(compact.slice(1));
  if (!split) return raw;

  const [country, national] = split;
  if (national.length < 6) return raw;

  return `+${country} ${groupNational(national)}`;
}
