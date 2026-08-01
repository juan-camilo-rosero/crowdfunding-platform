/**
 * Códigos de error de autenticación que viajan en el query param `?error=` hacia
 * /login. Este módulo NO importa nada a propósito: lo consumen tanto código server
 * (proxy.ts, callback) como Client Components, y cualquier import de `next/headers`
 * aquí rompería el bundle del navegador.
 */
export const AUTH_ERROR_CODES = [
  "sesion-requerida",
  "codigo-faltante",
  "intercambio-fallido",
  "proveedor-rechazado",
  "perfil-no-encontrado",
  "cuenta-suspendida",
  "cuenta-desactivada",
] as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];

export function isAuthErrorCode(value: string): value is AuthErrorCode {
  return (AUTH_ERROR_CODES as readonly string[]).includes(value);
}
