import type { IdentityProvider, VerificationStart } from "../types";

/**
 * Truora adapter — NOT IMPLEMENTED YET. The slot, with the shape it will fill.
 *
 * integrations.md is explicit that Truora recommends their Web Integration over
 * calling validator endpoints directly, so this will:
 *
 *  1. POST to Truora with TRUORA_API_KEY / TRUORA_ACCOUNT_ID to mint a web
 *     token for THIS user (one token per user, per process).
 *  2. Return `pending` with the flow URL. The user does Document ID + Face
 *     Match there; for Colombia that means country=CO,
 *     document_type=national-id and user_authorized=true.
 *  3. The result arrives at /api/truora/webhook, which calls the SAME
 *     recordVerificationOutcome as the mock — so there is still exactly one
 *     place a user can become verified.
 *
 * Left unimplemented deliberately: the endpoint and field names must be checked
 * against dev.truora.com before writing them, and guessing them here would look
 * finished while being wrong.
 */
export function createTruoraIdentityProvider(): IdentityProvider {
  return {
    name: "truora",
    async startVerification(): Promise<VerificationStart> {
      return {
        status: "failed",
        reason: "the Truora adapter is not implemented yet",
      };
    },
  };
}
