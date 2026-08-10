import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEsignProvider } from "./provider";
import type { SigningSubject } from "./types";

/**
 * THE ONLY PLACE A SIGNED CONTRACT IS CREATED.
 *
 * Same reasoning as lib/identity/verification.ts: `documents` has a select
 * policy and an ADMIN-ONLY write policy, so an investor cannot insert a
 * document — let alone one claiming to be their signed contract. No policy was
 * added or relaxed; the write goes through the trusted server path that
 * lib/supabase/admin.ts exists for, which is also where the future
 * /api/esign/webhook will write.
 *
 * `investorId` MUST come from the session's investor link. It is a parameter so
 * this module never guesses at identity, and the one caller derives it from
 * getVerifiedUser() plus the investors row.
 */

/** documents.doc_type for the investment contract (CHECK-constrained value). */
export const CONTRACT_DOC_TYPE = "contrato";
/** Only the investor it belongs to may read it. */
const CONTRACT_VISIBILITY = "privado";
/** Signed and on file. */
const CONTRACT_STATUS = "aprobado";

export type ContractResult =
  | { ok: true; kind: "signed"; documentId: string }
  /** Already on file — signing twice is a no-op, not an error. */
  | { ok: true; kind: "already-signed"; documentId: string }
  /** A real provider took over; the answer arrives by webhook. */
  | { ok: true; kind: "pending"; signingUrl: string }
  | { ok: false; reason: string };

/** The investor's contract, if they already have one. */
export async function findSignedContract(
  investorId: string
): Promise<{ id: string } | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("documents")
      .select("id")
      .eq("investor_id", investorId)
      .eq("doc_type", CONTRACT_DOC_TYPE)
      .limit(1)
      .maybeSingle();

    return data ?? null;
  } catch {
    return null;
  }
}

/**
 * Files the signed contract as a document.
 *
 * Shared by the mock and by the future e-sign webhook. Idempotent on purpose: a
 * double-click, a retry or a webhook delivered twice must not leave an investor
 * with two contracts.
 */
export async function recordSignedContract(input: {
  subject: SigningSubject;
  fileUrl: string;
  signedAt: string;
}): Promise<ContractResult> {
  const { subject, fileUrl, signedAt } = input;

  try {
    const existing = await findSignedContract(subject.investorId);
    if (existing) {
      return { ok: true, kind: "already-signed", documentId: existing.id };
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("documents")
      .insert({
        investor_id: subject.investorId,
        name: subject.documentName,
        doc_type: CONTRACT_DOC_TYPE,
        // Date only: documents.date is a `date` column.
        date: signedAt.slice(0, 10),
        file_url: fileUrl,
        status: CONTRACT_STATUS,
        visibility: CONTRACT_VISIBILITY,
      })
      .select("id")
      .single();

    if (error || !data) {
      return { ok: false, reason: error?.message ?? "insert returned no row" };
    }

    return { ok: true, kind: "signed", documentId: data.id };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "unknown error",
    };
  }
}

/**
 * Runs one signing attempt for the given investor.
 *
 * The provider decides; this only persists what it decided. With the mock that
 * is immediate; with Documenso it will be a redirect and a later webhook — and
 * the webhook lands on `recordSignedContract` above, the same function.
 */
export async function requestContractSignature(
  subject: SigningSubject
): Promise<ContractResult> {
  const existing = await findSignedContract(subject.investorId);
  if (existing) {
    return { ok: true, kind: "already-signed", documentId: existing.id };
  }

  const provider = getEsignProvider();
  const request = await provider.createSigningRequest(subject);

  if (request.status === "failed") {
    console.error(`[esign:${provider.name}] failed — ${request.reason}`);
    return { ok: false, reason: request.reason };
  }

  if (request.status === "pending") {
    return { ok: true, kind: "pending", signingUrl: request.signingUrl };
  }

  return recordSignedContract({
    subject,
    fileUrl: request.fileUrl,
    signedAt: request.signedAt,
  });
}
