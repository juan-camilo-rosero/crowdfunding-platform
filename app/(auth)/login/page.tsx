import { es } from "@/i18n";
import { isAuthErrorCode } from "@/lib/auth/auth-errors";
import { AuthSplitLayout } from "@/components/auth/AuthSplitLayout";
import { EmailContinueForm } from "@/components/auth/EmailContinueForm";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { Separator } from "@/components/ui/separator";

/**
 * Sign in / sign up. The split layout (form left, carousel right) is shared
 * with the onboarding screen through AuthSplitLayout.
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
    <AuthSplitLayout title={es.login.title} subtitle={es.login.subtitle}>
      {errorMessage ? (
        <p
          role="alert"
          className="mt-6 rounded-lg bg-destructive/10 px-4 py-3 text-center text-sm text-destructive"
        >
          {errorMessage}
        </p>
      ) : null}

      <div className="mt-8">
        <EmailContinueForm />
      </div>

      <div className="my-7 flex items-center gap-4">
        <Separator className="flex-1" />
        <span className="text-sm text-ink-500">{es.login.dividerOr}</span>
        <Separator className="flex-1" />
      </div>

      <GoogleSignInButton />
    </AuthSplitLayout>
  );
}
