import type { EsignProvider, SigningRequest } from "../types";

/**
 * Documenso adapter — NOT IMPLEMENTED YET. The slot, with the shape it will fill.
 *
 * It will POST the contract template plus the signer to ESIGN_PROVIDER_URL with
 * ESIGN_API_KEY, return `pending` with the signing URL, and let
 * /api/esign/webhook call the SAME recordSignedContract the mock uses — so
 * there stays exactly one place a contract can become signed.
 *
 * Left unimplemented deliberately: the payload shape depends on the deployment
 * (Documenso is self-hostable and its API differs by version), and guessing it
 * here would look finished while being wrong.
 */
export function createDocumensoEsignProvider(): EsignProvider {
  return {
    name: "documenso",
    async createSigningRequest(): Promise<SigningRequest> {
      return {
        status: "failed",
        reason: "the Documenso adapter is not implemented yet",
      };
    },
  };
}
