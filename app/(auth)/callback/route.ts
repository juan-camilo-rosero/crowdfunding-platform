import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { AuthErrorCode } from "@/lib/auth/auth-errors";

/**
 * Callback del OAuth de Google. Recibe el `code` del flujo PKCE, lo intercambia
 * por sesión (el cliente de @supabase/ssr escribe las cookies) y decide destino:
 *   · onboarding_completed = false → /onboarding
 *   · onboarding_completed = true  → /inicio
 *
 * Un usuario suspendido o desactivado NO inicia sesión aunque su OAuth sea válido
 * (user-management.md): se cierra la sesión recién creada y se devuelve a /login.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;

  // En producción detrás del proxy de Vercel, `origin` puede ser el host interno.
  const forwardedHost = request.headers.get("x-forwarded-host");
  const baseUrl =
    process.env.NODE_ENV === "development" || !forwardedHost
      ? origin
      : `https://${forwardedHost}`;

  const redirigirA = (path: string) => NextResponse.redirect(new URL(path, baseUrl));
  const volverALogin = (codigo: AuthErrorCode) =>
    redirigirA(`/login?error=${codigo}`);

  // Google/Supabase devuelven `error` cuando la persona cancela o niega permisos.
  if (searchParams.get("error")) {
    return volverALogin("proveedor-rechazado");
  }

  const code = searchParams.get("code");
  if (!code) {
    return volverALogin("codigo-faltante");
  }

  const supabase = await createClient();

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    return volverALogin("intercambio-fallido");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return volverALogin("intercambio-fallido");
  }

  // La fila la crea el trigger handle_new_user al insertarse en auth.users.
  const { data: profile } = await supabase
    .from("users")
    .select("status, onboarding_completed")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return volverALogin("perfil-no-encontrado");
  }

  if (profile.status === "suspendido") {
    await supabase.auth.signOut();
    return volverALogin("cuenta-suspendida");
  }

  if (profile.status === "desactivado") {
    await supabase.auth.signOut();
    return volverALogin("cuenta-desactivada");
  }

  return redirigirA(profile.onboarding_completed ? "/inicio" : "/onboarding");
}
