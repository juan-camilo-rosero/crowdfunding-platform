import type { EsignProvider, SigningRequest, SigningSubject } from "../types";

/**
 * Signature without a vendor.
 *
 * Resolves as signed straight away, on the SERVER. As with the identity mock,
 * nothing the browser sends influences the result — the client asks to sign,
 * and the server decides that it did.
 *
 * The placeholder file is a data: URL rather than a Storage object: the mock
 * must not need a bucket, a upload permission or a cleanup story to work, and
 * the real provider will replace the URL with its own signed PDF anyway.
 */
const PLACEHOLDER_CONTRACT =
  "data:text/plain;charset=utf-8," +
  encodeURIComponent(
    "Contrato de inversión — documento de prueba.\n\n" +
      "Este archivo es un marcador de posición generado por el proveedor de " +
      "firma en modo simulación. El contrato real lo emitirá el proveedor de " +
      "firma electrónica cuando se active."
  );

export function createMockEsignProvider(): EsignProvider {
  return {
    name: "mock",
    async createSigningRequest(subject: SigningSubject): Promise<SigningRequest> {
      return {
        status: "signed",
        // Recognisable in the database as not coming from a real provider.
        envelopeId: `mock-${subject.investorId}-${Date.now()}`,
        fileUrl: PLACEHOLDER_CONTRACT,
        signedAt: new Date().toISOString(),
      };
    },
  };
}
