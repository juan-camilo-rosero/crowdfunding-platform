"use server";

import { revalidatePath } from "next/cache";
import { es } from "@/i18n";
import { isAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getEsignProvider } from "@/lib/esign/provider";
import { createSigningRequestRecord } from "@/lib/esign/signing-requests";

/**
 * "Send the contract for signature", from the admin's user directory.
 *
 * NOT SELF-SERVICE, by the same rule as linking an investor: the contract is
 * prepared by the team for a specific investment, so the team is who sends it.
 * An investor cannot reach this action, and the check is on the server.
 *
 * The uploaded PDF never touches storage. It goes straight from the request to
 * Documenso, so there is no window in which a prepared contract sits in a
 * bucket waiting for someone to get its ACL wrong.
 */

export type SendContractResult =
  | { ok: true; signingUrl: string }
  | { ok: false; error: string };

/** 10 MB. A contract is a few pages; anything larger is a mistake. */
const MAX_PDF_BYTES = 10 * 1024 * 1024;

export async function sendContractForSignature(
  formData: FormData
): Promise<SendContractResult> {
  // Barrier one: only an admin, decided on the server.
  if (!(await isAdmin())) {
    return { ok: false, error: es.adminUsers.errors.notAdmin };
  }

  const userId = String(formData.get("userId") ?? "").trim();
  const file = formData.get("contract");

  if (!userId || !(file instanceof File) || file.size === 0) {
    return { ok: false, error: es.adminContract.errors.missingFile };
  }
  if (file.type !== "application/pdf") {
    return { ok: false, error: es.adminContract.errors.notPdf };
  }
  if (file.size > MAX_PDF_BYTES) {
    return { ok: false, error: es.adminContract.errors.tooLarge };
  }

  const supabase = await createClient();

  // The investor row is resolved from the user id HERE, so the caller cannot
  // name an investor directly and post a contract into somebody else's file.
  const { data: investor } = await supabase
    .from("investors")
    .select("id, email, full_name")
    .eq("user_id", userId)
    .maybeSingle();

  if (!investor) {
    return { ok: false, error: es.adminContract.errors.notInvestor };
  }

  const { data: profile } = await supabase
    .from("users")
    .select("email, full_name")
    .eq("id", userId)
    .maybeSingle();

  const signerEmail = profile?.email ?? investor.email;
  if (!signerEmail) {
    return { ok: false, error: es.adminContract.errors.noEmail };
  }

  const provider = getEsignProvider();
  const request = await provider.createSigningRequest({
    userId,
    investorId: investor.id,
    projectId: null,
    capitalContributionId: null,
    documentName: es.investmentOnboarding.contract.previewTitle,
    signerEmail,
    signerName: profile?.full_name ?? investor.full_name ?? null,
    contractPdf: {
      fileName: file.name,
      bytes: new Uint8Array(await file.arrayBuffer()),
    },
  });

  if (request.status === "failed") {
    console.error(`[esign:${provider.name}] send failed — ${request.reason}`);
    return { ok: false, error: es.adminContract.errors.sendFailed };
  }

  // The mock resolves inline; the real provider returns a pending envelope.
  const envelopeId = request.envelopeId;
  const signingUrl =
    request.status === "pending" ? request.signingUrl : request.fileUrl;

  // Recorded so the webhook can recognise this envelope as ours. Without the
  // row, an event for it would be ignored — which is the intended failure mode.
  const record = await createSigningRequestRecord({
    investorId: investor.id,
    projectId: null,
    capitalContributionId: null,
    externalDocumentId: envelopeId,
  });

  if (!record.ok) {
    console.error(`[esign] could not record the signing request — ${record.reason}`);
    return { ok: false, error: es.adminContract.errors.sendFailed };
  }

  revalidatePath("/admin/usuarios");

  return { ok: true, signingUrl };
}
