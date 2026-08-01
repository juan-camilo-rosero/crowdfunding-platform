import { es } from "@/i18n";
import { isAuthErrorCode } from "@/lib/auth/auth-errors";
import { GoogleSignInButton } from "./GoogleSignInButton";

/**
 * Minimal, functional Sprint 1 screen: Google sign-in only. The visual design
 * (4-slide side carousel, see views.md) lands in the design phase; no markup
 * effort is spent here yet.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const errorMessage =
    error && isAuthErrorCode(error) ? es.login.errors[error] : null;

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">{es.login.title}</h1>
          <p className="text-sm text-black/60 dark:text-white/60">
            {es.login.subtitle}
          </p>
        </div>

        {errorMessage ? (
          <p role="alert" className="text-sm text-red-600">
            {errorMessage}
          </p>
        ) : null}

        <GoogleSignInButton />
      </div>
    </main>
  );
}
