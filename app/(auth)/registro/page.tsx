import { es } from "@/i18n";
import { isAuthErrorCode } from "@/lib/auth/auth-errors";
import { AuthForm } from "@/components/auth/AuthForm";
import { AuthSplitLayout } from "@/components/auth/AuthSplitLayout";

/**
 * Create an account. Same shell, same carousel and the same form as /login —
 * only the mode differs, which is what decides the copy, the action it calls
 * and where the footer link points.
 */
export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const errorMessage =
    error && isAuthErrorCode(error) ? es.login.errors[error] : null;

  return (
    <AuthSplitLayout
      title={es.auth.signup.title}
      subtitle={es.auth.signup.subtitle}
      contentClassName="max-w-[380px]"
    >
      {errorMessage ? (
        <p
          role="alert"
          className="mt-6 rounded-lg bg-destructive/10 px-4 py-3 text-center text-sm text-destructive"
        >
          {errorMessage}
        </p>
      ) : null}

      <AuthForm mode="signup" />
    </AuthSplitLayout>
  );
}
