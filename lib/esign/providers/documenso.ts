import { es } from "@/i18n";
import type {
  EsignProvider,
  FetchSignedResult,
  SigningRequest,
  SigningSubject,
} from "../types";

/**
 * Documenso adapter. The ONLY file that knows this vendor exists.
 *
 * Verified against docs.documenso.com (August 2026):
 *
 *  - AUTH is `Authorization: <api-key>` — a bare token, WITHOUT the "Bearer"
 *    prefix. That is unusual enough to be worth stating: sending "Bearer …"
 *    here fails with 401.
 *  - The current API is **v2**, and new integrations are told to use the
 *    `/envelope/*` endpoints; `/documents/*` is deprecated.
 *  - `POST /envelope/create` is multipart/form-data: a JSON `payload` part with
 *    title, recipients and their fields, plus the PDF under `files`. It answers
 *    `{ id: "envelope_…" }`.
 *  - `POST /envelope/distribute` sends it, moving DRAFT → PENDING, and answers
 *    with the recipients including `signingUrl`.
 *
 * BASE URL comes from ESIGN_PROVIDER_URL, so Cloud and self-hosted are the same
 * code path — only the host differs.
 */

/** Documenso positions fields in percentages of the page. */
const SIGNATURE_FIELD = {
  identifier: 0,
  type: "SIGNATURE",
  page: 1,
  positionX: 10,
  positionY: 80,
  width: 30,
  height: 5,
} as const;

type CreateResponse = { id?: string; message?: string };
type DistributeResponse = {
  recipients?: { email?: string; signingUrl?: string }[];
  message?: string;
};
type EnvelopeResponse = {
  status?: string;
  recipients?: { email?: string; signingUrl?: string }[];
};

export function createDocumensoEsignProvider(
  baseUrl: string,
  apiKey: string
): EsignProvider {
  const root = baseUrl.replace(/\/+$/, "");

  /** Bare token, no "Bearer" — see the docblock. */
  const authHeaders = () => ({ Authorization: apiKey });

  async function call<T>(
    path: string,
    init: RequestInit
  ): Promise<{ ok: true; data: T } | { ok: false; reason: string }> {
    try {
      const response = await fetch(`${root}${path}`, {
        ...init,
        headers: { ...authHeaders(), ...(init.headers ?? {}) },
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        return {
          ok: false,
          reason: `HTTP ${response.status} on ${path}${body ? ` — ${body.slice(0, 200)}` : ""}`,
        };
      }

      return { ok: true, data: (await response.json()) as T };
    } catch (error) {
      return {
        ok: false,
        reason: error instanceof Error ? error.message : "unknown error",
      };
    }
  }

  return {
    name: "documenso",

    async createSigningRequest(subject: SigningSubject): Promise<SigningRequest> {
      if (!subject.contractPdf) {
        // The admin uploads the prepared PDF; without it there is nothing to
        // sign, and inventing one would be worse than refusing.
        return { status: "failed", reason: "no contract PDF was supplied" };
      }
      if (!subject.signerEmail) {
        return { status: "failed", reason: "the investor has no email on file" };
      }

      const form = new FormData();
      form.append(
        "payload",
        JSON.stringify({
          type: "DOCUMENT",
          title: subject.documentName,
          recipients: [
            {
              email: subject.signerEmail,
              name: subject.signerName ?? subject.signerEmail,
              role: "SIGNER",
              fields: [SIGNATURE_FIELD],
            },
          ],
        })
      );
      form.append(
        "files",
        new Blob([subject.contractPdf.bytes as unknown as BlobPart], {
          type: "application/pdf",
        }),
        subject.contractPdf.fileName
      );

      const created = await call<CreateResponse>("/envelope/create", {
        method: "POST",
        body: form,
      });

      if (!created.ok) return { status: "failed", reason: created.reason };

      const envelopeId = created.data.id;
      if (!envelopeId) {
        return { status: "failed", reason: "create returned no envelope id" };
      }

      // Sending is a separate call: an envelope stays DRAFT until distributed.
      const sent = await call<DistributeResponse>("/envelope/distribute", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ envelopeId }),
      });

      if (!sent.ok) return { status: "failed", reason: sent.reason };

      const signingUrl = sent.data.recipients?.find(
        (recipient) => recipient.email === subject.signerEmail
      )?.signingUrl;

      if (!signingUrl) {
        return { status: "failed", reason: "distribute returned no signing URL" };
      }

      // PENDING, never signed: only the webhook may say otherwise.
      return { status: "pending", envelopeId, signingUrl };
    },

    async getSigningUrl(envelopeId: string): Promise<string | null> {
      const envelope = await call<EnvelopeResponse>(
        `/envelope/${encodeURIComponent(envelopeId)}`,
        { method: "GET" }
      );

      if (!envelope.ok) return null;
      return envelope.data.recipients?.[0]?.signingUrl ?? null;
    },

    async fetchSignedDocument(envelopeId: string): Promise<FetchSignedResult> {
      /**
       * THE ONE PIECE NOT CONFIRMED FROM THE DOCS. The download endpoint is not
       * described on the public pages (openapi.documenso.com renders its
       * reference client-side), so the path is read from
       * ESIGN_DOWNLOAD_PATH_TEMPLATE and only defaults to the shape the v2
       * envelope API uses elsewhere.
       *
       * The webhook is written so that a wrong guess here CANNOT lose a
       * signature: the request is still marked completed, the file simply stays
       * unattached, and the admin can retry. See app/api/esign/webhook.
       */
      const template =
        process.env.ESIGN_DOWNLOAD_PATH_TEMPLATE?.trim() ||
        "/envelope/{envelopeId}/download";
      const path = template.replace("{envelopeId}", encodeURIComponent(envelopeId));

      try {
        const response = await fetch(`${root}${path}`, { headers: authHeaders() });

        if (!response.ok) {
          return { ok: false, reason: `HTTP ${response.status} on ${path}` };
        }

        const contentType = response.headers.get("content-type") ?? "";

        // Some deployments answer with the bytes; others with a signed link.
        if (contentType.includes("application/json")) {
          const payload = (await response.json()) as { downloadUrl?: string };
          if (!payload.downloadUrl) {
            return { ok: false, reason: "download returned no URL" };
          }

          const file = await fetch(payload.downloadUrl);
          if (!file.ok) {
            return { ok: false, reason: `HTTP ${file.status} fetching the PDF` };
          }
          return {
            ok: true,
            artifacts: {
              document: {
                fileName: `${envelopeId}.pdf`,
                bytes: new Uint8Array(await file.arrayBuffer()),
              },
            },
          };
        }

        return {
          ok: true,
          artifacts: {
            document: {
              fileName: `${envelopeId}.pdf`,
              bytes: new Uint8Array(await response.arrayBuffer()),
            },
          },
        };
      } catch (error) {
        return {
          ok: false,
          reason: error instanceof Error ? error.message : "unknown error",
        };
      }
    },
  };
}

/** Spanish message for a vendor failure. The reason itself stays in the logs. */
export function esignFailureMessage(): string {
  return es.investmentOnboarding.errors.contractFailed;
}
