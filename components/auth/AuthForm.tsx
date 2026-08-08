"use client";

import { useState } from "react";
import Link from "next/link";
import { MailIcon } from "lucide-react";
import { es } from "@/i18n";
import { LOGIN_ROUTE, SIGNUP_ROUTE } from "@/lib/auth/routes";
import { cn } from "@/lib/utils";
import {
  emailSchema,
  validateCredentials,
  type AuthMode,
  type CredentialErrors,
} from "@/lib/auth/credentials-schema";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Separator } from "@/components/ui/separator";
import { FormField } from "@/components/auth/FormField";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { signInWithPassword, signUpWithPassword } from "@/app/(auth)/actions";

export type AuthFormProps = { mode: AuthMode };

/**
 * Email/password form, shared by "iniciar sesión" and "crear cuenta".
 *
 * ONE component for both: the two screens differ in their copy, in which action
 * they call and in where the footer link goes — everything else, from the
 * fields to the Google button to the loading behaviour, is identical. Two
 * near-copies would have drifted the moment one of them changed.
 *
 * Sign-up asks in two steps — address first, then password — while sign-in
 * shows both at once. Someone creating an account is deciding whether to start;
 * one field is a smaller ask than two. Someone signing in already has both in
 * mind, and splitting it would just be an extra click.
 *
 * The second step REPLACES the first rather than growing below it. A field
 * appearing under the one you just filled reads as the interface sprouting
 * parts; swapping the address for a settled summary of it, with the password in
 * its place, reads as moving forward. The summary carries its own way back, so
 * a typo in the address is never a dead end.
 *
 * Validation runs on blur and on submit, never while typing: flagging an email
 * as invalid at the second character is noise. The same schema runs again in
 * the Server Action, which is the one that decides.
 */
export function AuthForm({ mode }: AuthFormProps) {
  const copy = mode === "signup" ? es.auth.signup : es.auth.login;

  // Sign-up starts on the address; sign-in never leaves the full form.
  const [step, setStep] = useState<"email" | "password">(
    mode === "signup" ? "email" : "password"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<CredentialErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const askingForPassword = step === "password";

  /** Validates ONE field and updates only its message. */
  function validateField(field: keyof CredentialErrors) {
    // On the first step only the address exists, so the full schema would flag
    // a password nobody has been asked for yet.
    if (!askingForPassword) {
      const result = emailSchema.safeParse(email);
      setErrors({ email: result.success ? undefined : result.error.issues[0]?.message });
      return;
    }

    const result = validateCredentials(mode, { email, password });
    setErrors((previous) => ({
      ...previous,
      [field]: result.success ? undefined : result.errors[field],
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    // First step: check the address and reveal the password field.
    if (!askingForPassword) {
      const emailResult = emailSchema.safeParse(email);
      if (!emailResult.success) {
        setErrors({ email: emailResult.error.issues[0]?.message });
        return;
      }
      setErrors({});
      setServerError(null);
      setStep("password");
      return;
    }

    const parsed = validateCredentials(mode, { email, password });
    if (!parsed.success) {
      setErrors(parsed.errors);
      return;
    }

    setErrors({});
    setServerError(null);
    setIsSubmitting(true);

    const action = mode === "signup" ? signUpWithPassword : signInWithPassword;
    const result = await action({ email, password });

    // On success the action redirects and this never runs.
    setIsSubmitting(false);
    setServerError(result.error);
  }

  return (
    <>
      <form onSubmit={handleSubmit} noValidate className="mt-6 flex flex-col gap-4">
        {serverError ? (
          <p
            role="alert"
            className="rounded-lg bg-destructive/10 px-4 py-3 text-center text-sm text-destructive"
          >
            {serverError}
          </p>
        ) : null}

        {/* Step two swaps the field for a summary of what it captured. */}
        {mode === "signup" && askingForPassword ? (
          <div className="flex items-center justify-between gap-3 rounded-[5px] border border-input px-4 py-2.5">
            <span className="flex min-w-0 items-center gap-2 text-sm">
              <MailIcon
                className="size-4 shrink-0 text-ink-500"
                aria-hidden="true"
              />
              <span className="min-w-0 truncate text-ink-700">{email}</span>
            </span>
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setErrors({});
                setServerError(null);
              }}
              disabled={isSubmitting}
              className="shrink-0 cursor-pointer text-sm font-medium text-ink-900 underline underline-offset-4 disabled:pointer-events-none disabled:opacity-50"
            >
              {es.auth.changeEmail}
            </button>
          </div>
        ) : (
          <FormField
            label={es.login.emailLabel}
            htmlFor="email"
            error={errors.email}
          >
            <Input
              id="email"
              name="email"
              type="email"
              inputSize="xl"
              icon={<MailIcon />}
              autoComplete="email"
              placeholder={es.login.emailPlaceholder}
              value={email}
              disabled={isSubmitting}
              aria-invalid={!!errors.email || undefined}
              onChange={(event) => setEmail(event.target.value)}
              onBlur={() => validateField("email")}
            />
          </FormField>
        )}

        {askingForPassword ? (
        <FormField
          label={es.auth.passwordLabel}
          htmlFor="password"
          error={errors.password}
        >
          <PasswordInput
            id="password"
            name="password"
            // Tells a password manager whether to offer a saved password or to
            // suggest a new one.
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            placeholder={es.auth.passwordPlaceholder}
            value={password}
            disabled={isSubmitting}
            aria-invalid={!!errors.password || undefined}
            onChange={(event) => setPassword(event.target.value)}
            onBlur={() => validateField("password")}
            // Focused on arrival: the step exists to ask for this.
            autoFocus
          />
        </FormField>
        ) : null}

        <Button
          type="submit"
          variant="brand"
          size="xl"
          fullWidth
          loading={isSubmitting}
          loadingText={askingForPassword ? copy.submitting : es.login.continuing}
        >
          {askingForPassword ? copy.submit : es.login.continue}
        </Button>
      </form>

      <div className="my-5 flex items-center gap-4">
        <Separator className="flex-1" />
        <span className="text-sm text-ink-500">{es.login.dividerOr}</span>
        <Separator className="flex-1" />
      </div>

      {/* The OAuth flow already in place; not rebuilt for this screen. */}
      <GoogleSignInButton />

      <p className="mt-5 text-center text-sm text-ink-500">
        {copy.switchPrompt}{" "}
        {/* A real <a>, styled with the design system's link variant rather
            than wrapped in <Button>: this navigates, so it must keep the link
            role. Base UI's Button stamps role="button" on whatever it renders,
            which would have misreported it to assistive tech. */}
        <Link
          href={mode === "signup" ? LOGIN_ROUTE : SIGNUP_ROUTE}
          className={cn(
            buttonVariants({ variant: "link", size: "sm" }),
            "h-auto p-0 align-baseline text-sm"
          )}
        >
          {copy.switchAction}
        </Link>
      </p>
    </>
  );
}
