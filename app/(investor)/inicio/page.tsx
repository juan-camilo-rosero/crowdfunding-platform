import { redirect } from "next/navigation";
import { es } from "@/i18n";
import { getCurrentUser, getCurrentUserProfile } from "@/lib/auth/session";

/**
 * PLACEHOLDER temporal del Sprint 1: solo confirma que la sesión funciona.
 * La Home real (KPIs, dona, feed de actividad — ver views.md) se construye después.
 */
export default async function InicioPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?error=sesion-requerida");
  }

  const profile = await getCurrentUserProfile();
  if (!profile) {
    redirect("/login?error=perfil-no-encontrado");
  }

  return (
    <main className="flex flex-1 flex-col gap-3 p-8">
      <h1 className="text-xl font-semibold">{es.inicio.titulo}</h1>
      <dl className="flex flex-col gap-1 text-sm">
        <div className="flex gap-2">
          <dt className="text-black/60 dark:text-white/60">
            {es.inicio.sesionIniciadaComo}:
          </dt>
          <dd>{profile.email}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-black/60 dark:text-white/60">{es.inicio.rol}:</dt>
          <dd>{profile.role}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-black/60 dark:text-white/60">{es.inicio.estado}:</dt>
          <dd>{profile.status}</dd>
        </div>
      </dl>
    </main>
  );
}
