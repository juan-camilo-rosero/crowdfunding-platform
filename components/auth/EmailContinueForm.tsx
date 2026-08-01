"use client";

import { useState } from "react";
import { MailIcon } from "lucide-react";
import { es } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** How long the mock pending state lasts, in ms. */
const MOCK_REQUEST_MS = 1600;

/**
 * Email step of the login screen.
 *
 * MOCK (design phase): submitting does NOT authenticate anything yet. It only
 * exercises the pending state so the interaction can be reviewed — the button
 * turns semi-transparent, swaps its label for a progress message and blocks
 * further clicks (that behaviour lives in <Button loading />). Replace the
 * timeout with the real magic-link / OTP call when that flow is built.
 */
export function EmailContinueForm() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    window.setTimeout(() => setIsSubmitting(false), MOCK_REQUEST_MS);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        type="email"
        name="email"
        inputSize="xl"
        icon={<MailIcon />}
        autoComplete="email"
        aria-label={es.login.emailLabel}
        placeholder={es.login.emailPlaceholder}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        disabled={isSubmitting}
      />

      <Button
        type="submit"
        variant="brand"
        size="xl"
        fullWidth
        loading={isSubmitting}
        loadingText={es.login.continuing}
      >
        {es.login.continue}
      </Button>
    </form>
  );
}
