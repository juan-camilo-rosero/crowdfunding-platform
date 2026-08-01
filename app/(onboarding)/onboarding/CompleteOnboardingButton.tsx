"use client";

import { useActionState } from "react";
import { es } from "@/i18n";
import {
  completeBasicOnboarding,
  type CompleteOnboardingState,
} from "./actions";

const INITIAL_STATE: CompleteOnboardingState = { error: null };

/** TEMPORARY (Sprint 1): see the note in actions.ts. */
export function CompleteOnboardingButton() {
  const [state, formAction, pending] = useActionState(
    completeBasicOnboarding,
    INITIAL_STATE
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded border border-black/15 px-4 py-2 text-sm font-medium disabled:opacity-60 dark:border-white/20"
      >
        {pending ? es.onboarding.saving : es.onboarding.completeData}
      </button>

      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
