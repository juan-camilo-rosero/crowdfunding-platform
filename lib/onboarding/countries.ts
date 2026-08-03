export type Country = {
  /** ISO 3166-1 alpha-2, used as the option key. */
  code: string;
  name: string;
  /** Dial code including the "+". */
  dial: string;
  /** Emoji flag, so no image assets or icon font are needed. */
  flag: string;
};

/**
 * Countries offered by the phone field.
 *
 * Deliberately NOT the full ISO list: the investors are mostly Colombian, with
 * the rest across Latin America, the US and Europe, and a 250-entry dropdown
 * makes the common case slower. Colombia leads because it is the default.
 * The list is searchable, so adding to it later costs nothing.
 */
export const COUNTRIES: Country[] = [
  { code: "CO", name: "Colombia", dial: "+57", flag: "🇨🇴" },
  { code: "US", name: "Estados Unidos", dial: "+1", flag: "🇺🇸" },
  { code: "MX", name: "México", dial: "+52", flag: "🇲🇽" },
  { code: "AR", name: "Argentina", dial: "+54", flag: "🇦🇷" },
  { code: "BO", name: "Bolivia", dial: "+591", flag: "🇧🇴" },
  { code: "BR", name: "Brasil", dial: "+55", flag: "🇧🇷" },
  { code: "CL", name: "Chile", dial: "+56", flag: "🇨🇱" },
  { code: "CR", name: "Costa Rica", dial: "+506", flag: "🇨🇷" },
  { code: "CU", name: "Cuba", dial: "+53", flag: "🇨🇺" },
  { code: "EC", name: "Ecuador", dial: "+593", flag: "🇪🇨" },
  { code: "SV", name: "El Salvador", dial: "+503", flag: "🇸🇻" },
  { code: "GT", name: "Guatemala", dial: "+502", flag: "🇬🇹" },
  { code: "HN", name: "Honduras", dial: "+504", flag: "🇭🇳" },
  { code: "NI", name: "Nicaragua", dial: "+505", flag: "🇳🇮" },
  { code: "PA", name: "Panamá", dial: "+507", flag: "🇵🇦" },
  { code: "PY", name: "Paraguay", dial: "+595", flag: "🇵🇾" },
  { code: "PE", name: "Perú", dial: "+51", flag: "🇵🇪" },
  { code: "DO", name: "República Dominicana", dial: "+1809", flag: "🇩🇴" },
  { code: "UY", name: "Uruguay", dial: "+598", flag: "🇺🇾" },
  { code: "VE", name: "Venezuela", dial: "+58", flag: "🇻🇪" },
  { code: "ES", name: "España", dial: "+34", flag: "🇪🇸" },
  { code: "PT", name: "Portugal", dial: "+351", flag: "🇵🇹" },
  { code: "FR", name: "Francia", dial: "+33", flag: "🇫🇷" },
  { code: "IT", name: "Italia", dial: "+39", flag: "🇮🇹" },
  { code: "DE", name: "Alemania", dial: "+49", flag: "🇩🇪" },
  { code: "GB", name: "Reino Unido", dial: "+44", flag: "🇬🇧" },
  { code: "NL", name: "Países Bajos", dial: "+31", flag: "🇳🇱" },
  { code: "CH", name: "Suiza", dial: "+41", flag: "🇨🇭" },
  { code: "CA", name: "Canadá", dial: "+1", flag: "🇨🇦" },
];

/** Colombia: most investors are there (CLAUDE.md). */
export const DEFAULT_COUNTRY = COUNTRIES[0];

/** Case- and accent-insensitive match on name or dial code. */
export function searchCountries(query: string): Country[] {
  const needle = normalize(query);
  if (!needle) return COUNTRIES;
  return COUNTRIES.filter(
    (country) =>
      normalize(country.name).includes(needle) ||
      country.dial.includes(needle) ||
      normalize(country.code).includes(needle)
  );
}

function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}
