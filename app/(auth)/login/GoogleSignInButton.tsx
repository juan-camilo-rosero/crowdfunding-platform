"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { es } from "@/i18n";

/**
 * Única parte cliente del login: necesita onClick para disparar el OAuth.
 * signInWithOAuth redirige el navegador a Google; si falla antes de redirigir,
 * el error se muestra aquí mismo.
 */
export function GoogleSignInButton() {
  const [conectando, setConectando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function iniciarSesionConGoogle() {
    setConectando(true);
    setError(null);

    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/callback`,
      },
    });

    // Si no hubo error el navegador ya se está yendo a Google: no se resetea el
    // estado para que el botón siga deshabilitado durante la redirección.
    if (oauthError) {
      setError(es.login.errores["intercambio-fallido"]);
      setConectando(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={iniciarSesionConGoogle}
        disabled={conectando}
        className="rounded border border-black/15 px-4 py-2 text-sm font-medium disabled:opacity-60 dark:border-white/20"
      >
        {conectando ? es.login.conectando : es.login.continuarConGoogle}
      </button>

      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
