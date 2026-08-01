"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { es } from "@/i18n";

/**
 * The only client-side part of the login screen: it needs onClick to start the
 * OAuth flow. signInWithOAuth redirects the browser to Google; if it fails
 * before redirecting, the error is shown here.
 */
export function GoogleSignInButton() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function signInWithGoogle() {
    setIsConnecting(true);
    setErrorMessage(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/callback`,
      },
    });

    // On success the browser is already navigating to Google, so the state is
    // left as-is to keep the button disabled during the redirect.
    if (error) {
      setErrorMessage(es.login.errors["exchange-failed"]);
      setIsConnecting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={signInWithGoogle}
        disabled={isConnecting}
        className="rounded border border-black/15 px-4 py-2 text-sm font-medium disabled:opacity-60 dark:border-white/20"
      >
        {isConnecting ? es.login.connecting : es.login.signInWithGoogle}
      </button>

      {errorMessage ? (
        <p role="alert" className="text-sm text-red-600">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
