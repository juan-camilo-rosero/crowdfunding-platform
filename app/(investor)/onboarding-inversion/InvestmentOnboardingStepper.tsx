"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckIcon, FileTextIcon, RefreshCwIcon, ShieldCheckIcon } from "lucide-react";
import { es } from "@/i18n";
import { DOCUMENTS_ROUTE, INVESTOR_HOME_ROUTE } from "@/lib/auth/routes";
import type {
  ContractStage,
  InvestmentOnboardingState,
  StepState,
} from "@/lib/onboarding/investment";
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
  const router = useRouter();
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
            contractBlocked ? (
              <p className="text-sm text-ink-500">
                {es.investmentOnboarding.contract.blocked}
              </p>
            ) : (
              <ContractStep
                stage={state.contractStage}
                signingUrl={state.signing?.signingUrl ?? null}
                isBusy={isBusy("contract")}
                disabled={pending}
                onSign={() => run("contract")}
                onRefresh={() => router.refresh()}
              />
            )
          ) : null}
        </StepCard>
      </ol>
    </div>
  );
}

/**
 * The contract step, in whichever stage it is.
 *
 * With a real provider the honest answer is rarely "pending" or "done": the
 * envelope may not have been sent, may be waiting for the signer, or may have
 * been signed seconds ago with our webhook still in flight. Each of those gets
 * its own copy rather than being flattened into one.
 */
function ContractStep({
  stage,
  signingUrl,
  isBusy,
  disabled,
  onSign,
  onRefresh,
}: {
  stage: ContractStage;
  signingUrl: string | null;
  isBusy: boolean;
  disabled: boolean;
  onSign: () => void;
  onRefresh: () => void;
}) {
  // Waiting on the team. Nothing for the investor to do, and saying so beats a
  // button that would fail.
  if (stage === "sin-enviar") {
    return (
      <p className="text-sm text-ink-500">
        {es.investmentOnboarding.contract.awaitingSend}
      </p>
    );
  }

  if (stage === "procesando") {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-ink-700">
          {es.investmentOnboarding.contract.processing}
        </p>
        {/* The webhook is authoritative and may land a moment later; this only
            re-reads the server, it never asserts a state. */}
        <Button type="button" variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCwIcon data-icon="inline-start" aria-hidden="true" />
          {es.investmentOnboarding.contract.refresh}
        </Button>
      </div>
    );
  }

  if (stage === "rechazado" || stage === "anulado" || stage === "expirado") {
    const message =
      stage === "rechazado"
        ? es.investmentOnboarding.contract.declined
        : stage === "anulado"
          ? es.investmentOnboarding.contract.cancelled
          : es.investmentOnboarding.contract.expired;

    // Resending is the admin's act, so there is no retry button here.
    return <p className="text-sm text-ink-700">{message}</p>;
  }

  // "en-firma": the envelope is out. With a signing URL the investor goes to
  // the provider; without one (mock mode) the inline action still works.
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-[10px] border border-line bg-surface px-4 py-3">
        <p className="text-sm font-medium text-ink-900">
          {es.investmentOnboarding.contract.previewTitle}
        </p>
        <p className="mt-1 text-sm text-ink-500">
          {signingUrl
            ? es.investmentOnboarding.contract.readyToSign
            : es.investmentOnboarding.contract.previewHint}
        </p>
      </div>

      {signingUrl ? (
        <a
          href={signingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "brand", size: "lg", className: "self-start" })}
        >
          {es.investmentOnboarding.contract.openSigning}
        </a>
      ) : (
        <Button
          type="button"
          variant="brand"
          size="lg"
          className="self-start"
          loading={isBusy}
          loadingText={es.investmentOnboarding.contract.working}
          disabled={disabled}
          onClick={onSign}
        >
          {es.investmentOnboarding.contract.action}
        </Button>
      )}
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
