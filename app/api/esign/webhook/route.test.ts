// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const applySigningEvent = vi.fn();
const attachSignedDocument = vi.fn();
const fetchSignedDocument = vi.fn();

vi.mock("@/lib/esign/signing-requests", () => ({
  applySigningEvent: (event: unknown) => applySigningEvent(event),
  attachSignedDocument: (input: unknown) => attachSignedDocument(input),
}));
vi.mock("@/lib/esign/provider", () => ({
  getEsignProvider: () => ({
    name: "documenso",
    createSigningRequest: vi.fn(),
    fetchSignedDocument: (id: string) => fetchSignedDocument(id),
  }),
}));

const { POST } = await import("./route");

const SECRET = "wh_secret_de_prueba";

const ROW = {
  id: "sr-1",
  investorId: "inv-1",
  projectId: null,
  externalDocumentId: "envelope_abc",
  status: "completado",
  signedDocumentId: null,
  declinedReason: null,
};

const post = (
  body: unknown,
  headers: Record<string, string> = { "x-documenso-secret": SECRET }
) =>
  POST(
    new Request("http://localhost/api/esign/webhook", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    })
  );

const completed = {
  event: "DOCUMENT_COMPLETED",
  payload: { envelopeId: "envelope_abc" },
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ESIGN_WEBHOOK_SECRET = SECRET;

  applySigningEvent.mockResolvedValue({
    outcome: "applied",
    row: ROW,
    status: "completado",
  });
  fetchSignedDocument.mockResolvedValue({
    ok: true,
    artifacts: {
      document: { fileName: "contrato.pdf", bytes: new Uint8Array([1, 2, 3]) },
    },
  });
  attachSignedDocument.mockResolvedValue({ ok: true, documentId: "doc-1" });
});

/** Barrier one. Nothing is written without a matching secret. */
describe("authenticity", () => {
  it("refuses a request with NO secret header", async () => {
    const response = await post(completed, {});

    expect(response.status).toBe(401);
    expect(applySigningEvent).not.toHaveBeenCalled();
    expect(attachSignedDocument).not.toHaveBeenCalled();
  });

  it("refuses a WRONG secret", async () => {
    const response = await post(completed, { "x-documenso-secret": "forjado" });

    expect(response.status).toBe(401);
    expect(applySigningEvent).not.toHaveBeenCalled();
  });

  it("refuses everything when the server has no secret configured", async () => {
    delete process.env.ESIGN_WEBHOOK_SECRET;

    // Failing open would leave the endpoint unauthenticated.
    expect((await post(completed)).status).toBe(401);
    expect(applySigningEvent).not.toHaveBeenCalled();
  });

  it("accepts the right secret", async () => {
    expect((await post(completed)).status).toBe(200);
    expect(applySigningEvent).toHaveBeenCalled();
  });

  it("says nothing useful in the refusal", async () => {
    const payload = await (await post(completed, {})).json();
    // A detailed refusal is a probing aid.
    expect(payload).toEqual({ error: "unauthorized" });
  });
});

/** Barrier two. An envelope we did not create is not ours to act on. */
describe("document ↔ investor mapping", () => {
  it("ignores an event for an UNKNOWN envelope, without filing anything", async () => {
    applySigningEvent.mockResolvedValue({
      outcome: "ignored",
      reason: "unknown-document",
    });

    const response = await post({
      event: "DOCUMENT_COMPLETED",
      payload: { envelopeId: "envelope_de_otro" },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ applied: false });
    // Never attach a signature to an investor who did not start one.
    expect(attachSignedDocument).not.toHaveBeenCalled();
    expect(fetchSignedDocument).not.toHaveBeenCalled();
  });

  it("matches by the envelope id from the payload", async () => {
    await post(completed);

    expect(applySigningEvent).toHaveBeenCalledWith(
      expect.objectContaining({ externalDocumentId: "envelope_abc" })
    );
  });
});

/** Barrier three. Retries are expected. */
describe("idempotency", () => {
  it("does not re-file the contract on a repeated event", async () => {
    applySigningEvent.mockResolvedValue({ outcome: "ignored", reason: "not-newer" });

    const response = await post(completed);

    expect(response.status).toBe(200);
    expect(attachSignedDocument).not.toHaveBeenCalled();
  });

  it("acknowledges rather than making Documenso retry forever", async () => {
    applySigningEvent.mockResolvedValue({ outcome: "ignored", reason: "not-newer" });

    // A non-2xx would have the vendor replay an event that will never apply.
    expect((await post(completed)).status).toBe(200);
  });
});

describe("a completed signature", () => {
  it("downloads the PDF and files it", async () => {
    const response = await post(completed);

    expect(fetchSignedDocument).toHaveBeenCalledWith("envelope_abc");
    expect(attachSignedDocument).toHaveBeenCalledWith(
      expect.objectContaining({ row: ROW })
    );
    expect(await response.json()).toMatchObject({ stored: true });
  });

  it("keeps the completion even when the download fails", async () => {
    fetchSignedDocument.mockResolvedValue({ ok: false, reason: "HTTP 404" });

    const response = await post(completed);

    // The signature is real and recorded; only the file is missing. Answering
    // 500 would replay the whole event and risk losing the completion.
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ applied: true, stored: false });
    expect(attachSignedDocument).not.toHaveBeenCalled();
  });

  it("keeps the completion even when filing fails", async () => {
    attachSignedDocument.mockResolvedValue({ ok: false, reason: "insert down" });

    const response = await post(completed);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ applied: true, stored: false });
  });
});

describe("the unhappy endings", () => {
  it("records a rejection and files NO contract", async () => {
    applySigningEvent.mockResolvedValue({
      outcome: "applied",
      row: { ...ROW, status: "rechazado" },
      status: "rechazado",
    });

    const response = await post({
      event: "DOCUMENT_REJECTED",
      payload: { envelopeId: "envelope_abc", rejectionReason: "no acepto" },
    });

    expect(await response.json()).toMatchObject({ applied: true, status: "rechazado" });
    expect(attachSignedDocument).not.toHaveBeenCalled();
    expect(fetchSignedDocument).not.toHaveBeenCalled();
  });

  it("records an expiry and files NO contract", async () => {
    applySigningEvent.mockResolvedValue({
      outcome: "applied",
      row: { ...ROW, status: "expirado" },
      status: "expirado",
    });

    await post({ event: "RECIPIENT_EXPIRED", payload: { envelopeId: "envelope_abc" } });

    expect(attachSignedDocument).not.toHaveBeenCalled();
  });

  it("records a cancellation and files NO contract", async () => {
    applySigningEvent.mockResolvedValue({
      outcome: "applied",
      row: { ...ROW, status: "anulado" },
      status: "anulado",
    });

    await post({ event: "DOCUMENT_CANCELLED", payload: { envelopeId: "envelope_abc" } });

    expect(attachSignedDocument).not.toHaveBeenCalled();
  });
});

describe("bodies it will not act on", () => {
  it("acknowledges an event type it does not handle", async () => {
    const response = await post({
      event: "TEMPLATE_CREATED",
      payload: { envelopeId: "envelope_abc" },
    });

    expect(response.status).toBe(200);
    expect(applySigningEvent).not.toHaveBeenCalled();
  });

  it("rejects a body that is not JSON", async () => {
    const response = await POST(
      new Request("http://localhost/api/esign/webhook", {
        method: "POST",
        headers: { "x-documenso-secret": SECRET },
        body: "no soy json",
      })
    );

    expect(response.status).toBe(400);
    expect(applySigningEvent).not.toHaveBeenCalled();
  });
});
