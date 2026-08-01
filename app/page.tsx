import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentUserProfile } from "@/lib/auth/session";

/**
 * PUNTO DE MONTAJE DE LA LANDING PÚBLICA (futuro).
 *
 * Hoy esta ruta NO renderiza nada: solo decide a dónde mandar al usuario.
 *   · sin sesión            → /login
 *   · onboarding pendiente  → /onboarding
 *   · sesión completa       → /inicio
 *
 * Cuando exista la landing de captación, este archivo pasa a renderizarla y la
 * lógica de redirección se mueve al botón de "Ingresar" (o se conserva solo para
 * usuarios ya autenticados). `proxy.ts` deja "/" pública precisamente para eso.
 */
export default async function Page() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login?error=perfil-no-encontrado");
  }

  redirect(profile.onboarding_completed ? "/inicio" : "/onboarding");
}
