import { describe, expect, it } from "vitest";
import {
  advances,
  DOCUMENSO_SECRET_HEADER,
  isAuthenticWebhook,
  parseWebhookEvent,
} from "./webhook-events";

const SECRET = "wh_secret_de_prueba";

describe("authenticating the webhook", () => {
  it("accepts the exact secret", () => {
    expect(isAuthenticWebhook(SECRET, SECRET)).toBe(true);
  });

  it("rejects a wrong secret", () => {
    expect(isAuthenticWebhook("otro", SECRET)).toBe(false);
  });

  it("rejects a MISSING header", () => {
    expect(isAuthenticWebhook(null, SECRET)).toBe(false);
    expect(isAuthenticWebhook(undefined, SECRET)).toBe(false);
  });

  it("rejects an empty header", () => {
    // Documenso sends an empty string when no secret is configured; accepting
    // it would accept anybody.
    expect(isAuthenticWebhook("", SECRET)).toBe(false);
  });

  it("rejects everything when WE have no secret configured", () => {
    // Failing open here would leave the endpoint unauthenticated.
    expect(isAuthenticWebhook(SECRET, undefined)).toBe(false);
    expect(isAuthenticWebhook(SECRET, "")).toBe(false);
  });

  it("does not accept a prefix or an extension of the secret", () => {
    expect(isAuthenticWebhook(SECRET.slice(0, -1), SECRET)).toBe(false);
    expect(isAuthenticWebhook(`${SECRET}x`, SECRET)).toBe(false);
  });

  it("compares secrets of different lengths without throwing", () => {
    // timingSafeEqual throws on unequal lengths; hashing first avoids leaking
    // the length through the difference between a throw and a false.
    expect(() => isAuthenticWebhook("x", SECRET)).not.toThrow();
    expect(isAuthenticWebhook("x", SECRET)).toBe(false);
  });

  it("uses the header Documenso actually sends", () => {
    // Verified against docs.documenso.com: a shared secret, not an HMAC.
    expect(DOCUMENSO_SECRET_HEADER).toBe("x-documenso-secret");
  });
});

const event = (name: string, payload: Record<string, unknown> = {}) =>
  parseWebhookEvent({
    event: name,
    createdAt: "2026-08-12T10:00:00.000Z",
    payload: { envelopeId: "envelope_abc", ...payload },
  });

describe("reading an event", () => {
  it("maps completion to completado", () => {
    expect(event("DOCUMENT_COMPLETED")).toEqual({
      externalDocumentId: "envelope_abc",
      status: "completado",
      declinedReason: null,
    });
  });

  it("maps the lifecycle events we act on", () => {
    expect(event("DOCUMENT_SENT")?.status).toBe("enviado");
    expect(event("DOCUMENT_OPENED")?.status).toBe("entregado");
    expect(event("DOCUMENT_SIGNED")?.status).toBe("entregado");
    expect(event("DOCUMENT_REJECTED")?.status).toBe("rechazado");
    expect(event("DOCUMENT_CANCELLED")?.status).toBe("anulado");
    expect(event("RECIPIENT_EXPIRED")?.status).toBe("expirado");
  });

  it("carries the rejection reason, from either place it may appear", () => {
    expect(event("DOCUMENT_REJECTED", { rejectionReason: "no estoy de acuerdo" })
      ?.declinedReason).toBe("no estoy de acuerdo");

    expect(
      event("DOCUMENT_REJECTED", {
        recipients: [{ rejectionReason: "desde el recipient" }],
      })?.declinedReason
    ).toBe("desde el recipient");
  });

  it("ignores an event type we do not act on", () => {
    // Template events are legitimate; they just say nothing about a contract.
    expect(event("TEMPLATE_CREATED")).toBeNull();
    expect(event("DOCUMENT_REMINDER_SENT")).toBeNull();
  });

  it("ignores a body with no envelope id", () => {
    expect(parseWebhookEvent({ event: "DOCUMENT_COMPLETED", payload: {} })).toBeNull();
  });

  it("ignores junk instead of throwing", () => {
    expect(parseWebhookEvent(null)).toBeNull();
    expect(parseWebhookEvent("hola")).toBeNull();
    expect(parseWebhookEvent({})).toBeNull();
  });

  it("accepts the legacy numeric id, so an older deployment still works", () => {
    const parsed = parseWebhookEvent({
      event: "DOCUMENT_COMPLETED",
      payload: { id: 1234 },
    });

    expect(parsed?.externalDocumentId).toBe("1234");
  });
});

describe("only forward transitions apply", () => {
  it("advances through the lifecycle", () => {
    expect(advances("enviado", "entregado")).toBe(true);
    expect(advances("entregado", "completado")).toBe(true);
  });

  it("makes a REPEATED event a no-op", () => {
    // Documenso retries; a replay must not re-file a contract.
    expect(advances("completado", "completado")).toBe(false);
    expect(advances("enviado", "enviado")).toBe(false);
  });

  it("refuses to walk a completed signature backwards", () => {
    // A late DOCUMENT_OPENED must not undo a completion that already landed.
    expect(advances("completado", "entregado")).toBe(false);
    expect(advances("completado", "enviado")).toBe(false);
  });

  it("does not let one terminal state overwrite another", () => {
    expect(advances("completado", "rechazado")).toBe(false);
    expect(advances("rechazado", "completado")).toBe(false);
  });
});
