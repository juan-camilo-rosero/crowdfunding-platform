import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { DOCUMENTS_BUCKET } from "@/lib/documents/download";
import { CONTRACT_DOC_TYPE } from "./contract";
import { advances, type SigningStatus, type WebhookEvent } from "./webhook-events";
import type { SignedArtifacts } from "./types";

/**
 * The signing_requests tracking table, and what a verified webhook does to it.
 *
 * WHY THE ADMIN CLIENT: a webhook arrives with no user session — there is
 * nobody to run it as. `signing_requests` grants `authenticated` read-only
 * access to their own rows and NO write policy at all, and `documents` is
 * admin-write only, so the privileged path is the only one available. That is
 * the design, not a workaround: an investor able to write these rows could
 * declare their own contract signed.
 *
 * What keeps the privilege safe is the MAPPING. Every write is addressed by
 * `external_document_id`, a value we stored when WE created the envelope. An
 * event whose id matches no row is ignored, so a forged payload cannot attach a
 * signature to an investor who never started one.
 */

export type SigningRequestRow = {
  id: string;
  investorId: string;
  projectId: string | null;
  externalDocumentId: string;
  status: SigningStatus;
  signedDocumentId: string | null;
  declinedReason: string | null;
};

type RawRow = {
  id: string;
  investor_id: string;
  project_id: string | null;
  external_document_id: string;
  status: string;
  signed_document_id: string | null;
  declined_reason: string | null;
};

const toRow = (raw: RawRow): SigningRequestRow => ({
  id: raw.id,
  investorId: raw.investor_id,
  projectId: raw.project_id,
  externalDocumentId: raw.external_document_id,
  status: raw.status as SigningStatus,
  signedDocumentId: raw.signed_document_id,
  declinedReason: raw.declined_reason,
});

const SELECT =
  "id, investor_id, project_id, external_document_id, status, signed_document_id, declined_reason";

/** Records the envelope we just created, so its webhooks can be recognised. */
export async function createSigningRequestRecord(input: {
  investorId: string;
  projectId: string | null;
  capitalContributionId: string | null;
  externalDocumentId: string;
}): Promise<{ ok: true; row: SigningRequestRow } | { ok: false; reason: string }> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("signing_requests")
      .insert({
        investor_id: input.investorId,
        project_id: input.projectId,
        capital_contribution_id: input.capitalContributionId,
        external_document_id: input.externalDocumentId,
        status: "enviado",
      })
      .select(SELECT)
      .single();

    if (error || !data) {
      return { ok: false, reason: error?.message ?? "insert returned no row" };
    }
    return { ok: true, row: toRow(data as RawRow) };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "unknown error",
    };
  }
}

/** The tracking row for an envelope id, or null when we did not create it. */
export async function findByExternalId(
  externalDocumentId: string
): Promise<SigningRequestRow | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("signing_requests")
      .select(SELECT)
      .eq("external_document_id", externalDocumentId)
      .maybeSingle();

    return data ? toRow(data as RawRow) : null;
  } catch {
    return null;
  }
}

/** The investor's most recent request, for the stepper. */
export async function findLatestForInvestor(
  investorIds: string[]
): Promise<SigningRequestRow | null> {
  if (investorIds.length === 0) return null;

  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("signing_requests")
      .select(SELECT)
      .in("investor_id", investorIds)
      .order("sent_at", { ascending: false })
      .limit(1);

    const rows = (data ?? []) as RawRow[];
    return rows[0] ? toRow(rows[0]) : null;
  } catch {
    return null;
  }
}

export type ApplyResult =
  | { outcome: "ignored"; reason: "unknown-document" | "not-newer" }
  | { outcome: "applied"; row: SigningRequestRow; status: SigningStatus };

/**
 * Applies a verified event to its tracking row.
 *
 * Returns "ignored" for the two cases that must never write: an envelope we did
 * not create, and an event that does not advance the row (a retry, or a late
 * delivery). Both are normal, so neither is an error.
 */
export async function applySigningEvent(
  event: WebhookEvent
): Promise<ApplyResult> {
  const row = await findByExternalId(event.externalDocumentId);

  // The mapping check: no row, no write. This is what stops a forged payload
  // from attaching a signature to an arbitrary investor.
  if (!row) return { outcome: "ignored", reason: "unknown-document" };

  if (!advances(row.status, event.status)) {
    return { outcome: "ignored", reason: "not-newer" };
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await admin
    .from("signing_requests")
    .update({
      status: event.status,
      declined_reason: event.declinedReason,
      completed_at: event.status === "completado" ? now : null,
      updated_at: now,
    })
    .eq("id", row.id)
    .select(SELECT)
    .single();

  if (error || !data) return { outcome: "ignored", reason: "unknown-document" };

  return {
    outcome: "applied",
    row: toRow(data as RawRow),
    status: event.status,
  };
}

/**
 * Stores the signed artefacts and files the contract as a document.
 *
 * The PDF goes to the PRIVATE `documents` bucket and the row is `privado`, so
 * only its own investor can read it — the same entitlement path the documents
 * screen already uses. Idempotent: a repeated completion does not file a second
 * contract.
 */
export async function attachSignedDocument(input: {
  row: SigningRequestRow;
  artifacts: SignedArtifacts;
  documentName: string;
}): Promise<{ ok: true; documentId: string } | { ok: false; reason: string }> {
  const { row, artifacts, documentName } = input;

  if (row.signedDocumentId) {
    return { ok: true, documentId: row.signedDocumentId };
  }

  try {
    const admin = createAdminClient();
    const folder = `contratos/${row.investorId}/${row.externalDocumentId}`;

    const upload = await admin.storage
      .from(DOCUMENTS_BUCKET)
      .upload(`${folder}/${artifacts.document.fileName}`, artifacts.document.bytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (upload.error) return { ok: false, reason: upload.error.message };

    // The audit certificate, when the plan exposes it. Stored beside the
    // contract but not filed as a separate document: it is evidence about the
    // contract, not a second paper the investor has to read.
    if (artifacts.certificate) {
      await admin.storage
        .from(DOCUMENTS_BUCKET)
        .upload(
          `${folder}/${artifacts.certificate.fileName}`,
          artifacts.certificate.bytes,
          { contentType: "application/pdf", upsert: true }
        );
    }

    const { data, error } = await admin
      .from("documents")
      .insert({
        investor_id: row.investorId,
        project_id: row.projectId,
        name: documentName,
        doc_type: CONTRACT_DOC_TYPE,
        date: new Date().toISOString().slice(0, 10),
        file_url: upload.data.path,
        status: "aprobado",
        visibility: "privado",
      })
      .select("id")
      .single();

    if (error || !data) {
      return { ok: false, reason: error?.message ?? "insert returned no row" };
    }

    await admin
      .from("signing_requests")
      .update({ signed_document_id: data.id, updated_at: new Date().toISOString() })
      .eq("id", row.id);

    return { ok: true, documentId: data.id };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "unknown error",
    };
  }
}
