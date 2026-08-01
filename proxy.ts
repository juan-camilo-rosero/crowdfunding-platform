import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { AuthErrorCode } from "@/lib/auth/auth-errors";
import { isRole, isUserStatus } from "@/types/user";

// Rutas de (auth): no requieren sesión.
// "/callback" DEBE ser pública: es donde se intercambia el `code` de Google por
// sesión, y en ese momento el usuario todavía no tiene cookies de sesión.
const PUBLIC_PATHS = ["/login", "/callback"];

// "/" es pública y se maneja aparte (coincidencia exacta, no por prefijo):
// hoy es un redirector y mañana será la landing pública. Ver app/page.tsx.
const ROOT_PATH = "/";

// (admin)/admin/*: solo rol admin.
const ADMIN_PATH = "/admin";

// (onboarding)/onboarding: solo inversionista, ver nota en el bloque de abajo.
const ONBOARDING_PATH = "/onboarding";

// (investor)/*: catálogo público (accesible también para visitante) vs. resto (solo inversionista).
const CATALOG_PATHS = ["/portafolio", "/proyecto", "/perfil"];
const INVESTOR_ONLY_PATHS = [
  "/inicio",
  "/mis-inversiones",
  "/transacciones",
  "/documentos",
  "/solicitudes",
];

function isPathUnder(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // No ejecutar lógica entre createServerClient() y auth.getUser(): getUser()
  // es lo que realmente refresca la sesión y reescribe las cookies vía setAll.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  const redirectToLogin = (codigo: AuthErrorCode) => {
    const url = new URL("/login", request.url);
    url.searchParams.set("error", codigo);
    return NextResponse.redirect(url);
  };

  if (pathname === ROOT_PATH || PUBLIC_PATHS.some((p) => isPathUnder(pathname, p))) {
    return response;
  }

  if (!user) {
    return redirectToLogin("sesion-requerida");
  }

  // Segunda consulta (perfil): la autorización real vive en el backend y en RLS;
  // este proxy es la primera barrera, no la única (ver code-patterns.md).
  const { data: profile } = await supabase
    .from("users")
    .select("role, status")
    .eq("id", user.id)
    .single();

  const role = profile && isRole(profile.role) ? profile.role : null;
  const status = profile && isUserStatus(profile.status) ? profile.status : null;

  if (!role || !status) {
    return redirectToLogin("perfil-no-encontrado");
  }

  if (status === "suspendido") {
    return redirectToLogin("cuenta-suspendida");
  }

  if (status === "desactivado") {
    return redirectToLogin("cuenta-desactivada");
  }

  if (status === "invitado") {
    // No debería ocurrir: invitado no tiene fila en auth.users hasta su primer login,
    // momento en que pasa a "registrado". Se trata como no autorizado por seguridad.
    return redirectToLogin("sesion-requerida");
  }

  const isAdminRoute = isPathUnder(pathname, ADMIN_PATH);
  const isOnboardingRoute = isPathUnder(pathname, ONBOARDING_PATH);
  const isCatalogRoute = CATALOG_PATHS.some((p) => isPathUnder(pathname, p));
  const isInvestorOnlyRoute = INVESTOR_ONLY_PATHS.some((p) => isPathUnder(pathname, p));

  if (isAdminRoute) {
    if (role !== "admin") {
      const homeUrl = new URL(role === "inversionista" ? "/inicio" : "/portafolio", request.url);
      return NextResponse.redirect(homeUrl);
    }
    return response;
  }

  // El admin ve todo (matriz de permisos, user-management.md): no se restringe más.
  if (role === "admin") {
    return response;
  }

  if (isOnboardingRoute) {
    // Un visitante (registrado sin vincular) solo accede a catálogo + perfil,
    // no a onboarding: eso es exclusivo de quien ya fue vinculado como inversionista.
    if (role !== "inversionista") {
      return NextResponse.redirect(new URL("/portafolio", request.url));
    }
    return response;
  }

  if (isCatalogRoute) {
    // Catálogo público y perfil: visitante e inversionista acceden por igual.
    return response;
  }

  if (isInvestorOnlyRoute) {
    if (role !== "inversionista") {
      return NextResponse.redirect(new URL("/portafolio", request.url));
    }
    return response;
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
