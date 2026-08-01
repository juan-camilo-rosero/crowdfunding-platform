import { es } from "@/i18n";
import { isAuthErrorCode } from "@/lib/auth/auth-errors";
import { GoogleSignInButton } from "./GoogleSignInButton";

/**
 * Pantalla mínima y funcional del Sprint 1: solo el acceso con Google.
 * El diseño (carrusel lateral de 4 slides, etc., ver views.md) llega en la fase
 * de diseño; aquí no se invierte en maquetación todavía.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const mensajeError =
    error && isAuthErrorCode(error) ? es.login.errores[error] : null;

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">{es.login.titulo}</h1>
          <p className="text-sm text-black/60 dark:text-white/60">
            {es.login.subtitulo}
          </p>
        </div>

        {mensajeError ? (
          <p role="alert" className="text-sm text-red-600">
            {mensajeError}
          </p>
        ) : null}

        <GoogleSignInButton />
      </div>
    </main>
  );
}
