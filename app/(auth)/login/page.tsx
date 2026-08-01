import { es } from "@/i18n";
import { isAuthErrorCode } from "@/lib/auth/auth-errors";
import { BrandLogo } from "@/components/auth/BrandLogo";
import { EmailContinueForm } from "@/components/auth/EmailContinueForm";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { LoginCarousel } from "@/components/auth/LoginCarousel";
import { Separator } from "@/components/ui/separator";

/**
 * Split layout: form on the left, image carousel on the right.
 * On mobile the carousel is dropped entirely and the form takes the full width,
 * which is the whole responsive difference.
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
    <div className="flex min-h-dvh flex-1">
      <section className="flex w-full flex-col justify-center px-6 py-12 lg:w-1/2 lg:px-16">
        <div className="mx-auto flex w-full max-w-[340px] flex-col">
          <BrandLogo className="mb-8" />

          {/* Design: 36px / weight 500 / #1E1E1E */}
          <h1 className="text-center text-4xl font-medium text-ink-900">
            {es.login.title}
          </h1>
          {/* Design: 16px / weight 400 / #848484 */}
          <p className="mt-4 text-center text-base leading-relaxed text-ink-500">
            {es.login.subtitle}
          </p>

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
        </div>
      </section>

      {/* Carousel is desktop-only by design. */}
      <aside className="hidden lg:block lg:w-1/2">
        <LoginCarousel />
      </aside>
    </div>
  );
}
