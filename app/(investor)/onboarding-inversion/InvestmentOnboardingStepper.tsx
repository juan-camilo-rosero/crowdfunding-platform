"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CheckIcon, FileTextIcon, ShieldCheckIcon } from "lucide-react";
import { es } from "@/i18n";
import { DOCUMENTS_ROUTE, INVESTOR_HOME_ROUTE } from "@/lib/auth/routes";
import type { InvestmentOnboardingState, StepState } from "@/lib/onboarding/investment";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { signContract, verifyIdentity } from "./actions";

export type InvestmentOnboardingStepperProps = {
  /** Derived on the server from auth.uid(). The client never computes it. */
  state: InvestmentOnboardingState;
};

type StepKey = "identity" | "contract";

const STATUS_VARIANT: Record<StepState, "success" | "warning" | "neutral"> = {
  hecho: "success",
  pendiente: "warning",
  omitido: "neutral",
};

/**
 * The two-step activation.
 *
 * RESUMABLE BY CONSTRUCTION: there is no "current step" in this component's
 * state. Each step renders from the server-derived state, so leaving and coming
 * back lands exactly where the facts say — which is also why a refresh, a
 * second tab or a webhook arriving in the background can never desynchronise it.
 *
 * The client sends no result: `verifyIdentity` and `signContract` take no
 * arguments at all. What comes back is a report of what the server decided.
 */
export function InvestmentOnboardingStepper({
  state,
}: InvestmentOnboardingStepperProps) {
  const [pending, startTransition] = useTransition();
  const [running, setRunning] = useState<StepKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const run = (step: StepKey) => {
    setError(null);
    setNotice(null);
    setRunning(step);

    startTransition(async () => {
      const action = step === "identity" ? verifyIdentity : signContract;
      const result = await action();
      setRunning(null);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      if (result.status === "pendiente") {
        // A real provider hosts the flow; the answer returns by webhook.
        window.location.href = result.redirectUrl;
        return;
      }

      if (result.status === "hecho") {
        setNotice(
          step === "identity"
            ? es.investmentOnboarding.identity.approved
            : es.investmentOnboarding.contract.signed
        );
        return;
      }

      // Rejected or expired: the step stays pending and can be retried.
      setError(result.message);
    });
  };

  const isBusy = (step: StepKey) => pending && running === step;

  // Order matters legally, and the server enforces it too.
  const contractBlocked =
    state.config.identityStepEnabled && state.identity !== "hecho";

  return (
    <div className="flex flex-col gap-6">
      {state.isComplete ? (
        <div className="flex flex-col items-start gap-3 rounded-[10px] border border-line bg-elevated px-5 py-4">
          <p className="text-base font-medium text-ink-900">
            {es.investmentOnboarding.completeTitle}
          </p>
          <p className="text-sm text-ink-700">
            {es.investmentOnboarding.completeDescription}
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href={DOCUMENTS_ROUTE}
              className={buttonVariants({ variant: "brand", size: "lg" })}
            >
              {es.investmentOnboarding.goToDocuments}
            </Link>
            <Link
              href={INVESTOR_HOME_ROUTE}
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              {es.investmentOnboarding.goHome}
            </Link>
          </div>
        </div>
      ) : null}

      {notice ? (
        <p
          role="status"
          className="rounded-[10px] border border-line bg-elevated px-4 py-3 text-sm text-ink-700"
        >
          {notice}
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded-[10px] border border-line bg-elevated px-4 py-3 text-sm text-ink-900"
        >
          {error}
        </p>
      ) : null}

      <ol className="flex flex-col gap-4">
        <StepCard
          index={1}
          icon={<ShieldCheckIcon aria-hidden="true" />}
          title={es.investmentOnboarding.identity.title}
          description={
            state.identity === "omitido"
              ? es.investmentOnboarding.identity.skipped
              : es.investmentOnboarding.identity.description
          }
          status={state.identity}
        >
          {state.identity === "pendiente" ? (
            <Button
              type="button"
              variant="brand"
              size="lg"
              loading={isBusy("identity")}
              loadingText={es.investmentOnboarding.identity.working}
              disabled={pending}
              onClick={() => run("identity")}
            >
              {es.investmentOnboarding.identity.action}
            </Button>
          ) : null}
        </StepCard>

        <StepCard
          index={2}
          icon={<FileTextIcon aria-hidden="true" />}
          title={es.investmentOnboarding.contract.title}
          description={
            state.contract === "omitido"
              ? es.investmentOnboarding.contract.skipped
              : es.investmentOnboarding.contract.description
          }
          status={state.contract}
        >
          {state.contract === "pendiente" ? (
            <div className="flex flex-col gap-3">
              {/* Placeholder preview until a signing provider is connected. */}
              <div className="rounded-[10px] border border-line bg-surface px-4 py-3">
                <p className="text-sm font-medium text-ink-900">
                  {es.investmentOnboarding.contract.previewTitle}
                </p>
                <p className="mt-1 text-sm text-ink-500">
                  {es.investmentOnboarding.contract.previewHint}
                </p>
              </div>

              {contractBlocked ? (
                <p className="text-sm text-ink-500">
                  {es.investmentOnboarding.contract.blocked}
                </p>
              ) : (
                <Button
                  type="button"
                  variant="brand"
                  size="lg"
                  className="self-start"
                  loading={isBusy("contract")}
                  loadingText={es.investmentOnboarding.contract.working}
                  disabled={pending}
                  onClick={() => run("contract")}
                >
                  {es.investmentOnboarding.contract.action}
                </Button>
              )}
            </div>
          ) : null}
        </StepCard>
      </ol>
    </div>
  );
}

function StepCard({
  index,
  icon,
  title,
  description,
  status,
  children,
}: {
  index: number;
  icon: React.ReactNode;
  title: string;
  description: string;
  status: StepState;
  children?: React.ReactNode;
}) {
  return (
    <li className="flex flex-col gap-3 rounded-[10px] border border-line bg-elevated px-5 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface text-ink-700 [&>svg]:size-4"
        >
          {status === "hecho" ? <CheckIcon /> : icon}
        </span>

        <div className="flex flex-1 flex-col">
          <span className="text-xs text-ink-500">
            {es.investmentOnboarding.stepLabel.replace("{n}", String(index))}
          </span>
          <h2 className="text-base font-medium text-ink-900">{title}</h2>
        </div>

        <Badge variant={STATUS_VARIANT[status]}>
          {es.investmentOnboarding.status[status]}
        </Badge>
      </div>

      <p className="text-sm text-ink-700">{description}</p>

      {children}
    </li>
  );
}
